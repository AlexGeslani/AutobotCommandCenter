import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { buildShowcaseProjection, stableJson } from '../scripts/generate-showcase-projection.mjs';
import {
  getPortfolioProjection,
  validateShowcasePolicy,
  validateShowcaseProjection,
} from '../src/showcase/projection.mjs';

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

function fixtureAdapters(overrides = {}) {
  return {
    fetchRepo: async (repository) => repoMetadata[repository],
    probeUrl: async (url) => url.includes('architecture.md') || url.includes('/articles/'),
    refreshedAt: '2026-08-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('showcase projection policy', () => {
  it('closes repository selection to explicit safe pointers', () => {
    const checked = validateShowcasePolicy(policy);
    expect(checked.github.projects.map((project) => project.repository)).toEqual([
      'AlexGeslani/Jarvis',
      'AlexGeslani/StackLogic',
      'AlexGeslani/8-Ball',
    ]);
    expect(JSON.stringify(checked)).not.toMatch(/\/Users\/|private repos?|readmeBody/i);
    expect(() => validateShowcasePolicy({
      ...policy,
      github: { projects: [...policy.github.projects, { id: 'other', repository: 'invalid repository', pointers: { productBrief: 'README.md' } }] },
    })).toThrow(/repository/i);
  });
});

describe('operator-run projection refresh', () => {
  it('emits only fetched PUBLIC metadata and probed pointers', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    expect(snapshot).toMatchObject({
      schemaVersion: 'showcase-projection-v1',
      refreshedAt: '2026-08-27T12:00:00.000Z',
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

  it('serializes deterministically', () => {
    expect(stableJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
  });
});

describe('closed snapshot selectors', () => {
  it('rejects unknown fields, non-public entries, and unsafe client-visible strings', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    expect(() => validateShowcaseProjection({ ...snapshot, privateRepositories: ['Private-One'] })).toThrow(/field/i);
    expect(() => validateShowcaseProjection({
      ...snapshot,
      githubProjects: snapshot.githubProjects.map((project, index) => index ? project : { ...project, visibility: 'PRIVATE' }),
    })).toThrow(/PUBLIC/i);
    expect(() => validateShowcaseProjection({ ...snapshot, sourcePath: '/home/fixture/private' })).toThrow(/field/i);
  });

  it('separates public projects from non-public internal products', async () => {
    const snapshot = await buildShowcaseProjection(policy, fixtureAdapters());
    const portfolio = getPortfolioProjection(snapshot, [
      { id: 'jarvis', name: 'Jarvis Voice Agent' },
      { id: 'autobot-command-center', name: 'Autobot Command Center' },
      { id: 'model-serving', name: 'Local AI Runtime' },
    ]);
    expect(portfolio.githubShowcaseProjects.map((project) => project.id)).toEqual(['jarvis', 'stacklogic', '8-ball']);
    expect(portfolio.internalProducts.map((product) => product.id)).toEqual(['autobot-command-center', 'model-serving']);
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
});
