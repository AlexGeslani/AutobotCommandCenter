export const PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION = 'web-analytics-projection-v2';
export const WEB_ANALYTICS_MAX_BYTES = 256 * 1024;
export const WEB_ANALYTICS_FIXTURE_NOTICE = 'ILLUSTRATIVE FIXTURE — NOT CURRENT KUNGFUCLAN.COM ANALYTICS';

const TOP_FIELDS = new Set(['schemaVersion', 'dataKind', 'generatedAt', 'subject', 'source', 'versions', 'coverage', 'ranges', 'notice']);
const SUBJECT_FIELDS = new Set(['id', 'label', 'domain']);
const SOURCE_FIELDS = new Set(['authority', 'fidelity']);
const VERSION_FIELDS = new Set(['archiveSchema', 'query', 'metricRegistry', 'compiler']);
const COVERAGE_FIELDS = new Set(['archiveStart', 'expectedThrough', 'dataThrough', 'freshness', 'acceptedPeriods', 'rejectedPeriods', 'missingPeriods', 'outsideArchivePeriods', 'inputSha256s']);
const RANGE_FIELDS = new Set(['id', 'startDate', 'endDate', 'daysCalendar', 'daysObserved', 'daysMissing', 'daysOutsideArchive', 'totals', 'daily', 'countries', 'statusClasses', 'cacheStatuses']);
const TOTAL_FIELDS = new Set(['requests', 'edgeResponseBytes', 'visits', 'cacheHitRequests', 'cacheEligibleRequests', 'strictCacheHitRatio']);
const DAILY_FIELDS = new Set(['date', 'state', 'requests', 'edgeResponseBytes', 'visits']);
const COUNTRY_FIELDS = new Set(['code', 'requests', 'edgeResponseBytes']);
const STATUS_FIELDS = new Set(['class', 'requests']);
const CACHE_FIELDS = new Set(['status', 'requests', 'edgeResponseBytes']);

const RANGE_DAYS = { '1d': 1, '7d': 7, '30d': 30 };
const DATA_KINDS = new Set(['real', 'illustrative_fixture']);
const DAY_STATES = new Set(['present', 'missing', 'not_retained']);
const FRESHNESS_STATES = new Set(['fresh', 'stale']);
const QUERY_VERSIONS = new Set(['httpRequestsAdaptiveGroups-safe-v1']);
const METRIC_REGISTRY_VERSIONS = new Set(['web-analytics-metrics-v2']);
const REAL_SUBJECTS = new Set(['kungfuclan.com', 'alexgeslani.com']);

function assertPlainObject(value, name) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
}

function assertAllowedKeys(value, allowed, name) {
  assertPlainObject(value, name);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
}

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function assertTimestamp(value, name) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError(`${name} must be a canonical UTC ISO timestamp`);
  }
  return value;
}

function assertDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`${name} must be a real UTC date`);
  return value;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function assertInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

function projectDaily(value, index, priorDate) {
  assertAllowedKeys(value, DAILY_FIELDS, `daily[${index}]`);
  const date = assertDate(value.date, `daily[${index}].date`);
  if (priorDate && date !== addDays(priorDate, 1)) throw new TypeError('daily dates must be contiguous ascending UTC dates');
  if (!DAY_STATES.has(value.state)) throw new TypeError(`daily[${index}].state is not allowlisted`);
  if (value.state === 'present') {
    assertInteger(value.requests, `daily[${index}].requests`);
    assertInteger(value.edgeResponseBytes, `daily[${index}].edgeResponseBytes`);
    assertInteger(value.visits, `daily[${index}].visits`);
  } else if (value.requests !== null || value.edgeResponseBytes !== null || value.visits !== null) {
    throw new TypeError('missing and not-retained days must use null metrics');
  }
  return { date, state: value.state, requests: value.requests, edgeResponseBytes: value.edgeResponseBytes, visits: value.visits };
}

function projectTotals(value) {
  assertAllowedKeys(value, TOTAL_FIELDS, 'range.totals');
  const requests = assertInteger(value.requests, 'range.totals.requests');
  const edgeResponseBytes = assertInteger(value.edgeResponseBytes, 'range.totals.edgeResponseBytes');
  const visits = assertInteger(value.visits, 'range.totals.visits');
  const cacheHitRequests = assertInteger(value.cacheHitRequests, 'range.totals.cacheHitRequests');
  const cacheEligibleRequests = assertInteger(value.cacheEligibleRequests, 'range.totals.cacheEligibleRequests');
  if (cacheHitRequests > cacheEligibleRequests) throw new TypeError('cache hit requests cannot exceed eligible requests');
  let strictCacheHitRatio = value.strictCacheHitRatio;
  if (cacheEligibleRequests === 0) {
    if (strictCacheHitRatio !== null) throw new TypeError('cache ratio must be null for a zero denominator');
  } else {
    if (!Number.isFinite(strictCacheHitRatio) || strictCacheHitRatio < 0 || strictCacheHitRatio > 1) throw new TypeError('cache ratio must be 0..1');
    if (Math.abs(strictCacheHitRatio - (cacheHitRequests / cacheEligibleRequests)) > 1e-12) throw new TypeError('cache ratio must be recomputed from its facts');
  }
  return { requests, edgeResponseBytes, visits, cacheHitRequests, cacheEligibleRequests, strictCacheHitRatio };
}

function projectCountries(values, totals) {
  if (!Array.isArray(values) || values.length > 250) throw new TypeError('range.countries must be a bounded array');
  const seen = new Set();
  const projected = values.map((value, index) => {
    assertAllowedKeys(value, COUNTRY_FIELDS, `countries[${index}]`);
    if (typeof value.code !== 'string' || !(/^[A-Z]{2}$/.test(value.code) || value.code === 'T1') || seen.has(value.code)) throw new TypeError('country code must be a unique ISO alpha-2 or allowlisted provider region code');
    seen.add(value.code);
    return { code: value.code, requests: assertInteger(value.requests, 'country.requests'), edgeResponseBytes: assertInteger(value.edgeResponseBytes, 'country.edgeResponseBytes') };
  });
  if (projected.reduce((sum, row) => sum + row.requests, 0) !== totals.requests) throw new TypeError('country requests must reconcile to range totals');
  if (projected.reduce((sum, row) => sum + row.edgeResponseBytes, 0) !== totals.edgeResponseBytes) throw new TypeError('country bytes must reconcile to range totals');
  return projected;
}

function projectStatusClasses(values, totals) {
  if (!Array.isArray(values) || values.length > 6) throw new TypeError('range.statusClasses must be a bounded array');
  const seen = new Set();
  const projected = values.map((value, index) => {
    assertAllowedKeys(value, STATUS_FIELDS, `statusClasses[${index}]`);
    if (typeof value.class !== 'string' || !/^[1-5]xx$|^other$/.test(value.class) || seen.has(value.class)) throw new TypeError('status class must be unique and allowlisted');
    seen.add(value.class);
    return { class: value.class, requests: assertInteger(value.requests, 'statusClass.requests') };
  });
  if (projected.reduce((sum, row) => sum + row.requests, 0) !== totals.requests) throw new TypeError('status-class requests must reconcile to range totals');
  return projected;
}

function projectCacheStatuses(values, totals) {
  if (!Array.isArray(values) || values.length > 32) throw new TypeError('range.cacheStatuses must be a bounded array');
  const seen = new Set();
  const projected = values.map((value, index) => {
    assertAllowedKeys(value, CACHE_FIELDS, `cacheStatuses[${index}]`);
    if (typeof value.status !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value.status) || seen.has(value.status)) throw new TypeError('cache status must be a unique bounded identifier');
    seen.add(value.status);
    return { status: value.status, requests: assertInteger(value.requests, 'cacheStatus.requests'), edgeResponseBytes: assertInteger(value.edgeResponseBytes, 'cacheStatus.edgeResponseBytes') };
  });
  if (projected.reduce((sum, row) => sum + row.requests, 0) !== totals.cacheEligibleRequests) throw new TypeError('cache-status requests must reconcile to the cache denominator');
  return projected;
}

function projectRange(value, key) {
  assertAllowedKeys(value, RANGE_FIELDS, `ranges.${key}`);
  if (!(key in RANGE_DAYS) || value.id !== key) throw new TypeError('range id is not allowlisted');
  const daysCalendar = RANGE_DAYS[key];
  if (value.daysCalendar !== daysCalendar) throw new TypeError('range calendar size is not canonical');
  if (!Array.isArray(value.daily) || value.daily.length !== daysCalendar) throw new TypeError('range.daily must cover its complete calendar window');
  const daily = [];
  for (let index = 0; index < value.daily.length; index += 1) daily.push(projectDaily(value.daily[index], index, daily.at(-1)?.date));
  const startDate = assertDate(value.startDate, 'range.startDate');
  const endDate = assertDate(value.endDate, 'range.endDate');
  if (daily[0].date !== startDate || daily.at(-1).date !== endDate) throw new TypeError('range dates must match its daily series');
  const daysObserved = daily.filter((day) => day.state === 'present').length;
  const daysMissing = daily.filter((day) => day.state === 'missing').length;
  const daysOutsideArchive = daily.filter((day) => day.state === 'not_retained').length;
  if (value.daysObserved !== daysObserved || value.daysMissing !== daysMissing || value.daysOutsideArchive !== daysOutsideArchive) throw new TypeError('range coverage counts must match daily states');
  const totals = projectTotals(value.totals);
  if (daily.reduce((sum, day) => sum + (day.requests ?? 0), 0) !== totals.requests) throw new TypeError('daily requests must reconcile to range totals');
  if (daily.reduce((sum, day) => sum + (day.edgeResponseBytes ?? 0), 0) !== totals.edgeResponseBytes) throw new TypeError('daily bytes must reconcile to range totals');
  if (daily.reduce((sum, day) => sum + (day.visits ?? 0), 0) !== totals.visits) throw new TypeError('daily visits must reconcile to range totals');
  return {
    id: key, startDate, endDate, daysCalendar, daysObserved, daysMissing, daysOutsideArchive, totals, daily,
    countries: projectCountries(value.countries, totals),
    statusClasses: projectStatusClasses(value.statusClasses, totals),
    cacheStatuses: projectCacheStatuses(value.cacheStatuses, totals),
  };
}

function projectCoverage(value) {
  assertAllowedKeys(value, COVERAGE_FIELDS, 'coverage');
  const archiveStart = assertDate(value.archiveStart, 'coverage.archiveStart');
  const expectedThrough = assertDate(value.expectedThrough, 'coverage.expectedThrough');
  const dataThrough = assertDate(value.dataThrough, 'coverage.dataThrough');
  if (dataThrough > expectedThrough || archiveStart > dataThrough) throw new TypeError('coverage dates are inconsistent');
  if (!FRESHNESS_STATES.has(value.freshness)) throw new TypeError('coverage.freshness is not allowlisted');
  if ((dataThrough === expectedThrough) !== (value.freshness === 'fresh')) throw new TypeError('coverage freshness must match expected-through state');
  const acceptedPeriods = assertInteger(value.acceptedPeriods, 'coverage.acceptedPeriods');
  const rejectedPeriods = assertInteger(value.rejectedPeriods, 'coverage.rejectedPeriods');
  const outsideArchivePeriods = assertInteger(value.outsideArchivePeriods, 'coverage.outsideArchivePeriods');
  if (!Array.isArray(value.missingPeriods) || value.missingPeriods.length > 3660) throw new TypeError('coverage.missingPeriods must be bounded');
  const missingPeriods = value.missingPeriods.map((date, index) => assertDate(date, `coverage.missingPeriods[${index}]`));
  if (new Set(missingPeriods).size !== missingPeriods.length) throw new TypeError('coverage.missingPeriods must be unique');
  if (!Array.isArray(value.inputSha256s) || value.inputSha256s.length !== acceptedPeriods || value.inputSha256s.some((digest) => typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest))) throw new TypeError('coverage.inputSha256s must match accepted periods');
  return { archiveStart, expectedThrough, dataThrough, freshness: value.freshness, acceptedPeriods, rejectedPeriods, missingPeriods, outsideArchivePeriods, inputSha256s: [...value.inputSha256s] };
}

export function projectWebAnalyticsProjection(value) {
  assertAllowedKeys(value, TOP_FIELDS, 'projection');
  if (value.schemaVersion !== PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION) throw new TypeError('projection schema version is unsupported');
  if (!DATA_KINDS.has(value.dataKind)) throw new TypeError('projection data kind is unsupported');
  const generatedAt = assertTimestamp(value.generatedAt, 'generatedAt');

  assertAllowedKeys(value.subject, SUBJECT_FIELDS, 'subject');
  if (value.subject.domain !== 'web') throw new TypeError('subject domain is unsupported');
  const subject = { id: assertString(value.subject.id, 'subject.id'), label: assertString(value.subject.label, 'subject.label'), domain: 'web' };
  if (value.dataKind === 'illustrative_fixture') {
    if (subject.id !== 'kungfuclan-demo' || value.notice !== WEB_ANALYTICS_FIXTURE_NOTICE) throw new TypeError('illustrative fixtures require the separate demo identity and permanent notice');
  } else if (!REAL_SUBJECTS.has(subject.id) || value.notice !== undefined) {
    throw new TypeError('real projection identity is not allowlisted');
  }

  assertAllowedKeys(value.source, SOURCE_FIELDS, 'source');
  if (value.source.authority !== 'Cloudflare edge aggregate analytics' || value.source.fidelity !== 'aggregate_not_raw_request_logs') throw new TypeError('source metadata is not canonical');
  const source = { authority: value.source.authority, fidelity: value.source.fidelity };

  assertAllowedKeys(value.versions, VERSION_FIELDS, 'versions');
  if (value.versions.archiveSchema !== 1 || !QUERY_VERSIONS.has(value.versions.query) || !METRIC_REGISTRY_VERSIONS.has(value.versions.metricRegistry) || value.versions.compiler !== '2.0.0') throw new TypeError('projection versions are incompatible');
  const versions = { archiveSchema: 1, query: value.versions.query, metricRegistry: value.versions.metricRegistry, compiler: value.versions.compiler };

  assertPlainObject(value.ranges, 'ranges');
  if (Object.keys(value.ranges).sort().join(',') !== Object.keys(RANGE_DAYS).sort().join(',')) throw new TypeError('projection must contain exactly the supported ranges');
  const ranges = Object.fromEntries(Object.keys(RANGE_DAYS).map((key) => [key, projectRange(value.ranges[key], key)]));

  return {
    schemaVersion: PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION,
    dataKind: value.dataKind,
    generatedAt,
    subject,
    source,
    versions,
    coverage: projectCoverage(value.coverage),
    ranges,
    ...(value.notice ? { notice: value.notice } : {}),
  };
}

export function projectCurrentWebAnalyticsCoverage(coverage, now = new Date()) {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) throw new TypeError('coverage must be an object');
  assertDate(coverage.dataThrough, 'coverage.dataThrough');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('now must be a valid Date');
  const currentUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expectedThrough = new Date(currentUtcDay - 86_400_000).toISOString().slice(0, 10);
  return { ...coverage, expectedThrough, freshness: coverage.dataThrough === expectedThrough ? 'fresh' : 'stale' };
}

export function isPublicWebAnalyticsProjection(value) {
  try {
    projectWebAnalyticsProjection(value);
    return true;
  } catch {
    return false;
  }
}

export function parseWebAnalyticsText(text) {
  if (typeof text !== 'string') throw new TypeError('analytics payload must be text');
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > WEB_ANALYTICS_MAX_BYTES) throw new TypeError('analytics payload exceeds the public size limit');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new TypeError('analytics payload is not valid JSON');
  }
  return projectWebAnalyticsProjection(value);
}
