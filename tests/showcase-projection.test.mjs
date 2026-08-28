import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  buildShowcaseProjection,
  parseSkillFrontmatter,
  stableJson,
} from '../scripts/generate-showcase-projection.mjs';
import {
  getPortfolioProjection,
  getSkillsProjection,
  validateShowcasePolicy,
  validateShowcaseProjection,
} from '../src/showcase/projection.mjs';

const absoluteUserPath = ['', 'Users', 'fixture', 'private', 'SKILL.md'].join('/');

const policy = {
  schemaVersion: 'showcase-projection-policy-v1',
  github: {
    projects: [
      {
        id: 'jarvis',
        repository: 'AlexGeslani/Jarvis',
        pointers: {
          productBrief: 'README.md',
          architecture: 'docs/architecture.md',
          relatedArticle: 'https://alexgeslani.com/articles/jarvis',
        },
      },
      { id: 'stacklogic', repository: 'AlexGeslani/StackLogic', pointers: { productBrief: 'README.md' } },
      { id: '8-ball', repository: 'AlexGeslani/8-Ball', pointers: { productBrief: 'README.md' } },
    ],
  },
  skills: {
    showcaseEditions: [],
    operational: [
      { id: 'autobots', category: 'Agent orchestration', source: 'autonomous-ai-agents/autobots/SKILL.md' },
    ],
  },
};

const repoMetadata = {
  'AlexGeslani/Jarvis': {
    full_name: 'AlexGeslani/Jarvis',
    name: 'Jarvis',
    html_url: 'https://github.com/AlexGeslani/Jarvis',
    description: 'A public voice agent.',
    homepage: 'https://alexgeslani.github.io/Jarvis/',
    visibility: 'public',
    private: false,
    default_branch: 'main',
  },
  'AlexGeslani/StackLogic': {
    full_name: 'AlexGeslani/StackLogic',
    name: 'StackLogic',
    html_url: 'https://github.com/AlexGeslani/StackLogic',
    description: 'A public stack visualizer.',
    homepage: '',
    visibility: 'public',
    private: false,
    default_branch: 'main',
  },
  'AlexGeslani/8-Ball': {
    full_name: 'AlexGeslani/8-Ball',
    name: '8-Ball',
    html_url: 'https://github.com/AlexGeslani/8-Ball',
    description: 'A public browser game.',
    homepage: null,
    visibility: 'public',
    private: false,
    default_branch: 'main',
  },
};

const skillText = `---
name: autobots
description: Run bounded specialist coding lanes.
version: 2.4.1
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [agents, delivery]
---

# Private operational body

This body must never enter the projection.
`;

function fixtureAdapters(overrides = {}) {
  return {
    fetchRepo: async (repository) => repoMetadata[repository],
    probeUrl: async (url) => url.includes('architecture.md') || url.includes('/articles/'),
    readSkill: async () => skillText,
    refreshedAt: '2026-08-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('showcase projection policy', () => {
  it('closes repository and local-skill selection to explicit safe pointers', () => {
    const checked = validateShowcasePolicy(policy);
    expect(checked.github.projects.map((project) => project.repository)).toEqual([
      'AlexGeslani/Jarvis',
      'AlexGeslani/StackLogic',
      'AlexGeslani/8-Ball',
    ]);
    expect(checked.skills.showcaseEditions).toEqual([]);
    expect(JSON.stringify(checked)).not.toMatch(/\/Users\/|private repos?|readmeBody/i);
    expect(() => validateShowcasePolicy({ ...policy, github: { projects: [...policy.github.projects, { id: 'other', repository: 'AlexGeslani/Other', pointers: { productBrief: 'README.md' } }] } })).toThrow(/allowlist/i);
    expect(() => validateShowcasePolicy({ ...policy, skills: { ...policy.skills, operational: [{ id: 'bad', category: 'Bad', source: absoluteUserPath }] } })).toThrow(/relative/i);
    expect(() => validateShowcasePolicy({
      ...policy,
      skills: {
        ...policy.skills,
        showcaseEditions: [{
          id: 'not-approved',
          name: 'Not approved',
          repository: 'AlexGeslani/Not-Approved',
          independenceStatus: 'Pending',
          validationStatus: 'Unknown',
        }],
      },
    })).toThrow(/independently approved/i);
  });
});

describe('operator-run projection refresh', () => {
  it('emits only fetched PUBLIC metadata, probed pointers, and frontmatter fields', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    expect(snapshot).toMatchObject({
      schemaVersion: 'showcase-projection-v1',
      refreshedAt: '2026-08-27T12:00:00.000Z',
      showcaseEditions: [],
      operationalSkills: [
        {
          id: 'autobots',
          name: 'autobots',
          description: 'Run bounded specialist coding lanes.',
          version: '2.4.1',
          category: 'Agent orchestration',
          license: 'MIT',
          platforms: ['macos', 'linux'],
          metadataStatus: 'frontmatter',
          validationStatus: 'Unknown',
        },
      ],
    });
    expect(snapshot.githubProjects[0]).toMatchObject({
          id: 'jarvis',
          repository: 'AlexGeslani/Jarvis',
          visibility: 'PUBLIC',
          repositoryUrl: 'https://github.com/AlexGeslani/Jarvis',
          description: 'A public voice agent.',
          demoUrl: 'https://alexgeslani.github.io/Jarvis/',
          productBriefUrl: 'https://github.com/AlexGeslani/Jarvis/blob/main/README.md',
          architectureUrl: 'https://github.com/AlexGeslani/Jarvis/blob/main/docs/architecture.md',
          relatedArticleUrl: 'https://alexgeslani.com/articles/jarvis',
    });
    expect(snapshot.githubProjects[1]).not.toHaveProperty('demoUrl');
    expect(snapshot.githubProjects[1]).not.toHaveProperty('architectureUrl');
    expect(JSON.stringify(snapshot)).not.toContain('Private operational body');
    expect(JSON.stringify(snapshot)).not.toMatch(/token|authorization|\/Users\//i);
    expect(validateShowcaseProjection(snapshot)).toEqual(snapshot);
  });

  it.each([
    ['private', { visibility: 'private', private: true }, /PUBLIC/i],
    ['missing', null, /missing/i],
    ['wrong identity', { full_name: 'AlexGeslani/Other' }, /identity/i],
  ])('fails the complete refresh for a %s allowlisted repository', async (_label, mutation, expected) => {
    const fetchRepo = async (repository) => repository === 'AlexGeslani/Jarvis'
      ? (mutation && { ...repoMetadata[repository], ...mutation })
      : repoMetadata[repository];
    await expect(buildShowcaseProjection(policy, fixtureAdapters({ fetchRepo }))).rejects.toThrow(expected);
  });

  it('uses Unknown for absent metadata authority and serializes deterministically', async () => {
    const parsed = parseSkillFrontmatter(`---\nname: sparse\ndescription: Sparse metadata.\n---\nsecret body`);
    expect(parsed).toEqual({ name: 'sparse', description: 'Sparse metadata.' });
    const sparsePolicy = structuredClone(policy);
    sparsePolicy.skills.operational[0].id = 'sparse';
    const snapshot = await buildShowcaseProjection(sparsePolicy, fixtureAdapters({ readSkill: async () => `---\nname: sparse\ndescription: Sparse metadata.\n---\nsecret body` }));
    expect(snapshot.operationalSkills[0]).toMatchObject({ version: 'Unknown', validationStatus: 'Unknown' });
    expect(snapshot.operationalSkills[0]).not.toHaveProperty('license');
    expect(stableJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
  });
});

describe('closed snapshot selectors', () => {
  it('rejects unknown fields, non-public entries, and unsafe client-visible strings', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    expect(() => validateShowcaseProjection({ ...snapshot, privateRepositories: ['Private-One'] })).toThrow(/field/i);
    expect(() => validateShowcaseProjection({ ...snapshot, githubProjects: snapshot.githubProjects.map((project, index) => index ? project : { ...project, visibility: 'PRIVATE' }) })).toThrow(/PUBLIC/i);
    expect(() => validateShowcaseProjection({ ...snapshot, operationalSkills: [{ ...snapshot.operationalSkills[0], sourcePath: absoluteUserPath }] })).toThrow(/field|path/i);
  });

  it('separates public projects from non-public internal products and projects honest skill state', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    const portfolio = getPortfolioProjection(snapshot, [
      { id: 'jarvis', name: 'Jarvis Voice Agent' },
      { id: 'autobot-command-center', name: 'Autobot Command Center' },
      { id: 'model-serving', name: 'Local AI Runtime' },
    ]);
    expect(portfolio.githubShowcaseProjects.map((project) => project.id)).toEqual(['jarvis', 'stacklogic', '8-ball']);
    expect(portfolio.internalProducts.map((product) => product.id)).toEqual(['autobot-command-center', 'model-serving']);
    expect(portfolio.internalProducts.some((product) => product.id === 'jarvis')).toBe(false);

    const skills = getSkillsProjection(snapshot);
    expect(skills.showcaseEditions).toEqual([]);
    expect(skills.showcaseEmptyState).toMatch(/no independently approved public showcase editions/i);
    expect(skills.operationalSkills[0]).toMatchObject({ version: '2.4.1', validationStatus: 'Unknown' });
    expect(skills.boundary).toMatch(/projection, not synchronization/i);
  });

  it('keeps the checked snapshot sanitized and exactly allowlisted', async () => {
    const text = await readFile(new URL('../src/generated/showcase-projection.v1.json', import.meta.url), 'utf8');
    const snapshot = validateShowcaseProjection(JSON.parse(text));
    expect(snapshot.githubProjects.map((project) => project.repository)).toEqual([
      'AlexGeslani/Jarvis',
      'AlexGeslani/StackLogic',
      'AlexGeslani/8-Ball',
    ]);
    expect(text).not.toMatch(/\/Users\/|privateRepositories|readmeBody|authorization|token/i);
  });

  it('binds the frozen source projection into offline build and explicit Portfolio and Skills sections', async () => {
    const [packageText, buildSource, modelSource, pluginSource, projectionSource] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8'),
      readFile(new URL('../src/model.mjs', import.meta.url), 'utf8'),
      readFile(new URL('../src/plugin.mjs', import.meta.url), 'utf8'),
      readFile(new URL('../src/showcase/projection.mjs', import.meta.url), 'utf8'),
    ]);
    const packageJson = JSON.parse(packageText);
    expect(packageJson.scripts['projection:refresh']).toBe('node scripts/generate-showcase-projection.mjs');
    expect(buildSource).toMatch(/validateShowcaseProjection/);
    expect(buildSource).not.toMatch(/api\.github\.com|fetch\s*\(/);
    expect(modelSource).toMatch(/generated\/showcase-projection\.v1\.json/);
    expect(modelSource).not.toMatch(/lastValidated:|'jarvis', name: 'Jarvis Voice Agent'/);
    expect(pluginSource).toMatch(/GitHub Showcase Projects/);
    expect(pluginSource).toMatch(/Internal Products & Capabilities/);
    expect(pluginSource).toMatch(/Showcase Editions/);
    expect(pluginSource).toMatch(/Operational Skills/);
    expect(pluginSource).toMatch(/registry\.boundary/);
    expect(projectionSource).toMatch(/projection, not synchronization/i);
  });
});
