import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const root = new URL('../.hermes/plugins/autobot-command-center/dashboard/', import.meta.url);

describe('Hermes dashboard plugin contract', () => {
  it('registers one native Command Center tab with no backend router', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
    expect(manifest.name).toBe('autobot-command-center');
    expect(manifest.label).toBe('Command Center');
    expect(manifest.tab).toEqual({
      path: '/autobot-command-center',
      position: 'after:analytics',
    });
    expect(manifest.entry).toBe('dist/index.js');
    expect(manifest.css).toBe('dist/style.css');
    expect(manifest.api).toBeUndefined();
  });
});
