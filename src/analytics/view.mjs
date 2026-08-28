import { loadWebAnalyticsProjection } from './client.mjs';
import { projectCurrentWebAnalyticsCoverage } from './schema.mjs';
import { buildWorldTrafficModel } from './world-map.mjs';
import { createSortingSupport, defineSortColumns } from '../sorting.mjs';

const RANGE_LABELS = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };
const ANALYTICS_SHOWCASE_ENABLED = globalThis.__ACC_ANALYTICS_SHOWCASE__ === true;

function formatNumber(value) {
  return Number.isSafeInteger(value) ? value.toLocaleString() : 'Unknown';
}

function formatBytes(value) {
  if (!Number.isSafeInteger(value)) return 'Unknown';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = -1;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[index]}`;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unknown';
}

function formatChartNumber(value) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function countryName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function projectCountryRows(rows, defaultLimit = 10) {
  const allRows = rows
    .map((row) => ({ ...row }))
    .sort((left, right) => (right.requests - left.requests) || left.code.localeCompare(right.code));
  return {
    defaultRows: allRows.slice(0, defaultLimit),
    allRows,
    hasMore: allRows.length > defaultLimit,
  };
}

export function projectTrafficScale(daily) {
  const observed = daily.filter((day) => day.state === 'present' && Number.isSafeInteger(day.requests));
  const maximum = Math.max(...observed.map((day) => day.requests), 1);
  return { maximum, ticks: [0, 0.25, 0.5, 0.75, 1].map((fraction) => maximum * fraction) };
}

export function createAnalyticsView({ React, h, useEffect, useState, Badge, StatusBadge, SectionHeading, ProviderUsage }) {
  const { useSortableRows, SortableHeader } = createSortingSupport({ React, useState });

  function SourceCard({ eyebrow, title, status, description, action, onClick }) {
    return h('article', { className: 'acc-analytics-source-card' },
      h('div', { className: 'acc-analytics-source-card__head' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, eyebrow), h('h3', null, title)),
        h(StatusBadge, { state: status }),
      ),
      h('p', null, description),
      onClick
        ? h('button', { type: 'button', className: 'acc-secondary-button', onClick }, action)
        : h('span', { className: 'acc-analytics-source-card__planned' }, action),
    );
  }

  function AnalyticsLanding({ go, providerUsage }) {
    const providerCount = providerUsage?.providers?.filter((provider) => Array.isArray(provider.windows) && provider.windows.length).length || 0;
    return h('div', { className: 'acc-view acc-analytics' },
      h(SectionHeading, { eyebrow: 'Measured systems', title: 'Analytics' }),
      h('p', { className: 'acc-lede' }, 'One reporting destination for web properties, AI services, and products or agents. Every source keeps its own authority, freshness, and metric definitions.'),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-web' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 01'), h('h2', { id: 'acc-domain-web' }, 'Web properties')), h(Badge, { tone: 'good' }, '2 connected')),
        h('div', { className: 'acc-analytics-source-grid' },
          h(SourceCard, { eyebrow: 'Cloudflare edge aggregates', title: 'Kung Fu Clan', status: 'available', description: 'Daily requests, Cloudflare Visits, transfer, cache behavior, response classes, countries, coverage, and source provenance.', action: 'Open KFC analytics', onClick: () => go({ view: 'analytics', domain: 'web', subject: 'kungfuclan.com', range: '30d' }) }),
          h(SourceCard, { eyebrow: 'Cloudflare edge aggregates', title: 'alexgeslani.com', status: 'available', description: 'Daily requests, Cloudflare Visits, transfer, cache behavior, response classes, countries, coverage, and source provenance.', action: 'Open alexgeslani.com analytics', onClick: () => go({ view: 'analytics', domain: 'web', subject: 'alexgeslani.com', range: '30d' }) }),
        ),
      ),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-ai' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 02'), h('h2', { id: 'acc-domain-ai' }, 'AI services')), h(Badge, { tone: providerCount ? 'good' : 'warn' }, `${providerCount} reporting`)),
        h('div', { className: 'acc-analytics-source-grid' },
          h(SourceCard, { eyebrow: 'Subscription and API headroom', title: 'Provider Usage', status: providerCount ? 'available' : 'unknown', description: 'Existing Codex, Claude, Antigravity, and Brave observations remain separated by authority and metric class.', action: 'Open provider usage', onClick: () => go({ view: 'analytics', domain: 'ai', subject: 'provider-usage' }) }),
        ),
      ),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-products' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 03'), h('h2', { id: 'acc-domain-products' }, 'Products & agents')), h(Badge, null, 'Planned')),
        h('div', { className: 'acc-analytics-source-grid' },
          h(SourceCard, { eyebrow: 'Future operational source', title: 'Jarvis', status: 'missing', description: 'No Jarvis measurement contract or sanitized projection has been connected.', action: 'Not connected' }),
        ),
      ),
    );
  }

  function CoverageStrip({ projection, range }) {
    const coverage = projection.coverage;
    return h('section', { className: 'acc-analytics-trust', 'aria-label': 'Analytics source coverage' },
      h('div', null, h('span', null, 'Source state'), h(StatusBadge, { state: coverage.freshness }), h('strong', null, projection.dataKind === 'real' ? 'Checksum-verified aggregate archive' : 'Illustrative fixture only')),
      h('div', null, h('span', null, 'Data through'), h('strong', null, coverage.dataThrough), h('small', null, `Expected through ${coverage.expectedThrough}`)),
      h('div', null, h('span', null, 'Calendar coverage'), h('strong', null, `${range.daysObserved}/${range.daysCalendar} observed`), h('small', null, `${range.daysMissing} missing · ${range.daysOutsideArchive} before archive`)),
      h('div', null, h('span', null, 'Archive start'), h('strong', null, coverage.archiveStart), h('small', null, projection.source.authority)),
    );
  }

  function SummaryCards({ range }) {
    const totals = range.totals;
    const cards = [
      ['Requests', formatNumber(totals.requests), 'Cloudflare edge request count'],
      ['Cloudflare Visits', formatNumber(totals.visits), 'Page-entry events from direct traffic or an external referrer; not unique people or sessions'],
      ['Transfer', formatBytes(totals.edgeResponseBytes), 'Edge response bytes'],
      ['Strict cache-hit share', formatPercent(totals.strictCacheHitRatio), totals.cacheEligibleRequests ? `${formatNumber(totals.cacheHitRequests)} hit ÷ ${formatNumber(totals.cacheEligibleRequests)} classified requests` : 'Unknown — no eligible denominator'],
    ];
    return h('section', { className: 'acc-analytics-summary', 'aria-label': 'Analytics summary' }, cards.map(([label, value, note]) =>
      h('article', { key: label, className: 'acc-analytics-metric' }, h('span', null, label), h('strong', null, value), h('small', null, note)),
    ));
  }

  function TrafficChart({ range }) {
    const width = 720;
    const height = 220;
    const leftInset = 58;
    const rightInset = 22;
    const verticalInset = 22;
    const { maximum, ticks } = projectTrafficScale(range.daily);
    const dailyColumns = defineSortColumns('analytics.daily', {
      date: (day) => day.date,
      state: (day) => day.state,
      requests: (day) => day.requests,
      visits: (day) => day.visits,
      transfer: (day) => day.edgeResponseBytes,
    });
    const dailySort = useSortableRows([...range.daily].reverse(), dailyColumns);
    const xFor = (index) => leftInset + (index * (width - leftInset - rightInset)) / Math.max(range.daily.length - 1, 1);
    const yFor = (value) => height - verticalInset - ((value / maximum) * (height - (2 * verticalInset)));
    const segments = [];
    let current = [];
    range.daily.forEach((day, index) => {
      if (day.state === 'present') current.push([xFor(index), yFor(day.requests)]);
      else if (current.length) { segments.push(current); current = []; }
    });
    if (current.length) segments.push(current);
    const pathFor = (points) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return h('section', { className: 'acc-analytics-panel', 'aria-labelledby': 'acc-traffic-title' },
      h('div', { className: 'acc-analytics-panel__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Closed UTC days'), h('h2', { id: 'acc-traffic-title' }, 'Daily traffic')), h('small', null, 'Gaps are never plotted as zero')),
      h('svg', { className: 'acc-traffic-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Daily requests from ${range.startDate} through ${range.endDate}; ${range.daysObserved} observed, ${range.daysMissing} missing, ${range.daysOutsideArchive} before archive.` },
        ticks.map((value) => h('g', { key: value },
          h('line', { x1: leftInset, x2: width - rightInset, y1: yFor(value), y2: yFor(value), className: 'acc-traffic-gridline' }),
          h('text', { x: leftInset - 8, y: yFor(value) + 4, textAnchor: 'end', className: 'acc-traffic-tick', 'data-traffic-tick': true }, formatChartNumber(value)),
        )),
        segments.map((points, index) => h('path', { key: index, d: pathFor(points), className: 'acc-traffic-line' })),
        range.daily.map((day, index) => day.state === 'present' ? h('circle', { key: day.date, cx: xFor(index), cy: yFor(day.requests), r: 4, className: 'acc-traffic-point' }, h('title', null, `${day.date}: ${formatNumber(day.requests)} requests`)) : null),
      ),
      h('div', { className: 'acc-traffic-axis' }, h('span', null, range.startDate), h('span', null, range.endDate)),
      h('details', { className: 'acc-analytics-daily' },
        h('summary', null, 'Daily values and gap states'),
        h('div', { className: 'acc-analytics-daily-table' }, h('table', { 'aria-label': 'Daily traffic exact values' },
          h('thead', null, h('tr', null, dailyColumns.map((definition) => h(SortableHeader, { key: definition.id, column: definition, sort: dailySort.sort, onSort: dailySort.onSort })))),
          h('tbody', null, dailySort.rows.map((day) => h('tr', { key: day.date, 'data-daily-row': day.date },
            h('td', null, day.date), h('td', null, day.state.replace('_', ' ')), h('td', null, day.requests == null ? '—' : formatNumber(day.requests)), h('td', null, day.visits == null ? '—' : formatNumber(day.visits)), h('td', null, day.edgeResponseBytes == null ? '—' : formatBytes(day.edgeResponseBytes)),
          ))),
        )),
      ),
    );
  }

  function WorldTrafficMap({ range }) {
    const model = buildWorldTrafficModel(range.countries);
    const observed = model.features.filter((feature) => feature.state === 'observed' || feature.state === 'observed_zero').length;
    return h('section', { className: 'acc-analytics-panel acc-world-map', 'aria-labelledby': 'acc-world-map-title' },
      h('div', { className: 'acc-analytics-panel__head' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Geographic context'), h('h2', { id: 'acc-world-map-title' }, 'World request map')),
        h('small', null, `${observed} observed countr${observed === 1 ? 'y' : 'ies'} · country aggregates`),
      ),
      h('div', { className: 'acc-world-map__frame' },
        h('svg', { viewBox: '0 0 1000 500', role: 'group', 'aria-label': `World map of Cloudflare requests; ${observed} countries have retained aggregate values.` },
          model.features.map((feature) => {
            const isObserved = feature.state === 'observed' || feature.state === 'observed_zero';
            const label = isObserved ? `${feature.name}${feature.code ? ` · ${feature.code}` : ''}: ${formatNumber(feature.requests)} requests` : null;
            return h('path', {
              key: `${feature.code || 'unmapped'}:${feature.name}`,
              d: feature.path,
              className: 'acc-world-map__country',
              'data-country': feature.code || undefined,
              'data-state': feature.state,
              'data-level': feature.level ?? undefined,
              role: isObserved ? 'img' : undefined,
              'aria-label': label || undefined,
              'aria-hidden': isObserved ? undefined : true,
              tabIndex: isObserved ? 0 : undefined,
            }, isObserved ? h('title', null, label) : null);
          }),
        ),
      ),
      h('div', { className: 'acc-world-map__legend', 'aria-label': 'Map legend' },
        h('span', null, h('i', { 'data-legend': 'none' }), 'No retained value'),
        [1, 2, 3, 4, 5].map((level) => h('span', { key: level }, h('i', { 'data-legend': level }), level === 1 ? 'Lower' : level === 5 ? 'Higher' : '')),
      ),
      model.unmapped.length ? h('p', { className: 'acc-world-map__note', role: 'status' }, `${model.unmapped.length} retained country code${model.unmapped.length === 1 ? '' : 's'} could not be mapped and remain listed in the authoritative table above.`) : null,
      h('p', { className: 'acc-world-map__note' }, 'US state breakdown unavailable — the retained Cloudflare aggregate source exposes country, not state or subdivision. Country values remain authoritative in the table above.'),
    );
  }

  function CountryTable({ range }) {
    const [expanded, setExpanded] = useState(false);
    const projection = projectCountryRows(range.countries);
    const countryColumns = defineSortColumns('analytics.countries', {
      country: (row) => countryName(row.code),
      requests: (row) => row.requests,
      transfer: (row) => row.edgeResponseBytes,
    });
    const countrySort = useSortableRows(projection.allRows, countryColumns);
    const rows = expanded ? countrySort.rows : countrySort.rows.slice(0, 10);
    return h('section', { className: 'acc-analytics-panel acc-country-table', 'aria-labelledby': 'acc-country-table-title' },
      h('div', { className: 'acc-analytics-panel__head' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Authoritative geography'), h('h2', { id: 'acc-country-table-title' }, 'Requests by country')),
        h('small', null, `${rows.length} of ${projection.allRows.length} shown`),
      ),
      projection.allRows.length ? h('div', { className: 'acc-country-table__frame' }, h('table', { 'aria-label': 'Authoritative requests by country' },
        h('thead', null, h('tr', null, countryColumns.map((definition) => h(SortableHeader, { key: definition.id, column: definition, sort: countrySort.sort, onSort: countrySort.onSort })))),
        h('tbody', null, rows.map((row) => h('tr', { key: row.code, 'data-country-row': row.code },
          h('th', { scope: 'row' }, `${countryName(row.code)} · ${row.code}`),
          h('td', null, formatNumber(row.requests)),
          h('td', null, formatBytes(row.edgeResponseBytes)),
        ))),
      )) : h('p', { className: 'acc-provider-empty' }, 'No observed country values'),
      projection.hasMore ? h('button', {
        type: 'button',
        className: 'acc-secondary-button acc-country-table__toggle',
        'aria-expanded': expanded,
        onClick: () => setExpanded((value) => !value),
      }, expanded ? 'Collapse to Top 10 countries' : `Show all ${projection.allRows.length} countries`) : null,
    );
  }

  function BarList({ title, eyebrow, rows, labelFor, valueFor, empty = 'No observed values' }) {
    const maximum = Math.max(...rows.map((row) => valueFor(row)), 1);
    return h('section', { className: 'acc-analytics-panel' },
      h('div', { className: 'acc-analytics-panel__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, eyebrow), h('h2', null, title)), h('small', null, `${rows.length} observed`)),
      rows.length ? h('ol', { className: 'acc-analytics-bars' }, rows.map((row) => {
        const label = labelFor(row);
        const value = valueFor(row);
        return h('li', { key: label },
          h('div', null, h('span', null, label), h('strong', null, formatNumber(value))),
          h('span', { className: 'acc-analytics-bar', role: 'img', 'aria-label': `${label}: ${formatNumber(value)} requests` }, h('i', { style: { width: `${(value / maximum) * 100}%` } })),
        );
      })) : h('p', { className: 'acc-provider-empty' }, empty),
    );
  }

  function MissingPeriods({ projection, range }) {
    const missing = projection.coverage.missingPeriods.filter((date) => date >= range.startDate && date <= range.endDate);
    return h('section', { className: 'acc-analytics-method' },
      h('div', null, h('p', { className: 'acc-eyebrow' }, 'Interpretation contract'), h('h2', null, 'Coverage & method')),
      h('div', { className: 'acc-detail-grid' },
        h('section', null, h('h3', null, 'Missing retained periods'), missing.length ? h('ul', null, missing.map((date) => h('li', { key: date }, date))) : h('p', null, 'None in this range.')),
        h('section', null, h('h3', null, 'Before collection began'), h('p', null, `${range.daysOutsideArchive} calendar day${range.daysOutsideArchive === 1 ? '' : 's'} in this view predate the ${projection.coverage.archiveStart} archive start; they are unavailable, not zero traffic.`)),
        h('section', null, h('h3', null, 'Metric boundary'), h('p', null, 'Requests, transfer, and Cloudflare Visits use the hourly fact family and reconcile across retained aggregate families. Visits are entry events, not unique people or sessions. Countries, response classes, and cache statuses are breakdowns of the same traffic and are never added to headline totals.')),
        h('section', null, h('h3', null, 'Version contract'), h('p', null, `Archive ${projection.versions.archiveSchema} · query ${projection.versions.query} · metrics ${projection.versions.metricRegistry} · projection ${projection.schemaVersion}`)),
      ),
    );
  }

  function WebPropertyAnalytics({ route, go }) {
    const mode = route.subject === 'kungfuclan-demo' && route.mode === 'fixture' ? 'fixture' : 'real';
    const subject = mode === 'fixture' ? 'kungfuclan-demo' : route.subject;
    const selectedRange = Object.hasOwn(RANGE_LABELS, route.range) ? route.range : '30d';
    const [loadState, setLoadState] = useState({ status: 'loading', projection: null });
    useEffect(() => {
      let active = true;
      setLoadState({ status: 'loading', projection: null });
      loadWebAnalyticsProjection(window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist', { subject, mode }).then(
        (projection) => { if (active) setLoadState({ status: 'ready', projection }); },
        () => { if (active) setLoadState({ status: 'unavailable', projection: null }); },
      );
      return () => { active = false; };
    }, [subject, mode]);

    if (loadState.status === 'loading') return h('div', { className: 'acc-view' }, h('p', { className: 'acc-search-status', role: 'status' }, 'Loading validated analytics projection…'));
    if (loadState.status === 'unavailable') return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, mode === 'fixture' ? 'Illustrative showcase is not included in this build' : `${subject} analytics unavailable`), h('p', null, mode === 'fixture' ? 'The default build excludes synthetic analytics. Use an explicitly labeled development showcase build.' : 'No validated public projection was loaded. The dashboard does not substitute zeros or fixture data.')),
    );
    const projection = { ...loadState.projection, coverage: projectCurrentWebAnalyticsCoverage(loadState.projection.coverage) };
    const range = projection.ranges[selectedRange];
    return h('div', { className: 'acc-view acc-analytics' },
      projection.notice ? h('div', { className: 'acc-analytics-fixture-banner', role: 'alert' }, projection.notice) : null,
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-analytics-hero' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Analytics / Web Properties'), h('h2', null, projection.subject.label), h('p', { className: 'acc-lede' }, projection.dataKind === 'real' ? 'Portable Cloudflare edge aggregates retained as immutable daily files and projected read-only into ACC.' : 'A deterministic, non-current dataset for reviewing the full 30-day visual composition.')),
        h(StatusBadge, { state: projection.dataKind === 'real' ? projection.coverage.freshness : 'provisional' }),
      ),
      h('div', { className: 'acc-analytics-toolbar' },
        h('label', { className: 'acc-field' }, h('span', null, 'Web property'), h('select', { value: subject, onChange: (event) => {
          if (event.target.value === 'kungfuclan-demo') go({ view: 'analytics', domain: 'web', subject: 'kungfuclan-demo', range: '30d', mode: 'fixture' });
          else go({ view: 'analytics', domain: 'web', subject: event.target.value, range: selectedRange });
        } },
        h('option', { value: 'kungfuclan.com' }, 'kungfuclan.com · real archive'),
        h('option', { value: 'alexgeslani.com' }, 'alexgeslani.com · real archive'),
        ANALYTICS_SHOWCASE_ENABLED ? h('option', { value: 'kungfuclan-demo' }, 'Kung Fu Clan · illustrative demo') : null,
        )),
        h('div', { className: 'acc-metric-tabs', role: 'group', 'aria-label': 'Analytics date range' }, Object.entries(RANGE_LABELS).map(([id, label]) => h('button', { key: id, type: 'button', className: `acc-tab-button${selectedRange === id ? ' is-active' : ''}`, 'aria-pressed': selectedRange === id, onClick: () => go({ view: 'analytics', domain: 'web', subject, range: id, ...(mode === 'fixture' ? { mode: 'fixture' } : {}) }) }, label))),
      ),
      h(CoverageStrip, { projection, range }),
      h(SummaryCards, { range }),
      h(TrafficChart, { range }),
      h(CountryTable, { range }),
      h('details', { className: 'acc-world-map-disclosure' },
        h('summary', null, 'Show world request map'),
        h(WorldTrafficMap, { range }),
      ),
      h('div', { className: 'acc-analytics-compact-breakdowns' },
        h(BarList, { eyebrow: 'HTTP outcome', title: 'Response classes', rows: range.statusClasses, labelFor: (row) => row.class, valueFor: (row) => row.requests }),
        h(BarList, { eyebrow: 'Edge cache', title: 'Cache statuses', rows: range.cacheStatuses, labelFor: (row) => row.status, valueFor: (row) => row.requests }),
      ),
      h(MissingPeriods, { projection, range }),
    );
  }

  function Analytics({ route, go, providerUsage }) {
    if (!route.domain && !route.subject) return h(AnalyticsLanding, { go, providerUsage });
    if (route.domain === 'ai' && route.subject === 'provider-usage') return h('div', { className: 'acc-view acc-analytics' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h(ProviderUsage, { snapshot: providerUsage, go }),
    );
    if (route.domain === 'web' && (route.subject === 'kungfuclan.com' || route.subject === 'alexgeslani.com' || (ANALYTICS_SHOWCASE_ENABLED && route.subject === 'kungfuclan-demo'))) return h(WebPropertyAnalytics, { route, go });
    return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, 'Analytics source not connected'), h('p', null, 'No validated projection is registered for this domain and subject. Unknown sources never become zero-valued dashboards.')),
    );
  }

  return Analytics;
}
