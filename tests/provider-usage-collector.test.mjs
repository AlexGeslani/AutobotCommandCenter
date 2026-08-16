import { describe, expect, it } from 'vitest';
import { collectProviderUsage } from '../collector/index.mjs';

describe('provider usage collector', () => {
  it('keeps healthy records when another adapter fails closed', async () => {
    const snapshot = await collectProviderUsage({
      now: '2026-07-27T12:00:00.000Z',
      adapters: [
        { id: 'codex', collect: async () => ({ provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt: '2026-07-27T11:59:00.000Z', state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 30, resetsAt: '2026-07-27T13:00:00.000Z' }] }) },
        { id: 'claude', collect: async () => { throw new Error('cache unavailable'); } },
      ],
    });
    expect(snapshot.providers.find((provider) => provider.provider === 'codex')?.state).toBe('fresh');
    expect(snapshot.providers.find((provider) => provider.provider === 'claude')).toMatchObject({ state: 'error', windows: [] });
  });

  it('keeps healthy records when another adapter returns malformed data', async () => {
    const snapshot = await collectProviderUsage({
      now: '2026-07-27T12:00:00.000Z',
      adapters: [
        { id: 'codex', collect: async () => ({ provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt: '2026-07-27T11:59:00.000Z', state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 30, resetsAt: '2026-07-27T13:00:00.000Z' }] }) },
        { id: 'claude', collect: async () => ({ provider: 'claude', not: 'public' }) },
      ],
    });
    expect(snapshot.providers.find((provider) => provider.provider === 'codex')?.state).toBe('fresh');
    expect(snapshot.providers.find((provider) => provider.provider === 'claude')).toMatchObject({ state: 'error', windows: [] });
  });

  it('preserves an adapter observation timestamp when a later snapshot is generated', async () => {
    const observedAt = '2026-07-27T11:45:00.000Z';
    const generatedAt = '2026-07-27T12:00:00.000Z';
    const snapshot = await collectProviderUsage({
      now: generatedAt,
      adapters: [{
        id: 'claude',
        collect: async () => ({
          provider: 'claude',
          product: 'Claude Code',
          metricClass: 'subscription_quota',
          authority: 'documented Claude Code status-line rate_limits event',
          collectionMode: 'status_line_cache',
          adapterVersion: '1.0.0',
          sourceVersion: 'claude-status-line',
          observedAt,
          state: 'fresh',
          windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 30, resetsAt: '2026-07-27T13:00:00.000Z' }],
        }),
      }],
    });
    expect(snapshot.generatedAt).toBe(generatedAt);
    expect(snapshot.providers[0].observedAt).toBe(observedAt);
  });

  it('fails Brave independently without blanking frontier subscription records', async () => {
    const snapshot = await collectProviderUsage({
      now: '2026-07-27T12:00:00.000Z',
      adapters: [
        { id: 'codex', collect: async () => ({ provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt: '2026-07-27T11:59:00.000Z', state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 30, resetsAt: '2026-07-27T13:00:00.000Z' }] }) },
        { id: 'brave-search', collect: async () => { throw new Error('Brave unavailable'); } },
      ],
    });
    expect(snapshot.providers.find((provider) => provider.provider === 'codex')?.state).toBe('fresh');
    expect(snapshot.providers.find((provider) => provider.provider === 'brave-search')).toMatchObject({ metricClass: 'search_api_quota', state: 'error', windows: [] });
  });
});
