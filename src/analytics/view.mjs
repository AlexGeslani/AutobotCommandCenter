import { loadWebAnalyticsProjection } from './client.mjs';
import { loadGitHubAnalyticsProjection } from './github-client.mjs';
import { projectCurrentWebAnalyticsCoverage } from './schema.mjs';
import { buildWorldTrafficModel } from './world-map.mjs';
import { createSortingSupport, defineSortColumns } from '../sorting.mjs';

const RANGE_LABELS = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };

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

export function projectGitHubPortfolioCards(projection) {
  return [
    { label: 'Retained views', value: formatNumber(projection.portfolio.retainedTotals.views), note: 'Additive repository views retained since collection began' },
    { label: 'Retained clones', value: formatNumber(projection.portfolio.retainedTotals.clones), note: 'Additive full-clone events retained since collection began' },
    { label: 'Repositories reporting', value: formatNumber(projection.portfolio.repositoriesReporting), note: 'Approved public repositories with validated observations' },
    { label: 'Retained coverage', value: projection.coverage.trafficStart ? `${projection.coverage.trafficStart} → ${projection.coverage.observedThrough}` : 'No daily rows', note: `Collection began ${projection.coverage.collectionStartedAt.slice(0, 10)}` },
  ];
}

export function projectGitHubRepositoryOptions(projection) {
  return projection.repositories.map((repository) => ({
    id: repository.id, name: repository.name, retainedViews: repository.retainedTotals.views, retainedClones: repository.retainedTotals.clones,
    uniqueVisitors: repository.latestWindow.views.uniques, uniqueCloners: repository.latestWindow.clones.uniques,
  })).sort((left, right) => left.id - right.id);
}

export function projectGitHubDailyRows(repository) {
  const display = (metric, field) => metric.state === 'missing' ? '—' : formatNumber(metric[field]);
  return repository.daily.map((row) => ({
    date: row.date, finality: row.finality,
    views: display(row.views, 'count'), uniqueVisitors: display(row.views, 'uniques'),
    clones: display(row.clones, 'count'), uniqueCloners: display(row.clones, 'uniques'),
  }));
}

export function createAnalyticsView({ React, h, useEffect, useState, Badge, StatusBadge, SectionHeading, ProviderUsage, edition }) {
  const webSubjects = edition.analytics.web;
  const githubSubject = edition.analytics.github;
  const providerSubject = edition.analytics.providerUsage;
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
      h(SectionHeading, {
        eyebrow: 'Measured systems',
        title: 'Analytics',
        help: 'One reporting destination for web properties, AI services, and products or agents. Every source keeps its own authority, freshness, and metric definitions.',
      }),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-web' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 01'), h('h2', { id: 'acc-domain-web' }, 'Web properties')), h(Badge, { tone: webSubjects.length ? 'good' : 'warn' }, `${webSubjects.length} connected`)),
        webSubjects.length
          ? h('div', { className: 'acc-analytics-source-grid' }, webSubjects.map((subject) => h(SourceCard, {
            key: subject.id,
            eyebrow: 'Validated aggregate projection',
            title: subject.label,
            status: 'available',
            description: subject.description,
            action: `Open ${subject.label} analytics`,
            onClick: () => go({ view: 'analytics', domain: 'web', subject: subject.id, range: '30d' }),
          })))
          : h('p', { className: 'acc-provider-empty' }, 'No web analytics projection is connected in this edition.'),
      ),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-code' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 02'), h('h2', { id: 'acc-domain-code' }, 'Code & repositories')), h(Badge, { tone: githubSubject ? 'good' : 'warn' }, githubSubject ? '1 connected' : 'Not connected')),
        githubSubject
          ? h('div', { className: 'acc-analytics-source-grid' }, h(SourceCard, {
            eyebrow: 'Retained rolling observations', title: githubSubject.label, status: 'available', description: githubSubject.description,
            action: `Open ${githubSubject.label}`, onClick: () => go({ view: 'analytics', domain: 'code', subject: githubSubject.id }),
          }))
          : h('p', { className: 'acc-provider-empty' }, 'No repository analytics projection is connected in this edition.'),
      ),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-ai' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 03'), h('h2', { id: 'acc-domain-ai' }, 'AI services')), h(Badge, { tone: providerCount ? 'good' : 'warn' }, `${providerCount} reporting`)),
        h('div', { className: 'acc-analytics-source-grid' },
          h(SourceCard, { eyebrow: 'Subscription and API headroom', title: providerSubject.label, status: providerCount ? 'available' : 'unknown', description: providerSubject.description, action: `Open ${providerSubject.label.toLocaleLowerCase('en')}`, onClick: () => go({ view: 'analytics', domain: 'ai', subject: providerSubject.id }) }),
        ),
      ),
      h('section', { className: 'acc-analytics-domain', 'aria-labelledby': 'acc-domain-products' },
        h('div', { className: 'acc-analytics-domain__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Domain 04'), h('h2', { id: 'acc-domain-products' }, 'Products & agents')), h(Badge, { tone: 'warn' }, 'Not connected')),
        h('p', { className: 'acc-provider-empty' }, 'No product or agent analytics projection is connected in this edition.'),
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
    const subject = route.subject;
    const selectedRange = Object.hasOwn(RANGE_LABELS, route.range) ? route.range : '30d';
    const [loadState, setLoadState] = useState({ status: 'loading', projection: null });
    useEffect(() => {
      let active = true;
      setLoadState({ status: 'loading', projection: null });
      loadWebAnalyticsProjection(window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist', { subject, subjects: webSubjects }).then(
        (projection) => { if (active) setLoadState({ status: 'ready', projection }); },
        () => { if (active) setLoadState({ status: 'unavailable', projection: null }); },
      );
      return () => { active = false; };
    }, [subject]);

    if (loadState.status === 'loading') return h('div', { className: 'acc-view' }, h('p', { className: 'acc-search-status', role: 'status' }, 'Loading validated analytics projection…'));
    if (loadState.status === 'unavailable') return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, `${subject} analytics unavailable`), h('p', null, 'No validated projection was loaded. The dashboard does not substitute zeros or fixture data.')),
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
          go({ view: 'analytics', domain: 'web', subject: event.target.value, range: selectedRange });
        } },
        webSubjects.map((item) => h('option', { key: item.id, value: item.id }, `${item.label} · validated projection`)),
        )),
        h('div', { className: 'acc-metric-tabs', role: 'group', 'aria-label': 'Analytics date range' }, Object.entries(RANGE_LABELS).map(([id, label]) => h('button', { key: id, type: 'button', className: `acc-tab-button${selectedRange === id ? ' is-active' : ''}`, 'aria-pressed': selectedRange === id, onClick: () => go({ view: 'analytics', domain: 'web', subject, range: id }) }, label))),
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

  function GitHubTopList({ eyebrow, title, rows, labelFor, empty }) {
    const maximum = Math.max(...rows.map((row) => row.count), 1);
    return h('section', { className: 'acc-analytics-panel' },
      h('div', { className: 'acc-analytics-panel__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, eyebrow), h('h2', null, title)), h('small', null, `${rows.length} from one provider window`)),
      rows.length ? h('ol', { className: 'acc-analytics-bars' }, rows.map((row) => {
        const label = labelFor(row);
        return h('li', { key: label },
          h('div', null, h('span', { title: label }, label), h('strong', null, `${formatNumber(row.count)} · ${formatNumber(row.uniques)} unique`)),
          h('span', { className: 'acc-analytics-bar', role: 'img', 'aria-label': `${label}: ${formatNumber(row.count)} views in this repository window` }, h('i', { style: { width: `${(row.count / maximum) * 100}%` } })),
        );
      })) : h('p', { className: 'acc-provider-empty' }, empty),
    );
  }

  function GitHubPortfolioAnalytics({ route, go }) {
    const [loadState, setLoadState] = useState({ status: 'loading', projection: null });
    useEffect(() => {
      let active = true;
      setLoadState({ status: 'loading', projection: null });
      loadGitHubAnalyticsProjection(window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist', githubSubject).then(
        (projection) => { if (active) setLoadState({ status: 'ready', projection }); },
        () => { if (active) setLoadState({ status: 'unavailable', projection: null }); },
      );
      return () => { active = false; };
    }, []);

    if (loadState.status === 'loading') return h('div', { className: 'acc-view' }, h('p', { className: 'acc-search-status', role: 'status' }, 'Loading validated GitHub observations…'));
    if (loadState.status === 'unavailable') return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, 'GitHub Portfolio analytics unavailable'), h('p', null, 'No validated GitHub projection was loaded. The dashboard does not substitute zeros, fixtures, or repository inventory.')),
    );
    const projection = loadState.projection;
    const requestedId = Number(route.repository);
    const repository = projection.repositories.find((row) => row.id === requestedId) || projection.repositories[0];
    const repositoryOptions = projectGitHubRepositoryOptions(projection);
    const daily = projectGitHubDailyRows(repository);
    const freshness = Date.now() - Date.parse(projection.generatedAt) <= 36 * 60 * 60 * 1000 ? 'available' : 'stale';
    return h('div', { className: 'acc-view acc-analytics' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-analytics-hero' },
        h('div', null,
          h('p', { className: 'acc-eyebrow' }, 'Analytics / Code & repositories'),
          h('h2', null, 'GitHub Portfolio'),
          h('p', { className: 'acc-lede' }, 'Prospective retention of GitHub’s rolling, revisable 14-day repository traffic observations. Website and demo traffic remains in the separate Cloudflare lane.'),
        ),
        h(StatusBadge, { state: freshness }),
      ),
      h('section', { className: 'acc-analytics-trust', 'aria-label': 'GitHub analytics source coverage' },
        h('div', null, h('span', null, 'Source state'), h(StatusBadge, { state: freshness }), h('small', null, 'Checksum-verified immutable observations')),
        h('div', null, h('span', null, 'Collection began'), h('strong', null, projection.coverage.collectionStartedAt.slice(0, 10)), h('small', null, 'Earlier traffic outside GitHub’s first retained window is unavailable')),
        h('div', null, h('span', null, 'Retained traffic dates'), h('strong', null, projection.coverage.trafficStart ? `${projection.coverage.trafficStart} → ${projection.coverage.observedThrough}` : 'No daily rows'), h('small', null, 'Recent dates remain provisional while GitHub can revise them')),
        h('div', null, h('span', null, 'Authority'), h('strong', null, 'GitHub REST traffic metrics'), h('small', null, 'Repository traffic only · not GitHub Pages/demo traffic')),
      ),
      h('section', { className: 'acc-analytics-summary', 'aria-label': 'GitHub Portfolio retained summary' }, projectGitHubPortfolioCards(projection).map((card) =>
        h('article', { key: card.label, className: 'acc-analytics-metric' }, h('span', null, card.label), h('strong', null, card.value), h('small', null, card.note)),
      )),
      h('section', { className: 'acc-analytics-panel acc-github-caveat', role: 'note' },
        h('strong', null, 'Audience boundary'),
        h('p', null, 'Unique visitors and unique cloners are shown only for one repository’s latest 14-day GitHub window. They overlap across repositories and dates, so ACC never creates a portfolio-wide unique audience total. Traffic may include Alex, automation, and repeat activity.'),
      ),
      h('section', { className: 'acc-analytics-panel' },
        h('div', { className: 'acc-analytics-panel__head' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Approved public allowlist'), h('h2', null, 'Repositories')), h('small', null, 'Numeric repository ID is the durable identity')),
        h('div', { className: 'acc-github-repository-grid', role: 'list' }, repositoryOptions.map((option) => h('button', {
          key: option.id, type: 'button', role: 'listitem', className: `acc-github-repository${option.id === repository.id ? ' is-active' : ''}`,
          'aria-pressed': option.id === repository.id,
          onClick: () => go({ view: 'analytics', domain: 'code', subject: 'github-portfolio', repository: String(option.id) }),
        }, h('strong', null, option.name), h('span', null, `${formatNumber(option.retainedViews)} retained views · ${formatNumber(option.retainedClones)} retained clones`), h('small', null, `Latest window: ${formatNumber(option.uniqueVisitors)} unique visitors · ${formatNumber(option.uniqueCloners)} unique cloners`)))),
      ),
      h('section', { className: 'acc-analytics-panel' },
        h('div', { className: 'acc-analytics-panel__head' },
          h('div', null, h('p', { className: 'acc-eyebrow' }, `Repository ID ${repository.id}`), h('h2', null, h('a', { href: repository.htmlUrl, target: '_blank', rel: 'noreferrer' }, repository.fullName))),
          h('small', null, `Observed ${repository.latestWindow.observedAt}`),
        ),
        h('div', { className: 'acc-analytics-summary acc-github-window-summary' },
          h('article', { className: 'acc-analytics-metric' }, h('span', null, '14-day views'), h('strong', null, formatNumber(repository.latestWindow.views.count)), h('small', null, `${formatNumber(repository.latestWindow.views.uniques)} repository-window unique visitors`)),
          h('article', { className: 'acc-analytics-metric' }, h('span', null, '14-day clones'), h('strong', null, formatNumber(repository.latestWindow.clones.count)), h('small', null, `${formatNumber(repository.latestWindow.clones.uniques)} repository-window unique cloners`)),
          h('article', { className: 'acc-analytics-metric' }, h('span', null, 'Stars'), h('strong', null, formatNumber(repository.stars)), h('small', null, `${formatNumber(repository.forks)} forks`)),
          h('article', { className: 'acc-analytics-metric' }, h('span', null, 'Subscribers'), h('strong', null, formatNumber(repository.subscribers)), h('small', null, 'GitHub repository subscribers · not watchers/stars')),
        ),
        h('p', { className: 'acc-github-window-note' }, `Exact provider window ${repository.latestWindow.windowStart} → ${repository.latestWindow.windowEnd}. Top referrers and paths below are this one snapshot only and are never merged into portfolio rankings.`),
        h('details', { className: 'acc-analytics-daily', open: true },
          h('summary', null, 'Retained daily values and revision state'),
          h('div', { className: 'acc-analytics-daily-table' }, h('table', { 'aria-label': `${repository.name} retained GitHub traffic` },
            h('thead', null, h('tr', null, h('th', null, 'UTC date'), h('th', null, 'State'), h('th', null, 'Views'), h('th', null, 'Unique visitors'), h('th', null, 'Clones'), h('th', null, 'Unique cloners'))),
            h('tbody', null, [...daily].reverse().map((row) => h('tr', { key: row.date }, h('th', { scope: 'row' }, row.date), h('td', null, row.finality), h('td', null, row.views), h('td', null, row.uniqueVisitors), h('td', null, row.clones), h('td', null, row.uniqueCloners)))),
          )),
        ),
      ),
      h('div', { className: 'acc-analytics-compact-breakdowns' },
        h(GitHubTopList, { eyebrow: 'Latest repository window', title: 'Top referrers', rows: repository.latestWindow.referrers, labelFor: (row) => row.referrer, empty: 'No referrers reported in this provider window' }),
        h(GitHubTopList, { eyebrow: 'Latest repository window', title: 'Popular paths', rows: repository.latestWindow.paths, labelFor: (row) => row.title || row.path, empty: 'No popular paths reported in this provider window' }),
      ),
      h('section', { className: 'acc-analytics-method' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Interpretation contract'), h('h2', null, 'Coverage & method')),
        h('div', { className: 'acc-detail-grid' },
          h('section', null, h('h3', null, 'Rolling revisions'), h('p', null, 'Each daily collection preserves the full GitHub window. A newer observation may revise a recent date; ACC selects the newest valid observation for that repository and day. Dates age from provisional to historical only after they leave the revisable window.')),
          h('section', null, h('h3', null, 'Missing is not zero'), h('p', null, 'An explicit provider zero is displayed as 0. A day or metric absent from retained observations is displayed as — and is never silently imputed.')),
          h('section', null, h('h3', null, 'Identity & privacy'), h('p', null, 'Approved public repositories are keyed by GitHub numeric repository ID across renames. Private, unknown-visibility, access-lost, and unapproved repositories are absent from this browser projection.')),
          h('section', null, h('h3', null, 'Version contract'), h('p', null, `Archive ${projection.versions.archiveSchema} · compiler ${projection.versions.compiler} · projection ${projection.schemaVersion}`)),
        ),
      ),
    );
  }

  function Analytics({ route, go, providerUsage }) {
    if (!route.domain && !route.subject) return h(AnalyticsLanding, { go, providerUsage });
    if (route.domain === 'ai' && route.subject === providerSubject.id) return h('div', { className: 'acc-view acc-analytics' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h(ProviderUsage, { snapshot: providerUsage, go }),
    );
    if (route.domain === 'code' && githubSubject && route.subject === githubSubject.id) return h(GitHubPortfolioAnalytics, { route, go });
    if (route.domain === 'web' && webSubjects.some((subject) => subject.id === route.subject)) return h(WebPropertyAnalytics, { route, go });
    return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'analytics' }) }, '← Analytics'),
      h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, 'Analytics source not connected'), h('p', null, 'No validated projection is registered for this domain and subject. Unknown sources never become zero-valued dashboards.')),
    );
  }

  return Analytics;
}
