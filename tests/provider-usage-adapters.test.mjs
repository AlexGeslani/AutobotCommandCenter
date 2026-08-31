import { describe, expect, it } from 'vitest';
import { normalizeCodexRateLimits } from '../collector/adapters/codex-app-server.mjs';
import { normalizeClaudeStatusLine } from '../collector/adapters/claude-statusline.mjs';
import { summarizeAntigravityStatusLine } from '../collector/adapters/antigravity-statusline-gate.mjs';
import { normalizeAntigravityStatusLine } from '../collector/adapters/antigravity-statusline.mjs';
import { createBraveSearchAdapter, normalizeBraveRateLimitHeaders } from '../collector/adapters/brave-search.mjs';
import { createElevenLabsAdapter, normalizeElevenLabsSubscription } from '../collector/adapters/elevenlabs.mjs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Codex app-server boundary', () => {
  it('projects a distinct allowlisted per-limit reset once and suppresses the duplicate primary window', () => {
    const record = normalizeCodexRateLimits({
      rateLimits: {
        primary: { usedPercent: 42, resetsAt: 1785592800 },
        secondary: null,
      },
      rateLimitsByLimitId: {
        codex: { primary: { usedPercent: 42, resetsAt: 1785592800 } },
        codex_bengalfox: { primary: { usedPercent: 17, resetsAt: 1786000000 } },
      },
      rateLimitResetCredits: {
        availableCount: 2,
        credits: [{ expiresAt: 1786100000 }, { expiresAt: 1786200000 }],
      },
    }, '2026-07-27T12:00:00.000Z');
    expect(record.windows).toEqual([
      { id: 'primary', label: 'Primary window', usedPercent: 42, resetsAt: '2026-08-01T14:00:00.000Z' },
      { id: 'additional', label: 'GPT-5.3-Codex-Spark', usedPercent: 17, resetsAt: '2026-08-06T07:06:40.000Z' },
    ]);
    expect(record.resetCredits).toEqual({
      availableCount: 2,
      credits: [{ expiresAt: '2026-08-07T10:53:20.000Z' }, { expiresAt: '2026-08-08T14:40:00.000Z' }],
    });
  });
});

describe('Claude status-line boundary', () => {
  it('projects only the two canonical documented rate-limit windows', () => {
    const record = normalizeClaudeStatusLine({
      rate_limits: {
        five_hour: { used_percentage: 12, resets_at: 1785592800 },
        seven_day: { used_percentage: 34, resets_at: 1786000000 },
      },
      session_id: 'must-not-persist',
    }, '2026-07-27T12:00:00.000Z');
    expect(record.windows).toEqual([
      { id: 'five_hour', label: '5-hour window', usedPercent: 12, resetsAt: '2026-08-01T14:00:00.000Z' },
      { id: 'seven_day', label: '7-day window', usedPercent: 34, resetsAt: '2026-08-06T07:06:40.000Z' },
    ]);
    expect(JSON.stringify(record)).not.toContain('session_id');
  });

  it('rejects unknown rate-limit keys before private-cache write', () => {
    expect(() => normalizeClaudeStatusLine({
      rate_limits: { private_quota: { used_percentage: 1, resets_at: 1785592800 } },
    })).toThrow(/unknown rate-limit/i);
  });
});

describe('Antigravity status-line observation gate', () => {
  it('retains only deterministic field paths and types, never source values', () => {
    const summary = summarizeAntigravityStatusLine({
      quota: [{ remaining_fraction: 0.42, reset_time: '2026-07-28T05:00:00.000Z' }],
      session_id: 'private-session-id',
      prompt: 'private prompt text',
    });
    expect(summary).toEqual({
      schemaVersion: 'antigravity-statusline-fingerprint-v1',
      paths: [
        'prompt:string',
        'quota:array',
        'quota[].remaining_fraction:number',
        'quota[].reset_time:string',
        'quota[]:object',
        'session_id:string',
      ],
    });
    expect(JSON.stringify(summary)).not.toContain('0.42');
    expect(JSON.stringify(summary)).not.toContain('private-session-id');
  });
});

describe('Antigravity status-line adapter', () => {
  it('projects only allowlisted quota windows and discards the rest of agent state', () => {
    const record = normalizeAntigravityStatusLine({
      quota: {
        'gemini-5h': { remaining_fraction: 0.75, reset_time: '2026-07-28T16:00:00.000Z' },
        'gemini-weekly': { remaining_fraction: 0.5, reset_time: '2026-08-01T00:00:00.000Z' },
      },
      email: 'must-not-persist@example.test',
      session_id: 'must-not-persist',
      workspace: { project_dir: '/private/path' },
    }, '2026-07-28T14:52:34.678Z');
    expect(record.windows).toEqual([
      { id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 25, resetsAt: '2026-07-28T16:00:00.000Z' },
      { id: 'gemini-weekly', label: 'Gemini weekly window', usedPercent: 50, resetsAt: '2026-08-01T00:00:00.000Z' },
    ]);
    expect(JSON.stringify(record)).not.toContain('must-not-persist');
    expect(JSON.stringify(record)).not.toContain('private/path');
  });
});

describe('Brave Search API boundary', () => {
  const headers = new Headers({
    'x-ratelimit-limit': '1, 2000',
    'x-ratelimit-policy': '1;w=1, 2000;w=2678400',
    'x-ratelimit-remaining': '0, 1842',
    'x-ratelimit-reset': '1, 1732530',
  });

  it('projects the authoritative monthly count and reset without retaining response content', () => {
    const record = normalizeBraveRateLimitHeaders(headers, '2026-08-11T22:44:29.000Z');
    expect(record).toEqual({
      provider: 'brave-search',
      product: 'Brave Search API',
      metricClass: 'search_api_quota',
      authority: 'Brave Search API rate-limit response headers',
      collectionMode: 'direct_api_headers',
      adapterVersion: '1.0.0',
      sourceVersion: 'brave-rate-limit-headers',
      observedAt: '2026-08-11T22:44:29.000Z',
      state: 'fresh',
      rateLimitPerSecond: 1,
      windows: [{
        id: 'monthly', label: 'Monthly searches', usedPercent: 7.9,
        limit: 2000, remaining: 1842, resetsAt: '2026-08-31T23:59:59.000Z',
      }],
    });
  });

  it('reuses a private observation for a day instead of spending quota every collector tick', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'acc-brave-'));
    const cachePath = join(cacheDir, 'brave-search.json');
    let requests = 0;
    const adapter = createBraveSearchAdapter({
      apiKey: 'test-only-key', cachePath, refreshAfterMs: 24 * 60 * 60 * 1000,
      fetchImpl: async () => { requests += 1; return { ok: true, headers, body: { cancel() {} } }; },
    });
    const first = await adapter.collect({ now: '2026-08-11T22:44:29.000Z' });
    const second = await adapter.collect({ now: '2026-08-12T10:44:29.000Z' });
    expect(first).toEqual(second);
    expect(requests).toBe(1);
    expect(JSON.parse(await readFile(cachePath, 'utf8'))).toEqual(first);
  });

  it('adds owner-confirmed paid coverage without storing billing policy in the private API cache', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'acc-brave-paid-'));
    const cachePath = join(cacheDir, 'brave-search.json');
    const adapter = createBraveSearchAdapter({
      apiKey: 'test-key', cachePath, paidOverageEnabled: true,
      fetchImpl: async () => ({ ok: true, headers, body: { cancel() {} } }),
    });
    const record = await adapter.collect({ now: '2026-08-11T22:44:29.000Z' });
    expect(record.billingPolicy).toEqual({
      status: 'owner_confirmed_enabled',
      monthlyCreditUsd: 5,
      usdPerThousandRequests: 5,
      creditApplication: 'automatic',
      authority: 'Owner-confirmed paid access + Brave public pricing',
    });
    expect(JSON.parse(await readFile(cachePath, 'utf8'))).not.toHaveProperty('billingPolicy');
  });
});

describe('ElevenLabs subscription boundary', () => {
  const subscription = {
    character_count: 24000,
    character_limit: 100000,
    next_character_count_reset_unix: 1788220800,
    tier: 'must-not-persist',
    current_overage: { amount: 'must-not-persist' },
  };

  it('projects only monthly credit capacity, remaining credits, and the provider reset', () => {
    const record = normalizeElevenLabsSubscription(subscription, '2026-08-30T12:00:00.000Z');
    expect(record).toEqual({
      provider: 'elevenlabs',
      product: 'ElevenLabs',
      metricClass: 'media_api_quota',
      authority: 'ElevenLabs GET /v1/user/subscription',
      collectionMode: 'direct_api',
      adapterVersion: '1.0.0',
      sourceVersion: 'elevenlabs-subscription-api',
      observedAt: '2026-08-30T12:00:00.000Z',
      state: 'fresh',
      windows: [{
        id: 'monthly', label: 'Monthly credits', usedPercent: 24,
        limit: 100000, remaining: 76000, resetsAt: '2026-09-01T00:00:00.000Z',
      }],
    });
    expect(JSON.stringify(record)).not.toContain('must-not-persist');
  });

  it('reads only the dedicated ACC usage credential and ignores the unrelated TTS credential', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'acc-elevenlabs-credential-'));
    const envPath = join(cacheDir, 'provider-usage.env');
    const previousAcc = process.env.ACC_ELEVENLABS_API_KEY;
    const previousTts = process.env.ELEVENLABS_API_KEY;
    delete process.env.ACC_ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = 'unrelated-tts-credential';
    await writeFile(envPath, 'ACC_ELEVENLABS_API_KEY=dedicated-usage-credential\n', { mode: 0o600 });
    let receivedCredential = null;
    try {
      const record = await createElevenLabsAdapter({
        envPath,
        cachePath: join(cacheDir, 'elevenlabs.json'),
        fetchImpl: async (_url, options) => {
          receivedCredential = options.headers['xi-api-key'];
          return { ok: true, status: 200, json: async () => subscription };
        },
      }).collect({ now: '2026-08-30T12:00:00.000Z' });
      expect(receivedCredential).toBe('dedicated-usage-credential');
      expect(record.state).toBe('fresh');
    } finally {
      if (previousAcc == null) delete process.env.ACC_ELEVENLABS_API_KEY;
      else process.env.ACC_ELEVENLABS_API_KEY = previousAcc;
      if (previousTts == null) delete process.env.ELEVENLABS_API_KEY;
      else process.env.ELEVENLABS_API_KEY = previousTts;
    }
  });

  it('reuses a private observation for an hour instead of polling every scheduler tick', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'acc-elevenlabs-'));
    const cachePath = join(cacheDir, 'elevenlabs.json');
    let requests = 0;
    const adapter = createElevenLabsAdapter({
      apiKey: 'test-key', cachePath,
      fetchImpl: async () => { requests += 1; return { ok: true, status: 200, json: async () => subscription }; },
    });
    const first = await adapter.collect({ now: '2026-08-30T12:00:00.000Z' });
    const second = await adapter.collect({ now: '2026-08-30T12:30:00.000Z' });
    expect(second).toEqual(first);
    expect(requests).toBe(1);
    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
    expect(cached.record).toEqual(first);
    expect(cached).not.toHaveProperty('tier');
  });

  it('fails closed when the configured API key lacks subscription-read permission', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'acc-elevenlabs-auth-'));
    const record = await createElevenLabsAdapter({
      apiKey: 'restricted-test-key', cachePath: join(cacheDir, 'elevenlabs.json'),
      fetchImpl: async () => ({ ok: false, status: 401 }),
    }).collect({ now: '2026-08-30T12:00:00.000Z' });
    expect(record).toMatchObject({ provider: 'elevenlabs', state: 'auth_error', windows: [] });
  });
});
