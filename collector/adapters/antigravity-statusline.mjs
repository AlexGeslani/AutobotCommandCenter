import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const ANTIGRAVITY_CACHE_PATH = join(process.env.ACC_PROVIDER_USAGE_PRIVATE_DIR || join(homedir(), '.acc-provider-usage'), 'antigravity-statusline.json');

const WINDOWS = {
  'gemini-5h': 'Gemini 5-hour window',
  'gemini-weekly': 'Gemini weekly window',
  '3p-5h': 'Third-party 5-hour window',
  '3p-weekly': 'Third-party weekly window',
};

function iso(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function normalizeAntigravityStatusLine(input, now = new Date().toISOString()) {
  const quota = input?.quota;
  if (!quota || Array.isArray(quota) || typeof quota !== 'object') throw new TypeError('Antigravity status line omitted quota');
  for (const id of Object.keys(quota)) if (!(id in WINDOWS)) throw new TypeError('Antigravity status line has unknown quota window');
  const windows = Object.entries(WINDOWS).flatMap(([id, label]) => {
    const value = quota[id];
    if (!value || Array.isArray(value) || typeof value !== 'object') return [];
    const remaining = value.remaining_fraction;
    const resetsAt = iso(value.reset_time);
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > 1 || !resetsAt) throw new TypeError('Antigravity status line has invalid quota window');
    return [{ id, label, usedPercent: (1 - remaining) * 100, resetsAt }];
  });
  return {
    provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota',
    authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache',
    adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt: now,
    state: windows.length ? 'fresh' : 'not_yet_observed', windows,
  };
}

export async function writeAntigravityStatusLineCache(input, { cachePath = ANTIGRAVITY_CACHE_PATH, now = new Date().toISOString() } = {}) {
  const record = normalizeAntigravityStatusLine(input, now);
  await mkdir(dirname(cachePath), { recursive: true, mode: 0o700 });
  const temporary = `${cachePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
  await rename(temporary, cachePath);
  return record;
}

export function createAntigravityAdapter({ cachePath = ANTIGRAVITY_CACHE_PATH } = {}) {
  return {
    id: 'antigravity',
    async collect({ now }) {
      try {
        const record = JSON.parse(await readFile(cachePath, 'utf8'));
        return { ...record, observedAt: record.observedAt || now };
      } catch (error) {
        if (error?.code === 'ENOENT') return {
          provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota',
          authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache',
          adapterVersion: '1.0.0', sourceVersion: 'not_configured', observedAt: now, state: 'not_configured', windows: [],
        };
        throw error;
      }
    },
  };
}
