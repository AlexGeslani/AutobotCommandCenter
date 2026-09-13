export const PUBLIC_GITHUB_ANALYTICS_SCHEMA_VERSION = 'github-analytics-projection-v1';
export const GITHUB_ANALYTICS_MAX_BYTES = 2 * 1024 * 1024;

const TOP_FIELDS = new Set(['schemaVersion', 'dataKind', 'generatedAt', 'subject', 'source', 'versions', 'coverage', 'portfolio', 'repositories']);
const SUBJECT_FIELDS = new Set(['id', 'label', 'domain']);
const SOURCE_FIELDS = new Set(['authority', 'fidelity']);
const VERSION_FIELDS = new Set(['archiveSchema', 'compiler']);
const COVERAGE_FIELDS = new Set(['collectionStartedAt', 'trafficStart', 'observedThrough', 'acceptedObservations', 'inputSha256s']);
const PORTFOLIO_FIELDS = new Set(['retainedTotals', 'repositoriesReporting']);
const TOTAL_FIELDS = new Set(['views', 'clones']);
const REPOSITORY_FIELDS = new Set(['id', 'name', 'owner', 'fullName', 'htmlUrl', 'archived', 'stars', 'forks', 'subscribers', 'pushedAt', 'latestRelease', 'coverage', 'retainedTotals', 'daily', 'latestWindow']);
const REPOSITORY_COVERAGE_FIELDS = new Set(['firstTrafficDate', 'lastTrafficDate', 'observedDates', 'missingViewDates', 'missingCloneDates']);
const DAILY_FIELDS = new Set(['date', 'finality', 'views', 'clones']);
const DAILY_METRIC_FIELDS = new Set(['state', 'count', 'uniques']);
const WINDOW_FIELDS = new Set(['observedAt', 'windowStart', 'windowEnd', 'views', 'clones', 'referrers', 'paths']);
const WINDOW_METRIC_FIELDS = new Set(['count', 'uniques']);
const REFERRER_FIELDS = new Set(['referrer', 'count', 'uniques']);
const PATH_FIELDS = new Set(['path', 'title', 'count', 'uniques']);
const RELEASE_FIELDS = new Set(['tagName', 'publishedAt', 'htmlUrl']);

function assertPlainObject(value, name) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
  return value;
}

function assertAllowedKeys(value, allowed, name) {
  assertPlainObject(value, name);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
  if (Object.keys(value).length !== allowed.size) throw new TypeError(`${name} must contain the exact field contract`);
}

function assertString(value, name, { max = 2048, pattern = null } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(`${name} must be a bounded non-empty string`);
  if (pattern && !pattern.test(value)) throw new TypeError(`${name} has an invalid format`);
  return value;
}

function assertTimestamp(value, name) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError(`${name} must be a canonical UTC ISO timestamp`);
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

function assertCountPair(value, name) {
  assertAllowedKeys(value, WINDOW_METRIC_FIELDS, name);
  const count = assertInteger(value.count, `${name}.count`);
  const uniques = assertInteger(value.uniques, `${name}.uniques`);
  if (uniques > count) throw new TypeError(`${name}.uniques cannot exceed count`);
  return { count, uniques };
}

function projectDailyMetric(value, name) {
  assertAllowedKeys(value, DAILY_METRIC_FIELDS, name);
  if (!['present', 'missing'].includes(value.state)) throw new TypeError(`${name}.state is unsupported`);
  if (value.state === 'missing') {
    if (value.count !== null || value.uniques !== null) throw new TypeError(`${name} missing metrics must use null values`);
    return { state: 'missing', count: null, uniques: null };
  }
  const count = assertInteger(value.count, `${name}.count`);
  const uniques = assertInteger(value.uniques, `${name}.uniques`);
  if (uniques > count) throw new TypeError(`${name}.uniques cannot exceed count`);
  return { state: 'present', count, uniques };
}

function projectLatestRelease(value, name) {
  if (value === null) return null;
  assertAllowedKeys(value, RELEASE_FIELDS, name);
  return {
    tagName: assertString(value.tagName, `${name}.tagName`, { max: 255 }),
    publishedAt: assertTimestamp(value.publishedAt, `${name}.publishedAt`),
    htmlUrl: assertString(value.htmlUrl, `${name}.htmlUrl`, { max: 512, pattern: /^https:\/\/github\.com\// }),
  };
}

function projectLatestWindow(value, name) {
  assertAllowedKeys(value, WINDOW_FIELDS, name);
  const observedAt = assertTimestamp(value.observedAt, `${name}.observedAt`);
  const windowStart = assertDate(value.windowStart, `${name}.windowStart`);
  const windowEnd = assertDate(value.windowEnd, `${name}.windowEnd`);
  if (windowEnd !== observedAt.slice(0, 10) || addDays(windowStart, 13) !== windowEnd) throw new TypeError(`${name} must describe the exact 14-day observation window`);
  if (!Array.isArray(value.referrers) || value.referrers.length > 10) throw new TypeError(`${name}.referrers must be one bounded provider window`);
  if (!Array.isArray(value.paths) || value.paths.length > 10) throw new TypeError(`${name}.paths must be one bounded provider window`);
  const referrers = value.referrers.map((row, index) => {
    assertAllowedKeys(row, REFERRER_FIELDS, `${name}.referrers[${index}]`);
    const count = assertInteger(row.count, 'referrer.count');
    const uniques = assertInteger(row.uniques, 'referrer.uniques');
    if (uniques > count) throw new TypeError('referrer uniques cannot exceed count');
    return { referrer: assertString(row.referrer, 'referrer.referrer', { max: 512 }), count, uniques };
  });
  const paths = value.paths.map((row, index) => {
    assertAllowedKeys(row, PATH_FIELDS, `${name}.paths[${index}]`);
    const count = assertInteger(row.count, 'path.count');
    const uniques = assertInteger(row.uniques, 'path.uniques');
    if (uniques > count) throw new TypeError('path uniques cannot exceed count');
    return { path: assertString(row.path, 'path.path', { max: 1024, pattern: /^\// }), title: assertString(row.title, 'path.title', { max: 512 }), count, uniques };
  });
  return { observedAt, windowStart, windowEnd, views: assertCountPair(value.views, `${name}.views`), clones: assertCountPair(value.clones, `${name}.clones`), referrers, paths };
}

function projectRepository(value, index, generatedAt) {
  const name = `repositories[${index}]`;
  assertAllowedKeys(value, REPOSITORY_FIELDS, name);
  const id = assertInteger(value.id, `${name}.id`);
  if (id === 0) throw new TypeError(`${name}.id must be a positive GitHub numeric repository ID`);
  const repositoryName = assertString(value.name, `${name}.name`, { max: 100, pattern: /^[A-Za-z0-9_.-]+$/ });
  const owner = assertString(value.owner, `${name}.owner`, { max: 39, pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/ });
  const fullName = assertString(value.fullName, `${name}.fullName`, { max: 140 });
  if (fullName !== `${owner}/${repositoryName}`) throw new TypeError(`${name}.fullName must match owner/name`);
  const htmlUrl = assertString(value.htmlUrl, `${name}.htmlUrl`, { max: 512 });
  if (htmlUrl !== `https://github.com/${fullName}`) throw new TypeError(`${name}.htmlUrl must be the canonical GitHub repository URL`);
  if (typeof value.archived !== 'boolean') throw new TypeError(`${name}.archived must be boolean`);
  const pushedAt = assertTimestamp(value.pushedAt, `${name}.pushedAt`);

  assertAllowedKeys(value.coverage, REPOSITORY_COVERAGE_FIELDS, `${name}.coverage`);
  const observedDates = assertInteger(value.coverage.observedDates, `${name}.coverage.observedDates`);
  let firstTrafficDate = value.coverage.firstTrafficDate;
  let lastTrafficDate = value.coverage.lastTrafficDate;
  if (observedDates === 0) {
    if (firstTrafficDate !== null || lastTrafficDate !== null) throw new TypeError(`${name}.coverage empty dates must be null`);
  } else {
    firstTrafficDate = assertDate(firstTrafficDate, `${name}.coverage.firstTrafficDate`);
    lastTrafficDate = assertDate(lastTrafficDate, `${name}.coverage.lastTrafficDate`);
  }
  if (!Array.isArray(value.daily) || value.daily.length !== observedDates) throw new TypeError(`${name}.daily must match coverage`);
  const daily = value.daily.map((row, dayIndex) => {
    assertAllowedKeys(row, DAILY_FIELDS, `${name}.daily[${dayIndex}]`);
    const date = assertDate(row.date, `${name}.daily[${dayIndex}].date`);
    if (dayIndex && date !== addDays(value.daily[dayIndex - 1].date, 1)) throw new TypeError(`${name}.daily dates must be contiguous`);
    const expectedFinality = addDays(date, 14) <= generatedAt.slice(0, 10) ? 'historical' : 'provisional';
    if (row.finality !== expectedFinality) throw new TypeError(`${name}.daily finality is inconsistent with the rolling window`);
    return { date, finality: row.finality, views: projectDailyMetric(row.views, `${name}.daily[${dayIndex}].views`), clones: projectDailyMetric(row.clones, `${name}.daily[${dayIndex}].clones`) };
  });
  if (observedDates && (daily[0].date !== firstTrafficDate || daily.at(-1).date !== lastTrafficDate)) throw new TypeError(`${name}.coverage dates must match daily rows`);
  const missingViewDates = daily.filter((row) => row.views.state === 'missing').length;
  const missingCloneDates = daily.filter((row) => row.clones.state === 'missing').length;
  if (value.coverage.missingViewDates !== missingViewDates || value.coverage.missingCloneDates !== missingCloneDates) throw new TypeError(`${name}.coverage missing counts must match daily rows`);

  assertAllowedKeys(value.retainedTotals, TOTAL_FIELDS, `${name}.retainedTotals`);
  const retainedTotals = { views: assertInteger(value.retainedTotals.views, `${name}.retainedTotals.views`), clones: assertInteger(value.retainedTotals.clones, `${name}.retainedTotals.clones`) };
  if (daily.reduce((sum, row) => sum + (row.views.count ?? 0), 0) !== retainedTotals.views || daily.reduce((sum, row) => sum + (row.clones.count ?? 0), 0) !== retainedTotals.clones) throw new TypeError(`${name}.retainedTotals must reconcile to additive daily counts`);

  return {
    id, name: repositoryName, owner, fullName, htmlUrl, archived: value.archived,
    stars: assertInteger(value.stars, `${name}.stars`), forks: assertInteger(value.forks, `${name}.forks`), subscribers: assertInteger(value.subscribers, `${name}.subscribers`),
    pushedAt, latestRelease: projectLatestRelease(value.latestRelease, `${name}.latestRelease`),
    coverage: { firstTrafficDate, lastTrafficDate, observedDates, missingViewDates, missingCloneDates }, retainedTotals, daily,
    latestWindow: projectLatestWindow(value.latestWindow, `${name}.latestWindow`),
  };
}

export function projectGitHubAnalyticsProjection(value) {
  assertAllowedKeys(value, TOP_FIELDS, 'projection');
  if (value.schemaVersion !== PUBLIC_GITHUB_ANALYTICS_SCHEMA_VERSION) throw new TypeError('projection schema version is unsupported');
  if (value.dataKind !== 'real') throw new TypeError('GitHub analytics projections must be real retained observations');
  const generatedAt = assertTimestamp(value.generatedAt, 'generatedAt');

  assertAllowedKeys(value.subject, SUBJECT_FIELDS, 'subject');
  if (value.subject.id !== 'github-portfolio' || value.subject.label !== 'GitHub Portfolio' || value.subject.domain !== 'code') throw new TypeError('subject identity is not canonical');
  assertAllowedKeys(value.source, SOURCE_FIELDS, 'source');
  if (value.source.authority !== 'GitHub REST repository traffic metrics' || value.source.fidelity !== 'rolling_14_day_aggregate_observations') throw new TypeError('source metadata is not canonical');
  assertAllowedKeys(value.versions, VERSION_FIELDS, 'versions');
  if (value.versions.archiveSchema !== 1 || value.versions.compiler !== '1.0.0') throw new TypeError('projection versions are incompatible');

  assertAllowedKeys(value.coverage, COVERAGE_FIELDS, 'coverage');
  const collectionStartedAt = assertTimestamp(value.coverage.collectionStartedAt, 'coverage.collectionStartedAt');
  if (collectionStartedAt > generatedAt) throw new TypeError('coverage collection start cannot follow generation');
  const acceptedObservations = assertInteger(value.coverage.acceptedObservations, 'coverage.acceptedObservations');
  if (!Array.isArray(value.coverage.inputSha256s) || value.coverage.inputSha256s.length !== acceptedObservations || value.coverage.inputSha256s.some((digest) => typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest))) throw new TypeError('coverage.inputSha256s must match accepted observations');
  let trafficStart = value.coverage.trafficStart;
  let observedThrough = value.coverage.observedThrough;
  if (trafficStart === null || observedThrough === null) {
    if (trafficStart !== null || observedThrough !== null) throw new TypeError('coverage traffic dates must both be null or both be dates');
  } else {
    trafficStart = assertDate(trafficStart, 'coverage.trafficStart');
    observedThrough = assertDate(observedThrough, 'coverage.observedThrough');
    if (trafficStart > observedThrough) throw new TypeError('coverage traffic dates are inconsistent');
  }

  if (!Array.isArray(value.repositories) || value.repositories.length > 50) throw new TypeError('repositories must be a bounded array');
  const repositories = value.repositories.map((repository, index) => projectRepository(repository, index, generatedAt));
  if (new Set(repositories.map((repository) => repository.id)).size !== repositories.length) throw new TypeError('repository numeric IDs must be unique');
  if (repositories.some((repository, index) => index && repositories[index - 1].id > repository.id)) throw new TypeError('repositories must be sorted by numeric ID');
  const dates = repositories.flatMap((repository) => repository.daily.map((row) => row.date));
  const derivedStart = dates.length ? [...dates].sort()[0] : null;
  const derivedThrough = dates.length ? [...dates].sort().at(-1) : null;
  if (trafficStart !== derivedStart || observedThrough !== derivedThrough) throw new TypeError('portfolio coverage dates must match repository rows');

  assertAllowedKeys(value.portfolio, PORTFOLIO_FIELDS, 'portfolio');
  assertAllowedKeys(value.portfolio.retainedTotals, TOTAL_FIELDS, 'portfolio.retainedTotals');
  const portfolio = {
    retainedTotals: {
      views: assertInteger(value.portfolio.retainedTotals.views, 'portfolio.retainedTotals.views'),
      clones: assertInteger(value.portfolio.retainedTotals.clones, 'portfolio.retainedTotals.clones'),
    },
    repositoriesReporting: assertInteger(value.portfolio.repositoriesReporting, 'portfolio.repositoriesReporting'),
  };
  if (portfolio.repositoriesReporting !== repositories.length) throw new TypeError('portfolio repository count must match public rows');
  if (portfolio.retainedTotals.views !== repositories.reduce((sum, repository) => sum + repository.retainedTotals.views, 0) || portfolio.retainedTotals.clones !== repositories.reduce((sum, repository) => sum + repository.retainedTotals.clones, 0)) throw new TypeError('portfolio additive totals must reconcile to repositories');

  return {
    schemaVersion: PUBLIC_GITHUB_ANALYTICS_SCHEMA_VERSION, dataKind: 'real', generatedAt,
    subject: { id: 'github-portfolio', label: 'GitHub Portfolio', domain: 'code' },
    source: { authority: value.source.authority, fidelity: value.source.fidelity },
    versions: { archiveSchema: 1, compiler: '1.0.0' },
    coverage: { collectionStartedAt, trafficStart, observedThrough, acceptedObservations, inputSha256s: [...value.coverage.inputSha256s] },
    portfolio, repositories,
  };
}

export function parseGitHubAnalyticsText(text) {
  if (typeof text !== 'string') throw new TypeError('GitHub analytics payload must be text');
  if (new TextEncoder().encode(text).byteLength > GITHUB_ANALYTICS_MAX_BYTES) throw new TypeError('GitHub analytics payload exceeds the public size limit');
  let value;
  try { value = JSON.parse(text); } catch { throw new TypeError('GitHub analytics payload is not valid JSON'); }
  return projectGitHubAnalyticsProjection(value);
}
