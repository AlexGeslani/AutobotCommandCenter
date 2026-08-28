import { beforeEach, describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  RELEASES,
  applyDomainProjection,
  applyEdition,
  buildAccUrl,
  canonicalizeAccRoute,
  edition,
  filterLocalAcc,
  fixtures,
  getBenchmarkComparison,
  getCapabilityRollup,
  getEffectiveAvailability,
  getEffectiveProductClaims,
  getEvaluationIndex,
  getLeaderboard,
  getMeasuredBenchmarkVisuals,
  getOverviewProjection,
  getRunLineage,
  getShowcasePortfolio,
  getShowcaseSkills,
  getSourceTrust,
  parseAccUrl,
} from '../src/model.mjs';
import { DEMO_DOMAIN_PROJECTION, DEMO_EDITION } from '../src/runtime/contracts.mjs';

describe('portable ACC product model', () => {
  beforeEach(() => {
    applyEdition(DEMO_EDITION);
    applyDomainProjection(DEMO_DOMAIN_PROJECTION);
  });

  it('boots from a sanitized demo edition with the closed module registry', () => {
    expect(edition.id).toBe('demo');
    expect(fixtures.meta).toMatchObject({ fixture: true });
    expect(NAV_ITEMS.map((item) => item.id)).toEqual(['overview', 'portfolio', 'analytics', 'benchmarks', 'skills', 'search']);
    expect(fixtures.products.map((product) => product.id)).toEqual(['demo-command-center']);
  });

  it('derives the three-score comparison and current average from projection data', () => {
    const comparison = getBenchmarkComparison();
    expect(comparison).toHaveLength(1);
    expect(Object.keys(comparison[0].scores).sort()).toEqual(['agent', 'instruction', 'tools']);
    expect(comparison[0].currentAverage).toEqual({ value: 61.67, verifiedSuites: 3, totalSuites: 3, complete: true });
  });

  it('renders illustrative demo coverage without presenting an empty benchmark surface', () => {
    const visuals = getMeasuredBenchmarkVisuals();
    expect(visuals.profiles.map((profile) => profile.conditionId)).toEqual(['demo-model-local']);
    expect(visuals.suites).toHaveLength(3);
    expect(visuals.suites.every((suite) => suite.rows[0].kind === 'score')).toBe(true);
  });

  it('derives release-scoped leaderboards and rollups from projection-owned release IDs', () => {
    expect(RELEASES).toEqual(DEMO_DOMAIN_PROJECTION.data.benchmarkReleases);
    expect(getLeaderboard('reasoning').map((result) => result.id)).toEqual(['demo-reasoning-result']);
    const rollup = getCapabilityRollup();
    expect(rollup.domains.map((domain) => domain.release)).toEqual(['bfcl-v3', 'gpqa-diamond-demo-v1', 'code-demo-v1']);
    expect(rollup.complete).toHaveLength(1);
    expect(rollup.complete[0]).toMatchObject({ coverage: 3, totalDomains: 3, complete: true, index: 100 });
  });

  it('accepts run evidence only for an exact canonical lineage tuple', () => {
    const valid = { conditionId: 'demo-model-local', resultId: 'demo-tool-result', domain: 'tool-use', release: 'bfcl-v3', runId: 'demo-tool-run' };
    expect(getRunLineage(valid)?.run.id).toBe('demo-tool-run');
    expect(getRunLineage({ ...valid, domain: 'coding' })).toBeNull();
    expect(getRunLineage({ ...valid, release: 'other' })).toBeNull();
    expect(getRunLineage({ ...valid, runId: 'demo-coding-run' })).toBeNull();
  });

  it('withholds mutable availability when its authority is invalidating', () => {
    const condition = fixtures.conditions[0];
    expect(getEffectiveAvailability(condition)).toBe('unknown');
    const product = { ...fixtures.products[0], availabilityAuthority: 'runtime' };
    expect(getEffectiveProductClaims(product)).toEqual({ state: 'unknown', worksNow: null });
    expect(getSourceTrust().filter((source) => source.invalidatesClaims).map((source) => source.id)).toEqual(['runtime', 'skill-meta']);
  });

  it('keeps showcase and skill data inside the validated projection', () => {
    expect(getShowcasePortfolio().githubShowcaseProjects).toEqual([]);
    expect(getShowcasePortfolio().internalProducts.map((product) => product.id)).toEqual(['demo-command-center']);
    expect(getShowcaseSkills().operationalSkills.map((skill) => skill.id)).toEqual(['demo-skill']);
  });

  it('keeps evaluations attached to durable projected objects', () => {
    expect(getEvaluationIndex()).toEqual([expect.objectContaining({ id: 'demo-evaluation' })]);
    expect(getEvaluationIndex()[0].affectedObjects).toEqual([{ type: 'product', id: 'demo-command-center', label: 'Demo Command Center' }]);
  });

  it('round-trips stable deep links and preserves one-way legacy aliases', () => {
    const state = { view: 'benchmarks', domain: 'tool-use', condition: 'demo-model-local', result: 'demo-tool-result', release: 'bfcl-v3', run: 'demo-tool-run' };
    expect(parseAccUrl(buildAccUrl(state))).toEqual(state);
    expect(canonicalizeAccRoute({ view: 'usage' })).toEqual({ view: 'analytics', domain: 'ai', subject: 'provider-usage' });
    expect(canonicalizeAccRoute({ view: 'hivemind', q: 'demo' })).toEqual({ view: 'search', q: 'demo' });
  });

  it('builds search and overview records from edition and projection IDs', () => {
    expect(filterLocalAcc('portable shell').map((record) => record.id)).toContain('portfolio:demo-command-center');
    expect(filterLocalAcc('provider service').map((record) => record.id)).toContain('analytics:provider-usage');
    expect(getOverviewProjection().destinations.map((destination) => destination.id)).toEqual(['portfolio', 'analytics', 'benchmarks', 'skills']);
  });

  it('applies a different valid edition and projection without changing Core code', () => {
    const localEdition = structuredClone(DEMO_EDITION);
    localEdition.id = 'local-test';
    localEdition.branding.title = 'Local Test Center';
    localEdition.analytics.web = [{ id: 'example.test', label: 'Example', description: 'Example aggregate.', projection: 'runtime/analytics/web/example.test.json' }];
    const localDomain = structuredClone(DEMO_DOMAIN_PROJECTION);
    localDomain.generatedAt = '2026-01-03T00:00:00.000Z';
    localDomain.data.products[0].name = 'Local Product';
    applyEdition(localEdition);
    applyDomainProjection(localDomain);
    expect(edition.branding.title).toBe('Local Test Center');
    expect(fixtures.products[0].name).toBe('Local Product');
    expect(filterLocalAcc('example aggregate').map((record) => record.route.subject)).toContain('example.test');
  });
});
