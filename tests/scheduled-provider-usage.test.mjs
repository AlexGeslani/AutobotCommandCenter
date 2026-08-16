import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVIDER_USAGE_REFRESH_TIMEOUT_MS, scheduledUsageRefreshScripts } from '../collector/lib/scheduled-provider-usage.mjs';

describe('scheduled provider usage refreshes', () => {
  it('runs the guarded Claude and Antigravity read-only refreshers before publishing', () => {
    expect(scheduledUsageRefreshScripts('/acc/collector')).toEqual([
      '/acc/collector/bin/claude-usage-refresh.mjs',
      '/acc/collector/bin/antigravity-usage-refresh.mjs',
    ]);
    expect(PROVIDER_USAGE_REFRESH_TIMEOUT_MS).toBe(120_000);
  });

  it('ships only a public-safe launchd template with explicit installation placeholders', () => {
    const plist = readFileSync(new URL('../ops/com.example.acc-provider-usage.plist.template', import.meta.url), 'utf8');
    expect(plist).toContain('__ACC_ROOT__');
    expect(plist).toContain('__NODE_PATH__');
    expect(plist).toContain('__OUTPUT_PATHS__');
    expect(plist).not.toMatch(/\/Users\/|192\.168\.|\.lan\b/);
  });
});
