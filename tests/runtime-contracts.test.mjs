import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  DEMO_DOMAIN_PROJECTION,
  DEMO_EDITION,
  validateDomainProjection,
  validateEdition,
} from '../src/runtime/contracts.mjs';
import { createRuntimeLoader } from '../src/runtime/client.mjs';

const execFileAsync = promisify(execFile);
const publisher = new URL('../scripts/publish-runtime-projection.mjs', import.meta.url);
const jsonResponse = (value) => ({ ok: true, text: async () => JSON.stringify(value) });

describe('Core + Edition + Projection runtime contract', () => {
  it('accepts the sanitized demo and rejects executable or escaping edition configuration', () => {
    expect(validateEdition(DEMO_EDITION).id).toBe('demo');
    expect(validateDomainProjection(DEMO_DOMAIN_PROJECTION).data.meta.fixture).toBe(true);
    expect(() => validateEdition({ ...DEMO_EDITION, modules: DEMO_EDITION.modules.map((module, index) => index ? module : { id: 'dynamic-import', label: 'Code' }) })).toThrow(/known modules/i);
    expect(() => validateEdition({ ...DEMO_EDITION, projections: { ...DEMO_EDITION.projections, domain: '../private.json' } })).toThrow(/safe relative/i);
    expect(() => validateEdition({ ...DEMO_EDITION, projections: { ...DEMO_EDITION.projections, domain: 'https://example.invalid/data.json' } })).toThrow(/safe relative/i);
  });

  it('rejects relationship drift before projections reach selectors', () => {
    const broken = structuredClone(DEMO_DOMAIN_PROJECTION);
    broken.data.results[0].conditionId = 'unknown-condition';
    expect(() => validateDomainProjection(broken)).toThrow(/unknown condition/i);
  });

  it('rejects malformed benchmark detail rows before tuple destructuring can corrupt the UI', () => {
    const broken = structuredClone(DEMO_DOMAIN_PROJECTION);
    broken.data.benchmarkComparison[0].scores.tools.detail = ['not a label-value pair'];
    expect(() => validateDomainProjection(broken)).toThrow(/must be a \[label, value\] pair/i);
  });

  it('retains the explicit last-good domain as stale_invalid after malformed replacement', async () => {
    const responses = [
      jsonResponse(DEMO_EDITION),
      jsonResponse(DEMO_DOMAIN_PROJECTION),
      jsonResponse(DEMO_EDITION),
      jsonResponse({ schemaVersion: 'acc-domain-projection-v1', generatedAt: 'not-a-time' }),
    ];
    const loader = createRuntimeLoader({ fetcher: async () => responses.shift() });
    const first = await loader('/');
    const second = await loader('/');
    expect(first.health.state).toBe('ready');
    expect(second.domain).toEqual(first.domain);
    expect(second.health.domain).toMatchObject({ state: 'stale_invalid', stale: true, valid: false });
    expect(second.health.edition.state).toBe('ready');
  });

  it('isolates an invalid edition while a valid domain refresh still advances through the last-good locator', async () => {
    const advanced = structuredClone(DEMO_DOMAIN_PROJECTION);
    advanced.generatedAt = '2026-01-02T00:00:00.000Z';
    const responses = [
      jsonResponse(DEMO_EDITION),
      jsonResponse(DEMO_DOMAIN_PROJECTION),
      jsonResponse({ ...DEMO_EDITION, modules: [{ id: 'unknown', label: 'Unknown' }] }),
      jsonResponse(advanced),
    ];
    const loader = createRuntimeLoader({ fetcher: async () => responses.shift() });
    await loader('/');
    const second = await loader('/');
    expect(second.health.edition.state).toBe('stale_invalid');
    expect(second.health.domain.state).toBe('ready');
    expect(second.domain.generatedAt).toBe(advanced.generatedAt);
  });
});

describe('atomic runtime publisher', () => {
  it('rejects malformed input and leaves the last-good destination byte-identical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'acc-runtime-invalid-'));
    const input = join(root, 'candidate.json');
    const output = join(root, 'domain.v1.json');
    const lastGood = `${JSON.stringify(DEMO_DOMAIN_PROJECTION, null, 2)}\n`;
    await Promise.all([writeFile(input, '{"invalid":true}\n'), writeFile(output, lastGood)]);
    await expect(execFileAsync(process.execPath, [publisher.pathname, '--input', input, '--output', output])).rejects.toThrow();
    expect(await readFile(output, 'utf8')).toBe(lastGood);
    expect((await readdir(root)).some((name) => name.includes('.tmp-'))).toBe(false);
  });

  it('publishes validated bytes to every destination and reports the schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'acc-runtime-valid-'));
    const input = join(root, 'candidate.json');
    const first = join(root, 'first.json');
    const second = join(root, 'second.json');
    await writeFile(input, JSON.stringify(DEMO_DOMAIN_PROJECTION));
    const { stdout } = await execFileAsync(process.execPath, [publisher.pathname, '--input', input, '--output', first, '--output', second]);
    expect(JSON.parse(stdout)).toMatchObject({ status: 'ok', schemaVersion: 'acc-domain-projection-v1', benchmarkProfiles: 1 });
    expect(await readFile(first, 'utf8')).toBe(await readFile(second, 'utf8'));
    expect(validateDomainProjection(JSON.parse(await readFile(first, 'utf8'))).data.products).toHaveLength(1);
  });
});
