#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectWebAnalyticsProjection } from '../../src/analytics/schema.mjs';

const COMPILER_VERSION = '2.0.0';
const RANGE_DAYS = { '1d': 1, '7d': 7, '30d': 30 };
const EXPECTED_GROUPS = {
  hourly: 'datetimeHour',
  country: 'clientCountryName',
  status: 'edgeResponseStatus',
  cache: 'cacheStatus',
};
const METRIC_FIELDS = new Set(['requests', 'edge_response_bytes', 'visits']);
const REGISTRY_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'metric-registry.v2.json');

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TypeError(`invalid UTC date: ${value}`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const dates = [];
  for (let value = start; value <= end; value = addDays(value, 1)) dates.push(value);
  return dates;
}

function safeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

async function filesUnder(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) output.push(path);
    }
  }
  await walk(root);
  return output.sort();
}

async function loadRegistry() {
  const value = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  if (value.version !== 'web-analytics-metrics-v2') throw new TypeError('unsupported metric registry version');
  if (!Array.isArray(value.archiveSchemaVersions) || !Array.isArray(value.queryVersions)) throw new TypeError('metric registry is malformed');
  if (value.totalsGroup !== 'hourly' || value.strictCacheHit?.denominator !== 'all_cache_status_requests') throw new TypeError('metric registry semantics are unsupported');
  return value;
}

async function verifyAndRead(path) {
  const sidecar = await readFile(`${path}.sha256`, 'utf8');
  const match = sidecar.match(/^([0-9a-f]{64})  ([^\r\n]+)\r?\n?$/);
  if (!match || match[2] !== basename(path)) throw new TypeError(`invalid checksum sidecar: ${basename(path)}`);
  const compressed = await readFile(path);
  const actual = createHash('sha256').update(compressed).digest('hex');
  if (actual !== match[1]) throw new TypeError(`checksum mismatch: ${basename(path)}`);
  let records;
  try {
    records = gunzipSync(compressed).toString('utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    throw new TypeError(`archive parse failure: ${basename(path)}`);
  }
  return { digest: actual, records };
}

function validateMetadata(value, expectedDate, site, registry) {
  if (!value || Array.isArray(value) || value.record_type !== 'metadata') throw new TypeError(`missing metadata record: ${expectedDate}`);
  if (!registry.archiveSchemaVersions.includes(value.archive_schema_version)) throw new TypeError(`unsupported archive schema version: ${expectedDate}`);
  if (!registry.queryVersions.includes(value.query_version)) throw new TypeError(`unsupported query version: ${expectedDate}`);
  if (value.site !== site || value.dataset !== 'httpRequestsAdaptiveGroups') throw new TypeError(`archive identity mismatch: ${expectedDate}`);
  if (value.source_authority !== 'Cloudflare edge aggregate analytics' || value.fidelity !== 'aggregate_not_raw_request_logs') throw new TypeError(`archive source metadata mismatch: ${expectedDate}`);
  if (value.period_start_utc !== `${expectedDate}T00:00:00Z` || value.period_end_utc !== `${addDays(expectedDate, 1)}T00:00:00Z`) throw new TypeError(`archive period mismatch: ${expectedDate}`);
  if (new Date(value.collected_at_utc).toISOString().slice(0, 10) < addDays(expectedDate, 1)) throw new TypeError(`archive was collected before period close: ${expectedDate}`);
  if (!Array.isArray(value.groups) || value.groups.length !== Object.keys(EXPECTED_GROUPS).length) throw new TypeError(`archive group registry mismatch: ${expectedDate}`);
  const groupMap = new Map(value.groups.map((group) => [group.name, group]));
  for (const [group, dimension] of Object.entries(EXPECTED_GROUPS)) {
    const entry = groupMap.get(group);
    if (!entry || entry.dimension !== dimension || JSON.stringify(entry.metrics) !== JSON.stringify(['requests', 'edge_response_bytes', 'visits'])) throw new TypeError(`archive group contract mismatch: ${expectedDate}/${group}`);
  }
  return value;
}

function summarizeDay(records, expectedDate, site, registry) {
  const metadata = validateMetadata(records[0], expectedDate, site, registry);
  const rows = records.slice(1);
  if (metadata.row_count !== rows.length) throw new TypeError(`archive row count mismatch: ${expectedDate}`);
  const groups = Object.fromEntries(Object.keys(EXPECTED_GROUPS).map((group) => [group, []]));
  for (const [index, row] of rows.entries()) {
    if (!row || Array.isArray(row) || row.record_type !== 'aggregate' || !(row.group in EXPECTED_GROUPS)) throw new TypeError(`invalid aggregate row: ${expectedDate}/${index}`);
    const dimension = EXPECTED_GROUPS[row.group];
    if (!row.dimensions || Object.keys(row.dimensions).length !== 1 || !(dimension in row.dimensions)) throw new TypeError(`aggregate dimension mismatch: ${expectedDate}/${row.group}`);
    if (!row.metrics || Object.keys(row.metrics).some((key) => !METRIC_FIELDS.has(key)) || Object.keys(row.metrics).length !== METRIC_FIELDS.size) throw new TypeError(`aggregate metric shape mismatch: ${expectedDate}/${row.group}`);
    const metrics = {
      requests: safeInteger(row.metrics.requests, 'requests'),
      edgeResponseBytes: safeInteger(row.metrics.edge_response_bytes, 'edge_response_bytes'),
      visits: safeInteger(row.metrics.visits, 'visits'),
    };
    groups[row.group].push({ dimension: row.dimensions[dimension], ...metrics });
  }

  const requests = groups.hourly.reduce((sum, row) => sum + row.requests, 0);
  const edgeResponseBytes = groups.hourly.reduce((sum, row) => sum + row.edgeResponseBytes, 0);
  const visits = groups.hourly.reduce((sum, row) => sum + row.visits, 0);
  for (const name of ['country', 'status', 'cache']) {
    if (groups[name].reduce((sum, row) => sum + row.requests, 0) !== requests) throw new TypeError(`${name} requests do not reconcile: ${expectedDate}`);
    if (groups[name].reduce((sum, row) => sum + row.edgeResponseBytes, 0) !== edgeResponseBytes) throw new TypeError(`${name} bytes do not reconcile: ${expectedDate}`);
    if (groups[name].reduce((sum, row) => sum + row.visits, 0) !== visits) throw new TypeError(`${name} visits do not reconcile: ${expectedDate}`);
  }
  if ((requests === 0) !== Boolean(metadata.zero_traffic)) throw new TypeError(`zero-traffic marker mismatch: ${expectedDate}`);

  return {
    date: expectedDate,
    collectedAt: new Date(metadata.collected_at_utc).toISOString(),
    archiveSchema: metadata.archive_schema_version,
    queryVersion: metadata.query_version,
    requests,
    edgeResponseBytes,
    visits,
    countries: groups.country.map((row) => ({ code: row.dimension, requests: row.requests, edgeResponseBytes: row.edgeResponseBytes })),
    statuses: groups.status.map((row) => ({ status: row.dimension, requests: row.requests })),
    cacheStatuses: groups.cache.map((row) => ({ status: String(row.dimension).toLowerCase(), requests: row.requests, edgeResponseBytes: row.edgeResponseBytes })),
  };
}

function aggregateRows(days, field, key, sort) {
  const rows = new Map();
  for (const day of days) {
    for (const item of day[field]) {
      const id = item[key];
      const current = rows.get(id) || { [key]: id, requests: 0, ...(Object.hasOwn(item, 'edgeResponseBytes') ? { edgeResponseBytes: 0 } : {}) };
      current.requests += item.requests;
      if (Object.hasOwn(item, 'edgeResponseBytes')) current.edgeResponseBytes += item.edgeResponseBytes;
      rows.set(id, current);
    }
  }
  return [...rows.values()].sort(sort);
}

function statusClass(value) {
  const number = Number(value);
  const family = Number.isInteger(number) ? Math.floor(number / 100) : 0;
  return family >= 1 && family <= 5 ? `${family}xx` : 'other';
}

function buildRange(id, throughDate, archiveStart, daysByDate, registry) {
  const daysCalendar = RANGE_DAYS[id];
  const startDate = addDays(throughDate, -(daysCalendar - 1));
  const dates = dateRange(startDate, throughDate);
  const daily = dates.map((date) => {
    if (date < archiveStart) return { date, state: 'not_retained', requests: null, edgeResponseBytes: null, visits: null };
    const day = daysByDate.get(date);
    return day
      ? { date, state: 'present', requests: day.requests, edgeResponseBytes: day.edgeResponseBytes, visits: day.visits }
      : { date, state: 'missing', requests: null, edgeResponseBytes: null, visits: null };
  });
  const present = dates.map((date) => daysByDate.get(date)).filter(Boolean);
  const requests = present.reduce((sum, day) => sum + day.requests, 0);
  const edgeResponseBytes = present.reduce((sum, day) => sum + day.edgeResponseBytes, 0);
  const visits = present.reduce((sum, day) => sum + day.visits, 0);
  const cacheStatuses = aggregateRows(present, 'cacheStatuses', 'status', (a, b) => b.requests - a.requests || a.status.localeCompare(b.status));
  const hitStatuses = new Set(registry.strictCacheHit.numeratorStatuses);
  const cacheHitRequests = cacheStatuses.filter((row) => hitStatuses.has(row.status)).reduce((sum, row) => sum + row.requests, 0);
  const cacheEligibleRequests = cacheStatuses.reduce((sum, row) => sum + row.requests, 0);
  const statusRows = [];
  for (const day of present) for (const row of day.statuses) statusRows.push({ class: statusClass(row.status), requests: row.requests });
  const statusMap = new Map();
  for (const row of statusRows) statusMap.set(row.class, (statusMap.get(row.class) || 0) + row.requests);
  const statusClasses = [...statusMap.entries()].map(([klass, count]) => ({ class: klass, requests: count })).sort((a, b) => a.class.localeCompare(b.class));
  return {
    id, startDate, endDate: throughDate, daysCalendar,
    daysObserved: daily.filter((day) => day.state === 'present').length,
    daysMissing: daily.filter((day) => day.state === 'missing').length,
    daysOutsideArchive: daily.filter((day) => day.state === 'not_retained').length,
    totals: {
      requests,
      edgeResponseBytes,
      visits,
      cacheHitRequests,
      cacheEligibleRequests,
      strictCacheHitRatio: cacheEligibleRequests ? cacheHitRequests / cacheEligibleRequests : null,
    },
    daily,
    countries: aggregateRows(present, 'countries', 'code', (a, b) => b.requests - a.requests || a.code.localeCompare(b.code)),
    statusClasses,
    cacheStatuses,
  };
}

export async function compileWebAnalyticsArchive({ archiveRoot, outputPath, site = 'kungfuclan.com', displayName = site, throughDate }) {
  if (!archiveRoot || !outputPath || !throughDate) throw new TypeError('archiveRoot, outputPath, and throughDate are required');
  addDays(throughDate, 0);
  const registry = await loadRegistry();
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-analytics-(\\d{4}-\\d{2}-\\d{2})\\.ndjson\\.gz$`);
  const candidates = (await filesUnder(archiveRoot)).flatMap((path) => {
    const match = basename(path).match(pattern);
    return match && match[1] <= throughDate ? [{ path, date: match[1] }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!candidates.length) throw new TypeError('no compatible archive periods found');
  const archiveStart = candidates[0].date;
  const dataThrough = candidates.at(-1).date;
  const projectionStart = addDays(throughDate, -29);
  const selected = candidates.filter((item) => item.date >= projectionStart || item.date === archiveStart || item.date === dataThrough);
  const daysByDate = new Map();
  const digests = [];
  const collectedAt = [];
  let archiveSchema;
  let queryVersion;
  for (const candidate of selected) {
    const source = await verifyAndRead(candidate.path);
    const day = summarizeDay(source.records, candidate.date, site, registry);
    if (daysByDate.has(candidate.date)) throw new TypeError(`duplicate archive period: ${candidate.date}`);
    if (archiveSchema !== undefined && archiveSchema !== day.archiveSchema) throw new TypeError('mixed archive schema versions are unsupported');
    if (queryVersion !== undefined && queryVersion !== day.queryVersion) throw new TypeError('mixed query versions are unsupported');
    archiveSchema = day.archiveSchema;
    queryVersion = day.queryVersion;
    daysByDate.set(candidate.date, day);
    digests.push(source.digest);
    collectedAt.push(day.collectedAt);
  }
  const missingPeriods = dateRange(projectionStart < archiveStart ? archiveStart : projectionStart, throughDate).filter((date) => !daysByDate.has(date));
  const ranges = Object.fromEntries(Object.keys(RANGE_DAYS).map((id) => [id, buildRange(id, throughDate, archiveStart, daysByDate, registry)]));
  const value = projectWebAnalyticsProjection({
    schemaVersion: 'web-analytics-projection-v2',
    dataKind: 'real',
    generatedAt: collectedAt.sort().at(-1),
    subject: { id: site, label: displayName, domain: 'web' },
    source: { authority: 'Cloudflare edge aggregate analytics', fidelity: 'aggregate_not_raw_request_logs' },
    versions: { archiveSchema, query: queryVersion, metricRegistry: registry.version, compiler: COMPILER_VERSION },
    coverage: {
      archiveStart,
      expectedThrough: throughDate,
      dataThrough,
      freshness: dataThrough === throughDate ? 'fresh' : 'stale',
      acceptedPeriods: selected.length,
      rejectedPeriods: 0,
      missingPeriods,
      outsideArchivePeriods: ranges['30d'].daysOutsideArchive,
      inputSha256s: digests,
    },
    ranges,
  });
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { mode: 0o644 });
  await rename(temporary, outputPath);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments must be --key value pairs');
    args[key.slice(2)] = value;
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const projection = await compileWebAnalyticsArchive({
    archiveRoot: args['archive-root'],
    outputPath: args.output,
    site: args.site || 'kungfuclan.com',
    displayName: args['display-name'] || args.site || 'Kung Fu Clan',
    throughDate: args.through,
  });
  console.log(JSON.stringify({
    status: 'ok',
    subject: projection.subject.id,
    through: projection.coverage.expectedThrough,
    acceptedPeriods: projection.coverage.acceptedPeriods,
    missingPeriods: projection.coverage.missingPeriods.length,
  }));
}
