import { describe, expect, it } from 'vitest';
import { projectGitHubDailyRows, projectGitHubPortfolioCards, projectGitHubRepositoryOptions } from '../src/analytics/view.mjs';

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
});
