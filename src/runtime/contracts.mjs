import demoEdition from '../../config/demo.edition.v1.json' with { type: 'json' };
import demoDomainProjection from '../../fixtures/demo/domain.v1.json' with { type: 'json' };
import { validateShowcaseProjection } from '../showcase/projection.mjs';

export const ACC_EDITION_SCHEMA_VERSION = 'acc-edition-v1';
export const ACC_DOMAIN_SCHEMA_VERSION = 'acc-domain-projection-v1';
export const ACC_RUNTIME_MAX_BYTES = 2 * 1024 * 1024;

const KNOWN_MODULES = new Set(['overview', 'portfolio', 'analytics', 'benchmarks', 'search']);
const KNOWN_THEMES = new Set(['g1-console', 'current-dark', 'matrix', 'decepticons', 'autobots']);
const EDITION_FIELDS = new Set(['schemaVersion', 'id', 'branding', 'modules', 'projections', 'analytics']);
const DOMAIN_FIELDS = new Set(['schemaVersion', 'generatedAt', 'data', 'showcase']);
const DOMAIN_DATA_FIELDS = new Set(['meta', 'sources', 'voicePerformance', 'products', 'modelFamilies', 'conditions', 'benchmarkReleases', 'benchmarkComparison', 'results', 'runs', 'evaluations']);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, name, allowed = null) {
  if (!plainObject(value)) throw new TypeError(`${name} must be an object`);
  if (allowed) for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${name} has unknown field ${key}`);
  return value;
}

function assertString(value, name, { max = 2048, pattern = null } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(`${name} must be a bounded non-empty string`);
  if (pattern && !pattern.test(value)) throw new TypeError(`${name} has an invalid format`);
  return value;
}

function assertTimestamp(value, name) {
  assertString(value, name, { max: 64 });
  if (Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new TypeError(`${name} must be a canonical UTC timestamp`);
  return value;
}

function assertArray(value, name, max = 5000) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${name} must be a bounded array`);
  return value;
}

function assertId(value, name) {
  return assertString(value, name, { max: 128, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/ });
}

function assertRelativeProjectionPath(value, name) {
  assertString(value, name, { max: 512 });
  if (value.includes('\\') || value.includes('\0') || value.startsWith('/') || value.startsWith('~') || value.split('/').includes('..') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    throw new TypeError(`${name} must be a safe relative projection path`);
  }
  if (!/^(?:runtime|data)\/[A-Za-z0-9._/-]+\.json$/.test(value)) throw new TypeError(`${name} must stay under runtime/ or data/ and end in .json`);
  return value;
}

function assertUniqueIds(values, name) {
  const seen = new Set();
  values.forEach((value, index) => {
    assertObject(value, `${name}[${index}]`);
    const id = assertId(value.id, `${name}[${index}].id`);
    if (seen.has(id)) throw new TypeError(`${name} ids must be unique`);
    seen.add(id);
  });
  return seen;
}

function assertTextTree(value, name = 'projection') {
  if (typeof value === 'string') {
    if (value.length > 16_384 || value.includes('\0')) throw new TypeError(`${name} contains an unsafe string`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 5000) throw new TypeError(`${name} contains an oversized array`);
    value.forEach((item, index) => assertTextTree(item, `${name}[${index}]`));
    return;
  }
  if (plainObject(value)) {
    if (Object.keys(value).length > 512) throw new TypeError(`${name} contains an oversized object`);
    Object.entries(value).forEach(([key, item]) => {
      if (!/^[A-Za-z0-9_.:-]+$/.test(key)) throw new TypeError(`${name} contains an unsafe field name`);
      assertTextTree(item, `${name}.${key}`);
    });
  }
}

function validateWebAnalyticsSubject(subject, name) {
  assertObject(subject, name, new Set(['id', 'label', 'description', 'projection']));
  return {
    id: assertId(subject.id, `${name}.id`),
    label: assertString(subject.label, `${name}.label`, { max: 96 }),
    description: assertString(subject.description, `${name}.description`, { max: 1024 }),
    projection: assertRelativeProjectionPath(subject.projection, `${name}.projection`),
  };
}

function validateGitHubAnalyticsSubject(subject) {
  const name = 'edition.analytics.github';
  assertObject(subject, name, new Set(['id', 'label', 'description', 'projection']));
  if (subject.id !== 'github-portfolio') throw new TypeError('GitHub analytics adapter id is fixed');
  return {
    id: subject.id,
    label: assertString(subject.label, `${name}.label`, { max: 96 }),
    description: assertString(subject.description, `${name}.description`, { max: 1024 }),
    projection: assertRelativeProjectionPath(subject.projection, `${name}.projection`),
  };
}

export function validateEditionWithWarnings(value) {
  assertObject(value, 'edition');
  const warnings = Object.keys(value).filter((key) => !EDITION_FIELDS.has(key)).map((key) => `edition.${key} is unsupported and was ignored`);
  if (value.schemaVersion !== ACC_EDITION_SCHEMA_VERSION) throw new TypeError(`edition must use ${ACC_EDITION_SCHEMA_VERSION}`);
  const id = assertId(value.id, 'edition.id');
  assertObject(value.branding, 'edition.branding', new Set(['title', 'defaultTheme']));
  const branding = {
    title: assertString(value.branding.title, 'edition.branding.title', { max: 96 }),
    defaultTheme: value.branding.defaultTheme,
  };
  if (!KNOWN_THEMES.has(branding.defaultTheme)) throw new TypeError('edition.branding.defaultTheme is unsupported');
  const modules = assertArray(value.modules, 'edition.modules', KNOWN_MODULES.size).map((module, index) => {
    assertObject(module, `edition.modules[${index}]`, new Set(['id', 'label']));
    if (!KNOWN_MODULES.has(module.id)) throw new TypeError('edition modules must be unique known modules');
    return { id: module.id, label: assertString(module.label, `edition.modules[${index}].label`, { max: 48 }) };
  });
  const moduleIds = new Set(modules.map(({ id: moduleId }) => moduleId));
  if (moduleIds.size !== modules.length) throw new TypeError('edition modules must be unique known modules');
  if (!moduleIds.has('overview')) throw new TypeError('edition must enable overview');
  assertObject(value.projections, 'edition.projections', new Set(['domain', 'providerUsage']));
  const projections = {
    domain: assertRelativeProjectionPath(value.projections.domain, 'edition.projections.domain'),
    providerUsage: assertRelativeProjectionPath(value.projections.providerUsage, 'edition.projections.providerUsage'),
  };
  const sourceAnalytics = assertObject(value.analytics, 'edition.analytics');
  for (const key of Object.keys(sourceAnalytics)) {
    if (!['web', 'github', 'providerUsage'].includes(key)) warnings.push(`edition.analytics.${key} is unsupported and was ignored`);
  }
  const web = [];
  const webIds = new Set();
  assertArray(sourceAnalytics.web, 'edition.analytics.web', 50).forEach((subject, index) => {
    const name = `edition.analytics.web[${index}]`;
    try {
      const projected = validateWebAnalyticsSubject(subject, name);
      if (webIds.has(projected.id)) throw new TypeError('analytics subject ids must be unique');
      webIds.add(projected.id);
      web.push(projected);
    } catch (error) {
      warnings.push(`${name} was withheld: ${error.message}`);
    }
  });
  let github = null;
  if (sourceAnalytics.github !== null && sourceAnalytics.github !== undefined) {
    try { github = validateGitHubAnalyticsSubject(sourceAnalytics.github); }
    catch (error) { warnings.push(`edition.analytics.github was withheld: ${error.message}`); }
  }
  assertObject(sourceAnalytics.providerUsage, 'edition.analytics.providerUsage', new Set(['id', 'label', 'description']));
  if (sourceAnalytics.providerUsage.id !== 'provider-usage') throw new TypeError('provider usage adapter id is fixed');
  const providerUsage = {
    id: sourceAnalytics.providerUsage.id,
    label: assertString(sourceAnalytics.providerUsage.label, 'edition.analytics.providerUsage.label', { max: 96 }),
    description: assertString(sourceAnalytics.providerUsage.description, 'edition.analytics.providerUsage.description', { max: 1024 }),
  };
  const edition = { schemaVersion: value.schemaVersion, id, branding, modules, projections, analytics: { web, github, providerUsage } };
  assertTextTree(edition, 'edition');
  return { edition, warnings };
}

export function validateEdition(value) {
  return validateEditionWithWarnings(value).edition;
}

function validateScore(score, name) {
  assertObject(score, name);
  assertString(score.label, `${name}.label`, { max: 96 });
  assertString(score.benchmark, `${name}.benchmark`, { max: 96 });
  if (!(score.value === null || (Number.isFinite(score.value) && score.value >= 0 && score.value <= 100))) throw new TypeError(`${name}.value must be null or 0..100`);
  if (!['verified', 'pending', 'provisional'].includes(score.evidence)) throw new TypeError(`${name}.evidence is unsupported`);
  assertString(score.denominator, `${name}.denominator`, { max: 512 });
  assertArray(score.detail, `${name}.detail`, 100);
  score.detail.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== 2) throw new TypeError(`${name}.detail[${index}] must be a [label, value] pair`);
    assertString(row[0], `${name}.detail[${index}][0]`, { max: 128 });
    assertString(row[1], `${name}.detail[${index}][1]`, { max: 1024 });
  });
  if (score.progress !== undefined) {
    assertObject(score.progress, `${name}.progress`);
    if (!Number.isSafeInteger(score.progress.current) || !Number.isSafeInteger(score.progress.total) || score.progress.current < 0 || score.progress.total < 0 || score.progress.current > score.progress.total) throw new TypeError(`${name}.progress counts are invalid`);
    if (!['in-progress', 'queued', 'pending'].includes(score.progress.state)) throw new TypeError(`${name}.progress.state is unsupported`);
    assertString(score.progress.label, `${name}.progress.label`, { max: 512 });
    if (score.progress.capturedAt !== undefined) assertTimestamp(score.progress.capturedAt, `${name}.progress.capturedAt`);
  }
}

export function validateDomainProjection(value) {
  assertObject(value, 'domain projection', DOMAIN_FIELDS);
  if (value.schemaVersion !== ACC_DOMAIN_SCHEMA_VERSION) throw new TypeError(`domain projection must use ${ACC_DOMAIN_SCHEMA_VERSION}`);
  assertTimestamp(value.generatedAt, 'domain projection.generatedAt');
  const data = assertObject(value.data, 'domain projection.data', DOMAIN_DATA_FIELDS);
  assertObject(data.meta, 'domain projection.data.meta');
  assertArray(data.sources, 'domain projection.data.sources', 100);
  assertArray(data.products, 'domain projection.data.products', 500);
  assertArray(data.modelFamilies, 'domain projection.data.modelFamilies', 500);
  assertArray(data.conditions, 'domain projection.data.conditions', 1000);
  assertArray(data.benchmarkComparison, 'domain projection.data.benchmarkComparison', 1000);
  assertArray(data.results, 'domain projection.data.results', 10000);
  assertArray(data.runs, 'domain projection.data.runs', 10000);
  assertArray(data.evaluations, 'domain projection.data.evaluations', 1000);
  assertObject(data.voicePerformance, 'domain projection.data.voicePerformance');
  assertObject(data.benchmarkReleases, 'domain projection.data.benchmarkReleases', new Set(['tool-use', 'reasoning', 'coding', 'multi-turn-agent']));
  for (const domain of ['tool-use', 'reasoning', 'coding']) assertId(data.benchmarkReleases[domain], `domain projection.data.benchmarkReleases.${domain}`);
  if (data.benchmarkReleases['multi-turn-agent'] !== undefined) assertId(data.benchmarkReleases['multi-turn-agent'], 'domain projection.data.benchmarkReleases.multi-turn-agent');

  assertUniqueIds(data.sources, 'sources');
  const productIds = assertUniqueIds(data.products, 'products');
  const familyIds = assertUniqueIds(data.modelFamilies, 'modelFamilies');
  const conditionIds = assertUniqueIds(data.conditions, 'conditions');
  const resultIds = assertUniqueIds(data.results, 'results');
  const runIds = assertUniqueIds(data.runs, 'runs');
  assertUniqueIds(data.evaluations, 'evaluations');

  data.conditions.forEach((condition, index) => {
    if (!familyIds.has(condition.familyId)) throw new TypeError(`conditions[${index}] references an unknown family`);
  });
  data.results.forEach((result, index) => {
    if (!conditionIds.has(result.conditionId)) throw new TypeError(`results[${index}] references an unknown condition`);
    assertArray(result.runIds, `results[${index}].runIds`, 100).forEach((id) => { if (!runIds.has(id)) throw new TypeError(`results[${index}] references an unknown run`); });
  });
  const comparisonIds = new Set();
  data.benchmarkComparison.forEach((profile, index) => {
    assertObject(profile, `benchmarkComparison[${index}]`);
    if (!conditionIds.has(profile.conditionId) || comparisonIds.has(profile.conditionId)) throw new TypeError('benchmark comparisons must reference unique known conditions');
    comparisonIds.add(profile.conditionId);
    assertObject(profile.scores, `benchmarkComparison[${index}].scores`);
    if (Object.keys(profile.scores).sort().join(',') !== 'agent,instruction,tools') throw new TypeError('benchmark comparison must contain exactly the three core scores');
    for (const [scoreId, score] of Object.entries(profile.scores)) validateScore(score, `benchmarkComparison[${index}].scores.${scoreId}`);
  });
  data.evaluations.forEach((evaluation, index) => {
    assertArray(evaluation.affectedObjects, `evaluations[${index}].affectedObjects`, 100).forEach((object) => {
      if (object.type === 'product' && !productIds.has(object.id)) throw new TypeError(`evaluations[${index}] references an unknown product`);
      if (object.type === 'condition' && !conditionIds.has(object.id)) throw new TypeError(`evaluations[${index}] references an unknown condition`);
    });
  });
  const showcase = validateShowcaseProjection(value.showcase);
  const projected = structuredClone(value);
  projected.showcase = structuredClone(showcase);
  for (const condition of projected.data.conditions) condition.results = projected.data.results.filter((result) => result.conditionId === condition.id);
  assertTextTree(projected, 'domain projection');
  return projected;
}

export function parseRuntimeJson(text, validator, name = 'runtime projection') {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > ACC_RUNTIME_MAX_BYTES) throw new TypeError(`${name} exceeds the runtime size limit`);
  let value;
  try { value = JSON.parse(text); } catch { throw new TypeError(`${name} is not valid JSON`); }
  return validator(value);
}

export const DEMO_EDITION = validateEdition(demoEdition);
export const DEMO_DOMAIN_PROJECTION = validateDomainProjection(demoDomainProjection);
