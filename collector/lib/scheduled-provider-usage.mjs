import { resolve } from 'node:path';

export const PROVIDER_USAGE_REFRESH_TIMEOUT_MS = 120_000;

export function scheduledUsageRefreshScripts(collectorRoot) {
  return [
    resolve(collectorRoot, 'bin', 'claude-usage-refresh.mjs'),
    resolve(collectorRoot, 'bin', 'antigravity-usage-refresh.mjs'),
  ];
}
