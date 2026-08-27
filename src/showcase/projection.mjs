const PROJECT_ALLOWLIST = new Map([
  ['jarvis', 'AlexGeslani/Jarvis'],
  ['stacklogic', 'AlexGeslani/StackLogic'],
  ['8-ball', 'AlexGeslani/8-Ball'],
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function assertObject(value, label, allowedKeys, requiredKeys = allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) throw new Error(`${label} contains unknown field ${key}`);
  }
  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) throw new Error(`${label} is missing field ${key}`);
  }
  return value;
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function assertHttpsUrl(value, label) {
  assertString(value, label);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid URL`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a credential-free HTTPS URL`);
  return value;
}

function assertRelativePointer(value, label) {
  assertString(value, label);
  if (value.startsWith('/') || value.startsWith('~') || value.includes('\\') || value.split('/').includes('..')) {
    throw new Error(`${label} must be a repository-relative pointer`);
  }
  return value;
}

function assertSafeClientStrings(value, label = 'projection') {
  if (typeof value === 'string') {
    if (/\/Users\/|(?:^|\W)(?:authorization|github_token|access_token|readmeBody|privateRepositories)(?:$|\W)/i.test(value)) {
      throw new Error(`${label} contains an unsafe client-visible path or field`);
    }
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafeClientStrings(item, `${label}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertSafeClientStrings(item, `${label}.${key}`);
  }
}

function validatePointerPolicy(pointers, label) {
  assertObject(pointers, label, ['productBrief', 'architecture', 'relatedArticle'], ['productBrief']);
  if (pointers.productBrief !== 'README.md') throw new Error(`${label}.productBrief must point to README.md`);
  if (pointers.architecture !== undefined) assertRelativePointer(pointers.architecture, `${label}.architecture`);
  if (pointers.relatedArticle !== undefined) assertHttpsUrl(pointers.relatedArticle, `${label}.relatedArticle`);
}

function validateShowcaseEditionPolicy(edition, label) {
  assertObject(edition, label, ['id', 'name', 'repository', 'independenceStatus', 'validationStatus']);
  assertString(edition.id, `${label}.id`);
  assertString(edition.name, `${label}.name`);
  assertString(edition.repository, `${label}.repository`);
  if (edition.independenceStatus !== 'approved-independent') throw new Error(`${label} is not an independently approved showcase edition`);
  assertString(edition.validationStatus, `${label}.validationStatus`);
}

export function validateShowcasePolicy(policy) {
  assertObject(policy, 'policy', ['schemaVersion', 'github', 'skills']);
  if (policy.schemaVersion !== 'showcase-projection-policy-v1') throw new Error('Unsupported showcase projection policy schema');
  assertObject(policy.github, 'policy.github', ['projects']);
  const projects = assertArray(policy.github.projects, 'policy.github.projects');
  if (projects.length !== PROJECT_ALLOWLIST.size) throw new Error('Policy repository allowlist must contain exactly three approved projects');
  const seen = new Set();
  projects.forEach((project, index) => {
    const label = `policy.github.projects[${index}]`;
    assertObject(project, label, ['id', 'repository', 'pointers']);
    const repository = PROJECT_ALLOWLIST.get(project.id);
    if (!repository || repository !== project.repository || seen.has(project.id)) throw new Error(`${label} is outside the repository allowlist`);
    seen.add(project.id);
    validatePointerPolicy(project.pointers, `${label}.pointers`);
  });
  assertObject(policy.skills, 'policy.skills', ['showcaseEditions', 'operational']);
  assertArray(policy.skills.showcaseEditions, 'policy.skills.showcaseEditions').forEach(validateShowcaseEditionPolicy);
  const skillIds = new Set();
  assertArray(policy.skills.operational, 'policy.skills.operational').forEach((skill, index) => {
    const label = `policy.skills.operational[${index}]`;
    assertObject(skill, label, ['id', 'category', 'source']);
    assertString(skill.id, `${label}.id`);
    assertString(skill.category, `${label}.category`);
    assertRelativePointer(skill.source, `${label}.source`);
    if (!skill.source.endsWith('/SKILL.md') || skillIds.has(skill.id)) throw new Error(`${label} must select one unique relative SKILL.md`);
    skillIds.add(skill.id);
  });
  assertSafeClientStrings(policy, 'policy');
  return policy;
}

function validateGithubProject(project, index) {
  const label = `snapshot.githubProjects[${index}]`;
  assertObject(project, label, [
    'id', 'name', 'repository', 'visibility', 'repositoryUrl', 'description', 'demoUrl',
    'productBriefUrl', 'architectureUrl', 'relatedArticleUrl',
  ], ['id', 'name', 'repository', 'visibility', 'repositoryUrl', 'description', 'productBriefUrl']);
  const repository = PROJECT_ALLOWLIST.get(project.id);
  if (!repository || repository !== project.repository) throw new Error(`${label} is outside the repository allowlist`);
  if (project.visibility !== 'PUBLIC') throw new Error(`${label}.visibility must be PUBLIC`);
  assertString(project.name, `${label}.name`);
  assertString(project.description, `${label}.description`);
  for (const field of ['repositoryUrl', 'productBriefUrl', 'demoUrl', 'architectureUrl', 'relatedArticleUrl']) {
    if (project[field] !== undefined) assertHttpsUrl(project[field], `${label}.${field}`);
  }
  if (project.repositoryUrl !== `https://github.com/${repository}`) throw new Error(`${label}.repositoryUrl is not canonical`);
}

function validateOperationalSkill(skill, index) {
  const label = `snapshot.operationalSkills[${index}]`;
  assertObject(skill, label, [
    'id', 'name', 'description', 'version', 'category', 'license', 'platforms',
    'metadataStatus', 'validationStatus',
  ], ['id', 'name', 'description', 'version', 'category', 'metadataStatus', 'validationStatus']);
  for (const field of ['id', 'name', 'description', 'version', 'category']) assertString(skill[field], `${label}.${field}`);
  if (skill.license !== undefined) assertString(skill.license, `${label}.license`);
  if (skill.platforms !== undefined) assertArray(skill.platforms, `${label}.platforms`).forEach((item, itemIndex) => assertString(item, `${label}.platforms[${itemIndex}]`));
  if (skill.metadataStatus !== 'frontmatter') throw new Error(`${label}.metadataStatus must be frontmatter`);
  if (skill.validationStatus !== 'Unknown') throw new Error(`${label}.validationStatus requires retained validation authority and must currently be Unknown`);
}

function validateShowcaseEdition(edition, index) {
  const label = `snapshot.showcaseEditions[${index}]`;
  assertObject(edition, label, ['id', 'name', 'repository', 'repositoryUrl', 'visibility', 'independenceStatus', 'validationStatus']);
  for (const field of ['id', 'name', 'repository', 'independenceStatus', 'validationStatus']) assertString(edition[field], `${label}.${field}`);
  assertHttpsUrl(edition.repositoryUrl, `${label}.repositoryUrl`);
  if (edition.visibility !== 'PUBLIC' || edition.independenceStatus !== 'approved-independent') {
    throw new Error(`${label} must be PUBLIC and independently approved`);
  }
}

export function validateShowcaseProjection(snapshot) {
  assertObject(snapshot, 'snapshot', ['schemaVersion', 'refreshedAt', 'githubProjects', 'showcaseEditions', 'operationalSkills']);
  if (snapshot.schemaVersion !== 'showcase-projection-v1') throw new Error('Unsupported showcase projection snapshot schema');
  assertString(snapshot.refreshedAt, 'snapshot.refreshedAt');
  if (Number.isNaN(Date.parse(snapshot.refreshedAt))) throw new Error('snapshot.refreshedAt must be an ISO timestamp');
  const projects = assertArray(snapshot.githubProjects, 'snapshot.githubProjects');
  if (projects.length !== PROJECT_ALLOWLIST.size) throw new Error('Snapshot must contain exactly the approved repository allowlist');
  projects.forEach(validateGithubProject);
  if (new Set(projects.map((project) => project.id)).size !== PROJECT_ALLOWLIST.size) throw new Error('Snapshot project identities must be unique');
  assertArray(snapshot.showcaseEditions, 'snapshot.showcaseEditions').forEach(validateShowcaseEdition);
  assertArray(snapshot.operationalSkills, 'snapshot.operationalSkills').forEach(validateOperationalSkill);
  assertSafeClientStrings(snapshot, 'snapshot');
  return snapshot;
}

export function getPortfolioProjection(snapshot, internalProducts) {
  const checked = validateShowcaseProjection(snapshot);
  const publicIds = new Set(checked.githubProjects.map((project) => project.id));
  return {
    refreshedAt: checked.refreshedAt,
    githubShowcaseProjects: checked.githubProjects,
    internalProducts: internalProducts.filter((product) => !publicIds.has(product.id)),
  };
}

export function getSkillsProjection(snapshot) {
  const checked = validateShowcaseProjection(snapshot);
  return {
    refreshedAt: checked.refreshedAt,
    showcaseEditions: checked.showcaseEditions,
    showcaseEmptyState: checked.showcaseEditions.length ? null : 'No independently approved public showcase editions are allowlisted.',
    operationalSkills: checked.operationalSkills,
    boundary: 'This is a one-way metadata projection, not synchronization. Editing and enablement remain in Hermes Skills.',
  };
}