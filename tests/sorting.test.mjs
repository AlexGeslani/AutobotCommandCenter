import { describe, expect, it } from 'vitest';
import {
  SORTABLE_TABLES,
  defineSortColumns,
  nextSort,
  sortRows,
} from '../src/sorting.mjs';

const EXPECTED_TABLES = {
  'analytics.daily': ['date', 'state', 'requests', 'visits', 'transfer'],
  'analytics.countries': ['country', 'requests', 'transfer'],
  'benchmarks.coverage': ['condition', 'instruction', 'tools', 'agent'],
  'benchmarks.measured-suite': ['condition', 'result'],
  'benchmarks.comparison': ['condition', 'instruction', 'tools', 'agent', 'average', 'evidence'],
  'benchmarks.leaderboard': ['rank', 'condition', 'score', 'denominator', 'release'],
};

describe('sortable evidence-table contract', () => {
  it('mechanically inventories every Analytics and Benchmarks data-table column', () => {
    expect(Object.fromEntries(Object.entries(SORTABLE_TABLES).map(([table, columns]) => [table, columns.map((column) => column.id)]))).toEqual(EXPECTED_TABLES);
    expect(Object.values(SORTABLE_TABLES).flat()).toHaveLength(25);
  });

  it('requires one sort-key accessor for every inventoried data column', () => {
    expect(() => defineSortColumns('analytics.countries', {
      country: (row) => row.country,
      requests: (row) => row.requests,
    })).toThrow(/transfer/i);
    expect(() => defineSortColumns('analytics.countries', {
      country: (row) => row.country,
      requests: (row) => row.requests,
      transfer: (row) => row.transfer,
      decorative: () => 0,
    })).toThrow(/decorative/i);
  });

  it('preserves default order and stably sorts text, numbers, and dates by underlying values', () => {
    const rows = [
      { id: 'first-tie', name: 'beta', score: 2, date: '2026-08-03' },
      { id: 'ten', name: 'Alpha 10', score: 10, date: '2026-08-01' },
      { id: 'two', name: 'alpha 2', score: 2, date: '2026-08-02' },
      { id: 'second-tie', name: 'beta', score: 2, date: '2026-08-04' },
    ];
    expect(sortRows(rows, null)).toEqual(rows);
    expect(sortRows(rows, { value: (row) => row.score, type: 'number' }, 'ascending').map((row) => row.id)).toEqual(['first-tie', 'two', 'second-tie', 'ten']);
    expect(sortRows(rows, { value: (row) => row.name, type: 'text' }, 'ascending').map((row) => row.id)).toEqual(['two', 'ten', 'first-tie', 'second-tie']);
    expect(sortRows(rows, { value: (row) => row.date, type: 'date' }, 'descending').map((row) => row.id)).toEqual(['second-tie', 'first-tie', 'two', 'ten']);
    expect(rows.map((row) => row.id)).toEqual(['first-tie', 'ten', 'two', 'second-tie']);
  });

  it('keeps missing, Pending, and Unknown values explicit and last in both directions', () => {
    const rows = [
      { id: 'unknown', value: 'Unknown' },
      { id: 'two', value: 2 },
      { id: 'pending', value: 'Pending' },
      { id: 'ten', value: 10 },
      { id: 'null', value: null },
    ];
    const column = { value: (row) => row.value, type: 'number' };
    expect(sortRows(rows, column, 'ascending').map((row) => row.id)).toEqual(['two', 'ten', 'unknown', 'pending', 'null']);
    expect(sortRows(rows, column, 'descending').map((row) => row.id)).toEqual(['ten', 'two', 'unknown', 'pending', 'null']);
  });

  it('keeps verified scores ahead of completion-only progress while sorting within each evidence class', () => {
    const rows = [
      { id: 'progress-high', metric: { kind: 'progress', value: 90 } },
      { id: 'score-low', metric: { kind: 'score', value: 20 } },
      { id: 'pending', metric: null },
      { id: 'score-high', metric: { kind: 'score', value: 80 } },
      { id: 'progress-low', metric: { kind: 'progress', value: 10 } },
    ];
    const column = { value: (row) => row.metric, type: 'grouped-number' };
    expect(sortRows(rows, column, 'ascending').map((row) => row.id)).toEqual(['score-low', 'score-high', 'progress-low', 'progress-high', 'pending']);
    expect(sortRows(rows, column, 'descending').map((row) => row.id)).toEqual(['score-high', 'score-low', 'progress-high', 'progress-low', 'pending']);
  });

  it('starts inactive headers ascending and toggles only the active column', () => {
    expect(nextSort(null, 'score')).toEqual({ column: 'score', direction: 'ascending' });
    expect(nextSort({ column: 'score', direction: 'ascending' }, 'score')).toEqual({ column: 'score', direction: 'descending' });
    expect(nextSort({ column: 'score', direction: 'descending' }, 'name')).toEqual({ column: 'name', direction: 'ascending' });
  });
});
