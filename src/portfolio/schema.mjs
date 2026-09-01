const TOP_FIELDS = new Set(['schemaVersion', 'generatedAt', 'source', 'policy', 'summary', 'projects']);
const SOURCE_FIELDS = new Set(['authority', 'profile', 'registryProjectCount', 'annotatedProjectCount']);
const POLICY_FIELDS = new Set(['activeLimit', 'rule']);
const SUMMARY_FIELDS = new Set(['total', 'active', 'operational', 'missingDocuments', 'unclassified']);
const PROJECT_FIELDS = new Set([
  'id', 'slug', 'name', 'description', 'outcome', 'portfolioState', 'health', 'focusRank',
  'deliveryModel', 'phase', 'nextGate', 'lastReviewedAt', 'visibility', 'repositoryUrl',
  'archived', 'documents', 'lifecycle', 'sessionRefs', 'relatedSkills',
]);
const DOCUMENT_FIELDS = new Set(['status', 'label', 'href', 'note']);
const LIFECYCLE_FIELDS = new Set(['id', 'label', 'state']);
const SESSION_FIELDS = new Set(['label', 'ref']);
const STATES = new Set(['active', 'operational', 'candidate', 'paused', 'complete', 'archived', 'unclassified']);
const HEALTH = new Set(['on_track', 'at_risk', 'blocked', 'unknown']);
const DOCUMENT_STATES = new Set(['approved', 'ratified', 'mapped', 'draft', 'historical', 'missing']);
const LIFECYCLE_STATES = new Set(['complete', 'current', 'next', 'future']);
const SLUG = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SESSION_REF = /^@session:[a-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function object(value, label, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${label} has unknown field ${key}`);
  return value;
}

function text(value, label, max = 4096) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new TypeError(`${label} must be a bounded non-empty string`);
  return value;
}

function timestamp(value, label, nullable = false) {
  if (nullable && value === null) return null;
  text(value, label, 64);
  if (Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new TypeError(`${label} must be a canonical UTC timestamp`);
  return value;
}

function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`${label} must be an integer from ${min} to ${max}`);
  return value;
}

function array(value, label, max = 100) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${label} must be a bounded array`);
  return value;
}

function safeHref(value, label) {
  text(value, label, 1024);
  if (/^(?:runtime|data)\/[A-Za-z0-9._/-]+\.html$/.test(value) && !value.split('/').includes('..')) return value;
  let parsed;
  try { parsed = new URL(value); } catch { throw new TypeError(`${label} must be a safe relative or credential-free HTTPS URL`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new TypeError(`${label} must be a safe relative or credential-free HTTPS URL`);
  return value;
}

function validateDocument(value, label) {
  object(value, label, DOCUMENT_FIELDS);
  if (!DOCUMENT_STATES.has(value.status)) throw new TypeError(`${label}.status is unsupported`);
  text(value.label, `${label}.label`, 160);
  if (value.href !== undefined) safeHref(value.href, `${label}.href`);
  if (value.note !== undefined) text(value.note, `${label}.note`, 1024);
  if (value.status === 'missing' && value.href !== undefined) throw new TypeError(`${label} cannot link a missing document`);
  if (value.status !== 'missing' && value.href === undefined) throw new TypeError(`${label} must link mapped document evidence`);
  return value;
}

function validateProject(value, index, activeLimit) {
  const label = `project portfolio.projects[${index}]`;
  object(value, label, PROJECT_FIELDS);
  text(value.id, `${label}.id`, 128);
  if (!ID.test(value.id)) throw new TypeError(`${label}.id has an invalid format`);
  text(value.slug, `${label}.slug`, 64);
  if (!SLUG.test(value.slug)) throw new TypeError(`${label}.slug has an invalid format`);
  text(value.name, `${label}.name`, 160);
  text(value.description, `${label}.description`, 2048);
  text(value.outcome, `${label}.outcome`, 2048);
  if (!STATES.has(value.portfolioState)) throw new TypeError(`${label}.portfolioState is unsupported`);
  if (!HEALTH.has(value.health)) throw new TypeError(`${label}.health is unsupported`);
  integer(value.focusRank, `${label}.focusRank`, { min: 1, max: activeLimit, nullable: true });
  if ((value.portfolioState === 'active') !== (value.focusRank !== null)) throw new TypeError(`${label}.focusRank must exist exactly for active projects`);
  text(value.deliveryModel, `${label}.deliveryModel`, 96);
  text(value.phase, `${label}.phase`, 160);
  text(value.nextGate, `${label}.nextGate`, 2048);
  timestamp(value.lastReviewedAt, `${label}.lastReviewedAt`, true);
  if (!['private', 'public'].includes(value.visibility)) throw new TypeError(`${label}.visibility is unsupported`);
  if (!(value.repositoryUrl === null || typeof value.repositoryUrl === 'string')) throw new TypeError(`${label}.repositoryUrl must be null or HTTPS`);
  if (value.repositoryUrl !== null) safeHref(value.repositoryUrl, `${label}.repositoryUrl`);
  if (typeof value.archived !== 'boolean') throw new TypeError(`${label}.archived must be boolean`);
  if (value.archived !== (value.portfolioState === 'archived')) throw new TypeError(`${label}.archived must agree with portfolioState`);
  object(value.documents, `${label}.documents`, new Set(['vision', 'charter', 'architecture']));
  for (const role of ['vision', 'charter', 'architecture']) validateDocument(value.documents[role], `${label}.documents.${role}`);
  const lifecycleIds = new Set();
  array(value.lifecycle, `${label}.lifecycle`, 20).forEach((gate, gateIndex) => {
    const gateLabel = `${label}.lifecycle[${gateIndex}]`;
    object(gate, gateLabel, LIFECYCLE_FIELDS);
    text(gate.id, `${gateLabel}.id`, 64);
    if (!SLUG.test(gate.id) || lifecycleIds.has(gate.id)) throw new TypeError(`${gateLabel}.id must be a unique slug`);
    lifecycleIds.add(gate.id);
    text(gate.label, `${gateLabel}.label`, 160);
    if (!LIFECYCLE_STATES.has(gate.state)) throw new TypeError(`${gateLabel}.state is unsupported`);
  });
  if (value.lifecycle.filter(({ state }) => state === 'current').length > 1) throw new TypeError(`${label}.lifecycle can have at most one current gate`);
  array(value.sessionRefs, `${label}.sessionRefs`, 20).forEach((session, sessionIndex) => {
    const sessionLabel = `${label}.sessionRefs[${sessionIndex}]`;
    object(session, sessionLabel, SESSION_FIELDS);
    text(session.label, `${sessionLabel}.label`, 160);
    if (!SESSION_REF.test(session.ref)) throw new TypeError(`${sessionLabel}.ref is not a Hermes session reference`);
  });
  array(value.relatedSkills, `${label}.relatedSkills`, 30).forEach((skill, skillIndex) => text(skill, `${label}.relatedSkills[${skillIndex}]`, 160));
  return value;
}

export function validateProjectPortfolio(value) {
  object(value, 'project portfolio', TOP_FIELDS);
  if (value.schemaVersion !== 'acc-project-portfolio-v1') throw new TypeError('project portfolio schema is unsupported');
  timestamp(value.generatedAt, 'project portfolio.generatedAt');
  object(value.source, 'project portfolio.source', SOURCE_FIELDS);
  if (value.source.authority !== 'Hermes projects.db joined to validated project manifests') throw new TypeError('project portfolio source authority is unsupported');
  text(value.source.profile, 'project portfolio.source.profile', 64);
  integer(value.source.registryProjectCount, 'project portfolio.source.registryProjectCount', { max: 500 });
  integer(value.source.annotatedProjectCount, 'project portfolio.source.annotatedProjectCount', { max: 500 });
  object(value.policy, 'project portfolio.policy', POLICY_FIELDS);
  const activeLimit = integer(value.policy.activeLimit, 'project portfolio.policy.activeLimit', { min: 1, max: 12 });
  text(value.policy.rule, 'project portfolio.policy.rule', 512);
  object(value.summary, 'project portfolio.summary', SUMMARY_FIELDS);
  const projects = array(value.projects, 'project portfolio.projects', 500).map((project, index) => validateProject(project, index, activeLimit));
  if (value.source.registryProjectCount !== projects.length) throw new TypeError('registry project count must equal projected project count');
  if (value.source.annotatedProjectCount > projects.length) throw new TypeError('annotated project count cannot exceed registry project count');
  if (new Set(projects.map(({ id }) => id)).size !== projects.length || new Set(projects.map(({ slug }) => slug)).size !== projects.length) throw new TypeError('project ids and slugs must be unique');
  const active = projects.filter(({ portfolioState }) => portfolioState === 'active');
  if (active.length > activeLimit) throw new TypeError(`active project limit ${activeLimit} exceeded`);
  const ranks = active.map(({ focusRank }) => focusRank).sort((a, b) => a - b);
  if (new Set(ranks).size !== ranks.length || ranks.some((rank, index) => rank !== index + 1)) throw new TypeError('active focus ranks must be unique and contiguous from 1');
  const projected = structuredClone(value);
  projected.projects = projects;
  projected.summary = {
    total: projects.length,
    active: active.length,
    operational: projects.filter(({ portfolioState }) => portfolioState === 'operational').length,
    missingDocuments: projects.reduce((count, project) => count + Object.values(project.documents).filter(({ status }) => status === 'missing').length, 0),
    unclassified: projects.filter(({ portfolioState }) => portfolioState === 'unclassified').length,
  };
  return projected;
}

export const EMPTY_PROJECT_PORTFOLIO = Object.freeze({
  schemaVersion: 'acc-project-portfolio-v1',
  generatedAt: '2026-01-01T00:00:00.000Z',
  source: { authority: 'Hermes projects.db joined to validated project manifests', profile: 'demo', registryProjectCount: 0, annotatedProjectCount: 0 },
  policy: { activeLimit: 3, rule: 'One project enters Active only when another leaves Active.' },
  summary: { total: 0, active: 0, operational: 0, missingDocuments: 0, unclassified: 0 },
  projects: [],
});
