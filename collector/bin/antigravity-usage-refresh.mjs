#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { buildAntigravityUsageExpectProgram } from '../lib/antigravity-usage-refresh.mjs';
import { lsofWorkingDirectoryCommand } from '../lib/process-cwd.mjs';

function activeAntigravityWorkingDirectory() {
  const processes = execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim().split(/\s+/, 2))
    .filter(([pid, command]) => pid && command === 'agy')
    .map(([pid]) => pid);
  for (const pid of processes) {
    const lines = execFileSync(lsofWorkingDirectoryCommand(pid)[0], lsofWorkingDirectoryCommand(pid).slice(1), { encoding: 'utf8' }).split('\n');
    const cwd = lines.find((line) => line.startsWith('n'))?.slice(1);
    if (cwd) return cwd;
  }
  return null;
}

const cwd = activeAntigravityWorkingDirectory();
if (!cwd) {
  process.stdout.write('antigravity-usage-refresh=skipped_no_active_trusted_session\n');
  process.exit(0);
}
const result = spawnSync('/usr/bin/expect', ['-c', buildAntigravityUsageExpectProgram()], {
  encoding: 'utf8', timeout: 45_000,
  env: { ...process.env, ACC_AGY_PROBE_CWD: cwd },
});
const outcome = String(result.stdout || '').trim().split(/\s+/).at(-1) || 'unknown';
process.stdout.write(`antigravity-usage-refresh=${outcome}\n`);
process.exit(result.error ? 1 : 0);
