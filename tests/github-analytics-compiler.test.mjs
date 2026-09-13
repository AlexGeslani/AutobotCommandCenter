import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileGitHubAnalyticsArchive } from '../collector/github-analytics/compiler.mjs';

const REGISTRY = {
  schemaVersion: 'github-analytics-repositories-v1',
  owner: 'AlexGeslani',
  repositories: [
    { id: 101, name: 'Alpha' },
    { id: 202, name: 'Beta' },
    { id: 303, name: 'PrivateSlot' },
    { id: 404, name: 'UnknownSlot' },
  ],
};

function observation({ id = 101, name = 'Alpha', visibility = 'public', collectedAt = '2026-08-30T05:00:00.000Z', views = [], clones = [], viewCount = null, viewUniques = null, cloneCount = null, cloneUniques = null, referrers = [], paths = [] } = {}) {
  const resolvedViewCount = viewCount ?? views.reduce((sum, row) => sum + row.count, 0);
  const resolvedCloneCount = cloneCount ?? clones.reduce((sum, row) => sum + row.count, 0);
  return {
    schemaVersion: 'github-traffic-observation-v1',
    collectedAt,
    source: { authority: 'GitHub REST repository traffic metrics', fidelity: 'rolling_14_day_aggregate_observation' },
    repository: {
      id, name, owner: 'AlexGeslani', fullName: `AlexGeslani/${name}`, visibility, archived: false,
      htmlUrl: `https://github.com/AlexGeslani/${name}`, stars: 4, forks: 1, subscribers: 2,
      pushedAt: '2026-08-29T12:00:00.000Z', latestRelease: null,
    },
    traffic: {
      views: { count: resolvedViewCount, uniques: viewUniques ?? Math.min(2, resolvedViewCount), daily: views },
      clones: { count: resolvedCloneCount, uniques: cloneUniques ?? Math.min(1, resolvedCloneCount), daily: clones },
      referrers,
      paths,
    },
  };
}

async function writeObservation(root, value) {
  const date = value.collectedAt.slice(0, 10);
  const stamp = value.collectedAt.replaceAll(/[-:.]/g, '').replace('Z', 'Z');
  const directory = join(root, 'github', 'observations', date.slice(0, 4), date.slice(5, 7), date.slice(8, 10), String(value.repository.id));
  await mkdir(directory, { recursive: true });
  const name = `github-traffic-${value.repository.id}-${stamp}.json.gz`;
  const path = join(directory, name);
  const compressed = gzipSync(`${JSON.stringify(value)}\n`, { mtime: 0 });
  const digest = createHash('sha256').update(compressed).digest('hex');
  await writeFile(path, compressed);
  await writeFile(`${path}.sha256`, `${digest}  ${name}\n`);
  return { path, digest };
}

async function writeEligibility(root, { repositoryId, checkedAt, state }) {
  const date = checkedAt.slice(0, 10);
  const stamp = checkedAt.replaceAll(/[-:.]/g, '').replace('Z', 'Z');
  const directory = join(root, 'github', 'eligibility', date.slice(0, 4), date.slice(5, 7), date.slice(8, 10), String(repositoryId));
  await mkdir(directory, { recursive: true });
  const name = `github-eligibility-${repositoryId}-${stamp}.json.gz`;
  const path = join(directory, name);
  const value = { schemaVersion: 'github-repository-eligibility-v1', checkedAt, repositoryId, state };
  const compressed = gzipSync(`${JSON.stringify(value)}\n`, { mtime: 0 });
  const digest = createHash('sha256').update(compressed).digest('hex');
  await writeFile(path, compressed);
  await writeFile(`${path}.sha256`, `${digest}  ${name}\n`);
  return { path, digest };
}

async function tempPaths() {
  const root = await mkdtemp(join(tmpdir(), 'acc-github-analytics-'));
  return { root, output: join(root, 'projection.json') };
}

describe('GitHub rolling observation compiler', () => {
  it('selects the latest revision for each repository/day and preserves rename continuity by numeric ID', async () => {
    const { root, output } = await tempPaths();
    await writeObservation(root, observation({
      name: 'Alpha', collectedAt: '2026-08-29T05:00:00.000Z',
      views: [{ timestamp: '2026-08-28T00:00:00Z', count: 2, uniques: 1 }],
      clones: [{ timestamp: '2026-08-28T00:00:00Z', count: 1, uniques: 1 }],
    }));
    await writeObservation(root, observation({
      name: 'Alpha-Renamed', collectedAt: '2026-08-30T05:00:00.000Z',
      views: [{ timestamp: '2026-08-28T00:00:00Z', count: 5, uniques: 3 }, { timestamp: '2026-08-29T00:00:00Z', count: 4, uniques: 2 }],
      clones: [{ timestamp: '2026-08-28T00:00:00Z', count: 1, uniques: 1 }],
    }));

    const projection = await compileGitHubAnalyticsArchive({ archiveRoot: root, outputPath: output, registry: REGISTRY });
    const repository = projection.repositories.find((row) => row.id === 101);
    expect(repository.name).toBe('Alpha-Renamed');
    expect(repository.daily.find((day) => day.date === '2026-08-28').views).toEqual({ state: 'present', count: 5, uniques: 3 });
    expect(repository.retainedTotals).toEqual({ views: 9, clones: 1 });
    expect(projection.coverage.acceptedObservations).toBe(2);
  });

  it('never creates portfolio unique totals and keeps top-N rows as the latest repository window only', async () => {
    const { root, output } = await tempPaths();
    await writeObservation(root, observation({
      id: 101, collectedAt: '2026-08-29T05:00:00.000Z', viewUniques: 9,
      views: [{ timestamp: '2026-08-28T00:00:00Z', count: 20, uniques: 9 }],
      referrers: [{ referrer: 'old.example', count: 20, uniques: 8 }],
    }));
    await writeObservation(root, observation({
      id: 101, collectedAt: '2026-08-30T05:00:00.000Z', viewUniques: 4,
      views: [{ timestamp: '2026-08-29T00:00:00Z', count: 5, uniques: 4 }],
      referrers: [{ referrer: 'latest.example', count: 5, uniques: 4 }],
      paths: [{ path: '/AlexGeslani/Alpha', title: 'Alpha', count: 5, uniques: 4 }],
    }));
    await writeObservation(root, observation({
      id: 202, name: 'Beta', viewUniques: 5, cloneUniques: 3,
      views: [{ timestamp: '2026-08-29T00:00:00Z', count: 6, uniques: 5 }],
      clones: [{ timestamp: '2026-08-29T00:00:00Z', count: 4, uniques: 3 }],
    }));

    const projection = await compileGitHubAnalyticsArchive({ archiveRoot: root, outputPath: output, registry: REGISTRY });
    expect(projection.portfolio).toEqual({ retainedTotals: { views: 31, clones: 4 }, repositoriesReporting: 2 });
    expect(JSON.stringify(projection.portfolio)).not.toMatch(/unique/i);
    const alpha = projection.repositories.find((row) => row.id === 101);
    expect(alpha.latestWindow.views.uniques).toBe(4);
    expect(alpha.latestWindow.referrers).toEqual([{ referrer: 'latest.example', count: 5, uniques: 4 }]);
    expect(JSON.stringify(alpha.latestWindow)).not.toContain('old.example');
  });

  it('keeps an explicit zero distinct from a missing metric', async () => {
    const { root, output } = await tempPaths();
    await writeObservation(root, observation({
      views: [{ timestamp: '2026-08-28T00:00:00Z', count: 0, uniques: 0 }],
      clones: [{ timestamp: '2026-08-29T00:00:00Z', count: 3, uniques: 2 }],
    }));
    const projection = await compileGitHubAnalyticsArchive({ archiveRoot: root, outputPath: output, registry: REGISTRY });
    const [first, second] = projection.repositories[0].daily;
    expect(first.views).toEqual({ state: 'present', count: 0, uniques: 0 });
    expect(first.clones).toEqual({ state: 'missing', count: null, uniques: null });
    expect(second.views).toEqual({ state: 'missing', count: null, uniques: null });
    expect(second.clones).toEqual({ state: 'present', count: 3, uniques: 2 });
  });

  it('emits byte-identical projection bytes when private or unknown observations are present or absent', async () => {
    const mixed = await tempPaths();
    const publicOnly = await tempPaths();
    const publicObservation = observation({ id: 101, name: 'Alpha', views: [{ timestamp: '2026-08-29T00:00:00Z', count: 1, uniques: 1 }] });
    await writeObservation(mixed.root, publicObservation);
    await writeObservation(publicOnly.root, publicObservation);
    await writeObservation(mixed.root, observation({ id: 303, name: 'Secret-Repository-Name', visibility: 'private', collectedAt: '2026-08-30T06:00:00.000Z', views: [{ timestamp: '2026-08-29T00:00:00Z', count: 999, uniques: 99 }] }));
    await writeObservation(mixed.root, observation({ id: 404, name: 'Unknown-Repository-Name', visibility: 'unknown', collectedAt: '2026-08-30T07:00:00.000Z', views: [{ timestamp: '2026-08-29T00:00:00Z', count: 888, uniques: 88 }] }));
    const projection = await compileGitHubAnalyticsArchive({ archiveRoot: mixed.root, outputPath: mixed.output, registry: REGISTRY });
    await compileGitHubAnalyticsArchive({ archiveRoot: publicOnly.root, outputPath: publicOnly.output, registry: REGISTRY });
    const serialized = JSON.stringify(projection);
    expect(projection.repositories.map((row) => row.id)).toEqual([101]);
    expect(serialized).not.toMatch(/Secret-Repository-Name|Unknown-Repository-Name|999|888/);
    expect(serialized).not.toMatch(/excluded|private|unknownVisibility/i);
    expect((await readFile(mixed.output)).equals(await readFile(publicOnly.output))).toBe(true);
  });

  it('suppresses retained public history after a newer access-loss status without changing peer projection bytes', async () => {
    const mixed = await tempPaths();
    const peerOnly = await tempPaths();
    const beta = observation({ id: 202, name: 'Beta', collectedAt: '2026-08-30T05:00:00.000Z', views: [{ timestamp: '2026-08-29T00:00:00Z', count: 6, uniques: 5 }] });
    await writeObservation(mixed.root, observation({ id: 101, name: 'Formerly-Public', collectedAt: '2026-08-29T05:00:00.000Z', views: [{ timestamp: '2026-08-28T00:00:00Z', count: 999, uniques: 9 }] }));
    await writeEligibility(mixed.root, { repositoryId: 101, checkedAt: '2026-08-30T06:00:00.000Z', state: 'access_lost' });
    await writeObservation(mixed.root, beta);
    await writeObservation(peerOnly.root, beta);

    const projection = await compileGitHubAnalyticsArchive({ archiveRoot: mixed.root, outputPath: mixed.output, registry: REGISTRY });
    await compileGitHubAnalyticsArchive({ archiveRoot: peerOnly.root, outputPath: peerOnly.output, registry: REGISTRY });
    expect(projection.repositories.map((row) => row.id)).toEqual([202]);
    expect(JSON.stringify(projection)).not.toMatch(/Formerly-Public|999|access_lost/);
    expect((await readFile(mixed.output)).equals(await readFile(peerOnly.output))).toBe(true);
  });

  it('writes byte-identical deterministic output for unchanged observations', async () => {
    const { root, output } = await tempPaths();
    await writeObservation(root, observation({ views: [{ timestamp: '2026-08-29T00:00:00Z', count: 1, uniques: 1 }] }));
    await compileGitHubAnalyticsArchive({ archiveRoot: root, outputPath: output, registry: REGISTRY });
    const first = await readFile(output);
    const secondPath = join(root, 'projection-2.json');
    await compileGitHubAnalyticsArchive({ archiveRoot: root, outputPath: secondPath, registry: REGISTRY });
    expect((await readFile(secondPath)).equals(first)).toBe(true);
  });
});
