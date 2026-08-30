import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cwd = new URL('..', import.meta.url);

async function withAdversarialFixture(content, run) {
  const fixture = new URL('./.public-safety-adversarial.tmp', import.meta.url);
  await writeFile(fixture, content, 'utf8');
  try {
    await run();
  } finally {
    await rm(fixture, { force: true });
  }
}

describe('public candidate source safety', () => {
  it('rejects private literals supplied outside the tracked repository', async () => {
    const literal = 'synthetic-internal-label';
    await withAdversarialFixture(literal, async () => {
      await expect(execFileAsync('node', ['scripts/check-public-safety.mjs'], {
        cwd,
        env: {
          ...process.env,
          ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON: JSON.stringify({ literals: [literal] }),
        },
      })).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('tests/.public-safety-adversarial.tmp: private infrastructure literal'),
      });
    });
  });

  it('rejects private LAN hostnames without a private literal file', async () => {
    const privateHost = ['knowledge', 'lan'].join('.');
    await withAdversarialFixture(`https://${privateHost}/search`, async () => {
      await expect(execFileAsync('node', ['scripts/check-public-safety.mjs'], { cwd })).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('tests/.public-safety-adversarial.tmp: private LAN hostname'),
      });
    });
  });
});
