import { describe, expect, it } from 'vitest';
import {
  PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION,
  WEB_ANALYTICS_FIXTURE_NOTICE,
  isPublicWebAnalyticsProjection,
  parseWebAnalyticsText,
  projectCurrentWebAnalyticsCoverage,
  projectWebAnalyticsProjection,
} from '../src/analytics/schema.mjs';
import { webAnalyticsProjectionPath } from '../src/analytics/client.mjs';

const digest = '58752ea8e8e15c228aaff78ee92d4887656e3e648d6d2ef8f304f97d521e4e15';

function daily(date, state, values = {}) {
  return {
    date,
    state,
    requests: state === 'present' ? values.requests ?? 0 : null,
    edgeResponseBytes: state === 'present' ? values.edgeResponseBytes ?? 0 : null,
    visits: state === 'present' ? values.visits ?? 0 : null,
  };
}

function range(id, daysCalendar, rows) {
  const present = rows.filter((row) => row.state === 'present');
  const missing = rows.filter((row) => row.state === 'missing');
  const outside = rows.filter((row) => row.state === 'not_retained');
  return {
    id,
    startDate: rows[0].date,
    endDate: rows.at(-1).date,
    daysCalendar,
    daysObserved: present.length,
    daysMissing: missing.length,
    daysOutsideArchive: outside.length,
    totals: {
      requests: 2412,
      edgeResponseBytes: 31139083,
      visits: 203,
      cacheHitRequests: 92,
      cacheEligibleRequests: 2412,
      strictCacheHitRatio: 92 / 2412,
    },
    daily: rows,
    countries: [{ code: 'US', requests: 2412, edgeResponseBytes: 31139083 }],
    statusClasses: [{ class: '2xx', requests: 767 }, { class: '3xx', requests: 880 }, { class: '4xx', requests: 765 }],
    cacheStatuses: [{ status: 'hit', requests: 92, edgeResponseBytes: 2488296 }, { status: 'dynamic', requests: 2320, edgeResponseBytes: 28650787 }],
  };
}

function validProjection() {
  const one = [daily('2026-08-15', 'present', { requests: 2412, edgeResponseBytes: 31139083, visits: 203 })];
  const seven = [
    ...Array.from({ length: 6 }, (_, index) => daily(`2026-08-${String(9 + index).padStart(2, '0')}`, 'not_retained')),
    ...one,
  ];
  const thirty = [
    ...Array.from({ length: 29 }, (_, index) => daily(`2026-07-${String(index + 17).padStart(2, '0')}`, 'not_retained')),
    ...one,
  ];
  // The exact date labels are incidental to schema validation; keep calendar
  // shape canonical for the strict projector.
  thirty.splice(15, 14,
    ...Array.from({ length: 14 }, (_, index) => daily(`2026-08-${String(index + 1).padStart(2, '0')}`, 'not_retained')),
  );
  return {
    schemaVersion: PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION,
    dataKind: 'real',
    generatedAt: '2026-08-16T01:11:43.000Z',
    subject: { id: 'kungfuclan.com', label: 'Kung Fu Clan', domain: 'web' },
    source: { authority: 'Cloudflare edge aggregate analytics', fidelity: 'aggregate_not_raw_request_logs' },
    versions: { archiveSchema: 1, query: 'httpRequestsAdaptiveGroups-safe-v1', metricRegistry: 'web-analytics-metrics-v2', compiler: '2.0.0' },
    coverage: {
      archiveStart: '2026-08-15', expectedThrough: '2026-08-15', dataThrough: '2026-08-15', freshness: 'fresh',
      acceptedPeriods: 1, rejectedPeriods: 0, missingPeriods: [], outsideArchivePeriods: 29, inputSha256s: [digest],
    },
    ranges: {
      '1d': range('1d', 1, one),
      '7d': range('7d', 7, seven),
      '30d': range('30d', 30, thirty),
    },
  };
}

describe('public web analytics projection', () => {
  it('accepts and routes the alexgeslani.com real projection', () => {
    const value = validProjection();
    value.subject = { id: 'alexgeslani.com', label: 'alexgeslani.com', domain: 'web' };
    expect(isPublicWebAnalyticsProjection(value)).toBe(true);
    expect(webAnalyticsProjectionPath({
      subject: 'alexgeslani.com',
      subjects: [{ id: 'alexgeslani.com', projection: 'runtime/analytics/web/alexgeslani.com.v2.json' }],
    })).toBe('runtime/analytics/web/alexgeslani.com.v2.json');
  });

  it('accepts and reprojects the closed, allowlisted public contract', () => {
    const value = validProjection();
    expect(PUBLIC_WEB_ANALYTICS_SCHEMA_VERSION).toBe('web-analytics-projection-v2');
    expect(isPublicWebAnalyticsProjection(value)).toBe(true);
    expect(projectWebAnalyticsProjection(value)).toEqual(value);
  });

  it('accepts Cloudflare\'s Tor network country bucket without dropping its totals', () => {
    const value = validProjection();
    for (const range of Object.values(value.ranges)) range.countries[0].code = 'T1';
    expect(projectWebAnalyticsProjection(value).ranges['1d'].countries[0].code).toBe('T1');
  });

  it('recalculates displayed freshness against the current fully closed UTC day', () => {
    const coverage = validProjection().coverage;
    coverage.expectedThrough = '2026-08-15';
    coverage.dataThrough = '2026-08-15';
    coverage.freshness = 'fresh';
    expect(projectCurrentWebAnalyticsCoverage(coverage, new Date('2026-08-18T00:01:00Z'))).toMatchObject({ expectedThrough: '2026-08-17', dataThrough: '2026-08-15', freshness: 'stale' });
    coverage.dataThrough = '2026-08-17';
    expect(projectCurrentWebAnalyticsCoverage(coverage, new Date('2026-08-18T23:59:00Z')).freshness).toBe('fresh');
  });

  it('requires daily entry visits to reconcile to each range total', () => {
    const value = validProjection();
    value.ranges['30d'].totals.visits += 1;
    expect(() => projectWebAnalyticsProjection(value)).toThrow(/daily visits must reconcile/i);
  });

  it('rejects unknown fields and incompatible versions', () => {
    const withRaw = { ...validProjection(), rawCloudflareResponse: { unsafe: true } };
    expect(isPublicWebAnalyticsProjection(withRaw)).toBe(false);
    const wrongQuery = validProjection();
    wrongQuery.versions.query = 'future-query-v99';
    expect(isPublicWebAnalyticsProjection(wrongQuery)).toBe(false);
  });

  it('requires illustrative data to use a separate demo subject and permanent notice', () => {
    const fixture = validProjection();
    fixture.dataKind = 'illustrative_fixture';
    fixture.subject = { id: 'kungfuclan-demo', label: 'Kung Fu Clan illustrative demo', domain: 'web' };
    fixture.notice = WEB_ANALYTICS_FIXTURE_NOTICE;
    expect(isPublicWebAnalyticsProjection(fixture)).toBe(true);
    fixture.subject.id = 'kungfuclan.com';
    expect(isPublicWebAnalyticsProjection(fixture)).toBe(false);
  });

  it('rejects oversized browser payloads before JSON projection work', () => {
    expect(() => parseWebAnalyticsText(' '.repeat(1024 * 1024))).toThrow(/payload exceeds/i);
  });
});
