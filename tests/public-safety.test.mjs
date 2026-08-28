import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const authorizedUiLabel = ['Tele', 'traan1'].join('');
const authorizedUiLabelPaths = new Set([
  'src/theme.mjs',
  '.hermes/plugins/autobot-command-center/dashboard/dist/index.js',
  'standalone/public/app.js',
]);

const candidatePaths = [
  'src/plugin.mjs',
  'src/model.mjs',
  '.hermes/plugins/autobot-command-center/dashboard/dist/index.js',
  'standalone/public/app.js',
  'scripts/check-public-safety.mjs',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function privateInfrastructurePattern() {
  const denied = [
    ['The', 'Ark', 'Lab'].join(''),
    ['The', 'Ark'].join(' '),
    ['The', 'Ark', 'Lab'].join(' '),
    ['Tele', 'traan'].join(''),
    ['Vector', 'Sigma'].join(' '),
    ['Vector', 'Sigma'].join('-'),
    ['qmd', 'lan'].join('.'),
  ];
  return new RegExp(denied.map(escapeRegExp).join('|'), 'i');
}

describe('public candidate source safety', () => {
  it('keeps private infrastructure identifiers out of source, generated artifacts, and the scanner itself', async () => {
    const pattern = privateInfrastructurePattern();
    const findings = [];
    for (const path of candidatePaths) {
      const rawText = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
      const text = authorizedUiLabelPaths.has(path) ? rawText.replaceAll(authorizedUiLabel, '') : rawText;
      if (pattern.test(text)) findings.push(path);
    }
    expect(findings).toEqual([]);
  });

  it('still rejects the authorized UI label outside its exact presentation paths', async () => {
    const fixture = new URL('./.public-safety-adversarial.tmp', import.meta.url);
    await writeFile(fixture, authorizedUiLabel, 'utf8');
    try {
      await expect(execFileAsync('node', ['scripts/check-public-safety.mjs'], { cwd: new URL('..', import.meta.url) })).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('tests/.public-safety-adversarial.tmp: private infrastructure name'),
      });
    } finally {
      await rm(fixture, { force: true });
    }
  });
});
