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
  DEFAULT_THEME,
  STATUS_COLORS,
  THEME_PRESENTATION,
  loadStoredTheme,
  persistTheme,
  validateTheme,
} from '../src/theme.mjs';

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  return 0.2126 * channel(Number.parseInt(value.slice(0, 2), 16))
    + 0.7152 * channel(Number.parseInt(value.slice(2, 4), 16))
    + 0.0722 * channel(Number.parseInt(value.slice(4, 6), 16));
}

function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

function cssThemeTokens(css, theme) {
  const block = css.match(new RegExp(`\\.acc-shell\\[data-acc-theme=['"]?${theme}['"]?\\][^{]*\\{([^}]+)\\}`))?.[1] || '';
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,6})/gi)].map((match) => [match[1], match[2].toLowerCase()]));
}

describe('local-first Search contract', () => {
  it('uses Search as the only primary navigation label and redirects the legacy view one way', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Overview', 'Portfolio', 'Analytics', 'Benchmarks', 'Search',
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
    ['portable shell', 'portfolio', 'Demo Command Center'],

    ['illustrative fixture', 'benchmarks', 'Demo Model'],
    ['provider service', 'analytics', 'Provider Usage'],
  ])('filters deterministic local records for %s without a remote dependency', (query, kind, title) => {
    const matches = filterLocalAcc(query);
    expect(matches.some((record) => record.kind === kind && record.title.includes(title))).toBe(true);
    expect(matches.every((record) => record.route && record.id && record.summary)).toBe(true);
  });
});

describe('five local presentation themes contract', () => {
  it('defaults new sessions to Matrix and lists all choices alphabetically by label', () => {
    expect(DEFAULT_THEME).toBe('matrix');
    expect(Object.keys(THEME_PRESENTATION)).toEqual(['autobots', 'decepticons', 'matrix', 'g1-console', 'current-dark']);
    expect(Object.values(THEME_PRESENTATION).map((theme) => theme.label)).toEqual([
      'Autobots', 'Decepticons', 'Matrix', ['Tele', 'traan1'].join(''), 'Terminal Dark',
    ]);
    expect(validateTheme('g1-console')).toBe('g1-console');
    expect(validateTheme('current-dark')).toBe('current-dark');
    expect(validateTheme('matrix')).toBe('matrix');
    expect(validateTheme('decepticons')).toBe('decepticons');
    expect(validateTheme('autobots')).toBe('autobots');
    expect(validateTheme('light')).toBe('matrix');
    expect(validateTheme(null)).toBe('matrix');
    expect(THEME_PRESENTATION['g1-console'].label).toBe(['Tele', 'traan1'].join(''));
    expect(THEME_PRESENTATION['current-dark'].label).toBe('Terminal Dark');
    expect(THEME_PRESENTATION.decepticons).toEqual({
      label: 'Decepticons',
      accentPrimary: '#692789',
      accentSecondary: '#c27bff',
    });
    expect(THEME_PRESENTATION.autobots).toEqual({
      label: 'Autobots',
      accentPrimary: '#e84b4f',
      accentSecondary: '#7cc7ff',
    });
  });

  it('reads and writes only a validated local preference', () => {
    const values = new Map([[ACC_THEME_STORAGE_KEY, 'autobots']]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    expect(loadStoredTheme(storage)).toBe('autobots');
    expect(persistTheme('light', storage)).toBe('matrix');
    expect(values.get(ACC_THEME_STORAGE_KEY)).toBe('matrix');
  });

  it('keeps immutable semantic evidence colors outside presentation accents', async () => {
    expect(STATUS_COLORS).toEqual({ good: '#41e88a', warn: '#ffca62', bad: '#ff707b' });
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('good');
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('warn');
    expect(THEME_PRESENTATION.matrix).not.toHaveProperty('bad');
    expect(THEME_PRESENTATION.decepticons).not.toHaveProperty('good');
    expect(THEME_PRESENTATION.decepticons).not.toHaveProperty('warn');
    expect(THEME_PRESENTATION.decepticons).not.toHaveProperty('bad');
    expect(THEME_PRESENTATION.autobots).not.toHaveProperty('good');
    expect(THEME_PRESENTATION.autobots).not.toHaveProperty('warn');
    expect(THEME_PRESENTATION.autobots).not.toHaveProperty('bad');
    const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/--acc-status-good:\s*#41e88a/);
    expect(css).toMatch(/--acc-status-warn:\s*#ffca62/);
    expect(css).toMatch(/--acc-status-bad:\s*#ff707b/);
    const matrixBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?matrix['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    const decepticonsBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?decepticons['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    const g1ConsoleBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?g1-console['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    const terminalBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?current-dark['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    const autobotsBlock = css.match(/\.acc-shell\[data-acc-theme=['"]?autobots['"]?\][^{]*\{([^}]+)\}/)?.[1] || '';
    expect(g1ConsoleBlock).toMatch(/--acc-accent-primary:\s*#ffb23e/i);
    expect(g1ConsoleBlock).toMatch(/--color-background:\s*#160c07/i);
    expect(g1ConsoleBlock).toMatch(/--acc-console-frame:\s*#d46624/i);
    expect(terminalBlock).toMatch(/--color-background:\s*#000(?:000)?/i);
    expect(terminalBlock).toMatch(/--color-foreground:\s*#ffcb7a/i);
    expect(terminalBlock).toMatch(/--acc-accent-primary:\s*#ffb454/i);
    expect(matrixBlock).toMatch(/--acc-accent-primary/);
    expect(matrixBlock).not.toMatch(/--acc-status-(good|warn|bad)/);
    expect(decepticonsBlock).toMatch(/--color-background:\s*#09060f/i);
    expect(decepticonsBlock).toMatch(/--acc-accent-primary:\s*#692789/i);
    expect(decepticonsBlock).toMatch(/--acc-command-mark-color:\s*#692789/i);
    expect(decepticonsBlock).not.toMatch(/--acc-status-(good|warn|bad)/);
    expect(autobotsBlock).toMatch(/--color-background:\s*#070b12/i);
    expect(autobotsBlock).toMatch(/--acc-accent-primary:\s*#e84b4f/i);
    expect(autobotsBlock).toMatch(/--acc-accent-secondary:\s*#7cc7ff/i);
    expect(autobotsBlock).not.toMatch(/--acc-status-(good|warn|bad)/);
    expect(css).toMatch(/\.acc-matrix-rain__canvas/);
    expect(css).not.toMatch(/\.acc-matrix-rain__stream/);
    expect(css).not.toMatch(/@keyframes\s+acc-matrix-fall/);
    expect(css).toMatch(/\.acc-command-mark[^}]+mask-image:/s);
    expect(css).toMatch(/\.acc-g1-console-detail/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('keeps Autobots text, accent, selection, and focus contrast accessible', async () => {
    const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
    const tokens = cssThemeTokens(css, 'autobots');
    expect(contrast(tokens['color-foreground'], tokens['color-background'])).toBeGreaterThanOrEqual(7);
    expect(contrast(tokens['color-foreground'], tokens['color-card'])).toBeGreaterThanOrEqual(7);
    expect(contrast(tokens['color-muted-foreground'], tokens['color-background'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['color-muted-foreground'], tokens['color-card'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['acc-accent-primary'], tokens['color-background'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['acc-accent-primary'], tokens['color-card'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['color-primary-foreground'], tokens['color-primary'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['color-ring'], tokens['color-background'])).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens['color-ring'], tokens['color-card'])).toBeGreaterThanOrEqual(3);
    expect(tokens['acc-accent-primary']).not.toBe(STATUS_COLORS.bad);
  });
});
