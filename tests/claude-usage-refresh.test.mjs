import { describe, expect, it } from 'vitest';
import {
  CLAUDE_USAGE_REFRESH_AFTER_MS,
  CLAUDE_USAGE_COMMAND_TIMEOUT_MS,
  buildClaudeUsageExpectProgram,
  normalizeClaudeUsageTranscript,
  refreshClaudeUsageCache,
  shouldRefreshClaudeUsage,
} from '../collector/lib/claude-usage-refresh.mjs';

const transcript = String.raw`
Settings  Status  Config  Usage  Stats
Current session
███████▌ 15% used
Current week (all models)
█████▌ 11% used
Resets Aug 4 at 12pm (America/New_York)
`;

describe('Claude authenticated /usage fallback', () => {
  it('normalizes only canonical plan-limit windows and marks the five-hour reset as estimated', () => {
    const observedAt = '2026-08-01T19:00:00.000Z';
    const record = normalizeClaudeUsageTranscript(transcript, observedAt);
    expect(record).toEqual({
      provider: 'claude',
      product: 'Claude Code',
      metricClass: 'subscription_quota',
      authority: 'authenticated Claude Code /usage limits view',
      collectionMode: 'interactive_cli_usage',
      adapterVersion: '1.0.0',
      sourceVersion: 'claude-usage-cli',
      observedAt,
      state: 'fresh',
      windows: [
        { id: 'five_hour', label: '5-hour window', usedPercent: 15, resetsAt: '2026-08-02T00:00:00.000Z', resetKind: 'estimated_window_end' },
        { id: 'seven_day', label: '7-day window', usedPercent: 11, resetsAt: '2026-08-04T16:00:00.000Z', resetKind: 'provider_reported' },
      ],
    });
  });

  it('fails closed when both canonical percentages and the weekly reset are not present', () => {
    expect(() => normalizeClaudeUsageTranscript('Current session 15% used', '2026-08-01T19:00:00.000Z')).toThrow(/quota/i);
    expect(() => normalizeClaudeUsageTranscript(transcript.replace('11% used', '111% used'), '2026-08-01T19:00:00.000Z')).toThrow(/quota/i);
  });

  it('normalizes the compact terminal transcript when cursor updates omit the weekly heading and spaces', () => {
    const compact = String.raw`Current session
███████▌ 15%used
█████▌ 11%used
ResetsAug4at12pm(America/New_York)`;
    const record = normalizeClaudeUsageTranscript(compact, '2026-08-01T19:00:00.000Z');
    expect(record.windows.map((window) => window.usedPercent)).toEqual([15, 11]);
    expect(record.windows[1].resetsAt).toBe('2026-08-04T16:00:00.000Z');
  });

  it('normalizes the real compact repaint and uses both provider-reported reset times', () => {
    const compact = String.raw`Currentsession
0%used
Resets11:10am(America/New_York)
Currentweek(allmodels)
█████████████████▌35%used
ResetsAug18at12pm(America/New_York)`;
    const record = normalizeClaudeUsageTranscript(compact, '2026-08-16T14:57:00.000Z');
    expect(record.windows).toEqual([
      { id: 'five_hour', label: '5-hour window', usedPercent: 0, resetsAt: '2026-08-16T15:10:00.000Z', resetKind: 'provider_reported' },
      { id: 'seven_day', label: '7-day window', usedPercent: 35, resetsAt: '2026-08-18T16:00:00.000Z', resetKind: 'provider_reported' },
    ]);
  });

  it('refreshes when a reported window resets or the last observation reaches twelve hours', () => {
    const now = '2026-08-01T19:00:00.000Z';
    expect(CLAUDE_USAGE_REFRESH_AFTER_MS).toBe(12 * 60 * 60 * 1000);
    expect(shouldRefreshClaudeUsage(null, now)).toBe(true);
    expect(shouldRefreshClaudeUsage({ observedAt: '2026-08-01T07:00:01.000Z' }, now)).toBe(false);
    expect(shouldRefreshClaudeUsage({ observedAt: '2026-08-01T07:00:00.000Z' }, now)).toBe(true);
    expect(shouldRefreshClaudeUsage({
      observedAt: '2026-08-01T18:30:00.000Z',
      windows: [{ resetsAt: '2026-08-01T18:59:59.000Z' }],
    }, now)).toBe(true);
    expect(shouldRefreshClaudeUsage({
      observedAt: '2026-08-01T18:30:00.000Z',
      windows: [{ resetsAt: '2026-08-01T19:00:01.000Z' }],
    }, now)).toBe(false);
  });

  it('runs only the documented read-only command under user settings and exits at user-owned dialogs', () => {
    const program = buildClaudeUsageExpectProgram();
    expect(CLAUDE_USAGE_COMMAND_TIMEOUT_MS).toBe(110_000);
    expect(program).toContain('/usage');
    expect(program).toContain('/exit');
    expect(program).toContain('-re {(?i)Current}');
    expect(program).toContain('-re {(?i)week}');
    expect(program).toMatch(/-re \{\(\?i\)Resets\}/);
    expect(program).not.toContain('Current session');
    expect(program).toContain('close');
    expect(program).toContain('wait');
    expect(program).toContain('--setting-sources user');
    expect(program).toContain('--safe-mode');
    expect(program).toContain('--tools');
    expect(program).toContain('set mcp $env(ACC_CLAUDE_EMPTY_MCP)');
    expect(program).not.toMatch(/set command \{[^\n]*\$env\(ACC_CLAUDE_EMPTY_MCP\)/);
    expect(program).toMatch(/trust this folder/i);
    expect(program).toMatch(/sign in/i);
    expect(program).not.toMatch(/(?:^|\s)-p(?:\s|$)|--print|--prompt/);
  });

  it('skips a recent observation and updates a stale cache only after complete parsing', async () => {
    const writes = [];
    let runs = 0;
    const fresh = await refreshClaudeUsageCache({
      now: '2026-08-01T19:00:00.000Z',
      readRecord: async () => ({ observedAt: '2026-08-01T18:00:00.000Z' }),
      runUsage: async () => { runs += 1; return transcript; },
      writeRecord: async (record) => writes.push(record),
    });
    expect(fresh).toEqual({ outcome: 'skipped_recent' });
    expect(runs).toBe(0);

    const updated = await refreshClaudeUsageCache({
      now: '2026-08-01T19:00:00.000Z',
      readRecord: async () => ({ observedAt: '2026-08-01T06:59:59.000Z' }),
      runUsage: async () => { runs += 1; return transcript; },
      writeRecord: async (record) => writes.push(record),
    });
    expect(updated.outcome).toBe('updated');
    expect(updated.record.sourceVersion).toBe('claude-usage-cli');
    expect(runs).toBe(1);
    expect(writes).toHaveLength(1);
  });
});
