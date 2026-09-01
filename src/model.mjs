import {
  DEMO_DOMAIN_PROJECTION,
  DEMO_EDITION,
  validateDomainProjection,
  validateEdition,
} from './runtime/contracts.mjs';
import { getPortfolioProjection } from './showcase/projection.mjs';
import { EMPTY_PROJECT_PORTFOLIO, validateProjectPortfolio } from './portfolio/schema.mjs';

function bindProjection(projection) {
  const data = structuredClone(projection.data);
  for (const condition of data.conditions) {
    condition.results = data.results.filter((result) => result.conditionId === condition.id);
  }
  return { data, showcase: structuredClone(projection.showcase) };
}

let active = bindProjection(DEMO_DOMAIN_PROJECTION);
let showcaseProjection = active.showcase;
let projectPortfolio = structuredClone(EMPTY_PROJECT_PORTFOLIO);

export let edition = structuredClone(DEMO_EDITION);
export let NAV_ITEMS = structuredClone(DEMO_EDITION.modules);
export let fixtures = active.data;
export let RELEASES = structuredClone(fixtures.benchmarkReleases);

export function applyEdition(value) {
  edition = structuredClone(validateEdition(value));
  NAV_ITEMS = structuredClone(edition.modules);
  return edition;
}

export function applyDomainProjection(value) {
  active = bindProjection(validateDomainProjection(value));
  fixtures = active.data;
  RELEASES = structuredClone(fixtures.benchmarkReleases);
  showcaseProjection = active.showcase;
  return fixtures;
}

export function applyProjectPortfolio(value) {
  projectPortfolio = validateProjectPortfolio(value);
  return structuredClone(projectPortfolio);
}

export function getProjectPortfolio() {
  return structuredClone(projectPortfolio);
}

export function getCondition(id) {
  return fixtures.conditions.find((condition) => condition.id === id) || null;
}

export function getBenchmarkComparison(conditionId = null) {
  const profiles = fixtures.benchmarkComparison.map((profile) => {
    const verifiedScores = Object.values(profile.scores).filter((score) => score.evidence === 'verified' && score.value != null);
    const currentAverage = verifiedScores.length
      ? Number((verifiedScores.reduce((sum, score) => sum + score.value, 0) / verifiedScores.length).toFixed(2))
      : null;
    return {
      ...profile,
      condition: getCondition(profile.conditionId),
      currentAverage: {
        value: currentAverage,
        verifiedSuites: verifiedScores.length,
        totalSuites: Object.keys(profile.scores).length,
        complete: verifiedScores.length === Object.keys(profile.scores).length,
      },
    };
  });
  return conditionId ? profiles.find((profile) => profile.conditionId === conditionId) || null : profiles;
}

export function getMeasuredBenchmarkVisuals() {
  const suiteOrder = ['instruction', 'tools', 'agent'];
  const measured = getBenchmarkComparison().filter((profile) => profile.evidence === 'measured' || fixtures.meta.fixture === true);
  if (!measured.length) return { profiles: [], suites: [] };
  return {
    profiles: measured.map((profile) => ({
      conditionId: profile.conditionId,
      shortName: profile.condition.shortName,
      provider: profile.condition.provider,
      runtime: profile.condition.runtime,
      coverage: Object.fromEntries(suiteOrder.map((suiteId) => [suiteId, profile.scores[suiteId].progress?.state || profile.scores[suiteId].evidence])),
    })),
    suites: suiteOrder.map((suiteId) => ({
      id: suiteId,
      label: measured[0].scores[suiteId].benchmark,
      rows: measured
        .map((profile) => {
          const score = profile.scores[suiteId];
          if (score.value != null && score.evidence === 'verified') return {
            conditionId: profile.conditionId, shortName: profile.condition.shortName, value: score.value, barValue: score.value,
            denominator: score.denominator, evidence: 'verified', kind: 'score', progress: null,
          };
          if (score.progress) return {
            conditionId: profile.conditionId, shortName: profile.condition.shortName, value: null,
            barValue: score.progress.total ? (score.progress.current / score.progress.total) * 100 : 0,
            denominator: score.progress.label, evidence: score.progress.state, kind: 'progress', progress: score.progress,
          };
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => (a.kind === b.kind ? b.barValue - a.barValue : a.kind === 'score' ? -1 : 1)),
    })),
  };
}

export function getFamily(id) {
  return fixtures.modelFamilies.find((family) => family.id === id) || null;
}

export function getRun(id) {
  return fixtures.runs.find((run) => run.id === id) || null;
}

export function getRunLineage({ conditionId, resultId, domain, release, runId }) {
  const condition = getCondition(conditionId);
  const result = fixtures.results.find((item) => item.id === resultId);
  if (!condition || !result) return null;
  if (result.status !== 'canonical' || result.conditionId !== condition.id || result.domain !== domain || result.release !== release || !result.runIds.includes(runId)) return null;
  const run = getRun(runId);
  return run ? { condition, result, run } : null;
}


export function getLeaderboard(domain, release = RELEASES[domain]) {
  return fixtures.results
    .filter((result) => result.domain === domain && result.release === release && result.status === 'canonical')
    .map((result) => ({ ...result, condition: getCondition(result.conditionId) }))
    .sort((a, b) => b.score - a.score);
}

export function getCapabilityRollup() {
  const labels = { 'tool-use': 'Tool Use', reasoning: 'Reasoning', coding: 'Coding' };
  const knownConditions = new Set(fixtures.conditions.map((condition) => condition.id));
  const domainState = Object.entries(RELEASES).map(([id, release]) => {
    const grouped = new Map();
    for (const result of fixtures.results) {
      if (result.domain !== id || result.release !== release || result.status !== 'canonical' || !knownConditions.has(result.conditionId)) continue;
      const group = grouped.get(result.conditionId) || [];
      group.push(result);
      grouped.set(result.conditionId, group);
    }
    const resultByCondition = new Map(
      [...grouped.entries()].filter(([, results]) => results.length === 1).map(([conditionId, results]) => [conditionId, results[0]]),
    );
    const eligible = [...resultByCondition.values()];
    return { id, label: labels[id], release, best: eligible.length ? Math.max(...eligible.map((result) => result.score)) : null, resultByCondition };
  });
  const rows = fixtures.conditions.map((condition) => {
    const domainScores = {};
    const resultIds = [];
    const normalized = [];
    for (const domain of domainState) {
      const result = domain.resultByCondition.get(condition.id) || null;
      const contribution = result && domain.best ? (result.score / domain.best) * 100 : null;
      domainScores[domain.id] = contribution;
      if (result && contribution != null) {
        resultIds.push(result.id);
        normalized.push(contribution);
      }
    }
    const coverage = normalized.length;
    return {
      condition,
      index: coverage ? Number((normalized.reduce((sum, score) => sum + score, 0) / coverage).toFixed(1)) : null,
      coverage,
      totalDomains: domainState.length,
      complete: coverage === domainState.length,
      domainScores,
      resultIds,
    };
  });
  const representedRows = rows.filter((row) => row.coverage > 0);
  const byIndex = (a, b) => (b.index ?? -1) - (a.index ?? -1);
  return {
    domains: domainState.map(({ resultByCondition, ...domain }) => domain),
    complete: representedRows.filter((row) => row.complete).sort(byIndex),
    partial: representedRows.filter((row) => !row.complete).sort(byIndex),
  };
}

export function getObjectTestingRecords(type, id) {
  return fixtures.evaluations
    .filter((evaluation) => evaluation.affectedObjects.some((object) => object.type === type && object.id === id))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getEvaluationOwnerRoute(evaluationId) {
  const evaluation = fixtures.evaluations.find((item) => item.id === evaluationId);
  const owner = evaluation?.affectedObjects.find((object) => object.type === 'product');
  if (owner?.type === 'product') return { view: 'portfolio', product: owner.id };
  return { view: 'overview' };
}

export function getVoicePerformance(id = fixtures.voicePerformance.id) {
  return id === fixtures.voicePerformance.id ? fixtures.voicePerformance : null;
}

export function getSourceTrust() {
  return fixtures.sources;
}


function canonicalObservedAt(value) {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/);
  return match ? match[0] : null;
}

function sourceStatus(source) {
  if (source.state === 'fresh' && !source.invalidatesClaims) return 'healthy';
  if (source.state === 'fresh') return 'warning';
  if (source.state === 'stale') return 'stale';
  if (source.state === 'invalid') return 'invalid';
  if (source.state === 'error' || source.state === 'failed') return 'error';
  if (source.state === 'unknown') return 'unknown';
  if (source.state === 'missing' || source.state === 'not-evaluated') return 'not-evaluated';
  return 'warning';
}

function providerStatus(state) {
  if (state === 'fresh') return 'healthy';
  if (state === 'stale' || state === 'expired') return 'stale';
  if (state === 'auth_error') return 'error';
  if (state === 'error') return 'collection-failed';
  if (state === 'unknown') return 'unknown';
  if (['inactive', 'not_yet_observed', 'not_configured', 'unsupported'].includes(state)) return 'not-evaluated';
  return 'warning';
}

function runtimeReachability(health) {
  if (health?.valid) return 'Available';
  if (/unavailable|fetch|network/i.test(health?.error || '')) return 'Unavailable';
  if (health?.error) return 'Available';
  return 'Unknown';
}

export function getIntegrationStatus({ providerUsage = null, providerUsageHealth = null, runtimeHealth = null } = {}) {
  const frozenSourceIds = new Set(['benchmarks', 'voice-performance']);
  const sourceIntegrations = getSourceTrust().map((source) => ({
    id: `source:${source.id}`,
    label: source.label,
    category: frozenSourceIds.has(source.id) ? 'Frozen artifact' : 'Claim source',
    status: sourceStatus(source),
    reachability: frozenSourceIds.has(source.id) ? 'Not applicable' : 'Not reported',
    configuration: 'Not reported',
    freshness: source.freshness,
    validation: source.invalidatesClaims
      ? 'Validated record · not claim-safe'
      : frozenSourceIds.has(source.id)
        ? 'Validated frozen artifact version'
        : 'Validated projection record',
    claimImpact: source.invalidatesClaims ? 'Dependent claims withheld' : 'No dependent claims withheld',
    observedAt: canonicalObservedAt(source.freshness),
    authority: source.authority,
  }));

  const runtimeIntegrations = ['edition', 'domain'].map((key) => {
    const health = runtimeHealth?.[key] || null;
    const ready = health?.state === 'ready' && health.valid === true && health.stale === false;
    const partial = health?.state === 'ready_with_warnings' && health.valid === true && health.stale === false;
    return {
      id: `runtime:${key}`,
      label: key === 'edition' ? 'ACC Edition projection' : 'ACC Domain projection',
      category: 'Runtime projection',
      status: ready ? 'healthy' : partial ? 'degraded' : health ? 'invalid' : 'unknown',
      reachability: runtimeReachability(health),
      configuration: 'Not applicable',
      freshness: ready ? 'Current validated load' : partial ? 'Current validated load with isolated subject warnings' : health?.state === 'stale_invalid' ? 'Stale last-good projection' : 'Bundled demonstration fallback',
      validation: ready ? 'Validated' : partial ? `Partially validated — ${health.warnings?.length || 0} subject warning(s)` : health ? 'Invalid' : 'Not evaluated',
      claimImpact: ready ? 'No dependent claims withheld' : partial ? 'Only invalid or unsupported subjects withheld; valid peers remain available' : 'Projection claims fall back to stale or demonstration data',
      observedAt: key === 'domain' ? fixtures.meta?.generatedAt || null : null,
      authority: key === 'edition' ? 'ACC Edition contract' : 'ACC Domain projection contract',
    };
  });

  const projectionReady = providerUsageHealth?.state === 'ready' && providerUsageHealth.valid === true;
  const projectionStatus = projectionReady
    ? 'healthy'
    : providerUsageHealth?.state === 'invalid'
      ? 'invalid'
      : providerUsageHealth?.state === 'unavailable' || providerUsageHealth?.state === 'error'
        ? 'collection-failed'
        : 'unknown';
  const providerProjection = {
    id: 'runtime:provider-usage',
    label: 'Provider usage projection',
    category: 'Runtime projection',
    status: projectionStatus,
    reachability: projectionReady ? 'Available' : providerUsageHealth?.state === 'unavailable' ? 'Unavailable' : 'Unknown',
    configuration: 'Not reported',
    freshness: providerUsage?.generatedAt ? `Generated ${providerUsage.generatedAt}` : 'No validated snapshot loaded',
    validation: projectionReady ? 'Validated' : providerUsageHealth ? 'Not validated' : 'Not evaluated',
    claimImpact: projectionReady ? 'No dependent claims withheld' : 'Current provider usage headroom withheld',
    observedAt: providerUsage?.generatedAt || null,
    authority: 'Provider usage public snapshot contract',
  };

  const providerIntegrations = (providerUsage?.providers || []).map((provider) => {
    const status = providerStatus(provider.state);
    const antigravityWaiting = provider.provider === 'antigravity' && provider.state === 'inactive';
    const configuration = antigravityWaiting
      ? 'Waiting for active trusted session'
      : provider.state === 'auth_error'
        ? 'Authentication error'
        : provider.state === 'not_configured'
          ? 'Not configured'
          : provider.state === 'unsupported'
            ? 'Unsupported observation path'
            : 'Not reported';
    return {
      id: `provider:${provider.provider}`,
      label: antigravityWaiting ? 'Antigravity — Waiting for active trusted session' : `${provider.product} collector`,
      category: 'Provider usage collector',
      status,
      reachability: 'Not reported',
      configuration,
      freshness: antigravityWaiting ? 'Waiting for active trusted session' : provider.state === 'fresh' ? 'Fresh' : provider.state === 'expired' ? 'Expired reset window' : String(provider.state || 'unknown').replaceAll('_', ' '),
      validation: projectionReady ? 'Validated public snapshot' : 'Not validated',
      claimImpact: status === 'healthy'
        ? 'None — collector health does not represent quota pressure'
        : status === 'stale'
          ? 'Quota figures retained as last observed; current headroom is not claimed'
          : antigravityWaiting && provider.windows?.length
            ? 'Current usage headroom withheld; retained windows are last-good only'
            : 'Current usage headroom withheld',
      observedAt: provider.observedAt || null,
      authority: provider.authority,
      collectionMode: provider.collectionMode,
    };
  });

  const integrations = [...runtimeIntegrations, providerProjection, ...sourceIntegrations, ...providerIntegrations];
  const issues = integrations.filter((integration) => integration.status !== 'healthy');
  return { integrations, issues, allHealthy: integrations.length > 0 && issues.length === 0 };
}

export function getShowcasePortfolio() {
  return getPortfolioProjection(showcaseProjection, fixtures.products);
}

export function getLocalAccSearchRecords() {
  const portfolio = getShowcasePortfolio();
  const portfolioRecords = portfolio.internalProducts.map((product) => ({
    id: `portfolio:${product.id}`,
    kind: 'portfolio',
    title: product.name,
    summary: product.value,
    keywords: [product.kind, product.state, product.outcome, product.limitation, ...(product.worksNow || [])],
    route: { view: 'portfolio', product: product.id },
  }));

  const benchmarkRecords = getBenchmarkComparison().map((profile) => ({
    id: `benchmarks:${profile.conditionId}`,
    kind: 'benchmarks',
    title: profile.condition.shortName,
    summary: `${profile.condition.provider} · ${profile.condition.runtime} · ${profile.condition.quantization}`,
    keywords: [
      'benchmark condition measured IFEval BFCL tau2',
      profile.condition.reasoning,
      profile.note,
      ...Object.values(profile.scores).flatMap((score) => [score.label, score.benchmark, score.denominator]),
    ],
    route: { view: 'benchmarks', condition: profile.conditionId },
  }));
  const analyticsRecords = [
    ...edition.analytics.web.map((subject) => ({
      id: `analytics:${subject.id}`,
      kind: 'analytics',
      title: `${subject.label} analytics`,
      summary: subject.description,
      keywords: ['web property analytics validated projection traffic coverage'],
      route: { view: 'analytics', domain: 'web', subject: subject.id, range: '30d' },
    })),
    ...(edition.analytics.github ? [{
      id: `analytics:${edition.analytics.github.id}`,
      kind: 'analytics',
      title: edition.analytics.github.label,
      summary: edition.analytics.github.description,
      keywords: ['GitHub portfolio repositories traffic views clones retained rolling observation'],
      route: { view: 'analytics', domain: 'code', subject: edition.analytics.github.id },
    }] : []),
    {
      id: `analytics:${edition.analytics.providerUsage.id}`,
      kind: 'analytics',
      title: edition.analytics.providerUsage.label,
      summary: edition.analytics.providerUsage.description,
      keywords: ['provider service usage limits quota analytics'],
      route: { view: 'analytics', domain: 'ai', subject: edition.analytics.providerUsage.id },
    },
  ];
  return [...portfolioRecords, ...benchmarkRecords, ...analyticsRecords];
}

export function filterLocalAcc(query) {
  const terms = String(query || '').normalize('NFKC').toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return getLocalAccSearchRecords().filter((record) => {
    const haystack = [record.title, record.summary, record.kind, ...(record.keywords || [])]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase('en');
    return terms.every((term) => haystack.includes(term));
  });
}

export function getOverviewProjection() {
  const summaries = {
    portfolio: 'Products and durable capabilities',
    analytics: 'Traffic, service usage, and coverage',
    benchmarks: 'Measured model evidence',
  };
  return {
    sectionOrder: ['provider-usage', 'source-exceptions', 'destinations', 'recently-landed'],
    sourceExceptions: getSourceTrust().filter((source) => source.invalidatesClaims),
    destinations: NAV_ITEMS.filter((item) => Object.hasOwn(summaries, item.id)).map((item) => ({ ...item, summary: summaries[item.id] })),
  };
}

const ROUTE_KEYS = ['view', 'q', 'domain', 'subject', 'range', 'repository', 'mode', 'product', 'project', 'condition', 'result', 'release', 'run', 'evaluation'];

export function buildAccUrl(state = {}, basePath = '/autobot-command-center') {
  const normalizedBase = basePath === '/' ? '' : String(basePath).replace(/\/$/, '');
  const standaloneSearch = state.view === 'search' && !normalizedBase;
  const params = new URLSearchParams();
  for (const key of ROUTE_KEYS) {
    if (standaloneSearch && key === 'view') continue;
    if (state[key]) params.set(key, state[key]);
  }
  const query = params.toString();
  const path = standaloneSearch ? '/search' : (normalizedBase || '/');
  return `${path}${query ? `?${query}` : ''}`;
}

export function parseAccUrl(input) {
  const url = new URL(input, 'http://localhost');
  const state = {};
  for (const key of ROUTE_KEYS) {
    const value = url.searchParams.get(key);
    if (value) state[key] = value;
  }
  if (url.pathname === '/search') state.view = 'search';
  if (!state.view) state.view = 'overview';
  return state;
}

export function canonicalizeAccRoute(route = {}) {
  if (route.view === 'usage') return { view: 'analytics', domain: 'ai', subject: 'provider-usage' };
  if (route.view === 'hivemind') return { view: 'search', ...(route.q ? { q: route.q } : {}) };
  if (route.view === 'evidence') return getEvaluationOwnerRoute(route.evaluation);
  return { ...route };
}
