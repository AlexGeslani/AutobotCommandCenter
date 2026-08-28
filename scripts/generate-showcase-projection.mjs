import { homedir } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateShowcasePolicy, validateShowcaseProjection } from '../src/showcase/projection.mjs';

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    return inner ? inner.split(',').map((item) => parseScalar(item)) : [];
  }
  return trimmed;
}

export function parseSkillFrontmatter(text) {
  if (typeof text !== 'string' || !text.startsWith('---\n')) throw new Error('Selected SKILL.md is missing frontmatter');
  const end = text.indexOf('\n---', 4);
  if (end === -1) throw new Error('Selected SKILL.md frontmatter is not closed');
  const parsed = {};
  for (const line of text.slice(4, end).split('\n')) {
    if (!line || /^\s/.test(line) || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match || !match[2].trim()) continue;
    parsed[match[1]] = parseScalar(match[2]);
  }
  return parsed;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}

export function stableJson(value) {
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

function normalizedPublicRepo(metadata, repository) {
  if (!metadata) throw new Error(`Allowlisted repository ${repository} is missing`);
  if (metadata.full_name !== repository) throw new Error(`Allowlisted repository ${repository} returned the wrong identity`);
  if (metadata.private !== false || String(metadata.visibility).toUpperCase() !== 'PUBLIC') {
    throw new Error(`Allowlisted repository ${repository} must be fetched as PUBLIC`);
  }
  if (metadata.html_url !== `https://github.com/${repository}`) throw new Error(`Allowlisted repository ${repository} returned a non-canonical URL`);
  if (typeof metadata.description !== 'string' || !metadata.description.trim()) throw new Error(`Allowlisted repository ${repository} is missing its canonical API description`);
  if (typeof metadata.default_branch !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(metadata.default_branch)) throw new Error(`Allowlisted repository ${repository} has a malformed default branch`);
  return metadata;
}

function blobUrl(repository, branch, path) {
  return `https://github.com/${repository}/blob/${branch}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function buildShowcaseProjection(policy, adapters) {
  const checked = validateShowcasePolicy(policy);
  if (!adapters || typeof adapters.fetchRepo !== 'function' || typeof adapters.probeUrl !== 'function' || typeof adapters.readSkill !== 'function') {
    throw new Error('Projection refresh requires explicit repository, pointer, and local-skill adapters');
  }
  const refreshedAt = adapters.refreshedAt || new Date().toISOString();
  const githubProjects = [];
  for (const selected of checked.github.projects) {
    let metadata;
    try { metadata = await adapters.fetchRepo(selected.repository); } catch (error) {
      throw new Error(`Allowlisted repository ${selected.repository} is missing or unavailable: ${error.message}`);
    }
    const repo = normalizedPublicRepo(metadata, selected.repository);
    const projected = {
      id: selected.id,
      name: repo.name,
      repository: selected.repository,
      visibility: 'PUBLIC',
      repositoryUrl: repo.html_url,
      description: repo.description.trim(),
      productBriefUrl: blobUrl(selected.repository, repo.default_branch, selected.pointers.productBrief),
    };
    if (typeof repo.homepage === 'string' && repo.homepage.trim()) projected.demoUrl = new URL(repo.homepage).href;
    if (selected.pointers.architecture) {
      const url = blobUrl(selected.repository, repo.default_branch, selected.pointers.architecture);
      if (await adapters.probeUrl(url)) projected.architectureUrl = url;
    }
    if (selected.pointers.relatedArticle && await adapters.probeUrl(selected.pointers.relatedArticle)) {
      projected.relatedArticleUrl = selected.pointers.relatedArticle;
    }
    githubProjects.push(projected);
  }

  const showcaseEditions = [];
  for (const edition of checked.skills.showcaseEditions) {
    const repo = normalizedPublicRepo(await adapters.fetchRepo(edition.repository), edition.repository);
    showcaseEditions.push({
      ...edition,
      visibility: 'PUBLIC',
      repositoryUrl: repo.html_url,
    });
  }

  const operationalSkills = [];
  for (const selected of checked.skills.operational) {
    const metadata = parseSkillFrontmatter(await adapters.readSkill(selected.source));
    if (typeof metadata.name !== 'string' || !metadata.name.trim() || typeof metadata.description !== 'string' || !metadata.description.trim()) {
      throw new Error(`Selected skill ${selected.id} is missing name or description frontmatter`);
    }
    const projected = {
      id: selected.id,
      name: metadata.name.trim(),
      description: metadata.description.trim(),
      version: typeof metadata.version === 'string' && metadata.version.trim() ? metadata.version.trim() : 'Unknown',
      category: selected.category,
      metadataStatus: 'frontmatter',
      validationStatus: 'Unknown',
    };
    if (typeof metadata.license === 'string' && metadata.license.trim()) projected.license = metadata.license.trim();
    if (Array.isArray(metadata.platforms) && metadata.platforms.length) projected.platforms = metadata.platforms.map(String);
    operationalSkills.push(projected);
  }
  return validateShowcaseProjection({ schemaVersion: 'showcase-projection-v1', refreshedAt, githubProjects, showcaseEditions, operationalSkills });
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--config', '--output', '--skills-root'].includes(key) || !argv[index + 1]) throw new Error(`Unknown or incomplete argument ${key}`);
    options[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

function githubHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'acc-showcase-projection-refresh' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  return response.json();
}

async function probeHttps(url) {
  const response = await fetch(url, { method: 'HEAD', headers: githubHeaders(), redirect: 'follow' });
  return response.ok;
}

async function run() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(root, args.config || 'config/showcase-projection.v1.json');
  const outputPath = resolve(root, args.output || 'src/generated/showcase-projection.v1.json');
  const skillsRoot = resolve(args['skills-root'] || process.env.HERMES_SKILLS_ROOT || resolve(homedir(), '.hermes/skills'));
  const policy = JSON.parse(await readFile(configPath, 'utf8'));
  const snapshot = await buildShowcaseProjection(policy, {
    fetchRepo: (repository) => fetchJson(`https://api.github.com/repos/${repository}`),
    probeUrl: probeHttps,
    readSkill: async (pointer) => {
      if (isAbsolute(pointer)) throw new Error('Skill pointer must be relative');
      const path = resolve(skillsRoot, pointer);
      if (relative(skillsRoot, path).startsWith(`..${sep}`)) throw new Error('Skill pointer escapes the selected skills root');
      return readFile(path, 'utf8');
    },
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, stableJson(snapshot));
  console.log(`Refreshed ${relative(root, outputPath)} with ${snapshot.githubProjects.length} PUBLIC projects and ${snapshot.operationalSkills.length} operational skills at ${snapshot.refreshedAt}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}