import { describe, expect, it } from 'vitest';
import { buildAntigravityUsageExpectProgram } from '../collector/lib/antigravity-usage-refresh.mjs';

describe('Antigravity no-model usage refresh', () => {
  it('uses only the documented quota command and stops at user-owned dialogs', () => {
    const program = buildAntigravityUsageExpectProgram();
    expect(program).toContain('/usage');
    expect(program).toContain('send -- "\\033"');
    expect(program).toContain('send -- "\\003"');
    expect(program).toMatch(/trust this folder/i);
    expect(program).toMatch(/sign in/i);
    expect(program).not.toMatch(/-p|--print|--prompt/);
  });
});
