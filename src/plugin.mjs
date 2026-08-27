import commandCenterMarkUrl from '../standalone/autobot-mark.jpg';
import voicePerformanceUrl from '../standalone/voice-performance-comparison.png';
import { loadProviderUsageSnapshot, providerUsageFallback } from './provider-usage/client.mjs';
import { createAnalyticsView } from './analytics/view.mjs';
import {
  NAV_ITEMS,
  RELEASES,
  fixtures,
  getCondition,
  getEvaluationIndex,
  getVoicePerformance,
  getFamily,
  getLeaderboard,
  getCapabilityRollup,
  getBenchmarkComparison,
  getRunLineage,
  getEffectiveAvailability,
  getEffectiveProductClaims,
  getEffectiveSkillClaims,
  getSourceTrust,
  buildAccUrl,
  parseAccUrl,
  canonicalizeAccRoute,
} from './model.mjs';

export function registerAutobotCommandCenter() {
  'use strict';

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) {
    console.error('[ACC] Hermes Plugin SDK is unavailable');
    return;
  }

  const { React } = SDK;
  const { useEffect, useRef, useState } = SDK.hooks;
  const h = React.createElement;

  function cx(...values) {
    return values.filter(Boolean).join(' ');
  }

  function Badge({ children, tone = 'neutral' }) {
    return h('span', { className: `acc-badge acc-badge--${tone}` }, children);
  }

  function StatusBadge({ state }) {
    const tone = state === 'fresh' || state === 'canonical' || state === 'validated' || state === 'available' || state === 'verified'
      ? 'good'
      : state === 'stale' || state === 'provisional' || state === 'unknown' || state === 'pending' || state === 'blocked'
        ? 'warn'
        : state === 'missing' || state === 'unavailable' || state === 'failed'
          ? 'bad'
          : 'neutral';
    return h(Badge, { tone }, String(state).replaceAll('-', ' '));
  }

  function SectionHeading({ eyebrow, title, action }) {
    return h('div', { className: 'acc-section-heading' },
      h('div', null,
        eyebrow ? h('p', { className: 'acc-eyebrow' }, eyebrow) : null,
        h('h2', null, title),
      ),
      action || null,
    );
  }

  function EmptyUnknown({ children = 'Unknown — no authoritative source' }) {
    return h('span', { className: 'acc-unknown' }, children);
  }

  function Meter({ value, label }) {
    return h('div', { className: 'acc-meter', 'aria-label': `${label}: ${value}%` },
      h('div', { className: 'acc-meter__track' }, h('span', { style: { width: `${value}%` } })),
      h('span', null, `${value}% evidence complete`),
    );
  }

  function VoicePerformance({ comparisonId }) {
    const snapshot = getVoicePerformance(comparisonId);
    if (!snapshot) return h(EmptyUnknown, { children: 'Voice comparison unavailable — evidence identity mismatch' });
    return h('section', { className: 'acc-voice-performance', 'aria-labelledby': 'acc-voice-performance-title' },
      h('div', { className: 'acc-ranking-heading' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Measured route evidence'), h('h3', { id: 'acc-voice-performance-title' }, 'Voice runtime comparison')),
        h(Badge, { tone: 'good' }, `Measured ${snapshot.observedAt}`),
      ),
      h('p', { className: 'acc-voice-method' }, snapshot.method),
      h('img', {
        className: 'acc-voice-visual', src: voicePerformanceUrl,
        alt: 'Prime voice performance matrix comparing first-byte latency, completion time, real-time factor, reliability, and role across six routes.',
      }),
      h('div', { className: 'acc-voice-desktop' }, h('table', null,
        h('thead', null, h('tr', null, ['Rank', 'Host / engine', 'First byte', 'Complete', 'RTF', 'Reliability', 'Position'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
        h('tbody', null, snapshot.routes.map((route, index) => h('tr', { key: route.id, 'data-voice-route': route.id },
          h('td', null, `#${index + 1}`),
          h('td', null, h('strong', null, route.host), h('small', null, route.engine)),
          h('td', null, `${route.firstByteSeconds.toFixed(3)}s`),
          h('td', null, `${route.completeSeconds.toFixed(3)}s`),
          h('td', null, route.rtf.toFixed(3)),
          h('td', null, route.timeouts ? h(Badge, { tone: 'warn' }, `${route.timeouts} timeout`) : `${route.successfulTrials}/${route.totalTrials}`),
          h('td', null, route.position),
        ))),
      )),
      h('div', { className: 'acc-voice-mobile' }, snapshot.routes.map((route, index) => h('article', { className: 'acc-voice-card', key: route.id },
        h('div', null, h('span', { className: 'acc-rank' }, `#${index + 1}`), h('strong', null, `${route.host} · ${route.engine}`)),
        h('dl', null,
          h('div', null, h('dt', null, 'Complete'), h('dd', null, `${route.completeSeconds.toFixed(3)}s`)),
          h('div', null, h('dt', null, 'RTF'), h('dd', null, route.rtf.toFixed(3))),
          h('div', null, h('dt', null, 'Reliability'), h('dd', null, route.timeouts ? `${route.successfulTrials}/${route.totalTrials} · ${route.timeouts} timeout` : `${route.successfulTrials}/${route.totalTrials}`)),
        ),
      ))),
      h('div', { className: 'acc-prototype-note acc-voice-warning' }, snapshot.reliabilityNote),
    );
  }

  function TrustStrip({ openEvidence }) {
    const sources = getSourceTrust();
    const invalid = sources.filter((source) => source.invalidatesClaims);
    return h('section', { className: 'acc-trust', 'aria-labelledby': 'acc-trust-title' },
      h('div', { className: 'acc-trust__copy' },
        h('div', { className: 'acc-trust__title-row' },
          h('h2', { id: 'acc-trust-title' }, invalid.length ? 'Source confidence degraded' : 'Sources verified'),
          h(Badge, { tone: invalid.length ? 'warn' : 'good' }, `${sources.length - invalid.length}/${sources.length} claim-safe`),
        ),
        h('p', null, invalid.length
          ? 'Availability and publication claims are withheld where authority is stale or missing.'
          : 'All displayed claims are backed by current authoritative sources.'),
      ),
      h('div', { className: 'acc-trust__sources' }, sources.map((source) =>
        h('button', {
          type: 'button', className: 'acc-source-chip', key: source.id,
          title: `${source.authority}. ${source.freshness}`,
          onClick: openEvidence,
        }, h(StatusBadge, { state: source.state }), h('span', null, source.label)),
      )),
    );
  }

  function ProviderUsageWindow({ window }) {
    const availablePercent = Math.round(100 - window.usedPercent);
    const countText = Number.isInteger(window.remaining) && Number.isInteger(window.limit)
      ? `${window.remaining.toLocaleString()} of ${window.limit.toLocaleString()} searches available`
      : null;
    const availabilityText = countText || `${availablePercent}% available`;
    const resetText = new Date(window.resetsAt).toLocaleString();
    const resetLabel = window.resetKind === 'estimated_window_end' ? `Estimated reset by ${resetText}` : `Resets ${resetText}`;
    return h('div', { className: 'acc-provider-window', key: window.id },
      h('dt', null, window.label),
      h('dd', null,
        h('div', { className: 'acc-provider-window__usage' }, availabilityText),
        h('div', {
          className: 'acc-provider-window__track',
          role: 'progressbar',
          'aria-label': `${window.label} availability`,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': availablePercent,
          'aria-valuetext': availabilityText,
        }, h('span', { style: { width: `${availablePercent}%` } })),
        h('small', { className: 'acc-provider-window__reset' }, resetLabel),
      ),
    );
  }

  function CodexResetCredits({ resetCredits }) {
    if (!resetCredits?.availableCount) return null;
    return h('section', { className: 'acc-codex-resets', 'aria-labelledby': 'acc-codex-resets-title' },
      h('div', { className: 'acc-codex-resets__head' },
        h('h4', { id: 'acc-codex-resets-title' }, 'Usage limit resets'),
        h('span', { className: 'acc-codex-resets__count' }, `${resetCredits.availableCount} available`),
      ),
      h('ul', null, resetCredits.credits.map((credit, index) => h('li', { key: `${credit.expiresAt}-${index}` },
        h('div', null, h('strong', null, 'Full reset'), h('small', null, `Expires ${new Date(credit.expiresAt).toLocaleDateString()}`)),
        h('span', { className: 'acc-codex-resets__status' }, 'Available'),
      ))),
    );
  }

  function ProviderUsageSync({ record }) {
    if (record.observedAt && ['fresh', 'stale', 'expired'].includes(record.state)) {
      return h('small', { className: 'acc-provider-sync' }, `Last observed ${new Date(record.observedAt).toLocaleString()}`);
    }
    return h(StatusBadge, { state: record.state });
  }

  function ProviderUsage({ snapshot, go, compact = false }) {
    const records = snapshot?.providers || providerUsageFallback().providers;
    const groups = [
      { id: 'frontier', label: 'Frontier subscriptions', records: records.filter((record) => record.metricClass === 'subscription_quota') },
      { id: 'search', label: 'Search infrastructure', records: records.filter((record) => record.metricClass === 'search_api_quota') },
    ].filter((group) => group.records.length);
    const renderCard = (record) => h('article', { key: record.provider, className: 'acc-provider-card', 'data-provider': record.provider },
      h('div', { className: 'acc-provider-card__head' }, h('strong', null, record.product), h(ProviderUsageSync, { record })),
      h('small', null, record.authority),
      record.provider === 'claude' ? h('small', { className: 'acc-provider-activity-note' }, 'Genuine activity updates immediately; guarded /usage refresh also runs when a reported window resets or after 12 hours.') : null,
      record.provider === 'brave-search' ? h('small', { className: 'acc-provider-activity-note' }, `${record.rateLimitPerSecond} request/second · Quota refresh uses one successful search and runs at most daily.`) : null,
      record.state === 'expired' ? h('p', { className: 'acc-provider-empty' }, 'Expired — reported reset time has passed; showing the last known observation.') : null,
      record.windows.length
        ? h('dl', { className: 'acc-provider-windows' }, record.windows.map((window) => h(ProviderUsageWindow, { key: window.id, window })))
        : h('p', { className: 'acc-provider-empty' }, record.state === 'unsupported' ? 'Unsupported — no supported API' : record.state === 'not_configured' ? 'Not configured — awaiting a validated observation' : record.state === 'error' || record.state === 'auth_error' ? 'Unavailable — provider observation failed; no usage is shown' : record.state === 'stale' ? 'Stale — collector observation exceeded its freshness window' : 'Unknown — no validated observation'),
      record.provider === 'codex' ? h(CodexResetCredits, { resetCredits: record.resetCredits }) : null,
      h('small', { className: 'acc-provider-meta' }, record.collectionMode),
    );
    return h('section', { className: cx('acc-section', 'acc-provider-usage'), 'aria-labelledby': 'acc-provider-usage-title' },
      h(SectionHeading, {
        eyebrow: 'Authoritative usage headroom', title: compact ? 'Provider usage' : 'Usage & limits',
        action: compact ? h('button', { type: 'button', className: 'acc-secondary-button', onClick: () => go({ view: 'analytics', domain: 'ai', subject: 'provider-usage' }) }, 'Open details') : null,
      }),
      h('p', { className: 'acc-lede' }, 'Frontier subscriptions and service quotas stay separate. Unavailable data is never shown as zero.'),
      groups.map((group) => h('section', { key: group.id, className: cx('acc-provider-group', `acc-provider-group--${group.id}`), 'aria-labelledby': `acc-provider-group-${group.id}` },
        h('div', { className: 'acc-provider-group__head' },
          h('h3', { id: `acc-provider-group-${group.id}` }, group.label),
          h('small', null, group.id === 'frontier' ? 'Model and coding-agent plan windows' : 'Independent API request quota'),
        ),
        h('div', { className: 'acc-provider-grid' }, group.records.map(renderCard)),
      )),
      h('p', { className: 'acc-prototype-note' }, snapshot?.generatedAt ? `Sanitized snapshot generated ${new Date(snapshot.generatedAt).toLocaleString()}. No billing, prompts, account identity, or local activity is included.` : 'No validated snapshot loaded.'),
    );
  }

  function Overview({ go, providerUsage }) {
    const leaders = ['tool-use', 'reasoning', 'coding'].map((domain) => ({
      domain,
      row: getLeaderboard(domain)[0],
    }));
    const pending = fixtures.evaluations.filter((evaluation) => evaluation.stage === 'Running' || evaluation.stage === 'Verifying');
    const durableProducts = ['autobot-command-center', 'jarvis', 'model-serving', 'benchmark-program']
      .map((id) => fixtures.products.find((product) => product.id === id))
      .filter(Boolean);
    return h('div', { className: 'acc-view acc-overview' },
      h('section', { className: 'acc-section' },
        h(SectionHeading, { eyebrow: 'Changed outcomes', title: 'Recently landed' }),
        h('div', { className: 'acc-feature-grid' },
          h('article', { className: 'acc-feature-card acc-feature-card--hero' },
            h(Badge, { tone: 'good' }, 'Verified outcome'),
            h('h3', null, 'Condition-aware benchmark lineage'),
            h('p', null, 'Canonical scores now resolve to an exact tested condition, frozen release, and supporting run evidence.'),
            h('button', { type: 'button', className: 'acc-link-button', onClick: () => go({ view: 'benchmarks' }) }, 'Inspect benchmark evidence'),
          ),
          h('article', { className: 'acc-feature-card' },
            h(Badge, null, 'Product milestone'),
            h('h3', null, 'Voice Lab acceptance envelope'),
            h('p', null, 'The reusable voice core has a defined acceptance owner and rejects non-speech inputs.'),
            h('button', { type: 'button', className: 'acc-link-button', onClick: () => go({ view: 'portfolio', product: 'voice-lab' }) }, 'Open Voice Lab'),
          ),
        ),
      ),
      h(ProviderUsage, { snapshot: providerUsage, go, compact: true }),
      h('section', { className: 'acc-section' },
        h(SectionHeading, { eyebrow: 'Durable objects', title: 'Durable capabilities' }),
        h('div', { className: 'acc-card-grid' }, durableProducts.map((product) => {
          const claims = getEffectiveProductClaims(product);
          return h('button', { key: product.id, type: 'button', className: 'acc-object-card', onClick: () => go({ view: 'portfolio', product: product.id }) },
            h('span', { className: 'acc-object-card__top' }, h(Badge, null, product.kind), h(StatusBadge, { state: claims.state.toLowerCase() })),
            h('strong', null, product.name),
            h('span', null, product.outcome),
            h('small', null, `Verified ${product.verified} · ${product.source}`),
          );
        })),
      ),
      h('section', { className: 'acc-section' },
        h(SectionHeading, { eyebrow: 'Separate capability areas', title: 'Model leaders' }),
        h('div', { className: 'acc-leader-grid' }, leaders.map(({ domain, row }) =>
          h('button', { key: domain, type: 'button', className: 'acc-leader-card', onClick: () => go({ view: 'benchmarks', domain, condition: row.conditionId }) },
            h('span', { className: 'acc-leader-card__domain' }, domain === 'tool-use' ? 'Tool use' : domain === 'reasoning' ? 'GPQA Diamond' : 'Offline-safe coding'),
            h('strong', null, row.condition.shortName),
            h('span', { className: 'acc-score' }, `${row.score.toFixed(1)}%`),
            h('small', null, `${row.release} · n=${row.denominator}`),
          ),
        )),
      ),
      h('section', { className: 'acc-section' },
        h(SectionHeading, { eyebrow: 'Named decisions only', title: 'Decision pending' }),
        h('div', { className: 'acc-evaluation-list' }, pending.map((evaluation) =>
          h('button', { key: evaluation.id, type: 'button', className: 'acc-evaluation-row', onClick: () => go({ view: 'evidence', evaluation: evaluation.id }) },
            h('span', null, h(StatusBadge, { state: evaluation.findingStatus }), h('strong', null, evaluation.title), h('small', null, evaluation.question)),
            h(Meter, { value: evaluation.progress, label: evaluation.title }),
          ),
        )),
      ),
    );
  }

  function Portfolio({ route, go }) {
    const product = route.product ? fixtures.products.find((item) => item.id === route.product) : null;
    if (product) {
      const evaluations = product.evaluations.map((id) => fixtures.evaluations.find((item) => item.id === id)).filter(Boolean);
      const claims = getEffectiveProductClaims(product);
      return h('div', { className: 'acc-view' },
        h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'portfolio' }) }, '← Portfolio'),
        h('article', { className: 'acc-detail' },
          h('div', { className: 'acc-detail__hero' },
            h('div', null, h('p', { className: 'acc-eyebrow' }, product.kind), h('h2', null, product.name), h('p', { className: 'acc-lede' }, product.value)),
            h(StatusBadge, { state: claims.state.toLowerCase() }),
          ),
          h('div', { className: 'acc-detail-grid' },
            claims.worksNow
              ? h('section', null, h('h3', null, 'What works now'), h('ul', null, claims.worksNow.map((item) => h('li', { key: item }, item))))
              : h('section', null, h('h3', null, 'Current availability'), h('p', null, 'Unknown — runtime telemetry is stale')),
            h('section', null, h('h3', null, 'Operating limitation'), h('p', null, product.limitation)),
            h('section', null, h('h3', null, 'Evidence'), h('ul', null, product.evidence.map((item) => h('li', { key: item }, item)))),
            h('section', null, h('h3', null, 'Authority'), h('p', null, `${product.source} · last verified ${product.verified}`)),
          ),
          product.id === 'voice-lab' ? h(VoicePerformance, { comparisonId: fixtures.voicePerformance.id }) : null,
          h('section', { className: 'acc-related' },
            h('h3', null, 'Evaluation timeline'),
            evaluations.length ? evaluations.map((evaluation) => h('button', { key: evaluation.id, type: 'button', className: 'acc-evaluation-row', onClick: () => go({ view: 'evidence', evaluation: evaluation.id }) },
              h('span', null, h(StatusBadge, { state: evaluation.findingStatus }), h('strong', null, evaluation.title), h('small', null, evaluation.finding)),
            )) : h(EmptyUnknown, { children: 'No evaluation record attached' }),
          ),
        ),
      );
    }
    const portfolioGroups = [
      { id: 'products', eyebrow: 'Built experiences', title: 'Products', items: fixtures.products.filter((item) => item.kind === 'Product') },
      { id: 'capabilities', eyebrow: 'Reusable foundations', title: 'Capabilities', items: fixtures.products.filter((item) => item.kind === 'Capability') },
    ];
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Products and capabilities', title: 'Portfolio' }),
      h('p', { className: 'acc-lede' }, 'A curated map of durable products and reusable capabilities. Each card leads with the outcome, its operating boundary, and named evidence.'),
      h('div', { className: 'acc-registry-summary', 'aria-label': 'Portfolio summary' },
        h('div', null, h('strong', null, fixtures.products.length), h('span', null, 'Durable entries')),
        h('div', null, h('strong', null, portfolioGroups[0].items.length), h('span', null, 'Products')),
        h('div', null, h('strong', null, portfolioGroups[1].items.length), h('span', null, 'Capabilities')),
      ),
      portfolioGroups.map((group) => h('section', { className: 'acc-portfolio-group', key: group.id, 'aria-labelledby': `acc-${group.id}-title` },
        h('div', { className: 'acc-section-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, group.eyebrow), h('h3', { id: `acc-${group.id}-title` }, group.title))),
        h('div', { className: 'acc-portfolio-grid' }, group.items.map((item) => {
          const claims = getEffectiveProductClaims(item);
          return h('button', { key: item.id, type: 'button', className: 'acc-portfolio-card', onClick: () => go({ view: 'portfolio', product: item.id }) },
            h('span', { className: 'acc-object-card__top' }, h(Badge, null, item.kind), h(StatusBadge, { state: claims.state.toLowerCase() })),
            h('h3', null, item.name), h('p', null, item.value),
            h('div', { className: 'acc-callout' }, h('span', null, 'Landed outcome'), h('strong', null, item.outcome)),
            h('small', null, `${item.source} · verified ${item.verified}`),
          );
        })),
      )),
    );
  }

  function MetricTabs({ active, onSelect }) {
    const labels = { rollup: 'Capability rollup', 'tool-use': 'Tool Use', reasoning: 'GPQA Diamond', coding: 'Coding' };
    return h('div', { className: 'acc-metric-tabs', role: 'group', 'aria-label': 'Benchmark domain' },
      Object.entries(labels).map(([id, label]) => h('button', {
        key: id, type: 'button', className: cx('acc-tab-button', active === id && 'is-active'),
        'aria-pressed': active === id, onClick: () => onSelect(id),
      }, label)),
    );
  }

  function CapabilityBar({ row, rank, domains, partial = false }) {
    const coverageLabel = partial
      ? `${row.coverage}/${row.totalDomains} domains · not ranked with complete coverage`
      : `${row.coverage}/${row.totalDomains} domains`;
    const indexLabel = row.index == null ? 'Unknown' : row.index.toFixed(1);
    return h('article', { className: cx('acc-capability-row', partial && 'is-partial') },
      h('div', { className: 'acc-capability-row__identity' },
        h('span', { className: 'acc-rank' }, partial ? 'Partial' : `#${rank}`),
        h('div', null, h('strong', null, row.condition.shortName), h('small', null, `${row.condition.provider} · ${row.condition.runtime}`)),
      ),
      h('div', { className: 'acc-capability-row__plot' },
        h('div', { className: 'acc-capability-track', role: 'img', 'aria-label': `${row.condition.shortName} capability index ${indexLabel} from ${coverageLabel}` },
          h('span', { style: { width: `${row.index ?? 0}%` } }),
        ),
        h('div', { className: 'acc-capability-row__score' }, h('strong', null, indexLabel), h('small', null, coverageLabel)),
      ),
      h('div', { className: 'acc-capability-domains' }, domains.map((domain) =>
        h('span', { key: domain.id }, h('small', null, domain.label), h('strong', null, row.domainScores[domain.id] == null ? 'Unknown' : `${row.domainScores[domain.id].toFixed(1)}%`)),
      )),
    );
  }

  function CapabilityRollup() {
    const rollup = getCapabilityRollup();
    return h('div', { className: 'acc-rollup' },
      h('section', { className: 'acc-rollup-method', 'aria-label': 'Capability index method' },
        h('strong', null, 'Capability index'),
        h('p', null, 'For each exact release: condition score ÷ best observed canonical score. The index is the equal-weight average across represented domains.'),
        h('p', null, 'Missing evidence is Unknown, never zero.'),
        h('p', null, 'Evidence-relative only — not universal capability, readiness, availability, or future performance.'),
      ),
      h('section', { className: 'acc-rollup-group', role: 'region', 'aria-label': 'Comparable rollup' },
        h('div', { className: 'acc-ranking-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Complete benchmark set'), h('h2', null, 'Comparable rollup')), h('small', null, `${rollup.domains.length}/${rollup.domains.length} current domains required`)),
        h('div', { className: 'acc-capability-list' }, rollup.complete.map((row, index) => h(CapabilityBar, { key: row.condition.id, row, rank: index + 1, domains: rollup.domains }))),
      ),
      h('section', { className: 'acc-rollup-group', role: 'region', 'aria-label': 'Partial evidence' },
        h('div', { className: 'acc-ranking-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Coverage gap'), h('h2', null, 'Partial evidence')), h('small', null, 'Observed-domain index only · not cross-ranked')),
        h('div', { className: 'acc-capability-list' }, rollup.partial.map((row) => h(CapabilityBar, { key: row.condition.id, row, domains: rollup.domains, partial: true }))),
      ),
    );
  }

  function ThreeScoreValue({ score }) {
    const label = score.value == null ? 'Pending' : score.value.toFixed(1);
    return h('span', { className: cx('acc-three-score__value', score.value == null && 'is-pending') },
      h('strong', null, label), h('small', null, score.benchmark),
    );
  }

  function ThreeScoreComparison({ go }) {
    const profiles = getBenchmarkComparison();
    const measuredCount = profiles.filter((profile) => profile.evidence === 'measured').length;
    const illustrativeCount = profiles.length - measuredCount;
    return h('section', { className: 'acc-three-score', role: 'region', 'aria-label': 'Three-score model comparison' },
      h('div', { className: 'acc-three-score__head' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, `${profiles.length} tested conditions at a glance`), h('h2', null, 'Three-score model comparison')),
        h('div', { className: 'acc-chip-list' }, h(Badge, { tone: 'good' }, `${measuredCount} measured`), h(Badge, null, `${illustrativeCount} illustrative`)),
      ),
      h('div', { className: 'acc-three-score__legend', 'aria-hidden': 'true' },
        h('span', null, 'Tested condition'), h('span', null, 'Instruction following'), h('span', null, 'Native tool use'), h('span', null, 'Multi-turn agent'), h('span', null, 'Evidence'),
      ),
      h('div', { className: 'acc-three-score__rows' }, profiles.map((profile) => {
        const condition = profile.condition;
        return h('article', { className: cx('acc-three-score__row', profile.evidence === 'measured' && 'is-measured'), key: profile.conditionId, 'data-benchmark-profile': profile.conditionId },
          h('div', { className: 'acc-three-score__identity' },
            h('button', { type: 'button', className: 'acc-table-link', onClick: () => go({ view: 'benchmarks', condition: profile.conditionId }) }, condition.shortName),
            h('small', null, `${condition.provider} · ${condition.runtime}`),
          ),
          h(ThreeScoreValue, { score: profile.scores.instruction }),
          h(ThreeScoreValue, { score: profile.scores.tools }),
          h(ThreeScoreValue, { score: profile.scores.agent }),
          h('div', { className: 'acc-three-score__evidence' },
            profile.evidence === 'measured' ? h(Badge, { tone: 'good' }, 'Measured') : h(Badge, null, 'Illustrative'),
            h('small', null, profile.evidence === 'measured' ? `${Object.values(profile.scores).filter((score) => score.evidence === 'verified').length} verified` : 'Layout fixture'),
          ),
        );
      })),
      h('div', { className: 'acc-prototype-note' }, 'Luna’s and Sol’s three suites are final-verified. Qwen 3.8 2B has a final-verified IFEval score reproduced exactly across two runs; BFCL and tau2 remain Pending and are not treated as zero. The remaining four conditions and all of their scores are explicitly illustrative Dev fixtures.'),
    );
  }

  function formatTokenCount(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  }

  function formatDuration(seconds) {
    if (seconds >= 3600) return `${(seconds / 3600).toFixed(2)}h`;
    if (seconds >= 60) return `${(seconds / 60).toFixed(2)}m`;
    return `${seconds.toFixed(2)}s`;
  }

  function OperationalBenchmarkFootprint({ operational }) {
    if (!operational) return null;
    const usage = operational.candidateUsage;
    const performance = operational.performance;
    const billing = operational.billing;
    const unavailable = 'Not separately reported';
    const evidenceLabel = operational.evidence === 'verified-repeat' ? 'Verified repeat' : 'Verified aggregate';
    const runtimeLabels = {
      host: 'Host', backend: 'Backend', modelRevision: 'Model revision', quantization: 'Quantization', context: 'Context', outputCap: 'Output cap',
      slots: 'Slots', concurrency: 'Concurrency', retries: 'Retries', thinking: 'Thinking', streaming: 'Streaming',
    };
    const accountingNote = billing
      ? `${billing.subscriptionAttribution}. API-equivalent pricing: ${operational.pricing.candidateRates}; fixed judge ${operational.pricing.judgeRates}. ${operational.pricing.assumption}; cached-input and hidden-reasoning splits were not retained. ${operational.pricing.longContextRequests} requests crossed the long-context surcharge threshold. ${operational.pricing.source}.`
      : operational.methodNote;
    return h('section', { className: 'acc-operational', role: 'region', 'aria-label': 'Operational benchmark footprint' },
      h('div', { className: 'acc-ranking-heading' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Retained aggregate evidence'), h('h3', null, 'Operational footprint')),
        h(Badge, { tone: 'good' }, evidenceLabel),
      ),
      h('div', { className: 'acc-operational-grid' },
        h('article', { className: 'acc-operational-card' },
          h('h4', null, 'Candidate model usage'),
          h('dl', null,
            [
              ['Input tokens', formatTokenCount(usage.inputTokens)], ['Output tokens', formatTokenCount(usage.outputTokens)], ['Total tokens', formatTokenCount(usage.totalTokens)],
              ['Cached input', usage.cachedInputTokens == null ? unavailable : formatTokenCount(usage.cachedInputTokens)], ['Reasoning tokens', usage.reasoningTokens == null ? unavailable : formatTokenCount(usage.reasoningTokens)],
              usage.basis ? ['Usage basis', usage.basis] : null,
            ].filter(Boolean).map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value))),
          ),
        ),
        performance ? h('article', { className: 'acc-operational-card' },
          h('h4', null, performance.class === 'local-runtime' ? 'Local runtime performance' : 'Frontier route performance'),
          h('dl', null,
            [
              ['Successful responses', performance.successfulResponses.toLocaleString()], ['Bridge non-OK events', performance.bridgeErrorEvents.toLocaleString()],
              ['Latency median', `${performance.latencySeconds.median.toFixed(2)}s`], ['Latency mean', `${performance.latencySeconds.mean.toFixed(2)}s`],
              ['Latency p95', `${performance.latencySeconds.p95.toFixed(2)}s`], ['Latency maximum', `${performance.latencySeconds.maximum.toFixed(2)}s`],
              ['Summed successful wall time', formatDuration(performance.latencySeconds.total)], ['End-to-end output throughput', `${performance.endToEndOutputTokensPerSecond.toFixed(2)} tok/s`],
            ].map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value))),
          ),
        ) : null,
        billing ? h('article', { className: 'acc-operational-card' },
          h('h4', null, 'Actual vs API equivalent'),
          h('dl', null,
            h('div', null, h('dt', null, 'Marginal API charge'), h('dd', null, `$${billing.marginalApiChargeUsd}`)),
            h('div', null, h('dt', null, 'API-equivalent estimate (not billed)'), h('dd', null, `$${billing.candidateApiEquivalentUsd.toFixed(2)}`)),
            h('div', null, h('dt', null, 'Fixed judge estimate'), h('dd', null, `$${billing.judgeApiEquivalentUsd.toFixed(2)}`)),
            h('div', null, h('dt', null, 'Fixed judge tokens'), h('dd', null, operational.judgeUsage.totalTokens.toLocaleString())),
            h('div', null, h('dt', null, 'Collection route'), h('dd', null, billing.route)),
            h('div', null, h('dt', null, 'Existing subscription'), h('dd', null, `$${billing.monthlySubscriptionUsd}/mo · unallocated`)),
          ),
        ) : null,
        operational.localRuntime ? h('article', { className: 'acc-operational-card' },
          h('h4', null, 'Local tested condition'),
          h('dl', null, Object.entries(operational.localRuntime).map(([key, value]) => h('div', { key }, h('dt', null, runtimeLabels[key] || key), h('dd', null, String(value))))),
        ) : null,
        h('article', { className: 'acc-operational-card acc-operational-card--outcomes' },
          h('h4', null, 'Observed misses and failures'),
          h('dl', null, operational.outcomes.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
        ),
      ),
      performance ? h('div', { className: 'acc-prototype-note' }, `${performance.measurementBoundary}. ${performance.variability}`) : null,
      accountingNote ? h('div', { className: 'acc-prototype-note' }, accountingNote) : null,
    );
  }

  function BenchmarkProfileSummary({ profile }) {
    if (!profile) return null;
    const suiteOrder = ['instruction', 'tools', 'agent'];
    return h('section', { className: 'acc-core-score-detail', 'aria-labelledby': 'acc-core-score-title' },
      h('div', { className: 'acc-ranking-heading' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, 'Benchmark standard'), h('h3', { id: 'acc-core-score-title' }, 'Three core scores')),
        profile.evidence === 'measured' ? h(Badge, { tone: 'good' }, 'Measured evidence') : h(Badge, null, 'Illustrative fixture'),
      ),
      h('div', { className: 'acc-core-score-grid' }, suiteOrder.map((suiteId) => {
        const score = profile.scores[suiteId];
        return h('article', { className: cx('acc-core-score-card', score.value == null && 'is-pending'), key: suiteId },
          h('div', { className: 'acc-core-score-card__head' },
            h('div', null, h('span', null, score.label), h('small', null, score.benchmark)), h(StatusBadge, { state: score.evidence }),
          ),
          h('strong', { className: 'acc-core-score-card__value' }, score.value == null ? 'Pending' : score.value.toFixed(1)),
          h('small', { className: 'acc-core-score-card__denominator' }, score.denominator),
          score.detail.length ? h('dl', null, score.detail.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))) : null,
        );
      })),
      h('div', { className: 'acc-prototype-note' }, profile.note),
    );
  }

  function RunDetail({ run, result, go, conditionId, domain }) {
    const fields = [
      ['Canonical result', result.id], ['Benchmark domain', result.domain], ['Benchmark release', result.release],
      ['Frozen manifest', run.manifest], ['Calls', run.calls.toLocaleString()], ['Failures / invalids', run.failures.toLocaleString()],
      ['Input tokens', run.inputTokens.toLocaleString()], ['Output tokens', run.outputTokens.toLocaleString()],
      ['Reasoning tokens', run.reasoningTokens == null ? 'Not reported' : run.reasoningTokens.toLocaleString()],
      ['Summed request wall', run.wall], ['Cost', run.cost], ['Source class', run.source],
    ];
    return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'benchmarks', domain, condition: conditionId }) }, '← Tested condition'),
      h('article', { className: 'acc-detail' },
        h('p', { className: 'acc-eyebrow' }, 'Frozen artifact lineage'),
        h('h2', null, 'Run evidence'),
        h('p', { className: 'acc-lede' }, run.label),
        h('dl', { className: 'acc-fact-grid' }, fields.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
        h('div', { className: 'acc-prototype-note' }, 'Prototype fixture values are interaction test data, not canonical benchmark claims.'),
      ),
    );
  }

  function ConditionDetail({ condition, route, go, domain }) {
    const family = getFamily(condition.familyId);
    const benchmarkProfile = getBenchmarkComparison(condition.id);
    const availability = getEffectiveAvailability(condition);
    if (route.run) {
      const lineage = getRunLineage({
        conditionId: condition.id,
        resultId: route.result,
        domain: route.domain,
        release: route.release,
        runId: route.run,
      });
      return lineage
        ? h(RunDetail, { run: lineage.run, result: lineage.result, go, conditionId: condition.id, domain })
        : h('div', { className: 'acc-view' },
          h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'benchmarks', domain, condition: condition.id }) }, '← Tested condition'),
          h('section', { className: 'acc-boundary', role: 'status' }, h('h2', null, 'Run unavailable for selected condition'), h('p', null, 'The requested evidence does not match this condition, result, benchmark domain, and release. No mismatched run evidence is displayed.')),
        );
    }
    const fields = [
      ['Publisher / family', `${family.publisher} · ${family.name}`], ['Provider / runtime', `${condition.provider} · ${condition.runtime}`],
      ['Host', condition.host], ['Quantization', condition.quantization], ['Reasoning', condition.reasoning],
      ['Context', condition.context], ['Output envelope', condition.output], ['Current availability', availability === 'unknown' ? 'Unknown — runtime telemetry is not claim-safe' : condition.availabilityNote],
    ];
    return h('div', { className: 'acc-view' },
      h('button', { type: 'button', className: 'acc-back', onClick: () => go(benchmarkProfile ? { view: 'benchmarks' } : { view: 'benchmarks', domain }) }, '← Benchmarks'),
      h('article', { className: 'acc-detail' },
        h('div', { className: 'acc-detail__hero' },
          h('div', null, h('p', { className: 'acc-eyebrow' }, 'Exact tested condition'), h('h2', null, condition.shortName), h('p', { className: 'acc-lede' }, family.roles.join(' · '))),
          h(Badge, { tone: availability === 'unknown' ? 'warn' : availability === 'available' ? 'good' : 'bad' }, `Availability ${availability}`),
        ),
        h('section', { className: 'acc-fingerprint' }, h('span', null, 'Condition fingerprint'), h('code', null, condition.fingerprint)),
        h(BenchmarkProfileSummary, { profile: benchmarkProfile }),
        h(OperationalBenchmarkFootprint, { operational: benchmarkProfile?.operational }),
        h('dl', { className: 'acc-fact-grid' }, fields.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
        condition.results.some((result) => result.status === 'canonical') ? h('section', { className: 'acc-related' },
          h('h3', null, 'Canonical results and run lineage'),
          condition.results.filter((result) => result.status === 'canonical').map((result) =>
            h('article', { className: 'acc-result-line', key: result.id },
              h('div', null, h(StatusBadge, { state: result.status }), h('strong', null, `${result.domain} · ${result.score.toFixed(1)}%`), h('small', null, `${result.release} · n=${result.denominator}`)),
              h('button', { type: 'button', className: 'acc-secondary-button', 'aria-label': `Open run evidence for ${result.domain} ${result.release}`, onClick: () => go({ view: 'benchmarks', domain: result.domain, condition: condition.id, result: result.id, release: result.release, run: result.runIds[0] }) }, 'Open run evidence'),
            ),
          ),
        ) : null,
      ),
    );
  }

  function Benchmarks({ route, go }) {
    const isRollup = route.domain === 'rollup';
    const domain = Object.hasOwn(RELEASES, route.domain) ? route.domain : 'tool-use';
    const condition = !isRollup && route.condition ? getCondition(route.condition) : null;
    if (condition) return h(ConditionDetail, { condition, route, go, domain });
    if (!route.domain) return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Model Observatory', title: 'Benchmarks' }),
      h('p', { className: 'acc-lede' }, 'Compare every tested model through the same three operational scores, then open a condition for suite-level evidence and caveats.'),
      h('div', { className: 'acc-toolbar' }, h(MetricTabs, { active: 'comparison', onSelect: (nextDomain) => go({ view: 'benchmarks', domain: nextDomain }) }), h(Badge, { tone: 'warn' }, 'Dev draft')),
      h(ThreeScoreComparison, { go }),
    );
    if (isRollup) return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Model Observatory', title: 'Benchmarks' }),
      h('p', { className: 'acc-lede' }, 'Capability rollup is normalized within exact frozen releases. Complete and partial benchmark coverage are never cross-ranked.'),
      h('div', { className: 'acc-toolbar' }, h(MetricTabs, { active: 'rollup', onSelect: (nextDomain) => go({ view: 'benchmarks', domain: nextDomain }) }), h(Badge, null, 'Canonical only')),
      h(CapabilityRollup),
    );
    const rows = getLeaderboard(domain, RELEASES[domain]);
    const title = domain === 'tool-use' ? 'Tool Use' : domain === 'reasoning' ? 'GPQA Diamond' : 'Offline-safe Coding';
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Model Observatory', title: 'Benchmarks' }),
      h('p', { className: 'acc-lede' }, 'Rankings are exact tested conditions within one frozen benchmark release. No universal aggregate score.'),
      h('div', { className: 'acc-toolbar' }, h(MetricTabs, { active: domain, onSelect: (nextDomain) => go({ view: 'benchmarks', domain: nextDomain }) }), h(Badge, null, RELEASES[domain])),
      h('section', { className: 'acc-ranking-panel', 'aria-labelledby': 'acc-ranking-title' },
        h('div', { className: 'acc-ranking-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Canonical ranking'), h('h2', { id: 'acc-ranking-title' }, title)), h('small', null, 'Higher is better · fixture data')),
        h('div', { className: 'acc-desktop-table' },
          h('table', null,
            h('thead', null, h('tr', null, ['Rank', 'Tested condition', 'Score', 'Denominator', 'Release', 'Availability'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, rows.map((row, index) => h('tr', { key: row.id },
              h('td', null, `#${index + 1}`),
              h('td', null, h('button', { type: 'button', className: 'acc-table-link', onClick: () => go({ view: 'benchmarks', domain, condition: row.conditionId }) }, row.condition.shortName)),
              h('td', { className: 'acc-score-cell' }, `${row.score.toFixed(1)}%`), h('td', null, row.denominator), h('td', null, row.release),
              h('td', null, h(StatusBadge, { state: getEffectiveAvailability(row.condition) })),
            ))),
          ),
        ),
        h('div', { className: 'acc-mobile-ranking' }, rows.map((row, index) =>
          h('button', { type: 'button', key: row.id, className: 'acc-mobile-row', onClick: () => go({ view: 'benchmarks', domain, condition: row.conditionId }) },
            h('span', { className: 'acc-rank' }, `#${index + 1}`),
            h('span', { className: 'acc-mobile-row__identity' }, h('strong', null, row.condition.shortName), h('small', null, `${row.release} · n=${row.denominator}`)),
            h('span', { className: 'acc-score' }, `${row.score.toFixed(1)}%`),
          ),
        )),
      ),
      h('section', { className: 'acc-section acc-boundary' },
        h('h2', null, 'Comparability boundary'),
        h('p', null, 'Provisional results and foreign releases are retained in lineage but excluded from this ranking. Current availability is displayed separately from tested performance and withheld when runtime authority is not claim-safe.'),
      ),
    );
  }

  function Skills({ route, go }) {
    const skill = route.skill ? fixtures.skills.find((item) => item.id === route.skill) : null;
    if (skill) {
      const claims = getEffectiveSkillClaims(skill);
      const fields = [['Purpose', skill.purpose], ['Provenance', skill.provenance], ['Stewardship', claims.stewardship], ['Publication', claims.publication], ['Validation', `${skill.validation} · ${skill.lastValidated}`], ['Operating envelope', skill.envelope], ['Metadata source', skill.repo]];
      return h('div', { className: 'acc-view' },
        h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'skills' }) }, '← Skill Registry'),
        h('article', { className: 'acc-detail' }, h('p', { className: 'acc-eyebrow' }, skill.category), h('h2', null, skill.name),
          h('dl', { className: 'acc-fact-grid' }, fields.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
          h('a', { className: 'acc-primary-link', href: window.__HERMES_SKILLS_URL__ || '/skills' }, 'Manage in Hermes Skills'),
        ),
      );
    }
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Durable reusable artifacts', title: 'Skill Registry' }),
      h('p', { className: 'acc-lede' }, 'A curated projection of authored or materially maintained skills that encode repeatable delivery knowledge. Enable, edit, install, and full inventory actions stay in Hermes.'),
      h('div', { className: 'acc-registry-summary', 'aria-label': 'Skill registry summary' },
        h('div', null, h('strong', null, fixtures.skills.length), h('span', null, 'Curated skills')),
        h('div', null, h('strong', null, fixtures.skills.filter((item) => item.validation === 'validated').length), h('span', null, 'Validated')),
        h('div', null, h('strong', null, new Set(fixtures.skills.map((item) => item.category)).size), h('span', null, 'Domains')),
      ),
      h('div', { className: 'acc-skill-list' }, fixtures.skills.map((item) => {
        const claims = getEffectiveSkillClaims(item);
        return h('button', { type: 'button', key: item.id, className: 'acc-skill-row', onClick: () => go({ view: 'skills', skill: item.id }) },
          h('span', { className: 'acc-skill-row__identity' }, h('small', null, item.category), h('strong', null, item.name), h('span', { className: 'acc-skill-row__purpose' }, item.purpose)),
          h('span', { className: 'acc-skill-row__states' },
            h(Badge, null, item.provenance),
            h(StatusBadge, { state: item.validation }),
            claims.publication === 'unknown' ? null : h(StatusBadge, { state: claims.publication }),
          ),
        );
      })),
      h('div', { className: 'acc-prototype-note' }, 'This curated prototype snapshot is derived from selected local SKILL.md metadata. Publication and stewardship claims remain withheld until a canonical metadata adapter is connected.'),
    );
  }

  function Evidence({ route, go }) {
    const evaluation = route.evaluation ? fixtures.evaluations.find((item) => item.id === route.evaluation) : null;
    if (evaluation) {
      return h('div', { className: 'acc-view' },
        h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'evidence' }) }, '← Evidence index'),
        h('article', { className: 'acc-detail' },
          h('div', { className: 'acc-detail__hero' }, h('div', null, h('p', { className: 'acc-eyebrow' }, evaluation.stage), h('h2', null, evaluation.title)), h(StatusBadge, { state: evaluation.findingStatus })),
          h(Meter, { value: evaluation.progress, label: evaluation.title }),
          h('section', null, h('h3', null, 'Question'), h('p', { className: 'acc-lede' }, evaluation.question)),
          h('section', null, h('h3', null, 'Current finding'), h('p', null, evaluation.finding)),
          h('section', null, h('h3', null, 'Decision outcome'), h('p', null, evaluation.decision)),
          h('section', null, h('h3', null, 'Affected objects'), h('div', { className: 'acc-chip-list' }, evaluation.affectedObjects.map((object) => h(Badge, { key: `${object.type}-${object.id}` }, `${object.type}: ${object.label}`)))),
          evaluation.comparisonId ? h(VoicePerformance, { comparisonId: evaluation.comparisonId }) : null,
        ),
      );
    }
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Secondary cross-domain index', title: 'Evaluation evidence' }),
      h('p', { className: 'acc-lede' }, 'Questions, findings, and decisions remain attached to the durable objects they affect.'),
      h('div', { className: 'acc-evaluation-list' }, getEvaluationIndex().map((item) =>
        h('button', { type: 'button', key: item.id, className: 'acc-evaluation-row', onClick: () => go({ view: 'evidence', evaluation: item.id }) },
          h('span', null, h(StatusBadge, { state: item.findingStatus }), h('strong', null, item.title), h('small', null, item.question)),
          h(Meter, { value: item.progress, label: item.title }),
        ),
      )),
    );
  }

  function HiveMindSearch() {
    const apiBase = window.__ACC_HIVEMIND_API__ || 'http://127.0.0.1:8788';
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all');
    const [bridgeState, setBridgeState] = useState('checking');
    const [searchState, setSearchState] = useState('idle');
    const [results, setResults] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
      let active = true;
      fetch(`${apiBase}/health`, { cache: 'no-store' }).then(
        (response) => { if (active) setBridgeState(response.ok ? 'ready' : 'unavailable'); },
        () => { if (active) setBridgeState('unavailable'); },
      );
      return () => { active = false; };
    }, [apiBase]);

    async function submit(event) {
      event.preventDefault();
      const cleanQuery = query.trim();
      if (!cleanQuery) return;
      const collections = scope === 'all' ? ['wiki-hermes', 'wiki-openai'] : [scope];
      setSearchState('loading');
      setMessage('');
      setResults([]);
      try {
        const response = await fetch(`${apiBase}/search`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanQuery, collections, limit: 10 }),
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.results)) throw new Error('search unavailable');
        setResults(payload.results);
        setSearchState('done');
        setMessage(payload.results.length ? `${payload.results.length} source-linked result${payload.results.length === 1 ? '' : 's'}` : 'No approved Wiki pages matched this search.');
      } catch {
        setSearchState('error');
        setMessage('Hive Mind search is unavailable on this device. Open ACC on The Ark to use the local protected bridge.');
      }
    }

    return h('div', { className: 'acc-view acc-hivemind' },
      h(SectionHeading, {
        eyebrow: 'Live QMD retrieval',
        title: 'Search Hive Mind',
        action: h(StatusBadge, { state: bridgeState === 'ready' ? 'available' : bridgeState === 'checking' ? 'unknown' : 'unavailable' }),
      }),
      h('p', { className: 'acc-lede' }, 'Search approved current-authority pages across wiki-hermes and wiki-openai. Results are read-only evidence with source paths—not a replacement for canonical Markdown.'),
      h('form', { className: 'acc-hivemind-form', onSubmit: submit },
        h('label', { className: 'acc-field acc-field--query' },
          h('span', null, 'Search query'),
          h('input', {
            type: 'search', value: query, maxLength: 2048, autoComplete: 'off', placeholder: 'Project Grin, benchmark policy, voice decisions…',
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        h('label', { className: 'acc-field' },
          h('span', null, 'Wiki scope'),
          h('select', { value: scope, onChange: (event) => setScope(event.target.value) },
            h('option', { value: 'all' }, 'Both Wikis'),
            h('option', { value: 'wiki-hermes' }, 'wiki-hermes'),
            h('option', { value: 'wiki-openai' }, 'wiki-openai'),
          ),
        ),
        h('button', { type: 'submit', className: 'acc-primary-button', disabled: searchState === 'loading' || !query.trim() }, searchState === 'loading' ? 'Searching…' : 'Search'),
      ),
      message ? h('p', { className: cx('acc-search-status', searchState === 'error' && 'is-error'), role: 'status' }, message) : null,
      results.length ? h('section', { className: 'acc-search-results', 'aria-label': 'Hive Mind search results' }, results.map((result, index) =>
        h('article', { className: 'acc-search-result', key: `${result.file}-${result.line ?? index}` },
          h('div', { className: 'acc-search-result__heading' },
            h('div', null, h('span', { className: 'acc-rank' }, `#${index + 1}`), h('h3', null, result.title || result.file)),
            h(Badge, null, result.file.startsWith('wiki-hermes/') ? 'wiki-hermes' : 'wiki-openai'),
          ),
          h('div', { className: 'acc-search-result__source' },
            h('code', { className: 'acc-search-result__path' }, result.file),
            result.line ? h('span', null, `Line ${result.line}`) : null,
          ),
          result.snippet ? h('pre', { className: 'acc-search-result__snippet' }, result.snippet) : null,
        ),
      )) : null,
      h('div', { className: 'acc-prototype-note' }, 'This interface uses a protected server-side bridge inside The Ark Lab. QMD credentials and certificate trust never enter the browser; the ACC dev surface remains trusted-LAN only.'),
    );
  }

  function CommandCenterMark() {
    return h('img', { className: 'acc-command-mark', src: commandCenterMarkUrl, alt: '', 'aria-hidden': 'true', draggable: false });
  }

  const Analytics = createAnalyticsView({ React, h, useEffect, useState, Badge, StatusBadge, SectionHeading, ProviderUsage });

  function App() {
    const [route, setRoute] = useState(() => canonicalizeAccRoute(parseAccUrl(window.location.href)));
    const [providerUsage, setProviderUsage] = useState(() => providerUsageFallback());
    const mainRef = useRef(null);
    useEffect(() => {
      let active = true;
      loadProviderUsageSnapshot(window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist').then(
        (snapshot) => { if (active) setProviderUsage(snapshot); },
        () => { if (active) setProviderUsage(providerUsageFallback()); },
      );
      return () => { active = false; };
    }, []);
    useEffect(() => {
      const parsed = parseAccUrl(window.location.href);
      if (parsed.view === 'usage') {
        const target = canonicalizeAccRoute(parsed);
        window.history.replaceState({}, '', buildAccUrl(target, window.__ACC_BASE_PATH__ || '/autobot-command-center'));
        setRoute(target);
      }
    }, []);
    useEffect(() => {
      const onPop = () => setRoute(canonicalizeAccRoute(parseAccUrl(window.location.href)));
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);
    useEffect(() => {
      mainRef.current?.focus({ preventScroll: true });
    }, [route]);

    function go(next, replace = false) {
      const target = canonicalizeAccRoute(next);
      if (!target.view) target.view = 'overview';
      const url = buildAccUrl(target, window.__ACC_BASE_PATH__ || '/autobot-command-center');
      window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
      setRoute(target);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    const primaryView = NAV_ITEMS.some((item) => item.id === route.view) ? route.view : null;
    let content;
    if (route.view === 'portfolio') content = h(Portfolio, { route, go });
    else if (route.view === 'analytics') content = h(Analytics, { route, go, providerUsage });
    else if (route.view === 'benchmarks') content = h(Benchmarks, { route, go });
    else if (route.view === 'skills') content = h(Skills, { route, go });
    else if (route.view === 'hivemind') content = h(HiveMindSearch);
    else if (route.view === 'evidence') content = h(Evidence, { route, go });
    else content = h(Overview, { go, providerUsage });

    const isAnalytics = route.view === 'analytics';
    const analyticsFixture = isAnalytics && route.mode === 'fixture';

    return h('div', { className: cx('acc-shell', route.view !== 'overview' && 'acc-shell--subview') },
      h('header', { className: 'acc-hero' },
        h('div', { className: 'acc-brand-lockup' },
          h(CommandCenterMark),
          h('div', null,
            h('p', { className: 'acc-kicker' }, 'AUTOBOT SYSTEMS · READ-ONLY PROJECTION'),
            h('h1', null, 'Autobot Command Center'),
            h('p', { className: 'acc-hero__subtitle' }, 'What we built, what the evidence established, and what is available now.'),
          ),
        ),
        h('div', { className: 'acc-hero__actions' },
          h(Badge, { tone: analyticsFixture ? 'warn' : isAnalytics ? 'good' : 'warn' }, analyticsFixture ? 'Illustrative fixture' : isAnalytics ? 'Read-only analytics' : 'Prototype fixtures'),
          h('button', { type: 'button', className: 'acc-secondary-button', onClick: () => go({ view: 'evidence' }) }, 'Evidence index'),
        ),
      ),
      isAnalytics ? null : h(TrustStrip, { openEvidence: () => go({ view: 'evidence' }) }),
      h('nav', { className: 'acc-local-nav', 'aria-label': 'Command Center sections' }, NAV_ITEMS.map((item) =>
        h('button', {
          key: item.id, type: 'button', className: cx(primaryView === item.id && 'is-active'),
          'aria-current': primaryView === item.id ? 'page' : undefined,
          onClick: () => go({ view: item.id }),
        }, item.label),
      )),
      h('main', { className: 'acc-main', ref: mainRef, tabIndex: -1, 'aria-label': 'Command Center content' }, content),
      h('footer', { className: 'acc-footer' }, h('span', null, isAnalytics ? 'Sanitized static projections · No browser-side Cloudflare access' : fixtures.meta.notice), h('span', null, 'No mutations · No second source of truth')),
    );
  }

  window.__HERMES_PLUGINS__.register('autobot-command-center', App);
}

if (typeof window !== 'undefined' && window.__HERMES_PLUGIN_SDK__ && window.__HERMES_PLUGINS__) {
  registerAutobotCommandCenter();
}
