import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  NAV_ITEMS,
  buildAccUrl,
  canonicalizeAccRoute,
  filterLocalAcc,
  parseAccUrl,
} from '../src/model.mjs';
import {
  ACC_THEME_STORAGE_KEY,
  STATUS_COLORS,
  THEME_PRESENTATION,
  loadStoredTheme,
  persistTheme,
  validateTheme,
} from '../src/theme.mjs';

describe('local-first Search contract', () => {
  it('uses Search as the only primary navigation label and redirects the legacy view one way', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Overview', 'Portfolio', 'Analytics', 'Benchmarks', 'Skill Registry', 'Search',
    ]);
    expect(canonicalizeAccRoute({ view: 'hivemind' })).toEqual({ view: 'search' });
    expect(canonicalizeAccRoute({ view: 'search', q: 'matrix' })).toEqual({ view: 'search', q: 'matrix' });
  });

  it('builds standalone path and native-plugin query Search deep links', () => {
    expect(buildAccUrl({ view: 'search', q: 'Qwen 35B' }, '/')).toBe('/search?q=Qwen+35B');
    expect(buildAccUrl({ view: 'search', q: 'Qwen 35B' }, '/autobot-command-center')).toBe('/autobot-command-center?view=search&q=Qwen+35B');
    expect(parseAccUrl('http://localhost/search?q=Qwen+35B')).toEqual({ view: 'search', q: 'Qwen 35B' });
    expect(parseAccUrl('http://localhost/autobot-command-center?view=search&q=Qwen+35B')).toEqual({ view: 'search', q: 'Qwen 35B' });
  });

  it.each([
    ['portfolio', 'portfolio', 'Autobot Command Center'],
    ['skills', 'skills', 'autobots'],
    ['qwen heretic', 'benchmarks', 'Qwen3.6 35B Heretic'],
    ['cloudflare visits', 'analytics', 'Kung Fu Clan'],
  ])('filters deterministic local records for %s without a remote dependency', (query, kind, title) => {
    const matches = filterLocalAcc(query);
    expect(matches.some((record) => record.kind === kind && record.title.includes(title))).toBe(true);
    expect(matches.every((record) => record.route && record.id && record.summary)).toBe(true);
  });
});

describe('Current Dark and Matrix theme contract', () => {
  it('validates only the two supported local presentation themes', () => {
    expect(Object.keys(THEME_PRESENTATION)).toEqual(['current-dark', 'matrix']);
    expect(validateTheme('current-dark')).toBe('current-dark');
    expect(validateTheme('matrix')).toBe('matrix');
    expect(validateTheme('light')).toBe('current-dark');
    expect(validateTheme(null)).toBe('current-dark');
  });

  it('reads and writes only a validated local preference', () => {
    const values = new Map([[ACC_THEME_STORAGE_KEY, 'matrix']]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    expect(loadStoredTheme(storage)).toBe('matrix');
    expect(persistTheme('light', storage)).toBe('current-dark');
    expect(values.get(ACC_THEME_STORAGE_KEY)).toBe('current-dark');
  });

  it('keeps immutable semantic evidence colors outside presentation accents', async () => {
    expect(STATUS_COLORS).toEqual({ good: '#41e88a', warn: '#ffca62', bad: '#ff707b' });
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('good');
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('warn');
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('bad');
    const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/--acc-status-good:\s*#41e88a/);
    expect(css).toMatch(/--acc-status-warn:\s*#ffca62/);
    expect(css).toMatch(/--acc-status-bad:\s*#ff707b/);
    const matrixBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?matrix['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    expect(matrixBlock).toMatch(/--acc-accent-primary/);
    expect(matrixBlock).not.toMatch(/--acc-status-(good|warn|bad)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
