import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const pluginUrl = process.env.ACC_PLUGIN_PATH || '/autobot-command-center';
const standaloneBuild = pluginUrl === '/';
const pathSearchMode = pluginUrl === '/' || Boolean(process.env.ACC_BASE_URL);
const searchUrl = pathSearchMode ? '/search' : `${pluginUrl}?view=search`;
const searchDeepLink = (query = '') => `${searchUrl}${query ? `${searchUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(query).replaceAll('%20', '+')}` : ''}`;
const showcaseBuild = process.env.ACC_ANALYTICS_SHOWCASE === '1';
const showcaseProjection = JSON.parse(await readFile(new URL('./fixtures/analytics/kungfuclan-demo.v2.json', import.meta.url), 'utf8'));
const demoDomainProjection = JSON.parse(await readFile(new URL('../fixtures/demo/domain.v1.json', import.meta.url), 'utf8'));
const demoEdition = JSON.parse(await readFile(new URL('../config/demo.edition.v1.json', import.meta.url), 'utf8'));

async function routeWebAnalytics(page) {
  const realProjection = structuredClone(showcaseProjection);
  realProjection.dataKind = 'real';
  realProjection.subject = { id: 'kungfuclan.com', label: 'Kung Fu Clan', domain: 'web' };
  const extraCountries = [
    { code: 'ES', requests: 80, edgeResponseBytes: 8000 },
    { code: 'MX', requests: 70, edgeResponseBytes: 7000 },
    { code: 'NZ', requests: 60, edgeResponseBytes: 6000 },
    { code: 'ZA', requests: 50, edgeResponseBytes: 5000 },
  ];
  const sourceCountry = realProjection.ranges['30d'].countries[0];
  sourceCountry.requests -= extraCountries.reduce((sum, country) => sum + country.requests, 0);
  sourceCountry.edgeResponseBytes -= extraCountries.reduce((sum, country) => sum + country.edgeResponseBytes, 0);
  realProjection.ranges['30d'].countries.push(...extraCountries);
  delete realProjection.notice;
  for (const pattern of ['**/data/analytics/web/kungfuclan.com.v2.json', '**/runtime/analytics/web/kungfuclan.com.v2.json']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(realProjection) });
    });
  }
  await page.route('**/data/analytics/showcase/kungfuclan-demo.v2.json', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(showcaseProjection) });
  });
  const alexProjection = structuredClone(realProjection);
  alexProjection.subject = { id: 'alexgeslani.com', label: 'alexgeslani.com', domain: 'web' };
  for (const pattern of ['**/data/analytics/web/alexgeslani.com.v2.json', '**/runtime/analytics/web/alexgeslani.com.v2.json']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(alexProjection) });
    });
  }
}

async function routeProviderUsage(page, providers, generatedAt = '2026-07-31T23:30:00.000Z') {
  for (const pattern of ['**/data/provider-usage.v1.json', '**/runtime/provider-usage.v1.json']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ schemaVersion: 'provider-usage-v1', generatedAt, providers }),
      });
    });
  }
}

function healthyProviderUsageFixture() {
  const observedAt = new Date().toISOString();
  const resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    observedAt,
    providers: [
      { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt, state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 20, resetsAt }] },
      { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'claude-status-line', observedAt, state: 'fresh', windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 20, resetsAt }] },
      { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt, state: 'fresh', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 20, resetsAt }] },
      { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers', adapterVersion: '1.0.0', sourceVersion: 'brave-rate-limit-headers', observedAt, state: 'fresh', windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 20, resetsAt, limit: 2000, remaining: 1600 }], rateLimitPerSecond: 1 },
    ],
  };
}

async function routeDomainProjection(page, projection) {
  for (const pattern of ['**/data/domain.v1.json', '**/runtime/domain.v1.json']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(projection) });
    });
  }
}

async function routeProtectedKnowledge(page, { failure = false } = {}) {
  const counts = { search: 0, health: 0 };
  for (const pattern of ['http://127.0.0.1:8788/health', '**/api/hivemind/health']) {
    await page.route(pattern, async (route) => {
      counts.health += 1;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'health_probe_forbidden' }) });
    });
  }
  for (const pattern of ['http://127.0.0.1:8788/search', '**/api/hivemind/search']) {
    await page.route(pattern, async (route) => {
      counts.search += 1;
      if (failure) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'fixture_unavailable' }) });
        return;
      }
      const request = route.request().postDataJSON();
      expect(request).toEqual({ query: 'Project Grin', collections: ['wiki-openai'], limit: 10 });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            file: 'wiki-openai/projects/project-grin.md',
            title: 'Project Grin — 2005 Subaru Forester XT',
            score: 1,
            line: 50,
            snippet: 'Project Grin is the reliability-first modernization of Alex’s black 2005 Subaru Forester XT.',
          }],
        }),
      });
    });
  }
  return counts;
}

function captureBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function exerciseEverySortHeader(table, labels) {
  await expect(table.getByRole('columnheader')).toHaveCount(labels.length);
  for (const label of labels) {
    const header = table.getByRole('columnheader', { name: new RegExp(`Sort by ${label}`) });
    const button = header.getByRole('button', { name: `Sort by ${label}` });
    await button.click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('[aria-sort]')).toHaveCount(1);
  }
}

test('Overview prioritizes provider headroom and keeps destination summaries compact', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  const providerUsage = healthyProviderUsageFixture();
  await routeProviderUsage(page, providerUsage.providers, providerUsage.observedAt);
  await page.goto(pluginUrl);
  await expect(page.getByRole('heading', { name: 'Autobot Command Center' })).toBeVisible();
  const commandMark = page.locator('.acc-command-mark');
  await expect(commandMark).toHaveAttribute('aria-hidden', 'true');
  expect(await commandMark.evaluate((element) => element.tagName)).toBe('SPAN');
  expect(await commandMark.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.maskImage || style.webkitMaskImage;
  })).toMatch(/^url\("data:image\/png;base64,/);
  if (pluginUrl === '/') await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/autobot-mark.jpg?v=1');

  const overview = page.locator('.acc-overview');
  const sections = overview.locator(':scope > section');
  await expect(sections.first().getByRole('heading', { name: 'Provider usage' })).toBeVisible();
  await expect(overview.getByRole('heading', { name: 'Explore details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Integration issues' })).toHaveCount(0);
  await expect(page.getByText('Recently landed', { exact: true })).toBeVisible();
  await expect(page.getByText('Durable capabilities', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Model leaders', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Decision pending', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Portfolio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Analytics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Benchmarks' })).toBeVisible();

  const localNav = page.getByRole('navigation', { name: 'Command Center sections' });
  await expect(localNav.getByRole('button')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(browserErrors).toEqual([]);
});

test('Integration Status uses a compact issue bar, keeps complete details in Settings, and disappears only when validated healthy', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  const degradedDomain = structuredClone(demoDomainProjection);
  degradedDomain.data.sources[0].state = 'stale';
  degradedDomain.data.sources[0].freshness = 'Stale test projection';
  degradedDomain.data.sources[0].invalidatesClaims = true;
  await routeDomainProjection(page, degradedDomain);
  const providerUsage = healthyProviderUsageFixture();
  await routeProviderUsage(page, providerUsage.providers, providerUsage.observedAt);
  await page.goto(pluginUrl);

  const issueBar = page.getByRole('status', { name: 'Integration issues' });
  await expect(issueBar).toBeVisible();
  await expect(issueBar.getByText('Integration issues', { exact: true })).toBeVisible();
  await expect(page.getByText('Source confidence degraded', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sources verified', { exact: true })).toHaveCount(0);


  const overviewIssues = page.getByRole('region', { name: 'Integration issues summary' });

  await expect(overviewIssues.getByText('Reachability', { exact: true })).toHaveCount(0);
  await issueBar.getByRole('button', { name: 'Review integration details' }).click();
  await expect(page).toHaveURL(/view=settings/);
  await expect(page.getByRole('heading', { name: 'Integration Status', exact: true })).toBeVisible();

  for (const label of [
    'Codex / ChatGPT collector',
    'Claude Code collector',
    'Antigravity CLI collector',
    'Brave Search API collector',
  ]) {
    await expect(page.locator('[data-integration]').filter({ hasText: label })).toBeVisible();
  }

  const integrationDetails = page.getByRole('region', { name: 'Integration Status details' });
  for (const field of ['Reachability', 'Configuration / authentication', 'Freshness / version', 'Validation', 'Dependent-claim impact', 'Last observed', 'Authority']) {
    await expect(integrationDetails.getByText(field, { exact: true }).first()).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Integration Status', exact: true })).toBeVisible();

  const now = new Date();
  const observedAt = now.toISOString();
  const resetsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const healthyDomain = structuredClone(demoDomainProjection);
  healthyDomain.generatedAt = observedAt;
  healthyDomain.data.meta.fixture = false;
  healthyDomain.data.meta.generatedAt = observedAt;
  healthyDomain.data.sources.forEach((source) => {
    source.state = 'fresh';
    source.freshness = `Validated ${observedAt}`;
    source.invalidatesClaims = false;
  });
  await routeDomainProjection(page, healthyDomain);
  await routeProviderUsage(page, [
    { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt, state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 99, resetsAt }] },
    { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'claude-status-line', observedAt, state: 'fresh', windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 10, resetsAt }] },
    { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt, state: 'fresh', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 10, resetsAt }] },
    { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers', adapterVersion: '1.0.0', sourceVersion: 'brave-rate-limit-headers', observedAt, state: 'fresh', windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 0, resetsAt, limit: 2000, remaining: 2000 }], rateLimitPerSecond: 1 },
  ], observedAt);
  await page.goto(pluginUrl);
  await expect(page.getByRole('status', { name: 'Integration issues' })).toHaveCount(0);
  await expect(page.locator('[data-provider="codex"]')).toContainText('1% available');
  await page.getByRole('button', { name: 'Settings' }).click();
  const codexCollector = page.locator('[data-integration="provider:codex"]');
  await expect(codexCollector.getByText('healthy', { exact: true })).toBeVisible();
  await expect(codexCollector).toContainText('collector health does not represent quota pressure');
  expect(browserErrors).toEqual([]);
});

test('Portfolio presents dated capability evidence without a runtime availability monitor', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await routeDomainProjection(page, demoDomainProjection);
  await page.goto(pluginUrl);
  await page.getByRole('button', { name: 'Open Portfolio' }).click();
  await page.getByRole('button', { name: /Demo Command Center/ }).click();

  await expect(page.getByRole('heading', { name: 'Demo Command Center', exact: true })).toBeVisible();
  await expect(page.getByText('demonstration', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What works now', exact: true })).toBeVisible();
  await expect(page.getByText('Validated JSON contracts', { exact: true })).toBeVisible();
  await expect(page.getByText('Sanitized fixture · last verified 2026-01-01', { exact: true })).toBeVisible();
  const history = page.getByRole('region', { name: 'Testing history' });
  await expect(history.getByRole('heading', { name: 'Portable projection contract', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('invalid runtime domain remains visible as stale while the dashboard falls back without page errors', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.route('**/runtime/domain.v1.json', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"schemaVersion":"acc-domain-projection-v1","generatedAt":"invalid"}' });
  });
  await page.goto(pluginUrl);
  const notice = page.getByRole('status', { name: 'Integration issues' });
  await expect(notice).toContainText('ACC Domain projection');
  await expect(notice).toContainText('invalid');
  await expect(page.getByRole('heading', { name: 'Autobot Command Center' })).toBeVisible();
  expect(await page.evaluate(() => window.__ACC_RUNTIME_HEALTH__.domain)).toMatchObject({ state: 'demo_invalid', stale: true, valid: false });
  expect(browserErrors).toEqual([]);
});

test('a condition with no verified suites renders a pending average instead of crashing the benchmark page', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  const pendingProjection = structuredClone(demoDomainProjection);
  const profile = pendingProjection.data.benchmarkComparison[0];
  Object.values(profile.scores).forEach((score) => {
    score.value = null;
    score.evidence = 'pending';
    score.denominator = '0 / 1 queued · score withheld';
    score.progress = { current: 0, total: 1, label: '0 / 1 queued', state: 'queued', capturedAt: pendingProjection.generatedAt };
  });
  await page.route('**/runtime/domain.v1.json', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(pendingProjection) });
  });
  await page.goto(pluginUrl + '?view=benchmarks');
  await expect(page.getByRole('heading', { name: 'Benchmarks' })).toBeVisible();
  const comparison = page.getByRole('table', { name: 'Three-score model comparison' });
  await expect(comparison.getByText('Queued', { exact: true })).toHaveCount(3);
  await expect(comparison.getByText('Pending', { exact: true })).toHaveCount(1);
  await expect(comparison.getByText('Pending · 0/3 verified', { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('benchmark landing prioritizes the model comparison and leaves suite detail last without legacy shortcuts', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks');
  const comparison = page.getByRole('region', { name: 'Three-score model comparison' });
  const suiteDetail = page.getByRole('region', { name: 'Suite score and completion details' });
  await expect(comparison).toBeVisible();
  await expect(suiteDetail).toBeVisible();
  expect(await comparison.evaluate((element, following) => Boolean(element.compareDocumentPosition(following) & Node.DOCUMENT_POSITION_FOLLOWING), await suiteDetail.elementHandle())).toBe(true);
  await expect(page.getByRole('heading', { name: 'Measured suite comparison' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Measured evidence coverage' })).toHaveCount(0);
  for (const label of ['Capability rollup', 'Tool Use', 'GPQA Diamond', 'Coding']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  }
});

test('benchmark heading opens a detailed testing philosophy without a landing-page description', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks');
  const landing = page.locator('.acc-benchmark-view');
  await expect(landing.locator(':scope > .acc-lede')).toHaveCount(0);
  const philosophyButton = landing.locator('.acc-section-heading').first().getByRole('button', { name: 'Testing philosophy' });
  await expect(philosophyButton).toBeVisible();
  await philosophyButton.click();
  await expect(page).toHaveURL(/view=benchmarks.*mode=methodology/);
  await expect(page.getByRole('heading', { name: 'Testing philosophy' })).toBeVisible();
  for (const benchmark of ['IFEval', 'BFCL V4 Hard-50', 'tau2 Hard-24']) {
    await expect(page.getByRole('heading', { name: benchmark })).toBeVisible();
  }
  await expect(page.getByText('40 frozen prompts', { exact: true })).toBeVisible();
  await expect(page.getByText('50 frozen hard cases', { exact: true })).toBeVisible();
  await expect(page.getByText('24 frozen hard tasks', { exact: true })).toBeVisible();
  await expect(page.getByText('12 Retail · 12 Telecom', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Testing philosophy' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Benchmarks' }).click();
  await expect(page).toHaveURL(/view=benchmarks(?!.*mode=methodology)/);
  await expect(page.getByRole('heading', { name: 'Three-score model comparison' })).toBeVisible();
});

test('Analytics exposes scalable domains and a truthful KFC real-data route', async ({ page }) => {
  await routeWebAnalytics(page);
  await page.goto(pluginUrl + '?view=analytics');
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Web properties' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Code & repositories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI services' })).toBeVisible();
  const productsDomain = page.locator('section.acc-analytics-domain').filter({ has: page.getByRole('heading', { name: 'Products & agents' }) });
  await expect(productsDomain.getByText('Not connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open alexgeslani.com analytics' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Kung Fu Clan analytics' }).click();
  await expect(page).toHaveURL(/view=analytics.*domain=web.*subject=kungfuclan\.com.*range=30d/);
  await expect(page.getByRole('heading', { name: 'Kung Fu Clan', exact: true })).toBeVisible();
  const propertySelector = page.getByLabel('Web property');
  await expect(propertySelector.getByRole('option')).toHaveCount(2);
  await expect(propertySelector.getByRole('option', { name: /illustrative demo/i })).toHaveCount(0);
  await expect(page.getByLabel('Analytics summary').getByText('Cloudflare Visits', { exact: true })).toBeVisible();
  await expect(page.getByText(/Page-entry events from direct traffic or an external referrer/i)).toBeVisible();
  await expect(page.getByText('Strict cache-hit share', { exact: true })).toBeVisible();
  const countryTable = page.getByRole('table', { name: 'Authoritative requests by country' });
  await expect(countryTable.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Show all 12 countries' }).click();
  await expect(countryTable.locator('tbody tr')).toHaveCount(12);
  await page.getByRole('button', { name: 'Collapse to Top 10 countries' }).click();
  await expect(countryTable.locator('tbody tr')).toHaveCount(10);
  const mapHeading = page.getByRole('heading', { name: 'World request map' });
  await expect(mapHeading).toBeHidden();
  await page.getByText('Show world request map', { exact: true }).click();
  await expect(mapHeading).toBeVisible();
  const unitedStates = page.locator('.acc-world-map__country[data-country="US"]');
  await expect(unitedStates).toHaveAttribute('data-state', 'observed');
  await expect(unitedStates).toHaveAttribute('aria-label', /United States.*requests/i);
  await unitedStates.focus();
  await expect(unitedStates).toBeFocused();
  await expect(page.getByText(/US state breakdown unavailable/i)).toBeVisible();
  await expect(page.locator('[data-traffic-tick]')).toHaveCount(5);
  await expect(page.locator('[data-traffic-tick]').filter({ hasText: /^0$/ })).toHaveCount(1);
  await expect(page.locator('[data-traffic-tick]').filter({ hasText: /^3,799$/ })).toHaveCount(1);
  await expect(page.locator('.acc-traffic-point title', { hasText: '2026-07-17: 1,440 requests' })).toHaveCount(1);
  await expect(page.locator('[data-period-delta]')).toHaveCount(0);
  await expect(page.getByText(/period.over.period|previous period/i)).toHaveCount(0);
  const compactPanels = page.locator('.acc-analytics-compact-breakdowns');
  await expect(compactPanels.locator('.acc-analytics-panel')).toHaveCount(2);
  expect(await compactPanels.evaluate((element) => getComputedStyle(element).alignItems)).toBe('start');
  await expect(page.getByText('ILLUSTRATIVE FIXTURE', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/Visits are entry events, not unique people or sessions/i)).toBeVisible();
});

test('Analytics exposes the alexgeslani.com real-data route', async ({ page }) => {
  await routeWebAnalytics(page);
  await page.goto(pluginUrl + '?view=analytics&domain=web&subject=alexgeslani.com&range=30d');
  await expect(page.getByRole('heading', { name: 'alexgeslani.com', exact: true })).toBeVisible();
  await expect(page.getByText('ILLUSTRATIVE FIXTURE', { exact: false })).toHaveCount(0);
});

test('a malformed GitHub projection is isolated from both website analytics subjects', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  const edition = structuredClone(demoEdition);
  edition.analytics.web = [
    { id: 'kungfuclan.com', label: 'Kung Fu Clan', description: 'Retained web traffic', projection: 'runtime/analytics/web/kungfuclan.com.v2.json' },
    { id: 'alexgeslani.com', label: 'alexgeslani.com', description: 'Retained web traffic', projection: 'runtime/analytics/web/alexgeslani.com.v2.json' },
  ];
  edition.analytics.github = {
    id: 'github-portfolio',
    label: 'GitHub Portfolio',
    description: 'Retained repository traffic',
    projection: 'runtime/analytics/github/github-portfolio.v1.json',
  };
  for (const pattern of ['**/data/edition.v1.json', '**/runtime/edition.v1.json']) {
    await page.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(edition) }));
  }
  await page.route('**/runtime/analytics/github/github-portfolio.v1.json', (route) => route.fulfill({ contentType: 'application/json', body: '{"invalid":true}' }));
  await routeWebAnalytics(page);

  await page.goto(pluginUrl + '?view=analytics&domain=code&subject=github-portfolio');
  await expect(page.getByRole('heading', { name: 'GitHub Portfolio analytics unavailable' })).toBeVisible();
  await page.getByRole('button', { name: '← Analytics', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open alexgeslani.com analytics' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Kung Fu Clan analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Kung Fu Clan', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('illustrative analytics stays on its separate identity with a permanent warning', async ({ page }) => {
  test.skip(!showcaseBuild, 'Illustrative analytics is compiled only into an explicit showcase build');
  const showcaseEdition = structuredClone(demoEdition);
  showcaseEdition.analytics.web = [{
    id: 'kungfuclan-demo',
    label: 'Kung Fu Clan illustrative demo',
    description: 'Clearly labeled, non-current aggregate web analytics fixture.',
    projection: 'data/analytics/showcase/kungfuclan-demo.v2.json',
  }];
  for (const pattern of ['**/data/edition.v1.json', '**/runtime/edition.v1.json']) {
    await page.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(showcaseEdition) }));
  }
  await routeWebAnalytics(page);
  await page.goto(pluginUrl + '?view=analytics&domain=web&subject=kungfuclan-demo&range=30d&mode=fixture');
  await expect(page.getByRole('alert')).toHaveText('ILLUSTRATIVE FIXTURE — NOT CURRENT ANALYTICS');
  await expect(page.getByRole('heading', { name: 'Kung Fu Clan illustrative demo' })).toBeVisible();
  await expect(page.getByText('30/30 observed', { exact: true })).toBeVisible();
});

test('Analytics remains readable without horizontal overflow on mobile', async ({ page }) => {
  await routeWebAnalytics(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=analytics&domain=web&subject=kungfuclan.com&range=30d');
  await expect(page.getByRole('heading', { name: 'Kung Fu Clan', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('navigation', { name: 'Command Center sections' }).getByRole('button')).toHaveCount(5);
});

test('legacy usage URL redirects to the canonical Analytics provider route', async ({ page }) => {
  await page.goto(pluginUrl + '?view=usage');
  await expect(page).toHaveURL(/view=analytics.*domain=ai.*subject=provider-usage/);
  await expect(page.getByRole('heading', { name: 'Usage & limits' })).toBeVisible();
});

test('Search deep links, filters locally, and sends one explicit protected request', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  const counts = await routeProtectedKnowledge(page);
  await page.goto(searchDeepLink('Qwen 35B'));
  await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Command Center sections' });
  await expect(navigation.getByRole('button')).toHaveText(['Overview', 'Portfolio', 'Analytics', 'Benchmarks', 'Search']);
  await expect(page.getByText('Hive Mind', { exact: true })).toHaveCount(0);
  const local = page.getByLabel('Search ACC', { exact: true });
  await expect(local).toHaveValue('Qwen 35B');
  await expect(page.getByText('Qwen3.6 35B Heretic · Q4_K_M · MTP-N2', { exact: true })).toBeVisible();
  await local.fill('cloudflare visits');
  await expect(page).toHaveURL(pathSearchMode ? /\/search\?q=cloudflare\+visits$/ : /\/autobot-command-center\?view=search&q=cloudflare\+visits$/);
  await expect(page.getByText('Kung Fu Clan analytics', { exact: true })).toBeVisible();
  expect(counts).toEqual({ search: 0, health: 0 });

  await page.getByLabel('Protected knowledge query').fill('Project Grin');
  await page.getByLabel('Approved scope').selectOption('wiki-openai');
  expect(counts.search).toBe(0);
  await page.getByRole('button', { name: 'Search protected knowledge' }).click();
  await expect(page.getByRole('heading', { name: 'Project Grin — 2005 Subaru Forester XT' })).toBeVisible();
  await expect(page.getByText('wiki-openai/projects/project-grin.md', { exact: true })).toBeVisible();
  await expect(page.getByText(/reliability-first modernization/i)).toBeVisible();
  await expect(page.getByText('Read-only source', { exact: true })).toBeVisible();
  expect(counts).toEqual({ search: 1, health: 0 });
  expect(browserErrors).toEqual([]);
});

test('Search failure is unavailable without retry and keeps local results usable', async ({ page }) => {
  const counts = await routeProtectedKnowledge(page, { failure: true });
  await page.goto(searchDeepLink('qwen'));
  await expect(page.getByText('Qwen3.6 35B Heretic · Q4_K_M · MTP-N2', { exact: true })).toBeVisible();
  await page.getByLabel('Protected knowledge query').fill('Unavailable fixture');
  expect(counts).toEqual({ search: 0, health: 0 });
  await page.getByRole('button', { name: 'Search protected knowledge' }).click();
  await expect(page.getByText(/Protected knowledge search is unavailable/)).toBeVisible();
  await page.waitForTimeout(250);
  expect(counts).toEqual({ search: 1, health: 0 });
  await expect(page.getByText('Qwen3.6 35B Heretic · Q4_K_M · MTP-N2', { exact: true })).toBeVisible();
});

test('legacy search view redirects one way and desktop hero Search creates a deep link', async ({ page }) => {
  await page.goto(`${pluginUrl}?view=hivemind&q=portfolio`);
  await expect(page).toHaveURL(pathSearchMode ? /\/search\?q=portfolio$/ : /\/autobot-command-center\?view=search&q=portfolio$/);
  await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
  await page.goto(pluginUrl);
  await page.locator('.acc-hero-search').getByPlaceholder('Search ACC').fill('Cloudflare visits');
  await page.locator('.acc-hero-search').getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(pathSearchMode ? /\/search\?q=Cloudflare\+visits$/ : /\/autobot-command-center\?view=search&q=Cloudflare\+visits$/);
  await expect(page.getByText('Kung Fu Clan analytics', { exact: true })).toBeVisible();
});

test('five themes persist locally while status colors, themed mark, and reduced motion stay invariant', async ({ page }) => {
  await page.goto(pluginUrl);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const shell = page.locator('.acc-shell');
  const commandMark = page.locator('.acc-command-mark');
  await expect(shell).toHaveAttribute('data-acc-theme', 'matrix');
  await expect(page.getByLabel('Presentation theme').locator('option')).toHaveCount(5);
  await page.getByLabel('Presentation theme').selectOption('g1-console');
  await expect(shell).toHaveAttribute('data-acc-theme', 'g1-console');
  const g1Console = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      good: style.getPropertyValue('--acc-status-good').trim(),
      warn: style.getPropertyValue('--acc-status-warn').trim(),
      bad: style.getPropertyValue('--acc-status-bad').trim(),
      accent: style.getPropertyValue('--acc-accent-primary').trim(),
      background: style.backgroundColor,
    };
  });
  expect(g1Console.background).toBe('rgb(22, 12, 7)');
  const g1MarkColor = await commandMark.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(page.locator('.acc-g1-console-detail')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.acc-g1-console-detail > span')).toHaveCount(5);

  await page.getByLabel('Presentation theme').selectOption('autobots');
  await expect(shell).toHaveAttribute('data-acc-theme', 'autobots');
  await expect(page.getByLabel('Presentation theme').locator('option:checked')).toHaveText('Autobots');
  const autobots = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      good: style.getPropertyValue('--acc-status-good').trim(),
      warn: style.getPropertyValue('--acc-status-warn').trim(),
      bad: style.getPropertyValue('--acc-status-bad').trim(),
      accent: style.getPropertyValue('--acc-accent-primary').trim(),
      background: style.backgroundColor,
    };
  });
  expect(autobots).toEqual({
    good: g1Console.good,
    warn: g1Console.warn,
    bad: g1Console.bad,
    accent: '#e84b4f',
    background: 'rgb(7, 11, 18)',
  });
  await page.reload();
  await expect(page.locator('.acc-shell')).toHaveAttribute('data-acc-theme', 'autobots');
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByLabel('Presentation theme').selectOption('current-dark');
  await expect(shell).toHaveAttribute('data-acc-theme', 'current-dark');
  const terminal = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      good: style.getPropertyValue('--acc-status-good').trim(),
      warn: style.getPropertyValue('--acc-status-warn').trim(),
      bad: style.getPropertyValue('--acc-status-bad').trim(),
      accent: style.getPropertyValue('--acc-accent-primary').trim(),
      background: style.backgroundColor,
      foreground: style.color,
    };
  });
  expect(terminal.background).toBe('rgb(0, 0, 0)');
  expect(terminal.foreground).toBe('rgb(255, 203, 122)');
  expect([terminal.good, terminal.warn, terminal.bad]).toEqual([g1Console.good, g1Console.warn, g1Console.bad]);
  const terminalMarkColor = await commandMark.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(terminalMarkColor).not.toBe(g1MarkColor);
  await expect(page.locator('.acc-g1-console-detail')).toHaveCount(0);

  await page.getByLabel('Presentation theme').selectOption('matrix');
  await expect(shell).toHaveAttribute('data-acc-theme', 'matrix');
  const matrix = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      good: style.getPropertyValue('--acc-status-good').trim(),
      warn: style.getPropertyValue('--acc-status-warn').trim(),
      bad: style.getPropertyValue('--acc-status-bad').trim(),
      accent: style.getPropertyValue('--acc-accent-primary').trim(),
    };
  });
  expect([matrix.good, matrix.warn, matrix.bad]).toEqual([g1Console.good, g1Console.warn, g1Console.bad]);
  expect(matrix.accent).not.toBe(g1Console.accent);
  const matrixMarkColor = await commandMark.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(matrixMarkColor).not.toBe(terminalMarkColor);
  await expect(page.locator('.acc-matrix-rain')).toHaveAttribute('aria-hidden', 'true');
  const rainCanvas = page.locator('.acc-matrix-rain__canvas');
  await expect(rainCanvas).toHaveCount(1);
  await expect(rainCanvas).toHaveAttribute('data-size-bands', '3');
  await expect(rainCanvas).toHaveAttribute('data-speed-bands', '3');
  await expect(rainCanvas).toHaveAttribute('data-density', 'variable');
  await expect(rainCanvas).toHaveAttribute('data-glyph-mutation', 'true');
  await expect(rainCanvas).toHaveAttribute('data-head-highlights', 'sparse');
  await expect(rainCanvas).toHaveAttribute('data-motion', 'running');
  await expect(rainCanvas).toHaveAttribute('data-glyph-signature', /.+/);
  expect(await page.locator('.acc-matrix-rain').evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
  await expect.poll(async () => Number(await rainCanvas.getAttribute('data-stream-count'))).toBeGreaterThan(24);
  const firstGlyphSignature = await rainCanvas.getAttribute('data-glyph-signature');
  await expect.poll(async () => rainCanvas.getAttribute('data-glyph-signature')).not.toBe(firstGlyphSignature);
  const firstFrame = Number(await rainCanvas.getAttribute('data-frame'));
  await expect.poll(async () => Number(await rainCanvas.getAttribute('data-frame'))).toBeGreaterThan(firstFrame);
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - window.innerHeight)));
  const scrolledCanvas = await rainCanvas.boundingBox();
  expect(scrolledCanvas.y).toBeLessThanOrEqual(0);
  expect(scrolledCanvas.y + scrolledCanvas.height).toBeGreaterThanOrEqual(page.viewportSize().height);
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.reload();
  await expect(page.locator('.acc-shell')).toHaveAttribute('data-acc-theme', 'matrix');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.acc-view')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.acc-matrix-rain__canvas')).toHaveAttribute('data-motion', 'reduced');
  const reducedFrame = Number(await page.locator('.acc-matrix-rain__canvas').getAttribute('data-frame'));
  await page.waitForTimeout(120);
  expect(Number(await page.locator('.acc-matrix-rain__canvas').getAttribute('data-frame'))).toBe(reducedFrame);
  await page.evaluate(() => localStorage.setItem('acc.presentation-theme.v1', 'light'));
  await page.reload();
  await expect(page.locator('.acc-shell')).toHaveAttribute('data-acc-theme', 'matrix');
});

test('Decepticons uses the G1 insignia purple and a local faction mark', async ({ page }) => {
  await page.goto(pluginUrl);
  await page.getByRole('button', { name: 'Settings' }).click();
  const shell = page.locator('.acc-shell');
  const mark = page.locator('.acc-command-mark');
  const autobotMask = await mark.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.maskImage || style.webkitMaskImage;
  });
  const semanticColors = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return ['--acc-status-good', '--acc-status-warn', '--acc-status-bad'].map((token) => style.getPropertyValue(token).trim());
  });

  await page.getByLabel('Presentation theme').selectOption('decepticons');
  await expect(shell).toHaveAttribute('data-acc-theme', 'decepticons');
  await expect(page.getByLabel('Presentation theme')).toHaveValue('decepticons');
  await expect(page.getByLabel('Presentation theme').locator('option:checked')).toHaveText('Decepticons');
  await expect(mark).toHaveAttribute('data-acc-faction', 'decepticon');
  const decepticonPresentation = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      foreground: style.color,
      accent: style.getPropertyValue('--acc-accent-primary').trim(),
      mark: style.getPropertyValue('--acc-command-mark-color').trim(),
      semantic: ['--acc-status-good', '--acc-status-warn', '--acc-status-bad'].map((token) => style.getPropertyValue(token).trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(decepticonPresentation).toEqual({
    background: 'rgb(9, 6, 15)',
    foreground: 'rgb(235, 224, 246)',
    accent: '#692789',
    mark: '#692789',
    semantic: semanticColors,
    overflow: 0,
  });
  const decepticonMask = await mark.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.maskImage || style.webkitMaskImage;
  });
  expect(decepticonMask).toMatch(/^url\("data:image\/png;base64,/);
  expect(decepticonMask).not.toBe(autobotMask);
  expect(await mark.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(105, 39, 137)');
  await expect(page.locator('.acc-g1-console-detail')).toHaveCount(0);
  await expect(page.locator('.acc-matrix-rain')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.acc-shell')).toHaveAttribute('data-acc-theme', 'decepticons');
  await expect(page.locator('.acc-command-mark')).toHaveAttribute('data-acc-faction', 'decepticon');
});

test('desktop header keeps title, Settings, and Search in one compact row', async ({ page }) => {
  await routeDomainProjection(page, demoDomainProjection);
  await page.setViewportSize({ width: 1210, height: 700 });
  await page.goto(pluginUrl);
  await expect(page.locator('.acc-hero').getByLabel('Presentation theme')).toHaveCount(0);
  await expect(page.locator('.acc-hero').getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('AUTOBOT SYSTEMS · READ-ONLY PROJECTION', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What we built, what the evidence established, and what is available now.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Prototype fixtures', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Dev fixtures', { exact: true })).toBeVisible();
  const geometry = await page.locator('.acc-hero h1').evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    const text = range.getBoundingClientRect();
    const actions = document.querySelector('.acc-hero__actions').getBoundingClientRect();
    const hero = document.querySelector('.acc-hero').getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
      leftAligned: getComputedStyle(heading).textAlign === 'left' || getComputedStyle(heading).textAlign === 'start',
      sameRow: Math.abs((actions.top + actions.height / 2) - (text.top + text.height / 2)) < 12,
      controlsAlignment: getComputedStyle(document.querySelector('.acc-hero__actions')).justifyContent,
      clipped: heading.scrollWidth > heading.clientWidth + 1,
      compact: hero.height <= 88,
      overlaps: text.left < actions.right
        && text.right > actions.left
        && text.top < actions.bottom
        && text.bottom > actions.top,
    };
  });
  expect(geometry).toEqual({
    fontSize: expect.any(Number),
    leftAligned: true,
    sameRow: true,
    controlsAlignment: 'flex-end',
    clipped: false,
    compact: true,
    overlaps: false,
  });
  expect(geometry.fontSize).toBeLessThanOrEqual(42);
});

test('mobile hero exposes a 44px Search button and Search has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl);
  const searchButton = page.locator('.acc-hero-search-mobile');
  const settingsButton = page.locator('.acc-hero').getByRole('button', { name: 'Settings' });
  await expect(searchButton).toBeVisible();
  await expect(settingsButton).toBeVisible();
  expect((await searchButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await settingsButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await searchButton.click();
  await expect(page).toHaveURL(new RegExp(`${searchUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await page.locator('.acc-local-search-field').getByRole('searchbox', { name: 'Search ACC' }).fill('qwen heretic');
  await expect(page.getByText('Qwen3.6 35B Heretic · Q4_K_M · MTP-N2', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('Portfolio stays on its frozen showcase projection', async ({ page }) => {
  await page.goto(pluginUrl + '?view=portfolio');
  const publicProjects = page.getByRole('region', { name: 'GitHub Showcase Projects' });
  await expect(publicProjects.locator('[data-showcase-project]')).toHaveCount(3);
  for (const repository of ['AlexGeslani/Jarvis', 'AlexGeslani/StackLogic', 'AlexGeslani/8-Ball']) {
    await expect(publicProjects.getByText(repository, { exact: true })).toBeVisible();
  }
  await expect(publicProjects.getByText('Public', { exact: true })).toHaveCount(3);
  const jarvis = publicProjects.locator('[data-showcase-project="jarvis"]');
  await expect(jarvis.getByRole('link', { name: 'Live demo' })).toHaveCount(0);
  await expect(jarvis.getByRole('link', { name: 'Architecture' })).toBeVisible();
  const internal = page.getByRole('region', { name: 'Internal Products & Capabilities' });
  await expect(internal.getByText('Jarvis Voice Agent', { exact: true })).toHaveCount(0);

});

test('Voice Lab exposes the measured six-route comparison and reliability boundary without a private static matrix', async ({ page }) => {
  await page.goto(pluginUrl + '?view=portfolio&product=voice-lab');
  await expect(page.getByRole('heading', { name: 'Voice runtime comparison', exact: true })).toBeVisible();
  await expect(page.locator('img.acc-voice-visual')).toHaveCount(0);
  await expect(page.locator('[data-voice-route]')).toHaveCount(6);
  await expect(page.getByText('1 timeout', { exact: true })).toBeVisible();
  await expect(page.getByText(/same sentence.*three warm end-to-end requests/i)).toBeVisible();
  await expect(page.getByText('Measured 2026-07-26', { exact: true })).toBeVisible();
});

test('Voice Lab comparison is readable without mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=portfolio&product=voice-lab');
  await expect(page.getByRole('heading', { name: 'Voice runtime comparison', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.acc-voice-mobile')).toBeVisible();
  await expect(page.locator('.acc-voice-desktop')).toBeHidden();
});

test('measured benchmark view distinguishes verified capability, live completion, and coverage-labeled averages', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.goto(pluginUrl + '?view=benchmarks');
  const comparison = page.getByRole('region', { name: 'Three-score model comparison' });
  await expect(comparison).toBeVisible();
  const measuredConditionCount = await comparison.locator('[data-benchmark-profile]').count();
  expect(measuredConditionCount).toBeGreaterThan(0);
  const measuredVisuals = page.getByRole('region', { name: 'Suite score and completion details' });
  await expect(measuredVisuals.locator('[data-measured-suite]')).toHaveCount(3);
  await expect(measuredVisuals.locator('[data-measured-suite="instruction"] [data-score-bar]')).toHaveCount(measuredConditionCount);
  await expect(measuredVisuals.locator('[data-measured-suite="tools"] [data-score-bar]')).toHaveCount(measuredConditionCount);
  await expect(measuredVisuals.locator('[data-measured-suite="agent"] [data-score-bar]')).toHaveCount(measuredConditionCount);
  const qwenAgentScore = measuredVisuals.locator('[data-measured-suite="agent"] [data-score-bar="qwen38-2b-mlx"]');
  await expect(qwenAgentScore.getByText('0.0', { exact: true })).toBeVisible();
  await expect(qwenAgentScore.getByText('0 / 24 frozen hard tasks · retrospective projection', { exact: true })).toBeVisible();
  await expect(measuredVisuals.getByText('36 / 40 strict prompts', { exact: true })).toBeVisible();
  await expect(measuredVisuals.getByText('Illustrative', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: 'Three-score model comparison' })).toBeVisible();
  await expect(comparison.locator('[data-benchmark-profile]')).toHaveCount(measuredConditionCount);
  const luna = comparison.locator('[data-benchmark-profile="gpt56-luna-max"]');
  await expect(luna.getByText('82.5', { exact: true })).toBeVisible();
  await expect(luna.getByText('40.0', { exact: true })).toBeVisible();
  await expect(luna.getByText('37.5', { exact: true })).toBeVisible();
  await expect(luna.getByText('53.3', { exact: true })).toBeVisible();
  await expect(luna.getByText('Complete · 3/3 verified', { exact: true })).toBeVisible();
  await expect(luna.getByText('3 verified', { exact: true })).toBeVisible();
  const sol = comparison.locator('[data-benchmark-profile="gpt56-sol-max"]');
  await expect(sol.getByText('90.0', { exact: true })).toBeVisible();
  await expect(sol.getByText('48.0', { exact: true })).toBeVisible();
  await expect(sol.getByText('54.2', { exact: true })).toBeVisible();
  await expect(sol.getByText('64.1', { exact: true })).toBeVisible();
  await expect(sol.getByText('3 verified', { exact: true })).toBeVisible();
  const qwen2b = comparison.locator('[data-benchmark-profile="qwen38-2b-mlx"]');
  await expect(qwen2b.getByText('22.5', { exact: true })).toBeVisible();
  await expect(qwen2b.getByText('6.0', { exact: true })).toBeVisible();
  await expect(qwen2b.getByText('0.0', { exact: true })).toBeVisible();
  await expect(qwen2b.getByText('9.5', { exact: true })).toBeVisible();
  await expect(qwen2b.getByText('Complete · 3/3 verified', { exact: true })).toBeVisible();
  await expect(qwen2b.getByText('3 verified', { exact: true })).toBeVisible();
  const gpu35 = comparison.locator('[data-benchmark-profile="qwen36-35b-heretic-gpu-b"]');
  await expect(gpu35.locator('.acc-three-score__value').getByText('77.5', { exact: true })).toBeVisible();
  await expect(gpu35.locator('.acc-three-score__value').getByText('34.0', { exact: true })).toBeVisible();
  await expect(gpu35.locator('.acc-three-score__value').getByText('41.7', { exact: true })).toBeVisible();
  await expect(gpu35.getByText('In progress', { exact: true })).toHaveCount(0);
  await expect(gpu35.getByText('Queued', { exact: true })).toHaveCount(0);
  await expect(gpu35.getByText('51.1', { exact: true })).toBeVisible();
  await expect(gpu35.getByText('Complete · 3/3 verified', { exact: true })).toBeVisible();
  await expect(gpu35.getByText('3 verified', { exact: true })).toBeVisible();
  const qwen27 = comparison.locator('[data-benchmark-profile="qwen38-27b-rvn-heretic-gpu-b"]');
  await expect(qwen27.locator('.acc-three-score__value').getByText('80.0', { exact: true })).toBeVisible();
  await expect(qwen27.getByText('In progress', { exact: true })).toHaveCount(0);
  await expect(qwen27.getByText('Queued', { exact: true })).toHaveCount(2);
  await expect(qwen27.getByText('80.0', { exact: true })).toHaveCount(2);
  await expect(qwen27.getByText('In progress · 1/3 verified', { exact: true })).toBeVisible();
  const qwen4b = comparison.locator('[data-benchmark-profile="qwen38-4b-mlx"]');
  const qwen4bSuites = qwen4b.locator('.acc-three-score__value');
  await expect(qwen4bSuites).toHaveCount(3);
  for (const suite of ['IFEval', 'BFCL V4 Hard-50', 'tau2 Hard-24']) {
    await expect(qwen4b.getByText(suite, { exact: true })).toBeVisible();
  }
  const qwen4bStates = await qwen4bSuites.locator('strong').allTextContents();
  expect(qwen4bStates.every((state) => /^(?:\d+\.\d|In progress|Queued|Pending)$/.test(state))).toBe(true);
  const qwen4bProgress = qwen4bSuites.getByRole('progressbar');
  for (let index = 0; index < await qwen4bProgress.count(); index += 1) {
    const progress = qwen4bProgress.nth(index);
    const current = Number(await progress.getAttribute('aria-valuenow'));
    const total = Number(await progress.getAttribute('aria-valuemax'));
    expect(Number.isFinite(current) && Number.isFinite(total) && current >= 0 && current <= total).toBe(true);
  }
  await expect(qwen4b.getByText(/^(?:Pending|In progress|Complete) · [0-3]\/3 verified$/)).toBeVisible();
  await expect(comparison.getByText('Illustrative', { exact: true })).toHaveCount(0);
  await expect(comparison.getByText('Current average is the equal-weight arithmetic mean', { exact: false })).toBeVisible();
  await sol.getByRole('button', { name: /GPT-5\.6 Sol/i }).click();
  await expect(page).toHaveURL(/condition=gpt56-sol-max/);
  await expect(page.getByRole('heading', { name: 'GPT-5.6 Sol · Max' })).toBeVisible();
  await expect(page.getByText('Current suite average', { exact: true })).toBeVisible();
  await expect(page.getByText('64.1', { exact: true })).toBeVisible();
  const solOperations = page.getByRole('region', { name: 'Operational benchmark footprint' });
  await expect(solOperations.getByText('22.64M', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('1.85M', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('24.49M', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('$127.58', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('$0.23', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('Marginal API charge', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('$0', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('API-equivalent estimate (not billed)', { exact: true })).toBeVisible();
  await expect(solOperations.getByRole('heading', { name: 'Frontier route performance' })).toBeVisible();
  await expect(solOperations.getByText('13.34s', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('35.58s', { exact: true })).toBeVisible();
  await expect(solOperations.getByText('30.26 tok/s', { exact: true })).toBeVisible();
  await page.goto(pluginUrl + '?view=benchmarks');
  await luna.getByRole('button', { name: /GPT-5\.6 Luna/i }).click();
  await expect(page).toHaveURL(/condition=gpt56-luna-max/);
  await expect(page.getByRole('heading', { name: 'GPT-5.6 Luna · Max' })).toBeVisible();
  await expect(page.getByText('20 / 50 correct · 40.0%', { exact: true })).toBeVisible();
  await expect(page.getByText('25.20% official subset aggregation', { exact: true })).toBeVisible();
  await expect(page.getByText('acc-tau2-fixed-judge-v1.1 · GPT-5.5 Low', { exact: true })).toBeVisible();
  const lunaOperations = page.getByRole('region', { name: 'Operational benchmark footprint' });
  await expect(lunaOperations.getByText('18.55M', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('1.60M', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('20.15M', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('$5.63', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('$0.12', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('Cached input', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('Not separately reported', { exact: true })).toHaveCount(2);
  await expect(lunaOperations.getByRole('heading', { name: 'Frontier route performance' })).toBeVisible();
  await expect(lunaOperations.getByText('8.85s', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('21.88s', { exact: true })).toBeVisible();
  await expect(lunaOperations.getByText('42.21 tok/s', { exact: true })).toBeVisible();
  await page.goto(pluginUrl + '?view=benchmarks');
  await qwen2b.getByRole('button', { name: /Qwen 3\.8 2B Distill/i }).click();
  await expect(page).toHaveURL(/condition=qwen38-2b-mlx/);
  await expect(page.getByRole('heading', { name: 'Qwen 3.8 2B Distill · 4-bit MLX' })).toBeVisible();
  await expect(page.getByText('9 / 40 strict prompts', { exact: true })).toBeVisible();
  await expect(page.getByText('50 / 50 frozen hard cases · 119 / 119 generated · retrospective calibration', { exact: true })).toBeVisible();
  await expect(page.getByText('0 / 24 frozen hard tasks · retrospective projection', { exact: true })).toBeVisible();
  await expect(page.getByText('Current suite average', { exact: true })).toBeVisible();
  await expect(page.getByText('9.5', { exact: true })).toBeVisible();
  await expect(page.getByText('Complete · 3/3 final-verified suites', { exact: true })).toBeVisible();
  const qwenOperations = page.getByRole('region', { name: 'Operational benchmark footprint' });
  await expect(qwenOperations.getByText('51.30M', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('1.74M', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('53.03M', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByRole('heading', { name: 'Local runtime performance' })).toBeVisible();
  await expect(qwenOperations.getByText('21.27s', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('78.28s', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('29.45 tok/s', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('MLX/Metal', { exact: true })).toBeVisible();
  await expect(qwenOperations.getByText('Verified aggregate', { exact: true })).toBeVisible();
  await page.goto(pluginUrl + '?view=benchmarks');
  await gpu35.getByRole('button', { name: /Qwen3\.6 35B Heretic/i }).click();
  await expect(page.getByRole('heading', { name: 'Qwen3.6 35B Heretic · Q4_K_M · MTP-N2' })).toBeVisible();
  await expect(page.getByText('50 / 50 frozen hard cases · 119 / 119 generated · retrospective calibration', { exact: true })).toBeVisible();
  await expect(page.getByText('17 / 50 correct · 34.0%', { exact: true })).toBeVisible();
  await expect(page.getByText('10 / 24 frozen hard tasks · retrospective projection', { exact: true })).toBeVisible();
  await expect(page.getByText('Retail', { exact: true })).toBeVisible();
  await expect(page.getByText('0 / 12 · 0.0%', { exact: true })).toBeVisible();
  await expect(page.getByText('Telecom', { exact: true })).toBeVisible();
  await expect(page.getByText('10 / 12 · 83.3%', { exact: true })).toBeVisible();
  await expect(page.getByText('Complete · 3/3 final-verified suites', { exact: true })).toBeVisible();
  const gpuOperations = page.getByRole('region', { name: 'Operational benchmark footprint' });
  await expect(gpuOperations.getByText('36.56M', { exact: true })).toBeVisible();
  await expect(gpuOperations.getByText('5.48M', { exact: true })).toBeVisible();
  await expect(gpuOperations.getByText('42.05M', { exact: true })).toBeVisible();
  await expect(gpuOperations.getByText('Verified aggregate', { exact: true })).toBeVisible();
  await page.goto(pluginUrl + '?view=benchmarks');
  await qwen27.getByRole('button', { name: /Qwen3\.8 27B RVN Heretic/i }).click();
  await expect(page.getByRole('heading', { name: 'Qwen3.8 27B RVN Heretic · Q4_K_M · MTP-N1' })).toBeVisible();
  await expect(page.getByText('32 / 40 strict prompts', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ \/ 119 generated · score withheld/, { exact: true })).toBeVisible();
  await expect(page.locator('.acc-core-score-card__denominator').filter({ hasText: /\d+ \/ 24 (queued · score withheld|live · score withheld|frozen hard tasks)/ })).toBeVisible();
  await expect(page.getByText('In progress · 1/3 final-verified suites · pending suites excluded', { exact: true })).toBeVisible();
  const qwen27Operations = page.getByRole('region', { name: 'Operational benchmark footprint' });
  await expect(qwen27Operations.getByText('80.33K', { exact: true })).toBeVisible();
  await expect(qwen27Operations.getByText('102.11s', { exact: true })).toBeVisible();
  await expect(qwen27Operations.getByText('209.92s', { exact: true })).toBeVisible();
  await expect(qwen27Operations.getByText('19.03 tok/s', { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('condition detail opens exact retained canonical run evidence', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm');
  await expect(page).toHaveURL(/condition=qwen36-awq-vllm/);
  await expect(page.getByText('Condition fingerprint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open run evidence for tool-use bfcl-v3/i }).click();
  await expect(page).toHaveURL(/result=r-bfcl-qwen/);
  await expect(page).toHaveURL(/release=bfcl-v3/);
  await expect(page.getByRole('heading', { name: 'Run evidence' })).toBeVisible();
});

test('capability rollup keeps post-freeze coverage gaps Unknown and out of complete ranking', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=rollup');
  await expect(page).toHaveURL(/domain=rollup/);
  const complete = page.getByRole('region', { name: 'Comparable rollup' });
  await expect(complete.locator('.acc-capability-row')).toHaveCount(0);
  const partial = page.getByRole('region', { name: 'Partial evidence' });
  await expect(partial.getByText('GPT-5.6 · Max · API', { exact: true })).toBeVisible();
  await expect(partial.getByText('Qwen3.6 35B · AWQ · vLLM', { exact: true })).toBeVisible();
  await expect(partial.getByText('Devstral Small 2 · FP8 · vLLM', { exact: true })).toBeVisible();
  await expect(partial.getByText('2/4 domains · not ranked with complete coverage', { exact: true })).toHaveCount(2);
  await expect(partial.getByText('1/4 domains · not ranked with complete coverage', { exact: true })).toBeVisible();
  const qwenRow = partial.locator('.acc-capability-row').filter({ hasText: 'Qwen3.6 35B · AWQ · vLLM' });
  await expect(qwenRow.getByText('Unknown', { exact: true })).toHaveCount(2);
  for (const contribution of ['84.9%', '87.6%']) await expect(qwenRow.getByText(contribution, { exact: true })).toBeVisible();
  await expect(page.getByText('Missing evidence is Unknown, never zero.', { exact: true })).toBeVisible();
});

test('testing records live with their owning projects without a global Evidence index', async ({ page }) => {
  await page.goto(pluginUrl);
  await expect(page.getByRole('button', { name: 'Evidence index' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Evaluation evidence' })).toHaveCount(0);

  await page.goto(pluginUrl + '?view=portfolio&product=voice-lab');
  const voiceHistory = page.getByRole('region', { name: 'Testing history' });
  await expect(voiceHistory.getByRole('heading', { name: 'Prime voice runtime comparison' })).toBeVisible();
  await expect(voiceHistory.getByRole('heading', { name: 'Voice interaction latency envelope' })).toBeVisible();
  await expect(voiceHistory.getByText('Question', { exact: true })).toHaveCount(2);
  await expect(voiceHistory.getByText('Current finding', { exact: true })).toHaveCount(2);
  await expect(voiceHistory.getByText('Decision outcome', { exact: true })).toHaveCount(2);

  await page.goto(pluginUrl + '?view=portfolio&product=model-serving');
  await expect(page.getByRole('region', { name: 'Testing history' }).getByRole('heading', { name: 'Qwen3.6 production condition' })).toBeVisible();


  await page.goto(pluginUrl + '?view=evidence&evaluation=eval-voice-latency');
  await expect(page).toHaveURL(/view=portfolio.*product=voice-lab/);
  await expect(page.getByRole('heading', { name: 'Prime Voice Lab' })).toBeVisible();
});

test('top-level page explanations use accessible information popovers instead of repeated ledes', async ({ page }) => {
  for (const [route, title, copy] of [
    ['?view=portfolio', 'Portfolio', 'Public GitHub evidence is refreshed'],
    ['?view=analytics', 'Analytics', 'One reporting destination for web properties'],
    ['?view=search', 'Search', 'Typing filters the bundled ACC index'],
  ]) {
    await page.goto(pluginUrl + route);
    const view = page.locator('.acc-view').first();
    await expect(view.locator(':scope > .acc-lede')).toHaveCount(0);
    await expect(view.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const info = view.getByRole('button', { name: `About ${title}` });
    await expect(info).toBeVisible();
    const panelId = await info.getAttribute('aria-controls');
    expect(panelId).toMatch(/^acc-info-/);
    await info.click();
    await expect(view.locator(`#${panelId}`)).toHaveAttribute('role', 'note');
    await expect(view.getByText(new RegExp(copy))).toBeVisible();
  }
});

test('mobile composition has no primary horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=benchmarks');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('region', { name: 'Three-score model comparison' })).toBeVisible();
  expect(await page.locator('[data-benchmark-profile]').count()).toBeGreaterThan(0);
  await page.goto(pluginUrl + '?view=benchmarks&domain=rollup');
  const rollupOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(rollupOverflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('region', { name: 'Comparable rollup' })).toBeVisible();
});

test('critical accessibility scan is clean across overview and detail routes', async ({ page }) => {
  await routeWebAnalytics(page);
  for (const route of [
    '',
    '?view=analytics&domain=web&subject=kungfuclan.com&range=30d',
    '?view=benchmarks&domain=rollup',
    '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm',
    '?view=settings',
    '?view=hivemind',
  ]) {
    await page.goto(pluginUrl + route);
    await expect(page.locator('.acc-shell')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('.acc-shell').analyze();
    expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)), route).toEqual([]);
  }
});

test('cross-domain result and run deep links fail closed', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=coding&condition=qwen36-awq-vllm&result=r-bfcl-qwen&release=bfcl-v3&run=run-bfcl-qwen');
  await expect(page.getByText('Run unavailable for selected condition', { exact: true })).toBeVisible();
  await expect(page.getByText(/BFCL canonical run.*Qwen3\.6/i)).toHaveCount(0);
});

test('missing and unknown run domains fail closed instead of using list fallback', async ({ page }) => {
  const suffix = '&condition=qwen36-awq-vllm&result=r-bfcl-qwen&release=bfcl-v3&run=run-bfcl-qwen';
  for (const domain of ['', '&domain=evil']) {
    await page.goto(pluginUrl + '?view=benchmarks' + domain + suffix);
    await expect(page.getByText('Run unavailable for selected condition', { exact: true })).toBeVisible();
    await expect(page.getByText(/BFCL canonical run.*Qwen3\.6/i)).toHaveCount(0);
  }
});

test('provisional result deep links fail closed', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm&result=r-bfcl-qwen-provisional&release=bfcl-v4-preview&run=run-bfcl-qwen-preview');
  await expect(page.getByText('Run unavailable for selected condition', { exact: true })).toBeVisible();
  await expect(page.getByText(/BFCL preview.*Qwen3\.6/i)).toHaveCount(0);
});

test('valid coding lineage opens its exact canonical result and run', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=coding&condition=qwen36-awq-vllm');
  await page.getByRole('button', { name: 'Open run evidence for coding bigcodebench-hard-2026-06' }).click();
  await expect(page).toHaveURL(/result=r-code-qwen/);
  await expect(page.getByText('r-code-qwen', { exact: true })).toBeVisible();
  await expect(page.getByText('BigCodeBench-Hard · Qwen3.6 AWQ', { exact: true })).toBeVisible();
});


test('benchmark domain is reload-stable and participates in browser history', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pluginUrl + '?view=benchmarks');
  await page.goto(pluginUrl + '?view=benchmarks&domain=rollup');
  await expect(page).toHaveURL(/domain=rollup/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comparable rollup' })).toBeVisible();
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(page).toHaveURL(/domain=coding/);
  await expect(page.getByRole('heading', { name: 'Offline-safe Coding' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline-safe Coding' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Comparable rollup' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Three-score model comparison' })).toBeVisible();
  expect(errors.filter((message) => /hooks|rendered fewer|rendered more/i.test(message))).toEqual([]);
});

test('mobile detail routes retain an immediate Dev fixture disclosure', async ({ page }) => {
  await routeDomainProjection(page, demoDomainProjection);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=benchmarks&condition=qwen36-awq-vllm');
  const label = page.getByText('Dev fixtures', { exact: true });
  await expect(label).toBeVisible();
  expect(await label.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(844);
});

test('every Analytics and Benchmarks data column is stably sortable with accessible state', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.goto(pluginUrl + '?view=analytics&domain=web&subject=kungfuclan.com&range=30d');
  await page.getByText('Daily values and gap states', { exact: true }).click();

  const daily = page.getByRole('table', { name: 'Daily traffic exact values' });
  const countries = page.getByRole('table', { name: 'Authoritative requests by country' });
  await exerciseEverySortHeader(daily, ['Date', 'State', 'Requests', 'Cloudflare Visits', 'Transfer']);
  await exerciseEverySortHeader(countries, ['Country', 'Requests', 'Transfer']);

  const countryButton = countries.getByRole('button', { name: 'Sort by Country' });
  await countryButton.click();
  const ascendingCountries = await countries.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[0].textContent.trim()));
  expect(ascendingCountries).toEqual([...ascendingCountries].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
  await countryButton.click();
  const descendingCountries = await countries.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[0].textContent.trim()));
  expect(descendingCountries).toEqual([...descendingCountries].sort((a, b) => b.localeCompare(a, 'en', { sensitivity: 'base', numeric: true })));

  const dailyRequests = daily.getByRole('button', { name: 'Sort by Requests' });
  await dailyRequests.click();
  const ascendingRequests = await daily.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[2].textContent.trim()));
  expect(ascendingRequests.findIndex((value) => value === '—')).toBeGreaterThan(0);
  expect(ascendingRequests.slice(ascendingRequests.findIndex((value) => value === '—')).every((value) => value === '—')).toBe(true);
  await dailyRequests.click();
  const descendingRequests = await daily.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.cells[2].textContent.trim()));
  expect(descendingRequests.slice(descendingRequests.findIndex((value) => value === '—')).every((value) => value === '—')).toBe(true);

  await page.goto(pluginUrl + '?view=benchmarks');
  for (const suite of ['IFEval', 'BFCL V4 Hard-50', 'tau2 Hard-24']) {
    await exerciseEverySortHeader(page.getByRole('table', { name: `${suite} measured suite comparison` }), ['Tested condition', 'Score or completion']);
  }
  const comparison = page.getByRole('table', { name: 'Three-score model comparison' });
  await exerciseEverySortHeader(comparison, ['Tested condition', 'Instruction following', 'Native tool use', 'Multi-turn agent', 'Current average', 'Verified suites']);
  const agentButton = comparison.getByRole('button', { name: 'Sort by Multi-turn agent' });
  const comparisonRows = comparison.locator('[role="rowgroup"] [data-benchmark-profile]');
  const nonFinalAgentProfiles = await comparisonRows.evaluateAll((rows) => rows
    .filter((row) => row.querySelectorAll('[role="cell"]')[2]?.querySelector('[role="progressbar"]'))
    .map((row) => row.getAttribute('data-benchmark-profile'))
    .sort());
  expect(nonFinalAgentProfiles.length).toBeGreaterThan(0);
  for (const direction of ['ascending', 'descending']) {
    await agentButton.click();
    await expect(comparison.getByRole('columnheader', { name: /Sort by Multi-turn agent/ })).toHaveAttribute('aria-sort', direction);
    const orderedProfiles = await comparisonRows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-benchmark-profile')));
    expect(orderedProfiles.slice(-nonFinalAgentProfiles.length).sort()).toEqual(nonFinalAgentProfiles);
  }

  await page.goto(pluginUrl + '?view=benchmarks&domain=tool-use');
  const leaderboard = page.getByRole('table', { name: 'Tool Use benchmark leaderboard' });
  await exerciseEverySortHeader(leaderboard, ['Rank', 'Tested condition', 'Score', 'Denominator', 'Release']);
  const releaseButton = leaderboard.getByRole('button', { name: 'Sort by Release' });
  await releaseButton.focus();
  await page.keyboard.press('Enter');
  await expect(leaderboard.getByRole('columnheader', { name: /Sort by Release/ })).toHaveAttribute('aria-sort', 'descending');
  await page.keyboard.press('Space');
  await expect(leaderboard.getByRole('columnheader', { name: /Sort by Release/ })).toHaveAttribute('aria-sort', 'ascending');
  expect(browserErrors).toEqual([]);
});

test('mobile sort controls remain visible, touch-safe, and overflow-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    '?view=analytics&domain=web&subject=kungfuclan.com&range=30d',
    '?view=benchmarks',
    '?view=benchmarks&domain=tool-use',
  ];
  for (const route of routes) {
    await page.goto(pluginUrl + route);
    if (route.startsWith('?view=analytics')) await page.getByText('Daily values and gap states', { exact: true }).click();
    const controls = page.locator('.acc-sort-button:visible');
    await expect(controls.first(), route).toBeVisible();
    expect(await controls.count(), route).toBeGreaterThan(0);
    const undersized = await controls.evaluateAll((nodes) => nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width + 0.01 >= 44 && rect.height + 0.01 >= 44 ? [] : [{ label: node.textContent.trim(), width: rect.width, height: rect.height }];
    }));
    expect(undersized, route).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), route).toBeLessThanOrEqual(1);
  }
});

test('mobile benchmark condition controls meet the 44px touch-target floor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=benchmarks');
  const undersized = await page.locator('.acc-evidence-matrix .acc-table-link, .acc-three-score .acc-table-link').evaluateAll((nodes) => nodes.flatMap((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
    if (rect.width + 0.01 >= 44 && rect.height + 0.01 >= 44) return [];
    return [{ label: node.textContent.trim(), width: rect.width, height: rect.height }];
  }));
  expect(undersized).toEqual([]);
});

test('every visible mobile ACC control meets the 44px touch-target floor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    '',
    '?view=portfolio',
    '?view=portfolio&product=model-serving',
    '?view=benchmarks',
    '?view=benchmarks&domain=rollup',
    '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm',
    '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm&result=r-bfcl-qwen&release=bfcl-v3&run=run-bfcl-qwen',
    '?view=settings',
    '?view=hivemind',
  ];
  for (const route of routes) {
    await page.goto(pluginUrl + route);
    const undersized = await page.locator('.acc-shell button, .acc-shell a').evaluateAll((nodes) => nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
      if (rect.width + 0.01 >= 44 && rect.height + 0.01 >= 44) return [];
      return [{ label: node.getAttribute('aria-label') || node.textContent.trim(), className: node.className, width: rect.width, height: rect.height }];
    }));
    expect(undersized, route).toEqual([]);
  }
});

test('SPA navigation moves focus to the main result region', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks&domain=reasoning');
  await page.getByRole('button', { name: /Qwen3\.6 35B.*AWQ.*vLLM/i }).click();
  await expect(page.locator('.acc-main')).toBeFocused();
});

test('passive Antigravity waiting keeps last-good windows explicitly non-current and is the only healthy-system issue', async ({ page }) => {
  const now = new Date();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const resetsAt = new Date(now.getTime() + 60 * 60_000).toISOString();
  await routeDomainProjection(page, demoDomainProjection);
  await routeProviderUsage(page, [
    { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt, state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 10, resetsAt }] },
    { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'claude-status-line', observedAt, state: 'fresh', windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 10, resetsAt }] },
    { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt, state: 'inactive', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 25, resetsAt }] },
    { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers', adapterVersion: '1.0.0', sourceVersion: 'brave-rate-limit-headers', observedAt, state: 'fresh', windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 10, resetsAt, limit: 2000, remaining: 1800 }], rateLimitPerSecond: 1 },
  ], now.toISOString());
  await page.goto(pluginUrl);
  const card = page.locator('[data-provider="antigravity"]');
  await expect(card.getByText('Waiting for active trusted session', { exact: true })).toBeVisible();
  await expect(card.getByText(/^Last successful observation /)).toBeVisible();
  await expect(card.getByText('Last-good quota only — current headroom is not claimed.', { exact: true })).toBeVisible();
  const overviewIssues = page.getByRole('region', { name: 'Integration issues summary' });
  await expect(overviewIssues.locator('.acc-overview-exception')).toHaveCount(1);
  await expect(overviewIssues.getByText('Antigravity — Waiting for active trusted session', { exact: true })).toBeVisible();
});

test('provider usage projects a sanitized snapshot without expanding primary navigation', async ({ page }) => {
  const observedAt = new Date().toISOString();
  const resetsAt = new Date(Date.now() + 60 * 60_000).toISOString();
  await routeProviderUsage(page, [
    { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt, state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 10, resetsAt }] },
    { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'documented Claude Code status-line rate_limits event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'claude-status-line', observedAt, state: 'fresh', windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 10, resetsAt }] },
    { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt, state: 'fresh', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 10, resetsAt }] },
  ], observedAt);
  await page.goto(pluginUrl);
  await expect(page.getByRole('heading', { name: 'Provider usage' })).toBeVisible();
  await expect(page.locator('[data-provider="codex"]')).toContainText(/Codex \/ ChatGPT/);
  await expect(page.locator('[data-provider="claude"]').getByText(/^Last observed /)).toBeVisible();
  await expect(page.locator('[data-provider="claude"]').getByText('Genuine activity updates private evidence immediately; the public snapshot advances on the scheduled collector. Guarded /usage refresh also runs when a reported window resets or after 12 hours.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-provider="claude"]').getByText(/^stale$/i)).toHaveCount(0);
  await expect(page.locator('[data-provider="antigravity"]').getByText(/^Last observed /)).toBeVisible();
  await expect(page.locator('[data-provider="antigravity"]').getByText(/^stale$/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Open details' }).click();
  await expect(page).toHaveURL(/view=analytics.*domain=ai.*subject=provider-usage/);
  await expect(page.getByRole('heading', { name: 'Usage & limits' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Command Center sections' }).getByRole('button')).toHaveCount(5);
});

test('provider quota windows render accessible progress bars with reset information below', async ({ page }) => {
  await routeProviderUsage(page, [{
    provider: 'claude',
    product: 'Claude Code',
    metricClass: 'subscription_quota',
    authority: 'documented Claude Code status-line rate_limits event',
    collectionMode: 'status_line_cache',
    adapterVersion: '1.0.0',
    sourceVersion: 'claude-status-line',
    observedAt: '2026-07-31T23:29:00.000Z',
    state: 'fresh',
    windows: [
      { id: 'five_hour', label: '5-hour window', usedPercent: 40, resetsAt: '2026-08-01T04:00:00.000Z' },
      { id: 'seven_day', label: '7-day window', usedPercent: 20, resetsAt: '2026-08-07T23:30:00.000Z' },
    ],
  }]);
  await page.goto(pluginUrl);
  const claude = page.locator('[data-provider="claude"]');
  await expect(claude.getByRole('progressbar')).toHaveCount(2);
  await expect(claude.getByText(/^Resets /)).toHaveCount(2);
  await expect(claude.getByRole('progressbar').first()).toHaveAttribute('aria-valuemin', '0');
  await expect(claude.getByRole('progressbar').first()).toHaveAttribute('aria-valuemax', '100');
  await expect(claude.getByRole('progressbar').first()).toHaveAttribute('aria-valuetext', /available/i);
  await expect(claude).toContainText(/% available/i);
});

test('Brave Search and ElevenLabs render side by side with exact provider capacity', async ({ page }) => {
  await routeProviderUsage(page, [{
    provider: 'brave-search',
    product: 'Brave Search API',
    metricClass: 'search_api_quota',
    authority: 'Brave Search API rate-limit response headers',
    collectionMode: 'direct_api_headers',
    adapterVersion: '1.0.0',
    sourceVersion: 'brave-rate-limit-headers',
    observedAt: '2026-07-31T23:29:00.000Z',
    state: 'fresh',
    windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 7.9, resetsAt: '2026-08-31T23:59:59.000Z', limit: 2000, remaining: 1842 }],
    rateLimitPerSecond: 1,
    billingPolicy: {
      status: 'owner_confirmed_enabled', monthlyCreditUsd: 5, usdPerThousandRequests: 5,
      creditApplication: 'automatic', authority: 'Owner-confirmed paid access + Brave public pricing',
    },
  }, {
    provider: 'elevenlabs',
    product: 'ElevenLabs',
    metricClass: 'media_api_quota',
    authority: 'ElevenLabs GET /v1/user/subscription',
    collectionMode: 'direct_api',
    adapterVersion: '1.0.0',
    sourceVersion: 'elevenlabs-subscription-api',
    observedAt: '2026-08-30T12:00:00.000Z',
    state: 'fresh',
    windows: [{ id: 'monthly', label: 'Monthly credits', usedPercent: 24, resetsAt: '2026-09-01T00:00:00.000Z', limit: 100000, remaining: 76000 }],
  }]);
  await page.goto(pluginUrl + '?view=usage');
  await expect(page.getByRole('heading', { name: 'Provider APIs' })).toBeVisible();
  const brave = page.locator('[data-provider="brave-search"]');
  const elevenlabs = page.locator('[data-provider="elevenlabs"]');
  await expect(brave).toContainText('1,842 of 2,000 searches available');
  await expect(brave).toContainText('1 request/second');
  await expect(brave).toContainText('Quota refresh uses one successful search and runs at most daily.');
  await expect(brave.getByRole('region', { name: 'Brave billing coverage' })).toContainText('Paid access enabled');
  await expect(brave).toContainText('$5 monthly credit');
  await expect(brave).toContainText('$5 per 1,000 searches after credits');
  await expect(brave).toContainText('Operational request headroom still comes from the API headers above.');
  await expect(brave.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1,842 of 2,000 searches available');
  await expect(elevenlabs).toContainText('76,000 credits available · 24,000 used of 100,000');
  await expect(elevenlabs).toContainText('Monthly credits');
  await expect(elevenlabs.getByText(/^Resets /)).toBeVisible();
  await expect(elevenlabs.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '76,000 credits available · 24,000 used of 100,000');
  const braveBox = await brave.boundingBox();
  const elevenlabsBox = await elevenlabs.boundingBox();
  expect(braveBox).not.toBeNull();
  expect(elevenlabsBox).not.toBeNull();
  expect(elevenlabsBox.x).toBeGreaterThan(braveBox.x);
});

test('expired Claude observations show last-known quota figures with a warning', async ({ page }) => {
  await page.route('**/*/provider-usage.v1.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 'provider-usage-v1',
        generatedAt: '2026-07-31T23:30:00.000Z',
        providers: [{
          provider: 'claude',
          product: 'Claude Code',
          metricClass: 'subscription_quota',
          authority: 'documented Claude Code status-line rate_limits event',
          collectionMode: 'status_line_cache',
          adapterVersion: '1.0.0',
          sourceVersion: 'claude-status-line',
          observedAt: '2026-07-31T23:00:00.000Z',
          state: 'expired',
          windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 88, resetsAt: '2026-07-31T23:15:00.000Z' }],
        }],
      }),
    });
  });
  await page.goto(pluginUrl + '?view=usage');
  await expect(page.locator('.acc-prototype-note')).toContainText('Sanitized snapshot generated');
  const claude = page.locator('[data-provider="claude"]');
  await expect(claude.getByRole('progressbar')).toHaveCount(1);
  await expect(claude.getByText('Expired — reported reset time has passed; showing the last known observation.', { exact: true })).toBeVisible();
  await expect(claude).toContainText('12% available');
});

test('Claude /usage fallback identifies its source and labels the estimated five-hour reset', async ({ page }) => {
  await routeProviderUsage(page, [{
    provider: 'claude',
    product: 'Claude Code',
    metricClass: 'subscription_quota',
    authority: 'authenticated Claude Code /usage limits view',
    collectionMode: 'interactive_cli_usage',
    adapterVersion: '1.0.0',
    sourceVersion: 'claude-usage-cli',
    observedAt: '2026-08-01T19:00:00.000Z',
    state: 'fresh',
    windows: [
      { id: 'five_hour', label: '5-hour window', usedPercent: 15, resetsAt: '2026-08-02T00:00:00.000Z', resetKind: 'estimated_window_end' },
      { id: 'seven_day', label: '7-day window', usedPercent: 11, resetsAt: '2026-08-04T16:00:00.000Z', resetKind: 'provider_reported' },
    ],
  }]);
  await page.goto(pluginUrl + '?view=usage');
  const claude = page.locator('[data-provider="claude"]');
  await expect(claude).toContainText('authenticated Claude Code /usage limits view');
  await expect(claude.getByText(/^Estimated reset by /)).toHaveCount(1);
  await expect(claude.getByText(/^Resets /)).toHaveCount(1);
  await expect(claude.getByRole('progressbar')).toHaveCount(2);
});

test('Codex reset credits render as a separate read-only availability panel', async ({ page }) => {
  await routeProviderUsage(page, [{
    provider: 'codex',
    product: 'Codex / ChatGPT',
    metricClass: 'subscription_quota',
    authority: 'installed Codex app-server account/rateLimits/read',
    collectionMode: 'local_app_server',
    adapterVersion: '1.0.0',
    sourceVersion: 'installed-app-server',
    observedAt: '2026-07-31T23:29:00.000Z',
    state: 'fresh',
    windows: [
      { id: 'primary', label: 'Primary window', usedPercent: 40, resetsAt: '2026-08-01T04:00:00.000Z' },
      { id: 'secondary', label: 'Secondary window', usedPercent: 20, resetsAt: '2026-08-07T23:30:00.000Z' },
    ],
    resetCredits: {
      availableCount: 2,
      credits: [
        { expiresAt: '2026-08-10T00:00:00.000Z' },
        { expiresAt: '2026-08-17T00:00:00.000Z' },
      ],
    },
  }]);
  await page.goto(pluginUrl);
  const codex = page.locator('[data-provider="codex"]');
  await expect(codex.getByRole('progressbar')).toHaveCount(2);
  await expect(codex.getByRole('heading', { name: 'Usage limit resets' })).toBeVisible();
  await expect(codex.getByText('2 available', { exact: true })).toBeVisible();
  await expect(codex.getByText(/^Full reset$/)).toHaveCount(2);
  await expect(codex.getByText(/^Expires /)).toHaveCount(2);
  await expect(codex.getByRole('button', { name: /Use reset/i })).toHaveCount(0);
});