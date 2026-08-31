import { isPublicProviderUsageSnapshot, refreshProviderUsageSnapshot } from './schema.mjs';

export async function loadProviderUsageSnapshot(basePath = '/', projectionPath = 'data/provider-usage.v1.json') {
  const base = new URL(basePath, window.location.origin);
  const url = new URL(projectionPath, `${base.href.replace(/\/?$/, '/')}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Provider usage snapshot unavailable');
  const value = await response.json();
  if (!isPublicProviderUsageSnapshot(value)) throw new Error('Provider usage snapshot failed validation');
  return refreshProviderUsageSnapshot(value);
}

export function providerUsageFallback() {
  return {
    schemaVersion: 'provider-usage-v1', generatedAt: null,
    providers: [
      { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'No validated snapshot', collectionMode: 'snapshot', adapterVersion: 'n/a', sourceVersion: 'n/a', observedAt: null, state: 'not_yet_observed', windows: [] },
      { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'No validated snapshot', collectionMode: 'snapshot', adapterVersion: 'n/a', sourceVersion: 'n/a', observedAt: null, state: 'not_yet_observed', windows: [] },
      { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'No supported machine-readable consumer-quota API', collectionMode: 'capability_probe', adapterVersion: 'n/a', sourceVersion: 'n/a', observedAt: null, state: 'unsupported', windows: [] },
      { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'No validated snapshot', collectionMode: 'snapshot', adapterVersion: 'n/a', sourceVersion: 'n/a', observedAt: null, state: 'not_yet_observed', rateLimitPerSecond: 1, windows: [] },
      { provider: 'elevenlabs', product: 'ElevenLabs', metricClass: 'media_api_quota', authority: 'No validated snapshot', collectionMode: 'snapshot', adapterVersion: 'n/a', sourceVersion: 'n/a', observedAt: null, state: 'not_yet_observed', windows: [] },
    ],
  };
}
