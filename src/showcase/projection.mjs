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

function assertRepository(value, label) {
  assertString(value, label);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) throw new Error(`${label} must be an owner/repository identifier`);
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

export function validateShowcasePolicy(policy) {
  assertObject(policy, 'policy', ['schemaVersion', 'github']);
  if (policy.schemaVersion !== 'showcase-projection-policy-v1') throw new Error('Unsupported showcase projection policy schema');
  assertObject(policy.github, 'policy.github', ['projects']);
  const projects = assertArray(policy.github.projects, 'policy.github.projects');
  if (projects.length > 50) throw new Error('Policy repository selection must be bounded');
  const seen = new Set();
  projects.forEach((project, index) => {
    const label = `policy.github.projects[${index}]`;
    assertObject(project, label, ['id', 'repository', 'pointers']);
    assertString(project.id, `${label}.id`);
    assertRepository(project.repository, `${label}.repository`);
    if (seen.has(project.id)) throw new Error(`${label}.id must be unique`);
    seen.add(project.id);
    validatePointerPolicy(project.pointers, `${label}.pointers`);
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
  assertString(project.id, `${label}.id`);
  const repository = assertRepository(project.repository, `${label}.repository`);
  if (project.visibility !== 'PUBLIC') throw new Error(`${label}.visibility must be PUBLIC`);
  assertString(project.name, `${label}.name`);
  assertString(project.description, `${label}.description`);
  for (const field of ['repositoryUrl', 'productBriefUrl', 'demoUrl', 'architectureUrl', 'relatedArticleUrl']) {
    if (project[field] !== undefined) assertHttpsUrl(project[field], `${label}.${field}`);
  }
  if (project.repositoryUrl !== `https://github.com/${repository}`) throw new Error(`${label}.repositoryUrl is not canonical`);
}

export function validateShowcaseProjection(snapshot) {
  assertObject(snapshot, 'snapshot', ['schemaVersion', 'refreshedAt', 'githubProjects']);
  if (snapshot.schemaVersion !== 'showcase-projection-v1') throw new Error('Unsupported showcase projection snapshot schema');
  assertString(snapshot.refreshedAt, 'snapshot.refreshedAt');
  if (Number.isNaN(Date.parse(snapshot.refreshedAt))) throw new Error('snapshot.refreshedAt must be an ISO timestamp');
  const projects = assertArray(snapshot.githubProjects, 'snapshot.githubProjects');
  if (projects.length > 50) throw new Error('Snapshot project selection must be bounded');
  projects.forEach(validateGithubProject);
  if (new Set(projects.map((project) => project.id)).size !== projects.length) throw new Error('Snapshot project identities must be unique');

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