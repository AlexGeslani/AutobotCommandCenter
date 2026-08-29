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

  getEvaluationOwnerRoute,
  getIntegrationStatus,
  getLeaderboard,
  getMeasuredBenchmarkVisuals,
  getObjectTestingRecords,
  getOverviewProjection,
  getRunLineage,
  getShowcasePortfolio,

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
    expect(NAV_ITEMS.map((item) => item.id)).toEqual(['overview', 'portfolio', 'analytics', 'benchmarks', 'search']);
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


  it('projects named integrations while keeping collector health separate from quota pressure', () => {
    const providerUsage = {
      generatedAt: '2026-01-01T00:05:00.000Z',
      providers: [
        { provider: 'codex', product: 'Codex / ChatGPT', state: 'fresh', observedAt: '2026-01-01T00:04:00.000Z', authority: 'Codex authority', collectionMode: 'local_app_server', windows: [{ usedPercent: 99 }] },
        { provider: 'claude', product: 'Claude Code', state: 'stale', observedAt: '2026-01-01T00:03:00.000Z', authority: 'Claude authority', collectionMode: 'status_line_cache', windows: [] },
        { provider: 'antigravity', product: 'Antigravity CLI', state: 'auth_error', observedAt: '2026-01-01T00:02:00.000Z', authority: 'Antigravity authority', collectionMode: 'status_line_cache', windows: [] },
        { provider: 'brave-search', product: 'Brave Search API', state: 'error', observedAt: '2026-01-01T00:01:00.000Z', authority: 'Brave authority', collectionMode: 'direct_api_headers', windows: [] },
      ],
    };
    const status = getIntegrationStatus({
      providerUsage,
      providerUsageHealth: { state: 'ready', valid: true },
      runtimeHealth: {
        edition: { state: 'ready', valid: true, stale: false, error: null },
        domain: { state: 'ready', valid: true, stale: false, error: null },
      },
    });

    expect(status.integrations.map((integration) => integration.label)).toEqual(expect.arrayContaining([
      'Codex / ChatGPT collector',
      'Claude Code collector',
      'Antigravity CLI collector',
      'Brave Search API collector',
    ]));
    expect(status.integrations.map((integration) => integration.id)).not.toContain('source:runtime');
    expect(status.integrations.map((integration) => integration.label)).not.toContain('Runtime telemetry');

    expect(status.integrations.find((integration) => integration.id === 'provider:codex')).toMatchObject({
      status: 'healthy',
      claimImpact: 'None — collector health does not represent quota pressure',
      observedAt: '2026-01-01T00:04:00.000Z',
    });
    expect(status.integrations.find((integration) => integration.id === 'provider:claude').status).toBe('stale');
    expect(status.integrations.find((integration) => integration.id === 'provider:antigravity')).toMatchObject({ status: 'error', configuration: 'Authentication error' });
    expect(status.integrations.find((integration) => integration.id === 'provider:brave-search').status).toBe('collection-failed');
    expect(status.integrations.find((integration) => integration.id === 'source:benchmarks')).toMatchObject({
      category: 'Frozen artifact',
      reachability: 'Not applicable',
      validation: 'Validated frozen artifact version',
    });
    expect(status.issues.map((integration) => integration.id)).toEqual(expect.arrayContaining(['provider:claude', 'provider:antigravity', 'provider:brave-search']));
    expect(status.allHealthy).toBe(false);
  });

  it('reports passive Antigravity waiting as the only issue when every evaluated authority is healthy', () => {
    const providerUsage = {
      generatedAt: '2026-08-29T14:00:00.000Z',
      providers: [
        { provider: 'codex', product: 'Codex / ChatGPT', state: 'fresh', observedAt: '2026-08-29T13:59:00.000Z', authority: 'Codex authority', collectionMode: 'local_app_server', windows: [] },
        { provider: 'claude', product: 'Claude Code', state: 'fresh', observedAt: '2026-08-29T13:58:00.000Z', authority: 'Claude authority', collectionMode: 'interactive_cli_usage', windows: [] },
        { provider: 'antigravity', product: 'Antigravity CLI', state: 'inactive', observedAt: '2026-08-29T12:00:00.000Z', authority: 'Antigravity authority', collectionMode: 'status_line_cache', windows: [{ usedPercent: 25 }] },
        { provider: 'brave-search', product: 'Brave Search API', state: 'fresh', observedAt: '2026-08-29T13:57:00.000Z', authority: 'Brave authority', collectionMode: 'direct_api_headers', windows: [] },
      ],
    };
    const status = getIntegrationStatus({
      providerUsage,
      providerUsageHealth: { state: 'ready', valid: true },
      runtimeHealth: {
        edition: { state: 'ready', valid: true, stale: false, error: null },
        domain: { state: 'ready', valid: true, stale: false, error: null },
      },
    });
    expect(status.issues.map((integration) => integration.label)).toEqual(['Antigravity — Waiting for active trusted session']);
    expect(status.issues[0]).toMatchObject({
      id: 'provider:antigravity',
      status: 'not-evaluated',
      configuration: 'Waiting for active trusted session',
      freshness: 'Waiting for active trusted session',
      claimImpact: 'Current usage headroom withheld; retained windows are last-good only',
    });
  });

  it('keeps portfolio showcase data inside the validated projection', () => {
    expect(getShowcasePortfolio().githubShowcaseProjects).toEqual([]);
    expect(getShowcasePortfolio().internalProducts.map((product) => product.id)).toEqual(['demo-command-center']);
  });

  it('keeps testing records attached to durable projected objects without a global index', () => {
    expect(getObjectTestingRecords('product', 'demo-command-center')).toEqual([expect.objectContaining({ id: 'demo-evaluation' })]);

    expect(getEvaluationOwnerRoute('demo-evaluation')).toEqual({ view: 'portfolio', product: 'demo-command-center' });
  });

  it('round-trips stable deep links and preserves one-way legacy aliases', () => {
    const state = { view: 'benchmarks', domain: 'tool-use', condition: 'demo-model-local', result: 'demo-tool-result', release: 'bfcl-v3', run: 'demo-tool-run' };
    expect(parseAccUrl(buildAccUrl(state))).toEqual(state);
    expect(canonicalizeAccRoute({ view: 'usage' })).toEqual({ view: 'analytics', domain: 'ai', subject: 'provider-usage' });
    expect(canonicalizeAccRoute({ view: 'hivemind', q: 'demo' })).toEqual({ view: 'search', q: 'demo' });
    expect(canonicalizeAccRoute({ view: 'evidence', evaluation: 'demo-evaluation' })).toEqual({ view: 'portfolio', product: 'demo-command-center' });
    expect(canonicalizeAccRoute({ view: 'evidence' })).toEqual({ view: 'overview' });
  });

  it('builds search and overview records from edition and projection IDs', () => {
    expect(filterLocalAcc('portable shell').map((record) => record.id)).toContain('portfolio:demo-command-center');
    expect(filterLocalAcc('provider service').map((record) => record.id)).toContain('analytics:provider-usage');
    expect(getOverviewProjection().destinations.map((destination) => destination.id)).toEqual(['portfolio', 'analytics', 'benchmarks']);
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
