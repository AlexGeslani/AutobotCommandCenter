const column = (id, label, type, extra = {}) => Object.freeze({ id, label, type, ...extra });

export const SORTABLE_TABLES = Object.freeze({
  'analytics.daily': Object.freeze([
    column('date', 'Date', 'date'),
    column('state', 'State', 'text'),
    column('requests', 'Requests', 'number'),
    column('visits', 'Cloudflare Visits', 'number'),
    column('transfer', 'Transfer', 'number'),
  ]),
  'analytics.countries': Object.freeze([
    column('country', 'Country', 'text'),
    column('requests', 'Requests', 'number'),
    column('transfer', 'Transfer', 'number'),
  ]),
  'benchmarks.coverage': Object.freeze([
    column('condition', 'Tested condition', 'text'),
    column('instruction', 'Instruction following', 'status', { ranks: { verified: 0, 'in-progress': 1, queued: 2 } }),
    column('tools', 'Native tool use', 'status', { ranks: { verified: 0, 'in-progress': 1, queued: 2 } }),
    column('agent', 'Multi-turn agent', 'status', { ranks: { verified: 0, 'in-progress': 1, queued: 2 } }),
  ]),
  'benchmarks.measured-suite': Object.freeze([
    column('condition', 'Tested condition', 'text'),
    column('result', 'Score or completion', 'grouped-number'),
  ]),
  'benchmarks.comparison': Object.freeze([
    column('condition', 'Tested condition', 'text'),
    column('instruction', 'Instruction following', 'number'),
    column('tools', 'Native tool use', 'number'),
    column('agent', 'Multi-turn agent', 'number'),
    column('average', 'Current average', 'number'),
    column('evidence', 'Verified suites', 'number'),
  ]),
  'benchmarks.leaderboard': Object.freeze([
    column('rank', 'Rank', 'number'),
    column('condition', 'Tested condition', 'text'),
    column('score', 'Score', 'number'),
    column('denominator', 'Denominator', 'number'),
    column('release', 'Release', 'text'),
  ]),
});

const MISSING_LABELS = new Set(['missing', 'pending', 'unknown']);
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function isMissing(value) {
  return value == null
    || (typeof value === 'number' && !Number.isFinite(value))
    || (typeof value === 'string' && MISSING_LABELS.has(value.trim().toLowerCase()));
}

function compareScalar(left, right, columnDefinition) {
  if (columnDefinition.type === 'number') return Number(left) - Number(right);
  if (columnDefinition.type === 'date') return Date.parse(left) - Date.parse(right);
  if (columnDefinition.type === 'status') {
    const leftRank = columnDefinition.ranks?.[left] ?? Number.MAX_SAFE_INTEGER;
    const rightRank = columnDefinition.ranks?.[right] ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || collator.compare(String(left), String(right));
  }
  return collator.compare(String(left), String(right));
}

export function sortRows(rows, columnDefinition, direction = 'ascending') {
  if (!columnDefinition) return [...rows];
  const multiplier = direction === 'descending' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: columnDefinition.value(row) }))
    .sort((left, right) => {
      const leftMissing = isMissing(left.value);
      const rightMissing = isMissing(right.value);
      if (leftMissing || rightMissing) {
        if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
        return left.index - right.index;
      }
      if (columnDefinition.type === 'grouped-number') {
        const leftGroup = left.value.kind === 'score' ? 0 : left.value.kind === 'progress' ? 1 : 2;
        const rightGroup = right.value.kind === 'score' ? 0 : right.value.kind === 'progress' ? 1 : 2;
        if (leftGroup !== rightGroup) return leftGroup - rightGroup;
        const difference = (Number(left.value.value) - Number(right.value.value)) * multiplier;
        return difference || left.index - right.index;
      }
      const difference = compareScalar(left.value, right.value, columnDefinition) * multiplier;
      return difference || left.index - right.index;
    })
    .map(({ row }) => row);
}

export function nextSort(current, columnId) {
  if (!current || current.column !== columnId) return { column: columnId, direction: 'ascending' };
  return { column: columnId, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

export function createSortingSupport({ React, useState }) {
  const h = React.createElement;

  function useSortableRows(rows, columns) {
    const [sort, setSort] = useState(null);
    const activeColumn = sort ? columns.find((candidate) => candidate.id === sort.column) : null;
    return {
      rows: sortRows(rows, activeColumn, sort?.direction),
      sort,
      onSort: (columnId) => setSort((current) => nextSort(current, columnId)),
    };
  }

  function SortableHeader({ column: definition, sort, onSort, as = 'th' }) {
    const active = sort?.column === definition.id;
    const direction = active ? sort.direction : null;
    return h(as, {
      scope: as === 'th' ? 'col' : undefined,
      role: as === 'th' ? undefined : 'columnheader',
      'aria-sort': direction || undefined,
    }, h('button', {
      type: 'button',
      className: 'acc-sort-button',
      'aria-label': `Sort by ${definition.label}`,
      onClick: () => onSort(definition.id),
    }, h('span', null, definition.label), h('span', { className: 'acc-sort-indicator', 'aria-hidden': 'true' }, direction === 'ascending' ? '↑' : direction === 'descending' ? '↓' : '↕')));
  }

  return { useSortableRows, SortableHeader };
}

export function defineSortColumns(tableId, accessors) {
  const definitions = SORTABLE_TABLES[tableId];
  if (!definitions) throw new TypeError(`Unknown sortable table: ${tableId}`);
  for (const definition of definitions) {
    if (typeof accessors[definition.id] !== 'function') throw new TypeError(`Missing sort accessor for ${tableId}.${definition.id}`);
  }
  for (const id of Object.keys(accessors)) {
    if (!definitions.some((definition) => definition.id === id)) throw new TypeError(`Unknown sort accessor for ${tableId}.${id}`);
  }
  return definitions.map((definition) => ({ ...definition, value: accessors[definition.id] }));
}
