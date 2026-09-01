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
    expect(portfolio.summary).toEqual({ total: 4, active: 3, operational: 0, missingDocuments: 1, unclassified: 0 });
    expect(portfolio.projects[0].documents.architecture.status).toBe('missing');
  });

  it('enforces the hard active-project cap', () => {
    const broken = clone();
    broken.projects[3].portfolioState = 'active';
    broken.projects[3].focusRank = 3;
    expect(() => validateProjectPortfolio(broken)).toThrow(/active project limit/i);
  });

  it('rejects local paths and unknown fields before browser delivery', () => {
    const unsafePath = clone();
    unsafePath.projects[0].documents.vision.href = ['', 'Users', 'example', 'private.md'].join('/');
    expect(() => validateProjectPortfolio(unsafePath)).toThrow(/safe relative or credential-free HTTPS/i);

    const unknown = clone();
    unknown.projects[0].secret = 'not allowed';
    expect(() => validateProjectPortfolio(unknown)).toThrow(/unknown field/i);
  });
});
