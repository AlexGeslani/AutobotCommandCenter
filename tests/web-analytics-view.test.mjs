import { describe, expect, it } from 'vitest';
import { projectCountryRows, projectTrafficScale } from '../src/analytics/view.mjs';

describe('compact analytics view projections', () => {
  it('keeps a stable Top 10 default and the complete authoritative country table without mutating source rows', () => {
    const rows = [
      { code: 'ZZ', requests: 20 },
      { code: 'US', requests: 100 },
      { code: 'CA', requests: 90 },
      { code: 'GB', requests: 80 },
      { code: 'DE', requests: 70 },
      { code: 'AU', requests: 60 },
      { code: 'JP', requests: 50 },
      { code: 'BR', requests: 40 },
      { code: 'SG', requests: 30 },
      { code: 'FR', requests: 20 },
      { code: 'ES', requests: 10 },
      { code: 'MX', requests: 5 },
    ];
    const original = structuredClone(rows);

    const projection = projectCountryRows(rows);

    expect(projection.defaultRows).toHaveLength(10);
    expect(projection.defaultRows.map((row) => row.code)).toEqual(['US', 'CA', 'GB', 'DE', 'AU', 'JP', 'BR', 'SG', 'FR', 'ZZ']);
    expect(projection.allRows.map((row) => row.code)).toEqual(['US', 'CA', 'GB', 'DE', 'AU', 'JP', 'BR', 'SG', 'FR', 'ZZ', 'ES', 'MX']);
    expect(projection.hasMore).toBe(true);
    expect(rows).toEqual(original);
    expect(projection.allRows[0]).not.toBe(rows[1]);
  });

  it('projects deterministic numeric traffic ticks from zero through the observed maximum while ignoring gaps', () => {
    const scale = projectTrafficScale([
      { date: '2026-08-01', state: 'present', requests: 100 },
      { date: '2026-08-02', state: 'missing', requests: 900 },
      { date: '2026-08-03', state: 'present', requests: 40 },
    ]);

    expect(scale.maximum).toBe(100);
    expect(scale.ticks).toEqual([0, 25, 50, 75, 100]);
  });
});
