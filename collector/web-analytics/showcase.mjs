#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectWebAnalyticsProjection, WEB_ANALYTICS_FIXTURE_NOTICE } from '../../src/analytics/schema.mjs';

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function allocate(total, shares) {
  let used = 0;
  return shares.map((share, index) => {
    const value = index === shares.length - 1 ? total - used : Math.floor(total * share);
    used += value;
    return value;
  });
}

function buildRange(id, days, allDaily) {
  const daily = allDaily.slice(-days);
  const requests = daily.reduce((sum, day) => sum + day.requests, 0);
  const edgeResponseBytes = daily.reduce((sum, day) => sum + day.edgeResponseBytes, 0);
  const visits = daily.reduce((sum, day) => sum + day.visits, 0);
  const countryIds = ['US', 'CA', 'GB', 'DE', 'AU', 'JP', 'BR', 'SG'];
  const countryShares = [.48, .11, .1, .08, .07, .06, .05, .05];
  const countryRequests = allocate(requests, countryShares);
  const countryBytes = allocate(edgeResponseBytes, countryShares);
  const statusClasses = ['2xx', '3xx', '4xx', '5xx'];
  const statusRequests = allocate(requests, [.82, .09, .075, .015]);
  const cacheIds = ['dynamic', 'hit', 'miss', 'bypass'];
  const cacheRequests = allocate(requests, [.57, .29, .1, .04]);
  const cacheBytes = allocate(edgeResponseBytes, [.49, .36, .11, .04]);
  const hitIndex = cacheIds.indexOf('hit');
  return {
    id,
    startDate: daily[0].date,
    endDate: daily.at(-1).date,
    daysCalendar: days,
    daysObserved: days,
    daysMissing: 0,
    daysOutsideArchive: 0,
    totals: {
      requests,
      edgeResponseBytes,
      visits,
      cacheHitRequests: cacheRequests[hitIndex],
      cacheEligibleRequests: requests,
      strictCacheHitRatio: cacheRequests[hitIndex] / requests,
    },
    daily,
    countries: countryIds.map((code, index) => ({ code, requests: countryRequests[index], edgeResponseBytes: countryBytes[index] })),
    statusClasses: statusClasses.map((klass, index) => ({ class: klass, requests: statusRequests[index] })),
    cacheStatuses: cacheIds.map((status, index) => ({ status, requests: cacheRequests[index], edgeResponseBytes: cacheBytes[index] })),
  };
}

export function buildShowcaseProjection() {
  const start = '2026-07-17';
  const through = '2026-08-15';
  const daily = Array.from({ length: 30 }, (_, index) => {
    const weekly = [260, 120, 0, 150, 430, 780, 610][index % 7];
    const campaign = index >= 17 && index <= 21 ? 1250 - (Math.abs(19 - index) * 260) : 0;
    const requests = 1180 + (index * 31) + weekly + campaign;
    return { date: addDays(start, index), state: 'present', requests, visits: Math.max(1, Math.floor(requests * 0.085)), edgeResponseBytes: requests * (6900 + ((index % 5) * 430)) };
  });
  const inputSha256s = daily.map((day) => createHash('sha256').update(`acc-analytics-showcase:${day.date}`).digest('hex'));
  return projectWebAnalyticsProjection({
    schemaVersion: 'web-analytics-projection-v2',
    dataKind: 'illustrative_fixture',
    generatedAt: '2026-08-16T02:00:00.000Z',
    subject: { id: 'kungfuclan-demo', label: 'Kung Fu Clan illustrative demo', domain: 'web' },
    source: { authority: 'Cloudflare edge aggregate analytics', fidelity: 'aggregate_not_raw_request_logs' },
    versions: { archiveSchema: 1, query: 'httpRequestsAdaptiveGroups-safe-v1', metricRegistry: 'web-analytics-metrics-v2', compiler: '2.0.0' },
    coverage: { archiveStart: start, expectedThrough: through, dataThrough: through, freshness: 'fresh', acceptedPeriods: 30, rejectedPeriods: 0, missingPeriods: [], outsideArchivePeriods: 0, inputSha256s },
    ranges: {
      '1d': buildRange('1d', 1, daily),
      '7d': buildRange('7d', 7, daily),
      '30d': buildRange('30d', 30, daily),
    },
    notice: WEB_ANALYTICS_FIXTURE_NOTICE,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  if (!outputPath) throw new TypeError('--output is required');
  const projection = buildShowcaseProjection();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`, { mode: 0o644 });
  console.log(JSON.stringify({ status: 'ok', dataKind: projection.dataKind, through: projection.coverage.dataThrough }));
}
