#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadAccPathConfig, pathInPrivateCache } from '../../src/path-config.mjs';
import { buildProviderUsageSnapshot } from '../../src/provider-usage/schema.mjs';
import { reconcileAntigravityActivity } from '../lib/antigravity-usage-refresh.mjs';
import { writeAtomicJson } from '../lib/atomic-json.mjs';

function hasActiveTrustedSession() {
  try {
    return execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' })
      .split('\n')
      .some((command) => command.trim() === 'agy');
  } catch {
    // Process discovery is evidence. If it fails, do not claim inactivity.
    return true;
  }
}

async function probeTrustedSession(readRecord) {
  let before = null;
  try {
    before = await readRecord();
  } catch {
    // A missing or malformed prior observation may still be repaired by the probe.
  }
  try {
    const helperPath = fileURLToPath(new URL('./antigravity-passive-probe.py', import.meta.url));
    execFileSync('/opt/homebrew/bin/python3', [helperPath, cachePath], {
      timeout: 5_000,
      stdio: 'ignore',
      killSignal: 'SIGKILL',
    });
  } catch {
    // Missing auth, prompts, malformed output, and timeouts all fail closed.
  }
  try {
    const after = await readRecord();
    const now = new Date().toISOString();
    const validated = buildProviderUsageSnapshot({ generatedAt: now, providers: [after] }, now).providers[0];
    return validated.provider === 'antigravity'
      && validated.state === 'fresh'
      && validated.observedAt !== before?.observedAt
      && validated.windows.length > 0;
  } catch {
    return false;
  }
}

const paths = await loadAccPathConfig();
const privateDir = paths.providerUsagePrivateCacheDir;
const cachePath = pathInPrivateCache('antigravity-statusline.json', paths);
await mkdir(privateDir, { recursive: true, mode: 0o700 });
await chmod(privateDir, 0o700);

try {
  const readRecord = async () => JSON.parse(await readFile(cachePath, 'utf8'));
  const result = await reconcileAntigravityActivity({
    hasActiveTrustedSession,
    probeTrustedSession: () => probeTrustedSession(readRecord),
    readRecord,
    writeRecord: (record) => writeAtomicJson(cachePath, record, { mode: 0o600 }),
  });
  process.stdout.write(`antigravity-usage-refresh=${result.outcome}\n`);
} catch {
  process.stderr.write('antigravity-usage-refresh=failed_closed\n');
  process.exitCode = 1;
}
