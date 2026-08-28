import {
  DEMO_DOMAIN_PROJECTION,
  DEMO_EDITION,
  validateDomainProjection,
  validateEdition,
} from './runtime/contracts.mjs';
import { getPortfolioProjection, getSkillsProjection } from './showcase/projection.mjs';

function bindProjection(projection) {
  const data = structuredClone(projection.data);
  for (const condition of data.conditions) {
    condition.results = data.results.filter((result) => result.conditionId === condition.id);
  }
  return { data, showcase: structuredClone(projection.showcase) };
}

let active = bindProjection(DEMO_DOMAIN_PROJECTION);
let showcaseProjection = active.showcase;

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

export function getEffectiveAvailability(condition) {
  const authority = fixtures.sources.find((source) => source.id === 'runtime');
  return authority?.invalidatesClaims ? 'unknown' : condition.availability;
}

export function getEffectiveProductClaims(product) {
  const authority = product.availabilityAuthority
    ? fixtures.sources.find((source) => source.id === product.availabilityAuthority)
    : null;
  if (authority?.invalidatesClaims) return { state: 'unknown', worksNow: null };
  return { state: product.state, worksNow: product.worksNow };
}

export function getEffectiveSkillClaims(skill) {
  const authority = fixtures.sources.find((source) => source.id === 'skill-meta');
  if (!authority?.invalidatesClaims) return { stewardship: skill.stewardship, publication: skill.publication };
  return { stewardship: 'unknown', publication: 'unknown' };
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

export function getEvaluationIndex() {
  return [...fixtures.evaluations].sort((a, b) => a.title.localeCompare(b.title));
}

export function getVoicePerformance(id = fixtures.voicePerformance.id) {
  return id === fixtures.voicePerformance.id ? fixtures.voicePerformance : null;
}

export function getSourceTrust() {
  return fixtures.sources;
}

export function getShowcasePortfolio() {
  return getPortfolioProjection(showcaseProjection, fixtures.products);
}

export function getShowcaseSkills() {
  return getSkillsProjection(showcaseProjection);
}

export function getLocalAccSearchRecords() {
  const portfolio = getShowcasePortfolio();
  const skills = getShowcaseSkills();
  const portfolioRecords = portfolio.internalProducts.map((product) => ({
    id: `portfolio:${product.id}`,
    kind: 'portfolio',
    title: product.name,
    summary: product.value,
    keywords: [product.kind, product.state, product.outcome, product.limitation, ...(product.worksNow || [])],
    route: { view: 'portfolio', product: product.id },
  }));
  const skillRecords = skills.operationalSkills.map((skill) => ({
    id: `skills:${skill.id}`,
    kind: 'skills',
    title: skill.name,
    summary: skill.description,
    keywords: [skill.category, skill.version, 'skill registry reusable operational knowledge'],
    route: { view: 'skills', skill: skill.id },
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
    {
      id: `analytics:${edition.analytics.providerUsage.id}`,
      kind: 'analytics',
      title: edition.analytics.providerUsage.label,
      summary: edition.analytics.providerUsage.description,
      keywords: ['provider service usage limits quota analytics'],
      route: { view: 'analytics', domain: 'ai', subject: edition.analytics.providerUsage.id },
    },
  ];
  return [...portfolioRecords, ...skillRecords, ...benchmarkRecords, ...analyticsRecords];
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
    skills: 'Reusable delivery knowledge',
  };
  return {
    sectionOrder: ['provider-usage', 'source-exceptions', 'destinations', 'recently-landed'],
    sourceExceptions: getSourceTrust().filter((source) => source.invalidatesClaims),
    destinations: NAV_ITEMS.filter((item) => Object.hasOwn(summaries, item.id)).map((item) => ({ ...item, summary: summaries[item.id] })),
  };
}

const ROUTE_KEYS = ['view', 'q', 'domain', 'subject', 'range', 'mode', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation'];

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
  return { ...route };
}
