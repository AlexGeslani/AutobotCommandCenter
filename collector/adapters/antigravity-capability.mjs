import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function createAntigravityAdapter({ command = 'agy' } = {}) {
  return {
    id: 'antigravity',
    async collect({ now }) {
      try {
        await execFileAsync(command, ['--version'], { timeout: 5_000, maxBuffer: 4_096 });
      } catch {
        // Capability state is intentionally not surfaced beyond unsupported.
      }
      return {
        provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota',
        authority: 'No supported machine-readable consumer-quota API', collectionMode: 'capability_probe',
        adapterVersion: '1.0.0', sourceVersion: 'capability-probe', observedAt: now, state: 'unsupported', windows: [],
      };
    },
  };
}
