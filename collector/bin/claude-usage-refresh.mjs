#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadAccPathConfig, pathInPrivateCache } from '../../src/path-config.mjs';
import {
  CLAUDE_USAGE_COMMAND_TIMEOUT_MS,
  buildClaudeUsageExpectProgram,
  refreshClaudeUsageCache,
} from '../lib/claude-usage-refresh.mjs';

const paths = await loadAccPathConfig();
const privateDir = paths.providerUsagePrivateCacheDir;
const claudeCachePath = pathInPrivateCache('claude-statusline.json', paths);
const emptyMcpPath = join(privateDir, 'claude-empty-mcp.json');

async function writeAtomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function readRecord() {
  return JSON.parse(await readFile(claudeCachePath, 'utf8'));
}

async function runUsage() {
  await writeAtomicJson(emptyMcpPath, { mcpServers: {} });
  const result = spawnSync('/usr/bin/expect', ['-c', buildClaudeUsageExpectProgram()], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: CLAUDE_USAGE_COMMAND_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, ACC_CLAUDE_EMPTY_MCP: emptyMcpPath },
  });
  if (result.error || result.status !== 0) throw new Error('guarded Claude /usage command did not complete');
  return result.stdout || '';
}

try {
  const result = await refreshClaudeUsageCache({
    readRecord,
    runUsage,
    writeRecord: (record) => writeAtomicJson(claudeCachePath, record),
  });
  process.stdout.write(`claude-usage-refresh=${result.outcome}\n`);
} catch {
  process.stderr.write('claude-usage-refresh=failed\n');
  process.exitCode = 1;
}
