import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { reconcileAntigravityActivity } from '../collector/lib/antigravity-usage-refresh.mjs';

const prior = {
  provider: 'antigravity',
  product: 'Antigravity CLI',
  metricClass: 'subscription_quota',
  authority: 'documented Antigravity CLI status-line quota event',
  collectionMode: 'status_line_cache',
  adapterVersion: '1.0.0',
  sourceVersion: 'antigravity-status-line',
  observedAt: '2026-08-29T12:00:00.000Z',
  state: 'fresh',
  windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 25, resetsAt: '2026-08-29T16:00:00.000Z' }],
};

describe('passive Antigravity activity reconciliation', () => {
  it('publishes inactive/not-evaluated without headroom when no trusted session or last-good record exists', async () => {
    const writes = [];
    const result = await reconcileAntigravityActivity({
      now: '2026-08-29T14:00:00.000Z',
      hasActiveTrustedSession: async () => false,
      readRecord: async () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; },
      writeRecord: async (record) => writes.push(record),
    });
    expect(result.outcome).toBe('inactive');
    expect(writes).toEqual([expect.objectContaining({ provider: 'antigravity', state: 'inactive', sourceVersion: 'not_configured', windows: [] })]);
  });

  it('retains only validated last-good windows as explicitly non-current while inactive', async () => {
    const writes = [];
    const result = await reconcileAntigravityActivity({
      now: '2026-08-29T14:00:00.000Z',
      hasActiveTrustedSession: async () => false,
      readRecord: async () => prior,
      writeRecord: async (record) => writes.push(record),
    });
    expect(result.outcome).toBe('inactive');
    expect(writes[0]).toMatchObject({ state: 'inactive', observedAt: prior.observedAt, windows: prior.windows });
  });

  it('does not launch, create trust, or overwrite a fresh status-line observation while an already-trusted session is active', async () => {
    let reads = 0;
    let probes = 0;
    const writes = [];
    const result = await reconcileAntigravityActivity({
      hasActiveTrustedSession: async () => true,
      probeTrustedSession: async () => { probes += 1; return true; },
      readRecord: async () => { reads += 1; return prior; },
      writeRecord: async (record) => writes.push(record),
    });
    expect(result).toEqual({ outcome: 'active_session' });
    expect(probes).toBe(0);
    expect(reads).toBe(0);
    expect(writes).toEqual([]);
  });

  it('keeps a newly refreshed trusted status-line observation current after the bounded probe exits', async () => {
    const writes = [];
    const result = await reconcileAntigravityActivity({
      hasActiveTrustedSession: async () => false,
      probeTrustedSession: async () => true,
      readRecord: async () => prior,
      writeRecord: async (record) => writes.push(record),
    });
    expect(result).toEqual({ outcome: 'refreshed' });
    expect(writes).toEqual([]);
  });

  it('scheduled reconciliation uses only a bounded no-input CLI probe and never starts a model turn', async () => {
    const source = await readFile(new URL('../collector/bin/antigravity-usage-refresh.mjs', import.meta.url), 'utf8');
    const helper = await readFile(new URL('../collector/bin/antigravity-passive-probe.py', import.meta.url), 'utf8');
    expect(source).toContain("'./antigravity-passive-probe.py'");
    expect(source).toContain('timeout: 5_000');
    expect(helper).toContain('["/opt/homebrew/bin/agy"]');
    expect(helper).toContain('time.monotonic() + 3.0');
    expect(`${source}\n${helper}`).not.toMatch(/buildAntigravityUsageExpectProgram|\/usage|--print|--prompt|--continue|--conversation/);
    expect(source).toContain('reconcileAntigravityActivity');
  });

  it('fails closed instead of retaining malformed private cache bytes', async () => {
    const writes = [];
    await reconcileAntigravityActivity({
      now: '2026-08-29T14:00:00.000Z',
      hasActiveTrustedSession: async () => false,
      readRecord: async () => ({ ...prior, privatePath: '/must/not/leak' }),
      writeRecord: async (record) => writes.push(record),
    });
    expect(writes[0]).toMatchObject({ state: 'inactive', sourceVersion: 'not_configured', windows: [] });
    expect(JSON.stringify(writes[0])).not.toContain('must/not/leak');
  });
});
