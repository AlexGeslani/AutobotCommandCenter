import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { writeAtomicJson } from '../lib/atomic-json.mjs';
import { DEFAULT_ACC_PATHS, pathInPrivateCache } from '../../src/path-config.mjs';

export const BRAVE_CACHE_PATH = pathInPrivateCache('brave-search.json', DEFAULT_ACC_PATHS);
export const BRAVE_REFRESH_AFTER_MS = 23 * 60 * 60 * 1000;

function csvIntegers(headers, name) {
  const value = headers.get(name);
  if (!value) throw new TypeError(`Brave response omitted ${name}`);
  const parsed = value.split(',').map((part) => Number(part.trim()));
  if (!parsed.length || parsed.some((part) => !Number.isInteger(part) || part < 0)) throw new TypeError(`Brave response has invalid ${name}`);
  return parsed;
}

function policies(headers) {
  const value = headers.get('x-ratelimit-policy');
  if (!value) throw new TypeError('Brave response omitted x-ratelimit-policy');
  return value.split(',').map((part) => {
    const match = part.trim().match(/^(\d+);w=(\d+)$/);
    if (!match) throw new TypeError('Brave response has invalid x-ratelimit-policy');
    return { limit: Number(match[1]), windowSeconds: Number(match[2]) };
  });
}

export function normalizeBraveRateLimitHeaders(headers, now = new Date().toISOString()) {
  const observedAt = new Date(now).toISOString();
  const policy = policies(headers);
  const limits = csvIntegers(headers, 'x-ratelimit-limit');
  const remaining = csvIntegers(headers, 'x-ratelimit-remaining');
  const resetSeconds = csvIntegers(headers, 'x-ratelimit-reset');
  if (new Set([policy.length, limits.length, remaining.length, resetSeconds.length]).size !== 1) throw new TypeError('Brave rate-limit header windows do not align');

  const monthlyIndex = policy.reduce((best, entry, index, all) => entry.windowSeconds > all[best].windowSeconds ? index : best, 0);
  const monthly = policy[monthlyIndex];
  if (monthly.windowSeconds <= 1 || monthly.limit !== limits[monthlyIndex]) throw new TypeError('Brave monthly quota window is unavailable');
  const monthlyRemaining = remaining[monthlyIndex];
  if (monthlyRemaining > monthly.limit) throw new TypeError('Brave remaining quota exceeds its limit');
  const perSecond = policy.find((entry, index) => entry.windowSeconds === 1 && entry.limit === limits[index]);
  if (!perSecond) throw new TypeError('Brave per-second policy is unavailable');

  const usedPercent = Number((((monthly.limit - monthlyRemaining) / monthly.limit) * 100).toFixed(4));
  const resetsAt = new Date(Date.parse(observedAt) + resetSeconds[monthlyIndex] * 1000).toISOString();
  return {
    provider: 'brave-search',
    product: 'Brave Search API',
    metricClass: 'search_api_quota',
    authority: 'Brave Search API rate-limit response headers',
    collectionMode: 'direct_api_headers',
    adapterVersion: '1.0.0',
    sourceVersion: 'brave-rate-limit-headers',
    observedAt,
    state: 'fresh',
    rateLimitPerSecond: perSecond.limit,
    windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent, limit: monthly.limit, remaining: monthlyRemaining, resetsAt }],
  };
}

async function readConfiguredApiKey(envPath) {
  if (process.env.BRAVE_SEARCH_API_KEY) return process.env.BRAVE_SEARCH_API_KEY;
  try {
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?BRAVE_SEARCH_API_KEY\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const raw = match[1];
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
      return raw;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return null;
}

async function readCache(cachePath) {
  try {
    const record = JSON.parse(await readFile(cachePath, 'utf8'));
    return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

function notConfigured(now) {
  return {
    provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota',
    authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers',
    adapterVersion: '1.0.0', sourceVersion: 'not_configured', observedAt: now,
    state: 'not_configured', rateLimitPerSecond: 1, windows: [],
  };
}

export function createBraveSearchAdapter({
  apiKey = null,
  cachePath = BRAVE_CACHE_PATH,
  envPath = DEFAULT_ACC_PATHS.braveHermesEnvFile,
  refreshAfterMs = BRAVE_REFRESH_AFTER_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    id: 'brave-search',
    async collect({ now }) {
      const cached = await readCache(cachePath);
      const cacheAge = cached?.observedAt ? Date.parse(now) - Date.parse(cached.observedAt) : Number.POSITIVE_INFINITY;
      if (cached && Number.isFinite(cacheAge) && cacheAge >= 0 && cacheAge < refreshAfterMs) return cached;

      const credential = apiKey || await readConfiguredApiKey(envPath);
      if (!credential) return cached || notConfigured(now);
      try {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.searchParams.set('q', 'Brave Search API');
        url.searchParams.set('count', '1');
        const response = await fetchImpl(url, {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': credential,
            'User-Agent': 'ACC-Brave-Quota-Observation/1.0',
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`Brave quota observation failed with HTTP ${response.status}`);
        const record = normalizeBraveRateLimitHeaders(response.headers, now);
        await response.body?.cancel?.();
        await mkdir(dirname(cachePath), { recursive: true, mode: 0o700 });
        await writeAtomicJson(cachePath, record, { mode: 0o600 });
        return record;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    },
  };
}
