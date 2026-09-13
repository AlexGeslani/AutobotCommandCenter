import fixture from './fixtures/portfolio/projects.v1.json' with { type: 'json' };
import demoPortfolio from '../fixtures/demo/portfolio.v1.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { validateProjectPortfolio } from '../src/portfolio/schema.mjs';

const clone = () => structuredClone(fixture);

describe('project portfolio projection', () => {
  it('keeps the committed public default empty and schema-valid', () => {
    const portfolio = validateProjectPortfolio(structuredClone(demoPortfolio));
    expect(portfolio.projects).toEqual([]);
    expect(portfolio.source).toMatchObject({ profile: 'demo', registryProjectCount: 0, annotatedProjectCount: 0 });
  });

  it('accepts a registry-aligned projection and derives an honest completeness summary', () => {
    const portfolio = validateProjectPortfolio(clone());
    expect(portfolio.projects.map(({ slug }) => slug)).toEqual(['alpha', 'beta', 'gamma', 'done']);
    expect(portfolio.summary).toEqual({ total: 4, active: 3, operational: 0, missingDocuments: 1, unclassified: 0, activityObserved: 2, activityQuiet: 1, activityNoSource: 1, activityBindingMissing: 0, activityErrors: 0 });
    expect(portfolio.projects[0].documents.architecture.status).toBe('missing');
    expect(portfolio.projects[0].activity).toEqual({ status: 'observed', source: 'git_head_commit', lastActivityAt: '2026-08-31T00:00:00.000Z' });
  });

  it('accepts unlimited active projects while keeping focus ranks optional', () => {
    const unlimited = clone();
    unlimited.policy.activeLimit = null;
    unlimited.policy.rule = 'Active work is unbounded; optional focus ranks identify lock-in priorities.';
    unlimited.projects[3].portfolioState = 'active';
    unlimited.projects[3].focusRank = null;
    unlimited.summary.active = 4;

    const portfolio = validateProjectPortfolio(unlimited);
    expect(portfolio.summary.active).toBe(4);
    expect(portfolio.projects.filter(({ portfolioState }) => portfolioState === 'active')).toHaveLength(4);
    expect(portfolio.projects.find(({ slug }) => slug === 'done').focusRank).toBeNull();
  });

  it('preserves accepted project-document governance status', () => {
    const accepted = clone();
    accepted.projects[0].documents.vision.status = 'accepted';
    expect(validateProjectPortfolio(accepted).projects[0].documents.vision.status).toBe('accepted');
  });

  it('rejects local paths and unknown fields before browser delivery', () => {
    const unsafePath = clone();
    unsafePath.projects[0].documents.vision.href = ['', 'Users', 'example', 'private.md'].join('/');
    expect(() => validateProjectPortfolio(unsafePath)).toThrow(/safe relative or credential-free HTTPS/i);

    const unknown = clone();
    unknown.projects[0].secret = 'not allowed';
    expect(() => validateProjectPortfolio(unknown)).toThrow(/unknown field/i);

    const futureActivity = clone();
    futureActivity.projects[0].activity.lastActivityAt = '2026-09-02T00:00:00.000Z';
    expect(() => validateProjectPortfolio(futureActivity)).toThrow(/non-future UTC day/i);
  });
});
