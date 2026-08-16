#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PROVIDER_USAGE_REFRESH_TIMEOUT_MS, scheduledUsageRefreshScripts } from '../lib/scheduled-provider-usage.mjs';

const root = resolve(import.meta.dirname, '..');
let refreshFailed = false;
for (const refreshScript of scheduledUsageRefreshScripts(root)) {
  const refresh = spawnSync(process.execPath, [refreshScript], { stdio: 'inherit', timeout: PROVIDER_USAGE_REFRESH_TIMEOUT_MS });
  if (refresh.error || refresh.status !== 0) {
    refreshFailed = true;
    process.stderr.write(`provider usage refresh failed: ${refresh.error?.message || `exit ${refresh.status}`}\n`);
  }
}
const publish = spawnSync(process.execPath, [resolve(root, 'run.mjs')], { stdio: 'inherit', timeout: 120_000 });
if (publish.error) process.stderr.write(`provider usage publication failed: ${publish.error.message}\n`);
process.exit(refreshFailed || publish.status !== 0 ? 1 : 0);
