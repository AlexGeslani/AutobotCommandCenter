import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { writeAtomicJson } from '../lib/atomic-json.mjs';
import { DEFAULT_ACC_PATHS, pathInPrivateCache } from '../../src/path-config.mjs';

export const ELEVENLABS_CACHE_PATH = pathInPrivateCache('elevenlabs.json', DEFAULT_ACC_PATHS);
export const ELEVENLABS_REFRESH_AFTER_MS = 60 * 60 * 1000;
export const ELEVENLABS_FAILURE_RETRY_MS = 15 * 60 * 1000;

const METADATA = Object.freeze({
  provider: 'elevenlabs',
  product: 'ElevenLabs',
  metricClass: 'media_api_quota',
  authority: 'ElevenLabs GET /v1/user/subscription',
  collectionMode: 'direct_api',
  adapterVersion: '1.0.0',
});

function isoFromUnixSeconds(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive Unix timestamp`);
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid Unix timestamp`);
  return date.toISOString();
}

export function normalizeElevenLabsSubscription(value, now = new Date().toISOString()) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError('ElevenLabs subscription must be an object');
  const used = value.character_count;
  const limit = value.character_limit;
  if (!Number.isInteger(used) || used < 0) throw new TypeError('ElevenLabs character_count must be a non-negative integer');
  if (!Number.isInteger(limit) || limit <= 0) throw new TypeError('ElevenLabs character_limit must be a positive integer');
  const remaining = Math.max(0, limit - used);
  const usedPercent = Number((((limit - remaining) / limit) * 100).toFixed(4));
  return {
    ...METADATA,
    sourceVersion: 'elevenlabs-subscription-api',
    observedAt: new Date(now).toISOString(),
    state: 'fresh',
    windows: [{
      id: 'monthly',
      label: 'Monthly credits',
      usedPercent,
      limit,
      remaining,
      resetsAt: isoFromUnixSeconds(value.next_character_count_reset_unix, 'ElevenLabs next_character_count_reset_unix'),
    }],
  };
}

async function readConfiguredApiKey(envPath) {
  if (process.env.ACC_ELEVENLABS_API_KEY) return process.env.ACC_ELEVENLABS_API_KEY;
  try {
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?ACC_ELEVENLABS_API_KEY\s*=\s*(.*?)\s*$/);
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
    const value = JSON.parse(await readFile(cachePath, 'utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (typeof value.attemptedAt !== 'string' || !value.record || Array.isArray(value.record) || typeof value.record !== 'object') return null;
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeCache(cachePath, attemptedAt, record) {
  await mkdir(dirname(cachePath), { recursive: true, mode: 0o700 });
  await writeAtomicJson(cachePath, { attemptedAt, record }, { mode: 0o600 });
}

function unavailableRecord(state, now, cachedRecord = null) {
  if (cachedRecord?.sourceVersion === 'elevenlabs-subscription-api' && Array.isArray(cachedRecord.windows) && cachedRecord.windows.length) {
    return { ...cachedRecord, state };
  }
  return {
    ...METADATA,
    sourceVersion: state === 'not_configured' ? 'not_configured' : 'unavailable',
    observedAt: new Date(now).toISOString(),
    state,
    windows: [],
  };
}

function cacheCanBeReused(cache, nowMs, refreshAfterMs, failureRetryMs) {
  if (!cache) return false;
  const attemptedMs = Date.parse(cache.attemptedAt);
  if (!Number.isFinite(attemptedMs) || attemptedMs > nowMs) return false;
  const retryAfterMs = ['auth_error', 'error'].includes(cache.record?.state) ? failureRetryMs : refreshAfterMs;
  if (nowMs - attemptedMs >= retryAfterMs) return false;
  return !cache.record?.windows?.some((window) => Number.isFinite(Date.parse(window.resetsAt)) && Date.parse(window.resetsAt) <= nowMs);
}

export function createElevenLabsAdapter({
  apiKey = null,
  cachePath = ELEVENLABS_CACHE_PATH,
  envPath = DEFAULT_ACC_PATHS.elevenLabsEnvFile,
  refreshAfterMs = ELEVENLABS_REFRESH_AFTER_MS,
  failureRetryMs = ELEVENLABS_FAILURE_RETRY_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    id: 'elevenlabs',
    async collect({ now }) {
      const nowMs = Date.parse(now);
      const cache = await readCache(cachePath);
      if (cacheCanBeReused(cache, nowMs, refreshAfterMs, failureRetryMs)) return cache.record;

      const credential = apiKey || await readConfiguredApiKey(envPath);
      if (!credential) return cache?.record || unavailableRecord('not_configured', now);

      try {
        const response = await fetchImpl('https://api.elevenlabs.io/v1/user/subscription', {
          headers: {
            Accept: 'application/json',
            'xi-api-key': credential,
            'User-Agent': 'ACC-ElevenLabs-Capacity/1.0',
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (response.status === 401 || response.status === 403) {
          const record = unavailableRecord('auth_error', now, cache?.record);
          await writeCache(cachePath, new Date(now).toISOString(), record);
          return record;
        }
        if (!response.ok) {
          const record = unavailableRecord('error', now, cache?.record);
          await writeCache(cachePath, new Date(now).toISOString(), record);
          return record;
        }
        const record = normalizeElevenLabsSubscription(await response.json(), now);
        await writeCache(cachePath, record.observedAt, record);
        return record;
      } catch {
        const record = unavailableRecord('error', now, cache?.record);
        await writeCache(cachePath, new Date(now).toISOString(), record);
        return record;
      }
    },
  };
}
