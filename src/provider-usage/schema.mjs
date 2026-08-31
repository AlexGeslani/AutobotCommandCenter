export const PUBLIC_PROVIDER_USAGE_SCHEMA_VERSION = 'provider-usage-v1';
export const PROVIDER_USAGE_MAX_AGE_MS = 15 * 60 * 1000;
export const CLAUDE_USAGE_VALIDITY_MS = 12 * 60 * 60 * 1000;

const STATES = new Set(['fresh', 'stale', 'expired', 'inactive', 'not_yet_observed', 'unsupported', 'unknown', 'error', 'auth_error', 'not_configured']);
const PROVIDER_FIELDS = new Set(['provider', 'product', 'metricClass', 'authority', 'collectionMode', 'adapterVersion', 'sourceVersion', 'observedAt', 'state', 'windows', 'resetCredits', 'rateLimitPerSecond', 'billingPolicy']);
const WINDOW_FIELDS = new Set(['id', 'label', 'usedPercent', 'resetsAt', 'resetKind', 'limit', 'remaining']);
const RESET_KINDS = new Set(['provider_reported', 'estimated_window_end']);
const RESET_CREDIT_FIELDS = new Set(['availableCount', 'credits']);
const RESET_CREDIT_ITEM_FIELDS = new Set(['expiresAt']);
const BILLING_POLICY_FIELDS = new Set(['status', 'monthlyCreditUsd', 'usdPerThousandRequests', 'creditApplication', 'authority']);
const BRAVE_BILLING_POLICY = Object.freeze({
  status: 'owner_confirmed_enabled', monthlyCreditUsd: 5, usdPerThousandRequests: 5,
  creditApplication: 'automatic', authority: 'Owner-confirmed paid access + Brave public pricing',
});

const PROVIDER_CONTRACTS = {
  codex: {
    product: 'Codex / ChatGPT',
    authority: 'installed Codex app-server account/rateLimits/read',
    collectionMode: 'local_app_server',
    sourceVersions: new Set(['installed-app-server', 'unavailable']),
    windows: { primary: 'Primary window', secondary: 'Secondary window', additional: 'GPT-5.3-Codex-Spark' },
  },
  claude: {
    product: 'Claude Code',
    authority: 'documented Claude Code status-line rate_limits event',
    collectionMode: 'status_line_cache',
    maxAgeMs: CLAUDE_USAGE_VALIDITY_MS,
    sourceVersions: new Set(['claude-status-line', 'claude-usage-cli', 'not_configured', 'unavailable']),
    sources: {
      'claude-usage-cli': {
        authority: 'authenticated Claude Code /usage limits view',
        collectionMode: 'interactive_cli_usage',
      },
    },
    windows: { five_hour: '5-hour window', seven_day: '7-day window' },
  },
  antigravity: {
    product: 'Antigravity CLI',
    authority: 'documented Antigravity CLI status-line quota event',
    collectionMode: 'status_line_cache',
    sourceVersions: new Set(['antigravity-status-line', 'not_configured', 'unavailable']),
    windows: {
      'gemini-5h': 'Gemini 5-hour window',
      'gemini-weekly': 'Gemini weekly window',
      '3p-5h': 'Third-party 5-hour window',
      '3p-weekly': 'Third-party weekly window',
    },
  },
  'brave-search': {
    product: 'Brave Search API',
    metricClass: 'search_api_quota',
    authority: 'Brave Search API rate-limit response headers',
    collectionMode: 'direct_api_headers',
    sourceVersions: new Set(['brave-rate-limit-headers', 'not_configured', 'unavailable']),
    windows: { monthly: 'Monthly searches' },
    maxAgeMs: 24 * 60 * 60 * 1000,
  },
  elevenlabs: {
    product: 'ElevenLabs',
    metricClass: 'media_api_quota',
    authority: 'ElevenLabs GET /v1/user/subscription',
    collectionMode: 'direct_api',
    sourceVersions: new Set(['elevenlabs-subscription-api', 'not_configured', 'unavailable']),
    windows: { monthly: 'Monthly credits' },
    maxAgeMs: 60 * 60 * 1000,
  },
};

function assertPlainObject(value, name) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
}

function assertAllowedKeys(value, allowed, name) {
  assertPlainObject(value, name);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
  }
}

function assertTimestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError(`${name} must be a canonical UTC ISO timestamp`);
  }
}

function projectWindow(value, contract, provider) {
  assertAllowedKeys(value, WINDOW_FIELDS, 'window');
  if (typeof value.id !== 'string' || !(value.id in contract.windows)) throw new TypeError('window.id is not allowlisted for provider');
  if (value.label !== contract.windows[value.id]) throw new TypeError('window.label must be canonical');
  if (!Number.isFinite(value.usedPercent) || value.usedPercent < 0 || value.usedPercent > 100) throw new TypeError('window.usedPercent must be 0..100');
  assertTimestamp(value.resetsAt, 'window.resetsAt');
  if (value.resetKind !== undefined) {
    if (provider !== 'claude' || !RESET_KINDS.has(value.resetKind)) throw new TypeError('window.resetKind is not allowlisted');
    if (value.resetKind === 'estimated_window_end' && value.id !== 'five_hour') throw new TypeError('window.resetKind estimate is only allowlisted for the Claude five-hour window');
  }
  const hasCounts = value.limit !== undefined || value.remaining !== undefined;
  if (hasCounts) {
    if (!['brave-search', 'elevenlabs'].includes(provider)) throw new TypeError('capacity counts are only allowlisted for Brave Search and ElevenLabs');
    if (!Number.isInteger(value.limit) || value.limit <= 0 || !Number.isInteger(value.remaining) || value.remaining < 0 || value.remaining > value.limit) throw new TypeError('provider capacity counts are invalid');
    const expectedUsedPercent = ((value.limit - value.remaining) / value.limit) * 100;
    if (Math.abs(expectedUsedPercent - value.usedPercent) > 0.0001) throw new TypeError('provider capacity count and percent disagree');
  }
  return {
    id: value.id, label: value.label, usedPercent: value.usedPercent, resetsAt: value.resetsAt,
    ...(value.resetKind ? { resetKind: value.resetKind } : {}),
    ...(hasCounts ? { limit: value.limit, remaining: value.remaining } : {}),
  };
}

function projectResetCredits(value, provider) {
  if (provider !== 'codex') throw new TypeError('resetCredits are only allowlisted for Codex');
  assertAllowedKeys(value, RESET_CREDIT_FIELDS, 'resetCredits');
  if (!Number.isInteger(value.availableCount) || value.availableCount < 0 || !Array.isArray(value.credits) || value.credits.length !== value.availableCount) {
    throw new TypeError('resetCredits must have a matching available count and credit list');
  }
  const credits = value.credits.map((credit) => {
    assertAllowedKeys(credit, RESET_CREDIT_ITEM_FIELDS, 'reset credit');
    assertTimestamp(credit.expiresAt, 'reset credit expiresAt');
    return { expiresAt: credit.expiresAt };
  });
  return { availableCount: value.availableCount, credits };
}

function projectBillingPolicy(value, provider) {
  if (provider !== 'brave-search') throw new TypeError('billingPolicy is only allowlisted for Brave Search');
  assertAllowedKeys(value, BILLING_POLICY_FIELDS, 'billingPolicy');
  for (const [key, expected] of Object.entries(BRAVE_BILLING_POLICY)) {
    if (value[key] !== expected) throw new TypeError(`billingPolicy.${key} must be canonical`);
  }
  return { ...BRAVE_BILLING_POLICY };
}

function projectProvider(value) {
  assertAllowedKeys(value, PROVIDER_FIELDS, 'provider');
  const contract = PROVIDER_CONTRACTS[value.provider];
  if (!contract) throw new TypeError('provider.provider is not allowlisted');
  const sourceMetadata = contract.sources?.[value.sourceVersion] || contract;
  if (value.product !== contract.product || value.authority !== sourceMetadata.authority || value.collectionMode !== sourceMetadata.collectionMode) throw new TypeError('provider metadata must be canonical');
  const expectedMetricClass = contract.metricClass || 'subscription_quota';
  if (value.metricClass !== expectedMetricClass) throw new TypeError(`provider.metricClass must be ${expectedMetricClass}`);
  if (typeof value.adapterVersion !== 'string' || value.adapterVersion !== '1.0.0') throw new TypeError('provider.adapterVersion must be canonical');
  if (typeof value.sourceVersion !== 'string' || !contract.sourceVersions.has(value.sourceVersion)) throw new TypeError('provider.sourceVersion is not allowlisted');
  if (!STATES.has(value.state)) throw new TypeError('provider.state is not allowlisted');
  assertTimestamp(value.observedAt, 'provider.observedAt');
  if (!Array.isArray(value.windows)) throw new TypeError('provider.windows must be an array');
  const windows = value.windows.map((window) => projectWindow(window, contract, value.provider));
  const resetCredits = value.resetCredits === undefined ? null : projectResetCredits(value.resetCredits, value.provider);
  const billingPolicy = value.billingPolicy === undefined ? null : projectBillingPolicy(value.billingPolicy, value.provider);
  const rateLimitPerSecond = value.rateLimitPerSecond;
  if (rateLimitPerSecond !== undefined && (value.provider !== 'brave-search' || !Number.isInteger(rateLimitPerSecond) || rateLimitPerSecond <= 0)) throw new TypeError('rateLimitPerSecond is only allowlisted for Brave Search');
  if (value.state === 'unsupported' && windows.length) throw new TypeError('unsupported providers must not publish windows');
  return {
    provider: value.provider, product: value.product, metricClass: value.metricClass, authority: value.authority, collectionMode: value.collectionMode,
    adapterVersion: value.adapterVersion, sourceVersion: value.sourceVersion, observedAt: value.observedAt, state: value.state, windows,
    ...(resetCredits ? { resetCredits } : {}),
    ...(rateLimitPerSecond !== undefined ? { rateLimitPerSecond } : {}),
    ...(billingPolicy ? { billingPolicy } : {}),
  };
}

export function deriveProviderUsageState(record, now = new Date().toISOString()) {
  if (!record || !STATES.has(record.state)) return 'unknown';
  if (['unsupported', 'error', 'auth_error', 'not_configured', 'inactive', 'not_yet_observed', 'unknown'].includes(record.state)) return record.state;
  const nowMs = Date.parse(now);
  const observedMs = Date.parse(record.observedAt);
  if (!Number.isFinite(nowMs)) throw new TypeError('now must be an ISO timestamp');
  if (!Number.isFinite(observedMs)) return 'unknown';
  if (Array.isArray(record.windows) && record.windows.some((window) => Number.isFinite(Date.parse(window.resetsAt)) && Date.parse(window.resetsAt) <= nowMs)) return 'expired';
  const maxAgeMs = PROVIDER_CONTRACTS[record.provider]?.maxAgeMs || PROVIDER_USAGE_MAX_AGE_MS;
  if (nowMs - observedMs > maxAgeMs) return 'stale';
  return record.state;
}

export function buildProviderUsageSnapshot({ generatedAt, providers }, now = generatedAt) {
  assertTimestamp(generatedAt, 'generatedAt');
  if (!Array.isArray(providers)) throw new TypeError('providers must be an array');
  const projected = providers.map(projectProvider).map((provider) => ({ ...provider, state: deriveProviderUsageState(provider, now) }));
  const ids = new Set();
  for (const provider of projected) {
    if (ids.has(provider.provider)) throw new TypeError(`duplicate provider: ${provider.provider}`);
    ids.add(provider.provider);
  }
  return { schemaVersion: PUBLIC_PROVIDER_USAGE_SCHEMA_VERSION, generatedAt, providers: projected };
}

export function refreshProviderUsageSnapshot(snapshot, now = new Date().toISOString()) {
  if (!isPublicProviderUsageSnapshot(snapshot)) throw new TypeError('snapshot is not public provider usage schema');
  return buildProviderUsageSnapshot({ generatedAt: snapshot.generatedAt, providers: snapshot.providers }, now);
}

export function isPublicProviderUsageSnapshot(value) {
  try {
    if (!value || Array.isArray(value) || typeof value !== 'object') return false;
    if (Object.keys(value).some((key) => !['schemaVersion', 'generatedAt', 'providers'].includes(key))) return false;
    if (value.schemaVersion !== PUBLIC_PROVIDER_USAGE_SCHEMA_VERSION) return false;
    const rebuilt = buildProviderUsageSnapshot({ generatedAt: value.generatedAt, providers: value.providers });
    return JSON.stringify(rebuilt) === JSON.stringify(value);
  } catch {
    return false;
  }
}
