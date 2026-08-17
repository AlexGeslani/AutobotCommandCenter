import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileWebAnalyticsArchive } from '../collector/web-analytics/compiler.mjs';

function metadata(date, queryVersion = 'httpRequestsAdaptiveGroups-safe-v1', site = 'kungfuclan.com') {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    record_type: 'metadata', archive_schema_version: 1, query_version: queryVersion,
    source_authority: 'Cloudflare edge aggregate analytics', fidelity: 'aggregate_not_raw_request_logs',
    site, dataset: 'httpRequestsAdaptiveGroups',
    period_start_utc: `${date}T00:00:00Z`, period_end_utc: next.toISOString().replace('.000Z', 'Z'),
    collected_at_utc: `${next.toISOString().slice(0, 10)}T01:00:00Z`,
    row_count: 4, zero_traffic: false,
    groups: [
      { name: 'hourly', dimension: 'datetimeHour', metrics: ['requests', 'edge_response_bytes', 'visits'] },
      { name: 'country', dimension: 'clientCountryName', metrics: ['requests', 'edge_response_bytes', 'visits'] },
      { name: 'status', dimension: 'edgeResponseStatus', metrics: ['requests', 'edge_response_bytes', 'visits'] },
      { name: 'cache', dimension: 'cacheStatus', metrics: ['requests', 'edge_response_bytes', 'visits'] },
    ],
  };
}

function row(group, dimension, value, requests, bytes, visits = 0) {
  return {
    record_type: 'aggregate', group, dimensions: { [dimension]: value },
    metrics: { requests, edge_response_bytes: bytes, visits },
  };
}

async function writeDay(root, date, { queryVersion, requests = 10, bytes = 1000, visits = 4, hit = 2, dynamic = 8, mismatchedVisits = false, site = 'kungfuclan.com' } = {}) {
  const records = [
    metadata(date, queryVersion, site),
    row('hourly', 'datetimeHour', `${date}T00:00:00Z`, requests, bytes, visits),
    row('country', 'clientCountryName', 'US', requests, bytes, mismatchedVisits ? visits + 1 : visits),
    row('status', 'edgeResponseStatus', 200, requests, bytes, visits),
    row('cache', 'cacheStatus', 'hit', hit, Math.round(bytes * (hit / requests)), Math.min(visits, 1)),
    row('cache', 'cacheStatus', 'dynamic', dynamic, Math.round(bytes * (dynamic / requests)), Math.max(visits - 1, 0)),
  ];
  records[0].row_count = records.length - 1;
  const bytesOut = gzipSync(`${records.map((record) => JSON.stringify(record)).join('\n')}\n`, { mtime: 0 });
  const digest = createHash('sha256').update(bytesOut).digest('hex');
  const month = date.slice(0, 7).replace('-', '/');
  const dir = join(root, month);
  await mkdir(dir, { recursive: true });
  const name = `${site}-analytics-${date}.ndjson.gz`;
  const path = join(dir, name);
  await writeFile(path, bytesOut);
  await writeFile(`${path}.sha256`, `${digest}  ${name}\n`);
  return { path, digest };
}

async function tempPaths() {
  const root = await mkdtemp(join(tmpdir(), 'acc-web-analytics-'));
  return { root, output: join(root, 'projection.json') };
}

describe('web analytics archive compiler', () => {
  it('compiles a second allowlisted web property with its own identity', async () => {
    const { root, output } = await tempPaths();
    await writeDay(root, '2026-08-15', { site: 'alexgeslani.com' });
    const projection = await compileWebAnalyticsArchive({
      archiveRoot: root,
      outputPath: output,
      site: 'alexgeslani.com',
      displayName: 'alexgeslani.com',
      throughDate: '2026-08-15',
    });
    expect(projection.subject).toEqual({ id: 'alexgeslani.com', label: 'alexgeslani.com', domain: 'web' });
  });

  it('emits deterministic, coverage-aware rollups and recomputes ratios from summed facts', async () => {
    const { root, output } = await tempPaths();
    await writeDay(root, '2026-08-15', { requests: 10, bytes: 1000, hit: 2, dynamic: 8 });
    await writeDay(root, '2026-08-17', { requests: 90, bytes: 9000, visits: 45, hit: 9, dynamic: 81 });

    const first = await compileWebAnalyticsArchive({ archiveRoot: root, outputPath: output, site: 'kungfuclan.com', throughDate: '2026-08-17' });
    const firstBytes = await readFile(output);
    const secondPath = join(root, 'projection-2.json');
    const second = await compileWebAnalyticsArchive({ archiveRoot: root, outputPath: secondPath, site: 'kungfuclan.com', throughDate: '2026-08-17' });
    const secondBytes = await readFile(secondPath);

    expect(first).toEqual(second);
    expect(firstBytes.equals(secondBytes)).toBe(true);
    expect(first.coverage).toMatchObject({ archiveStart: '2026-08-15', expectedThrough: '2026-08-17', dataThrough: '2026-08-17', acceptedPeriods: 2, missingPeriods: ['2026-08-16'] });
    expect(first.ranges['30d']).toMatchObject({ daysCalendar: 30, daysObserved: 2, daysMissing: 1, daysOutsideArchive: 27 });
    expect(first.ranges['30d'].daily.find((day) => day.date === '2026-08-16')).toMatchObject({ state: 'missing', requests: null, edgeResponseBytes: null });
    expect(first.schemaVersion).toBe('web-analytics-projection-v2');
    expect(first.ranges['30d'].totals).toMatchObject({ requests: 100, edgeResponseBytes: 10000, visits: 49, cacheHitRequests: 11, cacheEligibleRequests: 100, strictCacheHitRatio: 0.11 });
    expect(first.ranges['30d'].daily.at(-1)).toMatchObject({ visits: 45 });
  });

  it('fails closed when visits disagree across aggregate families', async () => {
    const { root, output } = await tempPaths();
    await writeDay(root, '2026-08-15', { mismatchedVisits: true });
    await expect(compileWebAnalyticsArchive({ archiveRoot: root, outputPath: output, site: 'kungfuclan.com', throughDate: '2026-08-15' })).rejects.toThrow(/country visits do not reconcile/i);
  });

  it('fails closed for unknown query versions', async () => {
    const { root, output } = await tempPaths();
    await writeDay(root, '2026-08-15', { queryVersion: 'future-query-v99' });
    await expect(compileWebAnalyticsArchive({ archiveRoot: root, outputPath: output, site: 'kungfuclan.com', throughDate: '2026-08-15' })).rejects.toThrow(/unsupported query version/i);
  });

  it('fails closed when a source checksum does not match', async () => {
    const { root, output } = await tempPaths();
    const source = await writeDay(root, '2026-08-15');
    await writeFile(`${source.path}.sha256`, `${'0'.repeat(64)}  ${source.path.split('/').at(-1)}\n`);
    await expect(compileWebAnalyticsArchive({ archiveRoot: root, outputPath: output, site: 'kungfuclan.com', throughDate: '2026-08-15' })).rejects.toThrow(/checksum mismatch/i);
  });
});
