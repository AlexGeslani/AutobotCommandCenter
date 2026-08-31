#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import registryFile from './repositories.v1.json' with { type: 'json' };
import { projectGitHubAnalyticsProjection } from '../../src/analytics/github-schema.mjs';

const COMPILER_VERSION = '1.0.0';
const OBSERVATION_PATTERN = /^github-traffic-(\d+)-(\d{8}T\d{9}Z)\.json\.gz$/;
const ELIGIBILITY_PATTERN = /^github-eligibility-(\d+)-(\d{8}T\d{9}Z)\.json\.gz$/;
const ELIGIBILITY_FIELDS = new Set(['schemaVersion', 'checkedAt', 'repositoryId', 'state']);
const ELIGIBILITY_STATES = new Set(['access_lost', 'identity_mismatch', 'ineligible']);
const TOP_FIELDS = new Set(['schemaVersion', 'collectedAt', 'source', 'repository', 'traffic']);
const SOURCE_FIELDS = new Set(['authority', 'fidelity']);
const REPOSITORY_FIELDS = new Set(['id', 'name', 'owner', 'fullName', 'visibility', 'archived', 'htmlUrl', 'stars', 'forks', 'subscribers', 'pushedAt', 'latestRelease']);
const TRAFFIC_FIELDS = new Set(['views', 'clones', 'referrers', 'paths']);
const SERIES_FIELDS = new Set(['count', 'uniques', 'daily']);
const DAILY_FIELDS = new Set(['timestamp', 'count', 'uniques']);
const REFERRER_FIELDS = new Set(['referrer', 'count', 'uniques']);
const PATH_FIELDS = new Set(['path', 'title', 'count', 'uniques']);
const RELEASE_FIELDS = new Set(['tagName', 'publishedAt', 'htmlUrl']);

function plain(value, name) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
  return value;
}

function exact(value, fields, name) {
  plain(value, name);
  const keys = Object.keys(value);
  if (keys.length !== fields.size || keys.some((key) => !fields.has(key))) throw new TypeError(`${name} has an incompatible field contract`);
}

function text(value, name, max = 2048) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new TypeError(`${name} must be bounded text`);
  return value;
}

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

function timestamp(value, name) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be a timestamp`);
  return new Date(value).toISOString();
}

function dateFromProviderTimestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(value)) throw new TypeError(`${name} must be a midnight UTC provider timestamp`);
  return value.slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const rows = [];
  for (let value = start; value <= end; value = addDays(value, 1)) rows.push(value);
  return rows;
}

function validateRegistry(value) {
  exact(value, new Set(['schemaVersion', 'owner', 'repositories']), 'registry');
  if (value.schemaVersion !== 'github-analytics-repositories-v1' || value.owner !== 'AlexGeslani') throw new TypeError('registry identity is unsupported');
  if (!Array.isArray(value.repositories) || !value.repositories.length || value.repositories.length > 50) throw new TypeError('registry repositories must be bounded');
  const ids = new Set();
  for (const [index, repository] of value.repositories.entries()) {
    exact(repository, new Set(['id', 'name']), `registry.repositories[${index}]`);
    const id = integer(repository.id, 'registry repository id');
    text(repository.name, 'registry repository name', 100);
    if (!id || ids.has(id)) throw new TypeError('registry numeric repository IDs must be positive and unique');
    ids.add(id);
  }
  return { owner: value.owner, ids };
}

async function filesUnder(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && (OBSERVATION_PATTERN.test(entry.name) || ELIGIBILITY_PATTERN.test(entry.name))) output.push(path);
    }
  }
  await walk(root);
  return output.sort();
}

async function verifyAndRead(path) {
  const sidecar = await readFile(`${path}.sha256`, 'utf8');
  const match = sidecar.match(/^([0-9a-f]{64})  ([^\r\n]+)\r?\n?$/);
  if (!match || match[2] !== basename(path)) throw new TypeError(`invalid checksum sidecar: ${basename(path)}`);
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== match[1]) throw new TypeError(`checksum mismatch: ${basename(path)}`);
  let value;
  try { value = JSON.parse(gunzipSync(bytes).toString('utf8')); } catch { throw new TypeError(`observation parse failure: ${basename(path)}`); }
  return { digest, value };
}

function validateEligibility(value, registry) {
  exact(value, ELIGIBILITY_FIELDS, 'eligibility');
  if (value.schemaVersion !== 'github-repository-eligibility-v1') throw new TypeError('eligibility schema is unsupported');
  const checkedAt = timestamp(value.checkedAt, 'eligibility.checkedAt');
  const repositoryId = integer(value.repositoryId, 'eligibility.repositoryId');
  if (!registry.ids.has(repositoryId)) throw new TypeError('eligibility repository is not allowlisted');
  if (!ELIGIBILITY_STATES.has(value.state)) throw new TypeError('eligibility state is unsupported');
  return { checkedAt, repositoryId, state: value.state };
}

function updateLatestEligibility(statuses, repositoryId, checkedAt, state) {
  const current = statuses.get(repositoryId);
  if (!current || checkedAt > current.checkedAt || (checkedAt === current.checkedAt && state !== 'public')) {
    statuses.set(repositoryId, { checkedAt, state });
  }
}

function projectSeries(value, name) {
  exact(value, SERIES_FIELDS, name);
  const count = integer(value.count, `${name}.count`);
  const uniques = integer(value.uniques, `${name}.uniques`);
  if (uniques > count) throw new TypeError(`${name}.uniques cannot exceed count`);
  if (!Array.isArray(value.daily) || value.daily.length > 14) throw new TypeError(`${name}.daily must be a provider-bounded array`);
  const seen = new Set();
  const daily = value.daily.map((row, index) => {
    exact(row, DAILY_FIELDS, `${name}.daily[${index}]`);
    const date = dateFromProviderTimestamp(row.timestamp, `${name}.daily[${index}].timestamp`);
    const rowCount = integer(row.count, `${name}.daily[${index}].count`);
    const rowUniques = integer(row.uniques, `${name}.daily[${index}].uniques`);
    if (rowUniques > rowCount || seen.has(date)) throw new TypeError(`${name}.daily rows must have unique dates and bounded uniques`);
    seen.add(date);
    return { date, count: rowCount, uniques: rowUniques };
  }).sort((left, right) => left.date.localeCompare(right.date));
  if (daily.reduce((sum, row) => sum + row.count, 0) !== count) throw new TypeError(`${name}.count must reconcile to its provider daily rows`);
  return { count, uniques, daily };
}

function projectTopRows(values, fields, kind) {
  if (!Array.isArray(values) || values.length > 10) throw new TypeError(`${kind} must be a provider-bounded top-ten array`);
  return values.map((row, index) => {
    exact(row, fields, `${kind}[${index}]`);
    const count = integer(row.count, `${kind}.count`);
    const uniques = integer(row.uniques, `${kind}.uniques`);
    if (uniques > count) throw new TypeError(`${kind}.uniques cannot exceed count`);
    if (kind === 'referrers') return { referrer: text(row.referrer, 'referrer', 512), count, uniques };
    return { path: text(row.path, 'path', 1024), title: text(row.title, 'path title', 512), count, uniques };
  });
}

function projectRelease(value) {
  if (value === null) return null;
  exact(value, RELEASE_FIELDS, 'repository.latestRelease');
  return { tagName: text(value.tagName, 'release tag', 255), publishedAt: timestamp(value.publishedAt, 'release publishedAt'), htmlUrl: text(value.htmlUrl, 'release htmlUrl', 512) };
}

function validateObservation(value, registry) {
  exact(value, TOP_FIELDS, 'observation');
  if (value.schemaVersion !== 'github-traffic-observation-v1') throw new TypeError('observation schema is unsupported');
  const collectedAt = timestamp(value.collectedAt, 'observation.collectedAt');
  exact(value.source, SOURCE_FIELDS, 'observation.source');
  if (value.source.authority !== 'GitHub REST repository traffic metrics' || value.source.fidelity !== 'rolling_14_day_aggregate_observation') throw new TypeError('observation source is unsupported');
  exact(value.repository, REPOSITORY_FIELDS, 'observation.repository');
  const id = integer(value.repository.id, 'repository.id');
  if (!registry.ids.has(id)) throw new TypeError('observation repository is not allowlisted');
  const name = text(value.repository.name, 'repository.name', 100);
  const owner = text(value.repository.owner, 'repository.owner', 39);
  if (owner !== registry.owner || value.repository.fullName !== `${owner}/${name}` || value.repository.htmlUrl !== `https://github.com/${owner}/${name}`) throw new TypeError('observation repository identity is inconsistent');
  if (!['public', 'private', 'unknown'].includes(value.repository.visibility)) throw new TypeError('observation visibility is unsupported');
  if (typeof value.repository.archived !== 'boolean') throw new TypeError('repository.archived must be boolean');
  exact(value.traffic, TRAFFIC_FIELDS, 'observation.traffic');
  return {
    collectedAt,
    repository: {
      id, name, owner, fullName: value.repository.fullName, visibility: value.repository.visibility, archived: value.repository.archived,
      htmlUrl: value.repository.htmlUrl, stars: integer(value.repository.stars, 'repository.stars'), forks: integer(value.repository.forks, 'repository.forks'), subscribers: integer(value.repository.subscribers, 'repository.subscribers'),
      pushedAt: timestamp(value.repository.pushedAt, 'repository.pushedAt'), latestRelease: projectRelease(value.repository.latestRelease),
    },
    traffic: {
      views: projectSeries(value.traffic.views, 'traffic.views'), clones: projectSeries(value.traffic.clones, 'traffic.clones'),
      referrers: projectTopRows(value.traffic.referrers, REFERRER_FIELDS, 'referrers'), paths: projectTopRows(value.traffic.paths, PATH_FIELDS, 'paths'),
    },
  };
}

function buildRepository(observations, generatedAt) {
  observations.sort((left, right) => left.collectedAt.localeCompare(right.collectedAt));
  const latest = observations.at(-1);
  const viewsByDate = new Map();
  const clonesByDate = new Map();
  for (const observation of observations) {
    for (const row of observation.traffic.views.daily) viewsByDate.set(row.date, row);
    for (const row of observation.traffic.clones.daily) clonesByDate.set(row.date, row);
  }
  const observedDates = [...new Set([...viewsByDate.keys(), ...clonesByDate.keys()])].sort();
  const firstTrafficDate = observedDates[0] || null;
  const lastTrafficDate = observedDates.at(-1) || null;
  const dates = observedDates.length ? dateRange(firstTrafficDate, lastTrafficDate) : [];
  const daily = dates.map((date) => ({
    date,
    finality: addDays(date, 14) <= generatedAt.slice(0, 10) ? 'historical' : 'provisional',
    views: viewsByDate.has(date) ? { state: 'present', count: viewsByDate.get(date).count, uniques: viewsByDate.get(date).uniques } : { state: 'missing', count: null, uniques: null },
    clones: clonesByDate.has(date) ? { state: 'present', count: clonesByDate.get(date).count, uniques: clonesByDate.get(date).uniques } : { state: 'missing', count: null, uniques: null },
  }));
  const metadata = latest.repository;
  return {
    id: metadata.id, name: metadata.name, owner: metadata.owner, fullName: metadata.fullName,
    htmlUrl: metadata.htmlUrl, archived: metadata.archived, stars: metadata.stars, forks: metadata.forks,
    subscribers: metadata.subscribers, pushedAt: metadata.pushedAt, latestRelease: metadata.latestRelease,
    coverage: { firstTrafficDate, lastTrafficDate, observedDates: daily.length, missingViewDates: daily.filter((row) => row.views.state === 'missing').length, missingCloneDates: daily.filter((row) => row.clones.state === 'missing').length },
    retainedTotals: { views: daily.reduce((sum, row) => sum + (row.views.count ?? 0), 0), clones: daily.reduce((sum, row) => sum + (row.clones.count ?? 0), 0) },
    daily,
    latestWindow: {
      observedAt: latest.collectedAt, windowStart: addDays(latest.collectedAt.slice(0, 10), -13), windowEnd: latest.collectedAt.slice(0, 10),
      views: { count: latest.traffic.views.count, uniques: latest.traffic.views.uniques }, clones: { count: latest.traffic.clones.count, uniques: latest.traffic.clones.uniques },
      referrers: latest.traffic.referrers, paths: latest.traffic.paths,
    },
  };
}

export async function compileGitHubAnalyticsArchive({ archiveRoot, outputPath, registry = registryFile }) {
  if (!archiveRoot || !outputPath) throw new TypeError('archiveRoot and outputPath are required');
  const allowed = validateRegistry(registry);
  const candidates = await filesUnder(archiveRoot);
  if (!candidates.length) throw new TypeError('no compatible GitHub observations found');
  const records = [];
  const latestEligibility = new Map();
  for (const path of candidates) {
    const source = await verifyAndRead(path);
    if (ELIGIBILITY_PATTERN.test(basename(path))) {
      const status = validateEligibility(source.value, allowed);
      updateLatestEligibility(latestEligibility, status.repositoryId, status.checkedAt, status.state);
      continue;
    }
    const observation = validateObservation(source.value, allowed);
    const state = observation.repository.visibility === 'public' ? 'public' : 'ineligible';
    updateLatestEligibility(latestEligibility, observation.repository.id, observation.collectedAt, state);
    if (state === 'public') records.push({ digest: source.digest, observation });
  }
  const observationsById = new Map();
  const digests = [];
  const collectedAt = [];
  for (const { digest, observation } of records) {
    if (latestEligibility.get(observation.repository.id)?.state !== 'public') continue;
    digests.push(digest);
    collectedAt.push(observation.collectedAt);
    const rows = observationsById.get(observation.repository.id) || [];
    rows.push(observation);
    observationsById.set(observation.repository.id, rows);
  }
  const generatedAt = [...collectedAt].sort().at(-1);
  const repositories = [...observationsById.entries()].map(([, observations]) => buildRepository(observations, generatedAt)).sort((left, right) => left.id - right.id);
  if (!repositories.length) throw new TypeError('no public allowlisted GitHub observations found');
  const dates = repositories.flatMap((repository) => repository.daily.map((row) => row.date)).sort();
  const value = projectGitHubAnalyticsProjection({
    schemaVersion: 'github-analytics-projection-v1', dataKind: 'real', generatedAt,
    subject: { id: 'github-portfolio', label: 'GitHub Portfolio', domain: 'code' },
    source: { authority: 'GitHub REST repository traffic metrics', fidelity: 'rolling_14_day_aggregate_observations' },
    versions: { archiveSchema: 1, compiler: COMPILER_VERSION },
    coverage: { collectionStartedAt: [...collectedAt].sort()[0], trafficStart: dates[0] || null, observedThrough: dates.at(-1) || null, acceptedObservations: digests.length, inputSha256s: digests },
    portfolio: { retainedTotals: { views: repositories.reduce((sum, repository) => sum + repository.retainedTotals.views, 0), clones: repositories.reduce((sum, repository) => sum + repository.retainedTotals.clones, 0) }, repositoriesReporting: repositories.length },
    repositories,
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
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) throw new TypeError('arguments must be --key value pairs');
    args[argv[index].slice(2)] = argv[index + 1];
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const projection = await compileGitHubAnalyticsArchive({ archiveRoot: args['archive-root'], outputPath: args.output });
  console.log(JSON.stringify({ status: 'ok', repositories: projection.repositories.length, observedThrough: projection.coverage.observedThrough, observations: projection.coverage.acceptedObservations }));
}
