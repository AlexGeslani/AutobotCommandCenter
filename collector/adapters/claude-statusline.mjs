import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_ACC_PATHS, pathInPrivateCache } from '../../src/path-config.mjs';

export const CLAUDE_CACHE_PATH = pathInPrivateCache('claude-statusline.json', DEFAULT_ACC_PATHS);

function iso(value) {
  if (typeof value === 'number') return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

const CLAUDE_WINDOWS = {
  five_hour: '5-hour window',
  seven_day: '7-day window',
};

export function normalizeClaudeStatusLine(input, now = new Date().toISOString()) {
  const limits = input?.rate_limits;
  if (!limits || Array.isArray(limits) || typeof limits !== 'object') throw new TypeError('Claude status line omitted rate_limits');
  for (const id of Object.keys(limits)) {
    if (!(id in CLAUDE_WINDOWS)) throw new TypeError('Claude status line has unknown rate-limit window');
  }
  const windows = Object.entries(CLAUDE_WINDOWS).flatMap(([id, label]) => {
    const value = limits[id];
    if (!value) return [];
    const usedPercent = value.used_percentage ?? value.usedPercent;
    const resetsAt = iso(value.resets_at ?? value.resetsAt);
    if (!Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100 || !resetsAt) throw new TypeError('Claude status line has invalid rate-limit window');
    return [{ id, label, usedPercent, resetsAt }];
  });
  return {
    provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota',
    authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache',
    adapterVersion: '1.0.0', sourceVersion: 'claude-status-line', observedAt: now,
    state: windows.length ? 'fresh' : 'not_yet_observed', windows,
  };
}

export async function writeClaudeStatusLineCache(input, { cachePath = CLAUDE_CACHE_PATH, now = new Date().toISOString() } = {}) {
  const record = normalizeClaudeStatusLine(input, now);
  await mkdir(dirname(cachePath), { recursive: true, mode: 0o700 });
  const tempPath = `${cachePath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(record), { mode: 0o600 });
  await rename(tempPath, cachePath);
  return record;
}

export function createClaudeAdapter({ cachePath = CLAUDE_CACHE_PATH } = {}) {
  return {
    id: 'claude',
    async collect({ now }) {
      try {
        const record = JSON.parse(await readFile(cachePath, 'utf8'));
        return { ...record, observedAt: record.observedAt || now };
      } catch (error) {
        if (error?.code === 'ENOENT') return {
          provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota',
          authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache',
          adapterVersion: '1.0.0', sourceVersion: 'not_configured', observedAt: now, state: 'not_configured', windows: [],
        };
        throw error;
      }
    },
  };
}
