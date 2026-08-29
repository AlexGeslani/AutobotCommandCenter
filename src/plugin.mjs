import commandCenterMarkMaskUrl from '../standalone/autobot-mark-mask.png';
import decepticonMarkMaskUrl from '../standalone/decepticon-mark-mask.png';
import voicePerformanceUrl from '../standalone/voice-performance-comparison.png';
import { loadProviderUsageSnapshot, providerUsageFallback } from './provider-usage/client.mjs';
import { loadRuntimeConfiguration } from './runtime/client.mjs';
import { createAnalyticsView } from './analytics/view.mjs';
import { createSortingSupport, defineSortColumns } from './sorting.mjs';
import {
  NAV_ITEMS,
  edition,
  applyEdition,
  applyDomainProjection,
  RELEASES,
  fixtures,
  getCondition,
  getEvaluationIndex,
  getVoicePerformance,
  getFamily,
  getLeaderboard,
  getCapabilityRollup,
  getBenchmarkComparison,
  getMeasuredBenchmarkVisuals,
  getRunLineage,
  getEffectiveAvailability,
  getEffectiveProductClaims,
  getShowcasePortfolio,
  getShowcaseSkills,
  getSourceTrust,
  getOverviewProjection,
  filterLocalAcc,
  buildAccUrl,
  parseAccUrl,
  canonicalizeAccRoute,
} from './model.mjs';
import { THEME_PRESENTATION, loadStoredTheme, persistTheme } from './theme.mjs';

const MATRIX_GLYPHS = Object.freeze(Array.from('日ﾊﾋｼﾂｳｰﾅﾐﾓﾆｻﾜｵﾘﾎﾏｴｷﾑﾃｹﾒｶﾕﾗｾﾈｽﾀﾇ0123456789Z*+:=.< >｜¦_').filter((glyph) => glyph !== ' '));
const MATRIX_SIZE_BANDS = Object.freeze([10, 14, 20]);
const MATRIX_SPEED_BANDS = Object.freeze([18, 34, 58]);

export async function registerAutobotCommandCenter() {
  'use strict';

  const basePath = window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist';
  const runtime = await loadRuntimeConfiguration(basePath);
  applyEdition(runtime.edition);
  applyDomainProjection(runtime.domain);
  window.__ACC_RUNTIME_HEALTH__ = runtime.health;

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) {
    console.error('[ACC] Hermes Plugin SDK is unavailable');
    return;
  }

  const { React } = SDK;
  const { useEffect, useRef, useState } = SDK.hooks;
  const h = React.createElement;
  const { useSortableRows, SortableHeader } = createSortingSupport({ React, useState });

  function cx(...values) {
    return values.filter(Boolean).join(' ');
  }

  function MatrixRain() {
    const canvasRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d', { alpha: true });
      if (!canvas || !context) return undefined;

      let animationFrame = 0;
      let frame = 0;
      let streams = [];
      let lastTime = performance.now();
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

      function createRandom(seed) {
        let state = seed >>> 0;
        return () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state / 4294967296;
        };
      }

      function randomGlyph(random) {
        return MATRIX_GLYPHS[Math.floor(random() * MATRIX_GLYPHS.length)];
      }

      function populateStreams(width, height) {
        const random = createRandom(0x4d415452 ^ Math.round(width) ^ (Math.round(height) << 8));
        const count = Math.max(28, Math.min(72, Math.round(width / 22)));
        streams = Array.from({ length: count }, (_, index) => {
          const sizeBand = index % MATRIX_SIZE_BANDS.length;
          const speedBand = (index * 2 + Math.floor(random() * 3)) % MATRIX_SPEED_BANDS.length;
          const fontSize = MATRIX_SIZE_BANDS[sizeBand];
          const trailLength = 7 + Math.floor(random() * 22);
          return {
            x: random() * width,
            headY: (random() * (height + trailLength * fontSize)) - (trailLength * fontSize),
            fontSize,
            speed: MATRIX_SPEED_BANDS[speedBand] * (0.82 + random() * 0.38),
            trailLength,
            opacity: 0.2 + random() * 0.34,
            highlighted: random() < 0.22,
            mutationRate: 0.025 + random() * 0.085,
            travel: 0,
            glyphs: Array.from({ length: trailLength }, () => randomGlyph(random)),
            brightness: Array.from({ length: trailLength }, () => 0.72 + random() * 0.28),
            random,
          };
        });
        canvas.dataset.streamCount = String(streams.length);
      }

      function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        context.clearRect(0, 0, width, height);
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        streams.forEach((stream) => {
          context.font = `700 ${stream.fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
          stream.glyphs.forEach((glyph, index) => {
            const y = stream.headY - (index * stream.fontSize);
            if (y < -stream.fontSize || y > height + stream.fontSize) return;
            const progress = 1 - (index / stream.trailLength);
            const alpha = stream.opacity * Math.pow(Math.max(0, progress), 1.55) * stream.brightness[index];
            if (index === 0 && stream.highlighted) {
              context.fillStyle = `rgba(224, 255, 228, ${Math.min(0.96, alpha + 0.44)})`;
              context.shadowColor = 'rgba(148, 255, 164, .82)';
              context.shadowBlur = stream.fontSize * 0.72;
            } else if (index === 0) {
              context.fillStyle = `rgba(112, 255, 132, ${Math.min(0.86, alpha + 0.28)})`;
              context.shadowColor = 'rgba(68, 255, 94, .48)';
              context.shadowBlur = stream.fontSize * 0.35;
            } else {
              context.fillStyle = `rgba(48, 238, 76, ${alpha})`;
              context.shadowBlur = 0;
            }
            context.fillText(glyph, stream.x, y);
          });
        });
        context.shadowBlur = 0;
        frame += 1;
        canvas.dataset.frame = String(frame);
        canvas.dataset.glyphSignature = streams.slice(0, 12)
          .map((stream) => stream.glyphs.slice(0, 4).join(''))
          .join('|');
      }

      function advance(deltaSeconds) {
        streams.forEach((stream) => {
          stream.travel += stream.speed * deltaSeconds;
          const steps = Math.floor(stream.travel / stream.fontSize);
          if (!steps) return;
          stream.travel -= steps * stream.fontSize;
          for (let step = 0; step < steps; step += 1) {
            stream.headY += stream.fontSize;
            stream.glyphs.unshift(randomGlyph(stream.random));
            stream.glyphs.pop();
            stream.brightness.unshift(0.72 + stream.random() * 0.28);
            stream.brightness.pop();
            stream.glyphs.forEach((glyph, index) => {
              if (index > 0 && stream.random() < stream.mutationRate) stream.glyphs[index] = randomGlyph(stream.random);
            });
          }
          if ((stream.headY - stream.trailLength * stream.fontSize) > canvas.clientHeight) {
            stream.headY = -(stream.random() * canvas.clientHeight * 0.72);
            stream.highlighted = stream.random() < 0.22;
          }
        });
      }

      function tick(now) {
        const deltaSeconds = Math.min(0.08, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        advance(deltaSeconds);
        draw();
        animationFrame = requestAnimationFrame(tick);
      }

      function resize() {
        const width = Math.max(1, Math.round(canvas.clientWidth));
        const height = Math.max(1, Math.round(canvas.clientHeight));
        const scale = Math.min(1.5, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        context.setTransform(scale, 0, 0, scale, 0, 0);
        populateStreams(width, height);
        draw();
      }

      function syncMotion() {
        cancelAnimationFrame(animationFrame);
        canvas.dataset.motion = motion.matches ? 'reduced' : 'running';
        if (motion.matches) {
          draw();
          return;
        }
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(tick);
      }

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      motion.addEventListener?.('change', syncMotion);
      resize();
      syncMotion();

      return () => {
        cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        motion.removeEventListener?.('change', syncMotion);
      };
    }, []);

    return h('div', { className: 'acc-matrix-rain', 'aria-hidden': 'true' },
      h('canvas', {
        className: 'acc-matrix-rain__canvas',
        ref: canvasRef,
        'data-size-bands': String(MATRIX_SIZE_BANDS.length),
        'data-speed-bands': String(MATRIX_SPEED_BANDS.length),
        'data-density': 'variable',
        'data-glyph-mutation': 'true',
        'data-head-highlights': 'sparse',
        'data-motion': 'running',
        'data-stream-count': '0',
        'data-frame': '0',
      }),
    );
  }

  function Badge({ children, tone = 'neutral' }) {
    return h('span', { className: `acc-badge acc-badge--${tone}` }, children);
  }

  function StatusBadge({ state }) {
    const tone = state === 'fresh' || state === 'canonical' || state === 'validated' || state === 'available' || state === 'verified'
      ? 'good'
      : state === 'stale' || state === 'provisional' || state === 'unknown' || state === 'pending' || state === 'in-progress' || state === 'queued' || state === 'blocked'
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

  function RuntimeHealthNotice() {
    const issues = ['edition', 'domain']
      .map((key) => [key, runtime.health[key]])
      .filter(([, state]) => state.state !== 'ready');
    if (!issues.length) return null;
    return h('aside', { className: 'acc-runtime-health', role: 'status', 'aria-live': 'polite' },
      h('strong', null, 'Runtime data is stale or invalid'),
      h('ul', null, issues.map(([key, state]) => h('li', { key },
        `${key === 'edition' ? 'Edition' : 'Domain projection'} ${state.state === 'stale_invalid' ? 'is invalid; showing last-good data marked stale.' : 'is invalid or unavailable; showing bundled demonstration data marked stale.'}`,
      ))),
    );
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
          h(Badge, { tone: 'warn' }, 'Dev fixtures'),
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
    const overview = getOverviewProjection();
    return h('div', { className: 'acc-view acc-overview' },
      h(ProviderUsage, { snapshot: providerUsage, go, compact: true }),
      h('section', { className: 'acc-section acc-overview-exceptions' },
        h(SectionHeading, {
          eyebrow: 'Claim boundaries',
          title: 'Source exceptions',
          action: h(Badge, { tone: overview.sourceExceptions.length ? 'warn' : 'good' }, overview.sourceExceptions.length ? `${overview.sourceExceptions.length} need attention` : 'All claim-safe'),
        }),
        h('div', { className: 'acc-overview-exception-list' }, overview.sourceExceptions.map((source) =>
          h('article', { className: 'acc-overview-exception', key: source.id },
            h(StatusBadge, { state: source.state }),
            h('div', null, h('strong', null, source.label), h('small', null, `${source.authority} · ${source.freshness}`)),
          ),
        )),
      ),
      h('section', { className: 'acc-section acc-overview-destinations' },
        h(SectionHeading, { eyebrow: 'Focused destinations', title: 'Explore details' }),
        h('div', { className: 'acc-overview-destination-strip' }, overview.destinations.map((destination) =>
          h('button', {
            key: destination.id,
            type: 'button',
            className: 'acc-overview-destination',
            'aria-label': `Open ${destination.label}`,
            onClick: () => go({ view: destination.id }),
          }, h('strong', null, destination.label), h('small', null, destination.summary), h('span', { 'aria-hidden': true }, '→')),
        )),
      ),
      h('section', { className: 'acc-section acc-overview-landed' },
        h(SectionHeading, { eyebrow: 'Changed outcomes', title: 'Recently landed' }),
        h('div', { className: 'acc-overview-landed__list' },
          h('button', { type: 'button', className: 'acc-overview-landed__item', onClick: () => go({ view: 'benchmarks' }) },
            h(Badge, { tone: 'good' }, 'Verified'),
            h('span', null, h('strong', null, 'Condition-aware benchmark lineage'), h('small', null, 'Exact condition, frozen release, and run evidence')),
            h('span', { 'aria-hidden': true }, '→'),
          ),
          h('button', { type: 'button', className: 'acc-overview-landed__item', onClick: () => go({ view: 'portfolio', product: 'voice-lab' }) },
            h(Badge, null, 'Milestone'),
            h('span', null, h('strong', null, 'Voice Lab acceptance envelope'), h('small', null, 'Named acceptance owner and non-speech rejection')),
            h('span', { 'aria-hidden': true }, '→'),
          ),
        ),
      ),
    );
  }

  function Portfolio({ route, go }) {
    const portfolio = getShowcasePortfolio();
    const product = route.product ? portfolio.internalProducts.find((item) => item.id === route.product) : null;
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
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Products and capabilities', title: 'Portfolio' }),
      h('p', { className: 'acc-lede' }, 'Public GitHub evidence is refreshed into a frozen, allowlisted projection. Internal products remain a separate durable capability view with no implied public release.'),
      h('div', { className: 'acc-registry-summary', 'aria-label': 'Portfolio summary' },
        h('div', null, h('strong', null, portfolio.githubShowcaseProjects.length), h('span', null, 'Public projects')),
        h('div', null, h('strong', null, portfolio.internalProducts.length), h('span', null, 'Internal entries')),
        h('div', null, h('strong', null, portfolio.refreshedAt.slice(0, 10)), h('span', null, 'Projection refresh')),
      ),
      h('section', { className: 'acc-portfolio-group', 'aria-labelledby': 'acc-github-showcase-title' },
        h('div', { className: 'acc-section-heading' }, h('div', null,
          h('p', { className: 'acc-eyebrow' }, 'Allowlisted public evidence'),
          h('h3', { id: 'acc-github-showcase-title' }, 'GitHub Showcase Projects'),
        )),
        h('div', { className: 'acc-portfolio-grid' }, portfolio.githubShowcaseProjects.map((item) => {
          const links = [
            ['Repository', item.repositoryUrl],
            ['Live demo', item.demoUrl],
            ['Product brief', item.productBriefUrl],
            ['Architecture', item.architectureUrl],
            ['Article / case study', item.relatedArticleUrl],
          ].filter(([, url]) => url);
          return h('article', { key: item.id, className: 'acc-portfolio-card acc-showcase-card', 'data-showcase-project': item.id },
            h('span', { className: 'acc-object-card__top' }, h(Badge, { tone: 'good' }, 'Public'), h('span', { className: 'acc-repository-name' }, item.repository)),
            h('h3', null, item.name), h('p', null, item.description),
            h('div', { className: 'acc-card-links' }, links.map(([label, url]) => h('a', { key: label, className: 'acc-card-link', href: url, rel: 'noreferrer' }, label))),
            h('small', null, `Last refreshed ${portfolio.refreshedAt}`),
          );
        })),
      ),
      h('section', { className: 'acc-portfolio-group', 'aria-labelledby': 'acc-internal-products-title' },
        h('div', { className: 'acc-section-heading' }, h('div', null,
          h('p', { className: 'acc-eyebrow' }, 'Private operating boundary'),
          h('h3', { id: 'acc-internal-products-title' }, 'Internal Products & Capabilities'),
        )),
        h('div', { className: 'acc-portfolio-grid' }, portfolio.internalProducts.map((item) => {
          const claims = getEffectiveProductClaims(item);
          return h('button', { key: item.id, type: 'button', className: 'acc-portfolio-card', onClick: () => go({ view: 'portfolio', product: item.id }) },
            h('span', { className: 'acc-object-card__top' }, h(Badge, null, `Internal · ${item.kind}`), h(StatusBadge, { state: claims.state.toLowerCase() })),
            h('h3', null, item.name), h('p', null, item.value),
            h('div', { className: 'acc-callout' }, h('span', null, 'Landed outcome'), h('strong', null, item.outcome)),
            h('small', null, `${item.source} · verified ${item.verified}`),
          );
        })),
      ),
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

  function ThreeScoreValue({ score, role }) {
    const progress = score.progress;
    const label = score.value != null ? score.value.toFixed(1) : progress?.state === 'queued' ? 'Queued' : progress ? 'In progress' : 'Pending';
    const progressPercent = progress?.total ? (progress.current / progress.total) * 100 : 0;
    return h('span', { className: cx('acc-three-score__value', score.value == null && 'is-pending', progress && 'has-progress', progress?.state === 'queued' && 'is-queued'), role },
      h('strong', null, label), h('small', null, score.benchmark),
      progress ? h('span', { className: 'acc-suite-progress' },
        h('span', {
          className: 'acc-suite-progress__track', role: 'progressbar', 'aria-label': `${score.benchmark} ${progress.label}`,
          'aria-valuemin': 0, 'aria-valuemax': progress.total, 'aria-valuenow': progress.current,
        }, h('span', { style: { width: `${progressPercent}%` } })),
        h('small', null, progress.label),
      ) : null,
    );
  }

  function MeasuredSuiteTable({ suite, go }) {
    const columns = defineSortColumns('benchmarks.measured-suite', {
      condition: (row) => row.shortName,
      result: (row) => row.kind === 'score'
        ? { kind: 'score', value: row.value }
        : { kind: 'progress', value: row.barValue },
    });
    const sorted = useSortableRows(suite.rows, columns);
    return h('article', { className: 'acc-measured-suite', 'data-measured-suite': suite.id },
      h('div', { className: 'acc-measured-suite__head' }, h('h3', null, suite.label), h('small', null, `${suite.rows.filter((row) => row.kind === 'score').length} verified · ${suite.rows.filter((row) => row.evidence === 'in-progress').length} active`)),
      h('div', { className: 'acc-measured-suite__table', role: 'table', 'aria-label': `${suite.label} measured suite comparison` },
        h('div', { className: 'acc-measured-suite__columns', role: 'row' }, columns.map((definition) => h(SortableHeader, { key: definition.id, as: 'span', column: definition, sort: sorted.sort, onSort: sorted.onSort }))),
        h('div', { role: 'rowgroup' }, sorted.rows.map((row) => h('div', { className: cx('acc-measured-score', row.kind === 'progress' && 'is-progress', row.evidence === 'queued' && 'is-queued'), role: 'row', key: row.conditionId, 'data-score-bar': row.conditionId },
          h('span', { className: 'acc-measured-score__identity', role: 'rowheader' },
            h('button', { type: 'button', className: 'acc-table-link', onClick: () => go({ view: 'benchmarks', condition: row.conditionId }) }, row.shortName),
            h('small', null, row.denominator),
          ),
          h('span', { className: 'acc-measured-score__result', role: 'cell' },
            h('strong', { className: 'acc-measured-score__value' }, row.kind === 'score' ? row.value.toFixed(1) : row.evidence === 'queued' ? 'Queued' : `${row.barValue.toFixed(0)}% done`),
            h('span', { className: 'acc-measured-score__track', 'aria-hidden': 'true' }, h('span', { style: { width: `${row.barValue}%` } })),
          ),
        ))),
      ),
    );
  }

  function MeasuredBenchmarkVisuals({ go }) {
    const visual = getMeasuredBenchmarkVisuals();
    return h('section', { className: 'acc-measured-visuals', role: 'region', 'aria-label': 'Suite score and completion details' },
      h('div', { className: 'acc-measured-suite-grid' }, visual.suites.map((suite) => h(MeasuredSuiteTable, { key: suite.id, suite, go }))),
      h('p', { className: 'acc-measured-visuals__boundary' }, 'Compare verified capability scores within a suite only. Completion bars are operational progress, not scores. The current suite average above is coverage-labeled and never cross-ranks incomplete with complete conditions.'),
    );
  }

  function ThreeScoreComparison({ go }) {
    const profiles = getBenchmarkComparison();
    const measuredCount = profiles.filter((profile) => profile.evidence === 'measured').length;
    const columns = defineSortColumns('benchmarks.comparison', {
      condition: (profile) => profile.condition.shortName,
      instruction: (profile) => profile.scores.instruction.value,
      tools: (profile) => profile.scores.tools.value,
      agent: (profile) => profile.scores.agent.value,
      average: (profile) => profile.currentAverage.value,
      evidence: (profile) => Object.values(profile.scores).filter((score) => score.evidence === 'verified').length,
    });
    const sorted = useSortableRows(profiles, columns);
    return h('section', { className: 'acc-three-score', role: 'region', 'aria-label': 'Three-score model comparison' },
      h('div', { className: 'acc-three-score__head' },
        h('div', null, h('p', { className: 'acc-eyebrow' }, `${profiles.length} measured conditions at a glance`), h('h2', null, 'Three-score model comparison')),
        h('div', { className: 'acc-chip-list' }, h(Badge, { tone: 'good' }, `${measuredCount} measured`)),
      ),
      h('div', { className: 'acc-three-score__table', role: 'table', 'aria-label': 'Three-score model comparison' },
        h('div', { className: 'acc-three-score__legend', role: 'row' }, columns.map((definition) => h(SortableHeader, { key: definition.id, as: 'span', column: definition, sort: sorted.sort, onSort: sorted.onSort }))),
        h('div', { className: 'acc-three-score__rows', role: 'rowgroup' }, sorted.rows.map((profile) => {
          const condition = profile.condition;
          const averageValue = profile.currentAverage.value;
          const averageState = averageValue == null ? 'Pending' : profile.currentAverage.complete ? 'Complete' : 'In progress';
          return h('article', { className: cx('acc-three-score__row', profile.evidence === 'measured' && 'is-measured'), role: 'row', key: profile.conditionId, 'data-benchmark-profile': profile.conditionId },
            h('div', { className: 'acc-three-score__identity', role: 'rowheader' },
              h('button', { type: 'button', className: 'acc-table-link', onClick: () => go({ view: 'benchmarks', condition: profile.conditionId }) }, condition.shortName),
              h('small', null, `${condition.provider} · ${condition.runtime}`),
            ),
            h(ThreeScoreValue, { score: profile.scores.instruction, role: 'cell' }),
            h(ThreeScoreValue, { score: profile.scores.tools, role: 'cell' }),
            h(ThreeScoreValue, { score: profile.scores.agent, role: 'cell' }),
            h('div', { className: cx('acc-three-score__average', !profile.currentAverage.complete && 'is-in-progress'), role: 'cell' },
              h('strong', null, averageValue == null ? 'Pending' : averageValue.toFixed(1)),
              h('small', null, `${averageState} · ${profile.currentAverage.verifiedSuites}/${profile.currentAverage.totalSuites} verified`),
              h('span', { className: 'acc-three-score__average-track', 'aria-hidden': 'true' }, h('span', { style: { width: `${averageValue ?? 0}%` } })),
            ),
            h('div', { className: 'acc-three-score__evidence', role: 'cell' },
              h(Badge, { tone: 'good' }, 'Measured'),
              h('small', null, `${Object.values(profile.scores).filter((score) => score.evidence === 'verified').length} verified`),
            ),
          );
        })),
      ),
      h('div', { className: 'acc-prototype-note' }, 'Current average is the equal-weight arithmetic mean of final-verified suite scores available for that exact condition. Amber averages are incomplete and carry explicit coverage; pending suites are excluded rather than treated as zero. Conditions without measured evidence are excluded from this comparison.'),
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
    const evidenceLabel = operational.evidence === 'verified-repeat' ? 'Verified repeat' : operational.evidence === 'verified-partial' ? 'Verified partial' : 'Verified aggregate';
    const runtimeLabels = {
      hardwareProfile: 'Hardware profile', capturedAt: 'Profile captured', machine: 'Machine', processor: 'Processor', memory: 'Memory', accelerator: 'Accelerator', os: 'Operating system', competingWorkload: 'Competing workload',
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
      h('div', { className: cx('acc-current-average', !profile.currentAverage.complete && 'is-in-progress') },
        h('div', null, h('span', null, 'Current suite average'), h('strong', null, profile.currentAverage.value.toFixed(1))),
        h('small', null, profile.currentAverage.complete
          ? `Complete · ${profile.currentAverage.verifiedSuites}/${profile.currentAverage.totalSuites} final-verified suites`
          : `In progress · ${profile.currentAverage.verifiedSuites}/${profile.currentAverage.totalSuites} final-verified suites · pending suites excluded`),
        h('span', { className: 'acc-current-average__track', 'aria-hidden': 'true' }, h('span', { style: { width: `${profile.currentAverage.value}%` } })),
      ),
      h('div', { className: 'acc-core-score-grid' }, suiteOrder.map((suiteId) => {
        const score = profile.scores[suiteId];
        const progress = score.progress;
        const progressPercent = progress?.total ? (progress.current / progress.total) * 100 : 0;
        return h('article', { className: cx('acc-core-score-card', score.value == null && 'is-pending'), key: suiteId },
          h('div', { className: 'acc-core-score-card__head' },
            h('div', null, h('span', null, score.label), h('small', null, score.benchmark)), h(StatusBadge, { state: progress?.state || score.evidence }),
          ),
          h('strong', { className: 'acc-core-score-card__value' }, score.value != null ? score.value.toFixed(1) : progress?.state === 'queued' ? 'Queued' : progress ? 'In progress' : 'Pending'),
          h('small', { className: 'acc-core-score-card__denominator' }, score.denominator),
          progress ? h('div', { className: cx('acc-core-progress', progress.state === 'queued' && 'is-queued') },
            h('span', {
              role: 'progressbar', 'aria-label': `${score.benchmark} ${progress.label}`, 'aria-valuemin': 0,
              'aria-valuemax': progress.total, 'aria-valuenow': progress.current,
            }, h('span', { style: { width: `${progressPercent}%` } })),
            h('small', null, `${progressPercent.toFixed(1)}% collection complete · ${progress.label}`),
          ) : null,
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
    const leaderboardColumns = defineSortColumns('benchmarks.leaderboard', {
      rank: (row) => row.canonicalRank,
      condition: (row) => row.condition.shortName,
      score: (row) => row.score,
      denominator: (row) => row.denominator,
      release: (row) => row.release,
      availability: (row) => getEffectiveAvailability(row.condition),
    });
    const leaderboardSort = useSortableRows(getLeaderboard(domain, RELEASES[domain]).map((row, index) => ({ ...row, canonicalRank: index + 1 })), leaderboardColumns);
    if (route.mode === 'methodology') return h('article', { className: 'acc-view acc-detail acc-benchmark-methodology' },
      h('div', { className: 'acc-detail__hero' },
        h('div', null,
          h('p', { className: 'acc-eyebrow' }, 'Model Observatory'),
          h('h2', null, 'Testing philosophy'),
          h('p', { className: 'acc-lede' }, 'Three complementary suites test whether an exact model condition can follow instructions, use native tools, and complete sustained multi-turn work.'),
        ),
        h('button', { type: 'button', className: 'acc-back', onClick: () => go({ view: 'benchmarks' }) }, 'Back to Benchmarks'),
      ),
      h('section', { className: 'acc-methodology-principles', 'aria-labelledby': 'acc-methodology-principles-title' },
        h('h3', { id: 'acc-methodology-principles-title' }, 'What the comparison is designed to answer'),
        h('p', null, 'The goal is not a universal intelligence score. It is a repeatable operational comparison of exact tested conditions across three capabilities that matter in daily agent work.'),
        h('ul', null,
          h('li', null, h('strong', null, 'Same work:'), ' every condition receives the same frozen selection within a suite release.'),
          h('li', null, h('strong', null, 'Exact condition identity:'), ' model, provider or runtime, quantization, reasoning mode, and deployment geometry stay attached to the result.'),
          h('li', null, h('strong', null, 'Verified evidence only:'), ' a capability score appears only after final verification. Active and queued work remains progress, never a zero score.'),
          h('li', null, h('strong', null, 'No hidden universal rank:'), ' suite scores remain separate. The current average is an equal-weight summary of verified suites available for that condition, with coverage shown explicitly.'),
        ),
      ),
      h('section', { 'aria-labelledby': 'acc-methodology-suites-title' },
        h('h3', { id: 'acc-methodology-suites-title' }, 'Why these benchmarks'),
        h('div', { className: 'acc-methodology-grid' },
          h('article', { className: 'acc-methodology-card' },
            h('p', { className: 'acc-eyebrow' }, 'Instruction following'),
            h('h3', null, 'IFEval'),
            h('strong', { className: 'acc-methodology-size' }, '40 frozen prompts'),
            h('p', null, 'Chosen because it checks whether a model follows explicit, objectively verifiable instructions instead of merely producing a plausible answer. The primary score is strict prompt-level success across the frozen selection.'),
          ),
          h('article', { className: 'acc-methodology-card' },
            h('p', { className: 'acc-eyebrow' }, 'Native tool use'),
            h('h3', null, 'BFCL V4 Hard-50'),
            h('strong', { className: 'acc-methodology-size' }, '50 frozen hard cases'),
            h('p', null, 'A category-complete successor epoch covering all 20 BFCL types: 13 single-turn, 23 multi-turn, and 14 Memory cases. Complete collection requires 119 generated rows because the 14 scored Memory cases need 69 frozen prerequisites. Raw case accuracy is primary; BFCL official weighted aggregation is reported separately.'),
          ),
          h('article', { className: 'acc-methodology-card' },
            h('p', { className: 'acc-eyebrow' }, 'Multi-turn agent work'),
            h('h3', null, 'tau2 Hard-24'),
            h('strong', { className: 'acc-methodology-size' }, '24 frozen hard tasks'),
            h('small', null, '12 Retail · 12 Telecom'),
            h('p', null, 'An outcome-conditioned regression successor: Retail keeps 12 of Qwen3.6 35B’s 15 raw scored failures, prioritized where Sol or Luna also failed; Telecom keeps both Qwen failures plus 10 hard Sol failures. Raw operational zeros remain failures exactly as scored. Calibration-model projections are retrospective, while future post-freeze models are out-of-sample.'),
          ),
        ),
      ),
      h('section', { className: 'acc-boundary', 'aria-labelledby': 'acc-methodology-boundary-title' },
        h('h3', { id: 'acc-methodology-boundary-title' }, 'Interpretation boundary'),
        h('p', null, 'Scores compare the represented tested conditions on these frozen selections. They do not claim universal capability, current service availability, or performance outside the recorded release and deployment envelope.'),
      ),
    );
    const condition = !isRollup && route.condition ? getCondition(route.condition) : null;
    if (condition) return h(ConditionDetail, { condition, route, go, domain });
    if (!route.domain) return h('div', { className: 'acc-view acc-benchmark-view' },
      h(SectionHeading, {
        eyebrow: 'Model Observatory',
        title: 'Benchmarks',
        action: h('button', { type: 'button', className: 'acc-secondary-button', onClick: () => go({ view: 'benchmarks', mode: 'methodology' }) }, 'Testing philosophy'),
      }),
      h(ThreeScoreComparison, { go }),
      h(MeasuredBenchmarkVisuals, { go }),
    );
    if (isRollup) return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Model Observatory', title: 'Benchmarks' }),
      h('p', { className: 'acc-lede' }, 'Capability rollup is normalized within exact frozen releases. Complete and partial benchmark coverage are never cross-ranked.'),
      h('div', { className: 'acc-toolbar' }, h(MetricTabs, { active: 'rollup', onSelect: (nextDomain) => go({ view: 'benchmarks', domain: nextDomain }) }), h(Badge, null, 'Canonical only')),
      h(CapabilityRollup),
    );
    const rows = leaderboardSort.rows;
    const title = domain === 'tool-use' ? 'Tool Use' : domain === 'reasoning' ? 'GPQA Diamond' : 'Offline-safe Coding';
    return h('div', { className: 'acc-view' },
      h(SectionHeading, { eyebrow: 'Model Observatory', title: 'Benchmarks' }),
      h('p', { className: 'acc-lede' }, 'Rankings are exact tested conditions within one frozen benchmark release. No universal aggregate score.'),
      h('div', { className: 'acc-toolbar' }, h(MetricTabs, { active: domain, onSelect: (nextDomain) => go({ view: 'benchmarks', domain: nextDomain }) }), h(Badge, null, RELEASES[domain])),
      h('section', { className: 'acc-ranking-panel', 'aria-labelledby': 'acc-ranking-title' },
        h('div', { className: 'acc-ranking-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Canonical ranking'), h('h2', { id: 'acc-ranking-title' }, title)), h('small', null, 'Higher is better · fixture data')),
        h('div', { className: 'acc-desktop-table' },
          h('table', { 'aria-label': `${title} benchmark leaderboard` },
            h('thead', null, h('tr', null, leaderboardColumns.map((definition) => h(SortableHeader, { key: definition.id, column: definition, sort: leaderboardSort.sort, onSort: leaderboardSort.onSort })))),
            h('tbody', null, rows.map((row) => h('tr', { key: row.id },
              h('td', null, `#${row.canonicalRank}`),
              h('td', null, h('button', { type: 'button', className: 'acc-table-link', onClick: () => go({ view: 'benchmarks', domain, condition: row.conditionId }) }, row.condition.shortName)),
              h('td', { className: 'acc-score-cell' }, `${row.score.toFixed(1)}%`), h('td', null, row.denominator), h('td', null, row.release),
              h('td', null, h(StatusBadge, { state: getEffectiveAvailability(row.condition) })),
            ))),
          ),
        ),
        h('div', { className: 'acc-mobile-sort-controls', 'aria-label': `${title} leaderboard sort controls` }, leaderboardColumns.map((definition) => {
          const active = leaderboardSort.sort?.column === definition.id;
          const direction = active ? leaderboardSort.sort.direction : null;
          return h('button', {
            key: definition.id,
            type: 'button',
            className: 'acc-sort-button',
            'aria-label': `Sort by ${definition.label}`,
            'aria-pressed': active,
            onClick: () => leaderboardSort.onSort(definition.id),
          }, h('span', null, definition.label), h('span', { className: 'acc-sort-indicator', 'aria-hidden': 'true' }, direction === 'ascending' ? '↑' : direction === 'descending' ? '↓' : '↕'));
        })),
        h('div', { className: 'acc-mobile-ranking' }, rows.map((row) =>
          h('button', { type: 'button', key: row.id, className: 'acc-mobile-row', onClick: () => go({ view: 'benchmarks', domain, condition: row.conditionId }) },
            h('span', { className: 'acc-rank' }, `#${row.canonicalRank}`),
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
    const registry = getShowcaseSkills();
    const skill = route.skill ? registry.operationalSkills.find((item) => item.id === route.skill) : null;
    if (skill) {
      const fields = [
        ['Purpose', skill.description], ['Version', skill.version], ['Category', skill.category],
        ['License', skill.license || 'Unknown'], ['Platforms', skill.platforms?.join(', ') || 'Unknown'],
        ['Metadata status', skill.metadataStatus], ['Validation', skill.validationStatus], ['Projection refreshed', registry.refreshedAt],
      ];
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
      h('p', { className: 'acc-lede' }, 'A frozen frontmatter projection of selected operational skills. Enable, edit, install, and full inventory actions stay in Hermes Skills.'),
      h('div', { className: 'acc-registry-summary', 'aria-label': 'Skill registry summary' },
        h('div', null, h('strong', null, registry.operationalSkills.length), h('span', null, 'Operational skills')),
        h('div', null, h('strong', null, registry.showcaseEditions.length), h('span', null, 'Showcase editions')),
        h('div', null, h('strong', null, new Set(registry.operationalSkills.map((item) => item.category)).size), h('span', null, 'Domains')),
      ),
      h('section', { className: 'acc-portfolio-group', 'aria-labelledby': 'acc-showcase-editions-title' },
        h('div', { className: 'acc-section-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Approved independent releases'), h('h3', { id: 'acc-showcase-editions-title' }, 'Showcase Editions'))),
        registry.showcaseEditions.length
          ? h('div', { className: 'acc-skill-list' }, registry.showcaseEditions.map((item) => h('a', { key: item.id, className: 'acc-skill-row', href: item.repositoryUrl, rel: 'noreferrer' },
            h('span', { className: 'acc-skill-row__identity' }, h('small', null, item.repository), h('strong', null, item.name)),
            h('span', { className: 'acc-skill-row__states' }, h(Badge, { tone: 'good' }, item.visibility), h(Badge, null, item.independenceStatus), h(Badge, null, item.validationStatus)),
          )))
          : h('p', { className: 'acc-empty-state' }, registry.showcaseEmptyState),
      ),
      h('section', { className: 'acc-portfolio-group', 'aria-labelledby': 'acc-operational-skills-title' },
        h('div', { className: 'acc-section-heading' }, h('div', null, h('p', { className: 'acc-eyebrow' }, 'Selected local frontmatter'), h('h3', { id: 'acc-operational-skills-title' }, 'Operational Skills'))),
        h('div', { className: 'acc-skill-list' }, registry.operationalSkills.map((item) => h('button', { type: 'button', key: item.id, className: 'acc-skill-row', onClick: () => go({ view: 'skills', skill: item.id }) },
          h('span', { className: 'acc-skill-row__identity' }, h('small', null, item.category), h('strong', null, item.name), h('span', { className: 'acc-skill-row__purpose' }, item.description)),
          h('span', { className: 'acc-skill-row__states' },
            h(Badge, null, `v${item.version}`),
            h(Badge, null, item.metadataStatus),
            h(StatusBadge, { state: item.validationStatus.toLowerCase() }),
          ),
        ))),
      ),
      h('div', { className: 'acc-prototype-note' }, registry.boundary),
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

  function Search({ route, go }) {
    const apiBase = window.__ACC_HIVEMIND_API__ || 'http://127.0.0.1:8788';
    const [query, setQuery] = useState(route.q || '');
    const [protectedQuery, setProtectedQuery] = useState(route.q || '');
    const [scope, setScope] = useState('all');
    const [bridgeState, setBridgeState] = useState('idle');
    const [searchState, setSearchState] = useState('idle');
    const [results, setResults] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
      setQuery(route.q || '');
    }, [route.q]);

    const localResults = filterLocalAcc(query);

    function updateLocalQuery(event) {
      const nextQuery = event.target.value;
      setQuery(nextQuery);
      const next = { view: 'search', ...(nextQuery ? { q: nextQuery } : {}) };
      window.history.replaceState({}, '', buildAccUrl(next, window.__ACC_BASE_PATH__ || '/autobot-command-center'));
    }

    async function submit(event) {
      event.preventDefault();
      const cleanQuery = protectedQuery.trim();
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
        setBridgeState('available');
        setSearchState('done');
        setMessage(payload.results.length ? `${payload.results.length} source-linked result${payload.results.length === 1 ? '' : 's'}` : 'No approved Wiki pages matched this search.');
      } catch {
        setBridgeState('unavailable');
        setSearchState('error');
        setMessage('Protected knowledge search is unavailable. Local ACC results remain available above.');
      }
    }

    return h('div', { className: 'acc-view acc-search' },
      h(SectionHeading, {
        eyebrow: 'Local-first discovery',
        title: 'Search',
        action: h(Badge, { tone: 'good' }, 'Local index'),
      }),
      h('p', { className: 'acc-lede' }, 'Typing filters the bundled ACC index immediately. Results cover Portfolio, Skills, measured benchmark conditions, and analytics subjects without a network request.'),
      h('label', { className: 'acc-field acc-local-search-field' },
        h('span', null, 'Search ACC'),
        h('input', {
          type: 'search', value: query, maxLength: 256, autoComplete: 'off', placeholder: 'Portfolio, skills, Qwen 35B, Cloudflare visits…',
          onChange: updateLocalQuery,
        }),
      ),
      query ? h('section', { className: 'acc-local-search-results', 'aria-label': 'Local ACC search results', 'aria-live': 'polite' },
        h('p', { className: 'acc-search-status' }, `${localResults.length} local result${localResults.length === 1 ? '' : 's'}`),
        localResults.map((record) => h('button', {
          type: 'button', key: record.id, className: 'acc-local-search-result', onClick: () => go(record.route),
        }, h('span', null, h(Badge, null, record.kind), h('strong', null, record.title), h('small', null, record.summary)), h('span', { 'aria-hidden': true }, '→'))),
        !localResults.length ? h('p', { className: 'acc-empty-state' }, 'No local ACC records matched. Try a product, skill, benchmark condition, or analytics subject.') : null,
      ) : h('p', { className: 'acc-empty-state' }, 'Start typing to filter the deterministic local index.'),
      h('section', { className: 'acc-protected-search', 'aria-labelledby': 'acc-protected-search-title' },
        h('div', { className: 'acc-ranking-heading' },
          h('div', null, h('p', { className: 'acc-eyebrow' }, 'Explicit protected fallback'), h('h2', { id: 'acc-protected-search-title' }, 'Protected knowledge')),
          h(StatusBadge, { state: bridgeState === 'available' ? 'available' : bridgeState === 'unavailable' ? 'unavailable' : 'unknown' }),
        ),
        h('p', { className: 'acc-protected-search__copy' }, 'Submit a separate bounded request only when local ACC results are not enough. Nothing is sent while you type, and failed requests are not retried.'),
        h('form', { className: 'acc-hivemind-form', onSubmit: submit },
          h('label', { className: 'acc-field acc-field--query' },
            h('span', null, 'Protected knowledge query'),
          h('input', {
              type: 'search', value: protectedQuery, maxLength: 2048, autoComplete: 'off', placeholder: 'Project Grin, benchmark policy, voice decisions…',
              onChange: (event) => setProtectedQuery(event.target.value),
            }),
          ),
          h('label', { className: 'acc-field' },
            h('span', null, 'Approved scope'),
            h('select', { value: scope, onChange: (event) => setScope(event.target.value) },
              h('option', { value: 'all' }, 'Both approved Wikis'),
              h('option', { value: 'wiki-hermes' }, 'wiki-hermes'),
              h('option', { value: 'wiki-openai' }, 'wiki-openai'),
            ),
          ),
          h('button', { type: 'submit', className: 'acc-primary-button', disabled: searchState === 'loading' || !protectedQuery.trim() }, searchState === 'loading' ? 'Searching…' : 'Search protected knowledge'),
        ),
        message ? h('p', { className: cx('acc-search-status', searchState === 'error' && 'is-error'), role: 'status' }, message) : null,
        results.length ? h('section', { className: 'acc-search-results', 'aria-label': 'Protected knowledge search results' }, results.map((result, index) =>
          h('article', { className: 'acc-search-result', key: `${result.file}-${result.line ?? index}` },
            h('div', { className: 'acc-search-result__heading' },
              h('div', null, h('span', { className: 'acc-rank' }, `#${index + 1}`), h('h3', null, result.title || result.file)),
              h(Badge, null, 'Read-only source'),
            ),
            h('div', { className: 'acc-search-result__source' },
              h('code', { className: 'acc-search-result__path' }, result.file),
              result.line ? h('span', null, `Line ${result.line}`) : null,
            ),
            result.snippet ? h('pre', { className: 'acc-search-result__snippet' }, result.snippet) : null,
          ),
        )) : null,
        h('div', { className: 'acc-prototype-note' }, 'The protected bridge holds credentials and certificate trust outside the browser. Results are source-linked, read-only evidence—not a replacement for canonical Markdown.'),
      ),
    );
  }

  function G1ConsoleDetail() {
    return h('div', { className: 'acc-g1-console-detail', 'aria-hidden': 'true' },
      h('span', { className: 'acc-g1-console-detail__screen acc-g1-console-detail__screen--wide' }),
      h('span', { className: 'acc-g1-console-detail__screen acc-g1-console-detail__screen--small' }),
      h('span', { className: 'acc-g1-console-detail__vents' }),
      h('span', { className: 'acc-g1-console-detail__seam' }),
      h('span', { className: 'acc-g1-console-detail__indicators' }),
    );
  }

  function CommandCenterMark({ theme }) {
    const decepticon = theme === 'decepticons';
    return h('span', {
      className: 'acc-command-mark',
      'aria-hidden': 'true',
      'data-acc-faction': decepticon ? 'decepticon' : 'autobot',
      style: {
        '--acc-command-mark-mask': `url(${decepticon ? decepticonMarkMaskUrl : commandCenterMarkMaskUrl})`,
      },
    });
  }

  const Analytics = createAnalyticsView({ React, h, useEffect, useState, Badge, StatusBadge, SectionHeading, ProviderUsage, edition });

  function App() {
    const [route, setRoute] = useState(() => canonicalizeAccRoute(parseAccUrl(window.location.href)));
    const [providerUsage, setProviderUsage] = useState(() => providerUsageFallback());
    const [theme, setTheme] = useState(() => loadStoredTheme());
    const [heroQuery, setHeroQuery] = useState('');
    const mainRef = useRef(null);
    useEffect(() => {
      let active = true;
      loadProviderUsageSnapshot(window.__ACC_BASE_PATH__ || '/dashboard-plugins/autobot-command-center/dist', edition.projections.providerUsage).then(
        (snapshot) => { if (active) setProviderUsage(snapshot); },
        () => { if (active) setProviderUsage(providerUsageFallback()); },
      );
      return () => { active = false; };
    }, []);
    useEffect(() => {
      const parsed = parseAccUrl(window.location.href);
      if (parsed.view === 'usage' || parsed.view === 'hivemind') {
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

    function submitHeroSearch(event) {
      event.preventDefault();
      const query = heroQuery.trim();
      go({ view: 'search', ...(query ? { q: query } : {}) });
    }

    function selectTheme(event) {
      setTheme(persistTheme(event.target.value));
    }

    const primaryView = NAV_ITEMS.some((item) => item.id === route.view) ? route.view : null;
    let content;
    if (route.view === 'portfolio') content = h(Portfolio, { route, go });
    else if (route.view === 'analytics') content = h(Analytics, { route, go, providerUsage });
    else if (route.view === 'benchmarks') content = h(Benchmarks, { route, go });
    else if (route.view === 'skills') content = h(Skills, { route, go });
    else if (route.view === 'search') content = h(Search, { route, go });
    else if (route.view === 'evidence') content = h(Evidence, { route, go });
    else content = h(Overview, { go, providerUsage });

    const isAnalytics = route.view === 'analytics';
    const analyticsFixture = isAnalytics && route.mode === 'fixture';

    return h('div', { className: cx('acc-shell', route.view !== 'overview' && 'acc-shell--subview'), 'data-acc-theme': theme },
      theme === 'matrix' ? h(MatrixRain) : null,
      h('header', { className: 'acc-hero' },
        theme === 'g1-console' ? h(G1ConsoleDetail) : null,
        h('div', { className: 'acc-brand-lockup' },
          h(CommandCenterMark, { theme }),
          h('div', null,
            h('h1', null, edition.branding.title),
          ),
        ),
        h('div', { className: 'acc-hero__actions' },
          h('label', { className: 'acc-theme-select' },
            h('span', null, 'Theme'),
            h('select', { value: theme, 'aria-label': 'Presentation theme', onChange: selectTheme },
              Object.entries(THEME_PRESENTATION).map(([value, option]) => h('option', { value, key: value }, option.label)),
            ),
          ),
          h('form', { className: 'acc-hero-search', role: 'search', onSubmit: submitHeroSearch },
            h('label', { className: 'acc-sr-only', htmlFor: 'acc-hero-search-input' }, 'Search ACC from header'),
            h('input', {
              id: 'acc-hero-search-input', type: 'search', value: heroQuery, placeholder: 'Search ACC', autoComplete: 'off',
              onChange: (event) => setHeroQuery(event.target.value),
            }),
            h('button', { type: 'submit' }, 'Search'),
          ),
          h('button', { type: 'button', className: 'acc-secondary-button acc-hero-search-mobile', onClick: () => go({ view: 'search' }) }, 'Search'),
          isAnalytics ? h(Badge, { tone: analyticsFixture ? 'warn' : 'good' }, analyticsFixture ? 'Illustrative fixture' : 'Read-only analytics') : null,
          h('button', { type: 'button', className: 'acc-secondary-button', onClick: () => go({ view: 'evidence' }) }, 'Evidence index'),
        ),
      ),
      h(RuntimeHealthNotice),
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
