import { buildProviderUsageSnapshot } from '../src/provider-usage/schema.mjs';

const FALLBACKS = {
  codex: { provider: 'codex', product: 'Codex / ChatGPT', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server' },
  claude: { provider: 'claude', product: 'Claude Code', authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache' },
  antigravity: { provider: 'antigravity', product: 'Antigravity CLI', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache' },
  'brave-search': { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers', rateLimitPerSecond: 1 },
};

function fallbackFor(id, now) {
  const base = FALLBACKS[id];
  if (!base) throw new TypeError(`unknown adapter: ${id}`);
  return {
    ...base,
    metricClass: base.metricClass || 'subscription_quota',
    adapterVersion: '1.0.0',
    sourceVersion: 'unavailable',
    observedAt: now,
    state: 'error',
    windows: [],
    ...(base.rateLimitPerSecond ? { rateLimitPerSecond: base.rateLimitPerSecond } : {}),
  };
}

export async function collectProviderUsage({ now = new Date().toISOString(), adapters }) {
  if (!Array.isArray(adapters)) throw new TypeError('adapters must be an array');
  const providers = await Promise.all(adapters.map(async (adapter) => {
    try {
      const record = await adapter.collect({ now });
      const projected = buildProviderUsageSnapshot({ generatedAt: now, providers: [record] }).providers[0];
      if (projected.provider !== adapter.id) throw new TypeError('adapter returned a mismatched provider');
      return projected;
    } catch {
      return fallbackFor(adapter.id, now);
    }
  }));
  return buildProviderUsageSnapshot({ generatedAt: now, providers });
}
