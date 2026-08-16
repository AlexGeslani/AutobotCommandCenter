import { describe, expect, it } from 'vitest';
import {
  PUBLIC_PROVIDER_USAGE_SCHEMA_VERSION,
  buildProviderUsageSnapshot,
  deriveProviderUsageState,
  isPublicProviderUsageSnapshot,
} from '../src/provider-usage/schema.mjs';

const generatedAt = '2026-07-27T12:00:00.000Z';
const codex = {
  provider: 'codex',
  product: 'Codex / ChatGPT',
  metricClass: 'subscription_quota',
  authority: 'installed Codex app-server account/rateLimits/read',
  collectionMode: 'local_app_server',
  adapterVersion: '1.0.0',
  sourceVersion: 'installed-app-server',
  observedAt: '2026-07-27T11:59:00.000Z',
  state: 'fresh',
  windows: [{ id: 'primary', label: 'Primary window', usedPercent: 42, resetsAt: '2026-07-27T14:00:00.000Z' }],
};

describe('public provider usage snapshot', () => {
  it('projects only allowlisted quota fields and rejects raw/private provider data', () => {
    const snapshot = buildProviderUsageSnapshot({ generatedAt, providers: [codex] });
    expect(snapshot.schemaVersion).toBe(PUBLIC_PROVIDER_USAGE_SCHEMA_VERSION);
    expect(snapshot.providers).toEqual([codex]);
    expect(isPublicProviderUsageSnapshot(snapshot)).toBe(true);
    expect(() => buildProviderUsageSnapshot({
      generatedAt,
      providers: [{ ...codex, raw: { account_email: 'user@example.com', token: '«redacted:sk-…»', prompt: 'private prompt', projectPath: '/home/user/private' } }],
    })).toThrow(/unknown/i);
  });

  it('rejects unknown provider fields before public serialization', () => {
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, unexpected: 'leak' }] })).toThrow(/unknown/i);
  });

  it('rejects invalid percentages and never substitutes missing usage with zero', () => {
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, windows: [{ ...codex.windows[0], usedPercent: 101 }] }] })).toThrow(/usedPercent/i);
    const snapshot = buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, windows: [] }] });
    expect(snapshot.providers[0].windows).toEqual([]);
  });

  it('expires a stale reading after its window reset time', () => {
    expect(deriveProviderUsageState({ state: 'fresh', observedAt: '2026-07-27T11:00:00.000Z', windows: [{ resetsAt: '2026-07-27T11:30:00.000Z' }] }, generatedAt)).toBe('expired');
  });

  it('rejects unbounded provider-controlled metadata and window identities', () => {
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, sourceVersion: 'Codex 9.9.9 user@host' }] })).toThrow(/sourceVersion/i);
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, windows: [{ ...codex.windows[0], label: 'raw provider label' }] }] })).toThrow(/canonical/i);
  });

  it('rejects non-canonical provider-controlled timestamps before public serialization', () => {
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, observedAt: 'July 27, 2026', windows: [{ ...codex.windows[0], resetsAt: 'December 31, 2030' }] }] })).toThrow(/canonical UTC ISO/i);
  });

  it('marks a stopped collector stale after the observation TTL even when reset is far away', () => {
    const stale = buildProviderUsageSnapshot({
      generatedAt: '2020-01-01T00:00:00.000Z',
      providers: [{ ...codex, observedAt: '2020-01-01T00:00:00.000Z', windows: [{ ...codex.windows[0], resetsAt: '2030-01-01T00:00:00.000Z' }] }],
    }, '2026-07-27T12:00:00.000Z');
    expect(stale.providers[0].state).toBe('stale');
  });

  it('allows only canonical Antigravity status-line quota windows', () => {
    const record = { ...codex, provider: 'antigravity', product: 'Antigravity CLI', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', sourceVersion: 'antigravity-status-line', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 25, resetsAt: '2026-07-27T14:00:00.000Z' }] };
    expect(buildProviderUsageSnapshot({ generatedAt, providers: [record] }).providers[0].windows).toEqual(record.windows);
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...record, windows: [{ ...record.windows[0], id: 'untrusted' }] }] })).toThrow(/allowlisted/i);
  });

  it('accepts the canonical Claude /usage fallback and preserves reset provenance', () => {
    const record = {
      ...codex,
      provider: 'claude',
      product: 'Claude Code',
      authority: 'authenticated Claude Code /usage limits view',
      collectionMode: 'interactive_cli_usage',
      sourceVersion: 'claude-usage-cli',
      windows: [
        { id: 'five_hour', label: '5-hour window', usedPercent: 15, resetsAt: '2026-07-27T16:59:00.000Z', resetKind: 'estimated_window_end' },
        { id: 'seven_day', label: '7-day window', usedPercent: 11, resetsAt: '2026-08-04T16:00:00.000Z', resetKind: 'provider_reported' },
      ],
    };
    expect(buildProviderUsageSnapshot({ generatedAt, providers: [record] }).providers[0]).toEqual(record);
    expect(() => buildProviderUsageSnapshot({
      generatedAt,
      providers: [{ ...record, windows: [{ ...record.windows[0], resetKind: 'guessed' }] }],
    })).toThrow(/resetKind/i);
  });

  it('keeps unsupported distinct from errors and requires zero windows for it', () => {
    const unsupported = { ...codex, provider: 'antigravity', product: 'Antigravity CLI', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', sourceVersion: 'not_configured', state: 'unsupported', windows: [] };
    const snapshot = buildProviderUsageSnapshot({ generatedAt, providers: [unsupported] });
    expect(snapshot.providers[0].state).toBe('unsupported');
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...unsupported, windows: codex.windows }] })).toThrow(/allowlisted|unsupported/i);
  });

  it('keeps Brave Search in a distinct service-quota class with authoritative request counts', () => {
    const brave = {
      provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota',
      authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers',
      adapterVersion: '1.0.0', sourceVersion: 'brave-rate-limit-headers',
      observedAt: '2026-07-27T11:59:00.000Z', state: 'fresh', rateLimitPerSecond: 1,
      windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 7.9, limit: 2000, remaining: 1842, resetsAt: '2026-08-01T14:00:00.000Z' }],
    };
    expect(buildProviderUsageSnapshot({ generatedAt, providers: [brave] }).providers[0]).toEqual(brave);
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...brave, metricClass: 'subscription_quota' }] })).toThrow(/metricClass/i);
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...brave, windows: [{ ...brave.windows[0], remaining: 1841 }] }] })).toThrow(/count|percent/i);
    expect(() => buildProviderUsageSnapshot({ generatedAt, providers: [{ ...codex, windows: [{ ...codex.windows[0], limit: 2000, remaining: 1842 }] }] })).toThrow(/Brave|allowlisted/i);
  });
});
