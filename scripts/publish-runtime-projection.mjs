#!/usr/bin/env node
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDomainProjection } from '../src/runtime/contracts.mjs';

function parseArgs(argv) {
  const options = { outputs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value) throw new TypeError(`Missing value for ${key}`);
    if (key === '--input') options.input = value;
    else if (key === '--output') options.outputs.push(value);
    else throw new TypeError(`Unknown argument ${key}`);
    index += 1;
  }
  if (!options.input || !options.outputs.length) throw new TypeError('Usage: publish-runtime-projection --input candidate.json --output destination.json [--output destination.json]');
  return options;
}

async function writeAtomic(path, bytes) {
  const destination = resolve(path);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o644);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, destination);
    const directory = await open(dirname(destination), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function publishRuntimeProjection({ input, outputs }) {
  const candidateText = await readFile(resolve(input), 'utf8');
  const candidate = validateDomainProjection(JSON.parse(candidateText));
  const bytes = `${JSON.stringify(candidate, null, 2)}\n`;
  for (const output of outputs) await writeAtomic(output, bytes);
  return {
    schemaVersion: candidate.schemaVersion,
    generatedAt: candidate.generatedAt,
    outputs: outputs.map((path) => resolve(path)),
    benchmarkProfiles: candidate.data.benchmarkComparison.length,
  };
}

async function run() {
  const result = await publishRuntimeProjection(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ status: 'ok', ...result }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
