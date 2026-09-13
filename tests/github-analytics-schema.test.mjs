import { describe, expect, it } from 'vitest';
import { parseGitHubAnalyticsText, projectGitHubAnalyticsProjection } from '../src/analytics/github-schema.mjs';

function projection() {
  return {
    schemaVersion: 'github-analytics-projection-v1',
    dataKind: 'real',
    generatedAt: '2026-08-30T05:00:00.000Z',
    subject: { id: 'github-portfolio', label: 'GitHub Portfolio', domain: 'code' },
    source: { authority: 'GitHub REST repository traffic metrics', fidelity: 'rolling_14_day_aggregate_observations' },
    versions: { archiveSchema: 1, compiler: '1.0.0' },
    coverage: { collectionStartedAt: '2026-08-29T05:00:00.000Z', trafficStart: '2026-08-28', observedThrough: '2026-08-29', acceptedObservations: 1, inputSha256s: ['a'.repeat(64)] },
    portfolio: { retainedTotals: { views: 0, clones: 0 }, repositoriesReporting: 1 },
    repositories: [{
      id: 101, name: 'Alpha', owner: 'AlexGeslani', fullName: 'AlexGeslani/Alpha', htmlUrl: 'https://github.com/AlexGeslani/Alpha', archived: false,
      stars: 1, forks: 0, subscribers: 2, pushedAt: '2026-08-29T00:00:00.000Z', latestRelease: null,
      coverage: { firstTrafficDate: '2026-08-28', lastTrafficDate: '2026-08-29', observedDates: 2, missingViewDates: 1, missingCloneDates: 2 },
      retainedTotals: { views: 0, clones: 0 },
      daily: [
        { date: '2026-08-28', finality: 'provisional', views: { state: 'present', count: 0, uniques: 0 }, clones: { state: 'missing', count: null, uniques: null } },
        { date: '2026-08-29', finality: 'provisional', views: { state: 'missing', count: null, uniques: null }, clones: { state: 'missing', count: null, uniques: null } },
      ],
      latestWindow: {
        observedAt: '2026-08-30T05:00:00.000Z', windowStart: '2026-08-17', windowEnd: '2026-08-30',
        views: { count: 0, uniques: 0 }, clones: { count: 0, uniques: 0 }, referrers: [], paths: [],
      },
    }],
  };
}

describe('public GitHub analytics projection schema', () => {
  it('accepts the exact truthful contract', () => {
    expect(projectGitHubAnalyticsProjection(projection())).toEqual(projection());
  });

  it('rejects missing metrics represented as zero', () => {
    const value = projection();
    value.repositories[0].daily[1].views.count = 0;
    expect(() => projectGitHubAnalyticsProjection(value)).toThrow(/missing/i);
  });

  it('rejects portfolio-wide unique totals and unknown fields', () => {
    const value = projection();
    value.portfolio.uniqueVisitors = 3;
    expect(() => projectGitHubAnalyticsProjection(value)).toThrow(/unknown field/i);
  });

  it('rejects top-N rows outside the exact latest-window object', () => {
    const value = projection();
    value.repositories[0].referrers = [];
    expect(() => projectGitHubAnalyticsProjection(value)).toThrow(/unknown field/i);
  });

  it('enforces the bounded public payload size', () => {
    expect(() => parseGitHubAnalyticsText('x'.repeat((2 * 1024 * 1024) + 1))).toThrow(/size limit/i);
  });
});
