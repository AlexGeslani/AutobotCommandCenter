import { describe, expect, it } from 'vitest';
import { lsofWorkingDirectoryCommand } from '../collector/lib/process-cwd.mjs';

describe('process working-directory lookup', () => {
  it('uses macOS lsof by its absolute path so launchd PATH cannot break a refresh', () => {
    expect(lsofWorkingDirectoryCommand('123')).toEqual(['/usr/sbin/lsof', '-a', '-p', '123', '-d', 'cwd', '-Fn']);
  });
});
