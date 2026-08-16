import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const collectorRunPath = resolve(import.meta.dirname, '..', 'run.mjs');

export function requestSnapshotPublication() {
  const child = spawn(process.execPath, [collectorRunPath], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
}
