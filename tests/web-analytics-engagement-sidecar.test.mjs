import { describe, expect, it } from 'vitest';
import {
  ENGAGEMENT_QUERY_VERSION,
  normalizeEngagementQueryResponse,
  parseEngagementSidecarText,
  serializeEngagementSidecar,
} from '../collector/web-analytics/engagement-sidecar.mjs';

function response() {
  return {
    data: { viewer: { zones: [{ httpRequests1dGroups: [{ dimensions: { date: '2026-08-15' }, sum: { pageViews: 213, visits: 203 }, uniq: { uniques: 135 } }] }] } },
  };
}

describe('local engagement sidecar contract', () => {
  it('normalizes one closed UTC day without retaining the raw provider envelope', () => {
    const record = normalizeEngagementQueryResponse(response(), {
      site: 'kungfuclan.com',
      date: '2026-08-15',
      collectedAt: '2026-08-16T18:00:00.000Z',
    });
    expect(record).toEqual({
      schemaVersion: 'web-analytics-engagement-sidecar-v1',
      queryVersion: ENGAGEMENT_QUERY_VERSION,
      site: 'kungfuclan.com',
      date: '2026-08-15',
      periodStartUtc: '2026-08-15T00:00:00.000Z',
      periodEndUtc: '2026-08-16T00:00:00.000Z',
      collectedAt: '2026-08-16T18:00:00.000Z',
      metrics: { pageViews: 213, visits: 203, uniqueIps: 135 },
    });
    expect(JSON.stringify(record)).not.toContain('viewer');
  });

  it('round-trips the closed sidecar and rejects unknown fields', () => {
    const record = normalizeEngagementQueryResponse(response(), { site: 'kungfuclan.com', date: '2026-08-15', collectedAt: '2026-08-16T18:00:00.000Z' });
    expect(parseEngagementSidecarText(serializeEngagementSidecar(record))).toEqual(record);
    expect(() => parseEngagementSidecarText(JSON.stringify({ ...record, rawResponse: response() }))).toThrow(/unknown field/i);
  });

  it('fails closed for provider errors, multiple rows, or a mismatched day', () => {
    const options = { site: 'kungfuclan.com', date: '2026-08-15', collectedAt: '2026-08-16T18:00:00.000Z' };
    expect(() => normalizeEngagementQueryResponse({ errors: [{ message: 'denied' }] }, options)).toThrow(/provider errors/i);
    const multiple = response();
    multiple.data.viewer.zones[0].httpRequests1dGroups.push(structuredClone(multiple.data.viewer.zones[0].httpRequests1dGroups[0]));
    expect(() => normalizeEngagementQueryResponse(multiple, options)).toThrow(/exactly one/i);
    const wrongDay = response();
    wrongDay.data.viewer.zones[0].httpRequests1dGroups[0].dimensions.date = '2026-08-14';
    expect(() => normalizeEngagementQueryResponse(wrongDay, options)).toThrow(/date mismatch/i);
  });
});