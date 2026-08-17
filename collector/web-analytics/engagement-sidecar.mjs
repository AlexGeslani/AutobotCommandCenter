export const ENGAGEMENT_SIDECAR_SCHEMA_VERSION = 'web-analytics-engagement-sidecar-v1';
export const ENGAGEMENT_QUERY_VERSION = 'httpRequests1dGroups-engagement-v1';

const TOP_FIELDS = new Set(['schemaVersion', 'queryVersion', 'site', 'date', 'periodStartUtc', 'periodEndUtc', 'collectedAt', 'metrics']);
const METRIC_FIELDS = new Set(['pageViews', 'visits', 'uniqueIps']);
const MAX_SIDECAR_BYTES = 16 * 1024;

function assertPlainObject(value, name) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
}

function assertExactKeys(value, allowed, name) {
  assertPlainObject(value, name);
  const keys = Object.keys(value);
  for (const key of keys) if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
  if (keys.length !== allowed.size) throw new TypeError(`${name} is missing required fields`);
}

function assertDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`${name} must be a real UTC date`);
  return value;
}

function addDay(value) {
  const date = new Date(`${assertDate(value, 'date')}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function assertTimestamp(value, name) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError(`${name} must be a canonical UTC timestamp`);
  return value;
}

function assertInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

export function projectEngagementSidecar(value) {
  assertExactKeys(value, TOP_FIELDS, 'engagement sidecar');
  if (value.schemaVersion !== ENGAGEMENT_SIDECAR_SCHEMA_VERSION) throw new TypeError('engagement sidecar schema is unsupported');
  if (value.queryVersion !== ENGAGEMENT_QUERY_VERSION) throw new TypeError('engagement query version is unsupported');
  if (value.site !== 'kungfuclan.com') throw new TypeError('engagement sidecar site is unsupported');
  const date = assertDate(value.date, 'engagement sidecar date');
  const periodStartUtc = `${date}T00:00:00.000Z`;
  const periodEndUtc = addDay(date);
  if (value.periodStartUtc !== periodStartUtc || value.periodEndUtc !== periodEndUtc) throw new TypeError('engagement sidecar period must be one closed UTC day');
  const collectedAt = assertTimestamp(value.collectedAt, 'engagement sidecar collectedAt');
  if (collectedAt < periodEndUtc) throw new TypeError('engagement sidecar was collected before period close');
  assertExactKeys(value.metrics, METRIC_FIELDS, 'engagement sidecar metrics');
  return {
    schemaVersion: ENGAGEMENT_SIDECAR_SCHEMA_VERSION,
    queryVersion: ENGAGEMENT_QUERY_VERSION,
    site: value.site,
    date,
    periodStartUtc,
    periodEndUtc,
    collectedAt,
    metrics: {
      pageViews: assertInteger(value.metrics.pageViews, 'pageViews'),
      visits: assertInteger(value.metrics.visits, 'visits'),
      uniqueIps: assertInteger(value.metrics.uniqueIps, 'uniqueIps'),
    },
  };
}

export function normalizeEngagementQueryResponse(response, { site, date, collectedAt } = {}) {
  assertPlainObject(response, 'provider response');
  if (Array.isArray(response.errors) && response.errors.length) throw new TypeError('provider response contains provider errors');
  const zones = response.data?.viewer?.zones;
  if (!Array.isArray(zones) || zones.length !== 1) throw new TypeError('provider response must contain exactly one zone');
  const rows = zones[0]?.httpRequests1dGroups;
  if (!Array.isArray(rows) || rows.length !== 1) throw new TypeError('provider response must contain exactly one daily row');
  const row = rows[0];
  if (row?.dimensions?.date !== date) throw new TypeError('provider response date mismatch');
  return projectEngagementSidecar({
    schemaVersion: ENGAGEMENT_SIDECAR_SCHEMA_VERSION,
    queryVersion: ENGAGEMENT_QUERY_VERSION,
    site,
    date,
    periodStartUtc: `${date}T00:00:00.000Z`,
    periodEndUtc: addDay(date),
    collectedAt,
    metrics: {
      pageViews: row?.sum?.pageViews,
      visits: row?.sum?.visits,
      uniqueIps: row?.uniq?.uniques,
    },
  });
}

export function serializeEngagementSidecar(value) {
  return `${JSON.stringify(projectEngagementSidecar(value))}\n`;
}

export function parseEngagementSidecarText(text) {
  if (typeof text !== 'string') throw new TypeError('engagement sidecar must be text');
  if (new TextEncoder().encode(text).byteLength > MAX_SIDECAR_BYTES) throw new TypeError('engagement sidecar exceeds size limit');
  let value;
  try { value = JSON.parse(text); } catch { throw new TypeError('engagement sidecar is not valid JSON'); }
  return projectEngagementSidecar(value);
}