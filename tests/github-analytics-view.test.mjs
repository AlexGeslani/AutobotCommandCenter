import { describe, expect, it } from 'vitest';
import { projectGitHubDailyRows, projectGitHubPortfolioCards, projectGitHubRepositoryOptions, projectGitHubTrendModel } from '../src/analytics/view.mjs';

const projection = {
  coverage: { collectionStartedAt: '2026-08-29T05:00:00.000Z', trafficStart: '2026-08-16', observedThrough: '2026-08-29' },
  portfolio: { retainedTotals: { views: 12, clones: 3 }, repositoriesReporting: 2 },
  repositories: [
    { id: 202, name: 'Beta', retainedTotals: { views: 2, clones: 1 }, latestWindow: { views: { uniques: 2 }, clones: { uniques: 1 } } },
    { id: 101, name: 'Alpha', retainedTotals: { views: 10, clones: 2 }, latestWindow: { views: { uniques: 7 }, clones: { uniques: 2 } } },
  ],
};

describe('GitHub Portfolio view projections', () => {
  it('projects only additive portfolio headline metrics', () => {
    const cards = projectGitHubPortfolioCards(projection);
    expect(cards.map((card) => card.label)).toEqual(['Retained views', 'Retained clones', 'Repositories reporting', 'Retained coverage']);
    expect(JSON.stringify(cards)).not.toMatch(/unique/i);
  });

  it('keeps repository unique windows separate rather than summing them', () => {
    const options = projectGitHubRepositoryOptions(projection);
    expect(options.map((row) => row.id)).toEqual([101, 202]);
    expect(options.map((row) => row.uniqueVisitors)).toEqual([7, 2]);
    expect(options).not.toHaveProperty('uniqueVisitors');
  });

  it('renders explicit zero as zero and missing as an em dash', () => {
    const rows = projectGitHubDailyRows({ daily: [
      { date: '2026-08-28', finality: 'provisional', views: { state: 'present', count: 0, uniques: 0 }, clones: { state: 'missing', count: null, uniques: null } },
      { date: '2026-08-29', finality: 'provisional', views: { state: 'missing', count: null, uniques: null }, clones: { state: 'present', count: 3, uniques: 2 } },
    ] });
    expect(rows[0]).toMatchObject({ views: '0', uniqueVisitors: '0', clones: '—', uniqueCloners: '—' });
    expect(rows[1]).toMatchObject({ views: '—', uniqueVisitors: '—', clones: '3', uniqueCloners: '2' });
  });

  const addDays = (date, amount) => {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  };

  function trendProjection({ days = 30, missingDate = null } = {}) {
    const start = '2026-08-01';
    const repositories = [
      { id: 101, name: 'Alpha', multiplier: 1 },
      { id: 202, name: 'Beta', multiplier: 2 },
    ].map(({ id, name, multiplier }) => ({
      id, name,
      daily: Array.from({ length: days }, (_, index) => {
        const date = addDays(start, index);
        const missing = date === missingDate;
        return {
          date,
          finality: index < days - 14 ? 'historical' : 'provisional',
          views: missing ? { state: 'missing', count: null, uniques: null } : { state: 'present', count: multiplier * (index + 1), uniques: multiplier },
          clones: missing ? { state: 'missing', count: null, uniques: null } : { state: 'present', count: multiplier, uniques: multiplier },
        };
      }),
      latestWindow: { views: { uniques: multiplier }, clones: { uniques: multiplier }, referrers: [{ referrer: 'example.com', count: 1, uniques: 1 }], paths: [] },
    }));
    return {
      generatedAt: `${addDays(start, days)}T05:35:00.000Z`,
      coverage: { collectionStartedAt: '2026-08-15T05:35:00.000Z', trafficStart: start, observedThrough: addDays(start, days - 1) },
      repositories,
    };
  }

  it('builds additive range trends while excluding the current UTC day', () => {
    const value = trendProjection({ days: 31 });
    value.repositories.forEach((repository) => repository.daily.push({
      date: '2026-09-01', finality: 'provisional',
      views: { state: 'present', count: 9999, uniques: 1 }, clones: { state: 'present', count: 9999, uniques: 1 },
    }));
    value.coverage.observedThrough = '2026-09-01';
    const model = projectGitHubTrendModel(value, { range: '30d', today: '2026-09-01' });
    expect(model.selectedRange).toBe('30d');
    expect(model.daily.at(-1).date).toBe('2026-08-31');
    expect(model.daily.some((row) => row.views.count === 19998)).toBe(false);
    expect(model.totals.complete).toBe(true);
    expect(model.rangeOptions.find((row) => row.id === '90d')).toMatchObject({ available: false });
  });

  it('enables comparisons only for two complete gap-free equal windows', () => {
    const ready = projectGitHubTrendModel(trendProjection({ days: 30 }), { range: '14d', today: '2026-08-31' });
    expect(ready.comparison.available).toBe(true);
    expect(ready.comparison.current.views).toBeGreaterThan(ready.comparison.prior.views);
    expect(ready.comparison.current).not.toHaveProperty('uniques');

    const blocked = projectGitHubTrendModel(trendProjection({ days: 30, missingDate: '2026-08-10' }), { range: '14d', today: '2026-08-31' });
    expect(blocked.comparison).toMatchObject({ available: false, reason: 'A comparison window contains a retained gap.' });
    expect(blocked.daily.find((row) => row.date === '2026-08-10')?.views).toBeUndefined();
  });

  it('keeps missing distinct from zero and omits non-additive source families', () => {
    const value = trendProjection({ days: 16, missingDate: '2026-08-14' });
    const zeroDate = value.repositories[0].daily[13];
    zeroDate.views = { state: 'present', count: 0, uniques: 0 };
    zeroDate.clones = { state: 'present', count: 0, uniques: 0 };
    const model = projectGitHubTrendModel(value, { range: '14d', repositoryId: 101, today: '2026-08-17' });
    expect(model.daily.find((row) => row.date === '2026-08-14').views).toMatchObject({ state: 'present', count: 0 });
    expect(model.daily.find((row) => row.date === '2026-08-15').views).toMatchObject({ state: 'present' });
    expect(JSON.stringify(model)).not.toMatch(/unique|referrer|popular|path/i);
  });

  it('reports range availability and ranks repository drivers from the selected range', () => {
    const model = projectGitHubTrendModel(trendProjection({ days: 16 }), { range: '14d', today: '2026-08-17' });
    expect(model.rangeOptions.find((row) => row.id === '14d')).toMatchObject({ available: true });
    expect(model.rangeOptions.find((row) => row.id === '30d')).toMatchObject({ available: false, daysNeeded: 14 });
    expect(model.comparison.available).toBe(false);
    expect(model.repositories.map((row) => row.name)).toEqual(['Beta', 'Alpha']);
    expect(model.repositories[0].viewShare).toBeCloseTo(2 / 3);
  });
});
