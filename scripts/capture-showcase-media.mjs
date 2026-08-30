#!/usr/bin/env node
import { chromium } from 'playwright';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const baseURL = process.env.ACC_CAPTURE_BASE_URL || 'http://127.0.0.1:9130';
const snapshotDir = process.env.ACC_CAPTURE_SNAPSHOT_DIR ? resolve(process.env.ACC_CAPTURE_SNAPSHOT_DIR) : null;
const captureHostMapping = process.env.ACC_CAPTURE_HOST_MAPPING || null;
const screenshots = resolve(root, 'docs/screenshots');
const videoDir = resolve(root, 'docs/demo');
const rawVideoDir = resolve(tmpdir(), `acc-showcase-raw-${process.pid}`);
const silentOutput = resolve(process.env.ACC_CAPTURE_SILENT_OUTPUT || resolve(tmpdir(), 'autobot-command-center-demo-silent.webm'));
const captureMode = snapshotDir ? 'authorized_snapshot' : 'illustrative_fixture';

const fixtureEdition = resolve(root, 'config/demo.edition.v1.json');
const fixtureDomain = resolve(root, 'fixtures/demo/domain.v1.json');
const fixtureAnalytics = resolve(root, 'tests/fixtures/analytics/kungfuclan-demo.v2.json');
const edition = JSON.parse(await readFile(snapshotDir ? resolve(snapshotDir, 'edition.v1.json') : fixtureEdition, 'utf8'));
const domain = JSON.parse(await readFile(snapshotDir ? resolve(snapshotDir, 'domain.v1.json') : fixtureDomain, 'utf8'));
const webAnalytics = JSON.parse(await readFile(snapshotDir ? resolve(snapshotDir, 'alexgeslani.com.v2.json') : fixtureAnalytics, 'utf8'));
const showcase = JSON.parse(await readFile(resolve(root, 'src/generated/showcase-projection.v1.json'), 'utf8'));
const observedAt = new Date().toISOString();
const resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

domain.showcase = showcase;
if (captureMode === 'authorized_snapshot') {
  domain.data.meta.fixture = false;
  domain.data.meta.generatedAt = domain.generatedAt;
  domain.data.meta.notice = 'Authorized dated showcase snapshot · sanitized projections · read-only';
  edition.analytics.web = edition.analytics.web.filter((subject) => subject.id === 'alexgeslani.com');
  if (edition.analytics.web.length !== 1 || webAnalytics.dataKind !== 'real' || webAnalytics.subject?.id !== 'alexgeslani.com') {
    throw new Error('Authorized snapshot must contain exactly the real alexgeslani.com analytics projection');
  }
} else {
  domain.generatedAt = observedAt;
  domain.data.meta.generatedAt = observedAt;
  edition.analytics.web = [{
    id: 'kungfuclan-demo',
    label: 'Kung Fu Clan illustrative demo',
    description: 'Clearly labeled, non-current aggregate web analytics fixture.',
    projection: 'data/analytics/showcase/kungfuclan-demo.v2.json',
  }];
}

const providerUsage = {
  schemaVersion: 'provider-usage-v1',
  generatedAt: observedAt,
  providers: [
    { provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota', authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server', adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt, state: 'fresh', windows: [{ id: 'primary', label: 'Primary window', usedPercent: 24, resetsAt }] },
    { provider: 'claude', product: 'Claude Code', metricClass: 'subscription_quota', authority: 'authenticated Claude Code /usage limits view', collectionMode: 'interactive_cli_usage', adapterVersion: '1.0.0', sourceVersion: 'claude-usage-cli', observedAt, state: 'fresh', windows: [{ id: 'five_hour', label: '5-hour window', usedPercent: 18, resetsAt, resetKind: 'provider_reported' }] },
    { provider: 'antigravity', product: 'Antigravity CLI', metricClass: 'subscription_quota', authority: 'documented Antigravity CLI status-line quota event', collectionMode: 'status_line_cache', adapterVersion: '1.0.0', sourceVersion: 'antigravity-status-line', observedAt, state: 'fresh', windows: [{ id: 'gemini-5h', label: 'Gemini 5-hour window', usedPercent: 12, resetsAt }] },
    { provider: 'brave-search', product: 'Brave Search API', metricClass: 'search_api_quota', authority: 'Brave Search API rate-limit response headers', collectionMode: 'direct_api_headers', adapterVersion: '1.0.0', sourceVersion: 'brave-rate-limit-headers', observedAt, state: 'fresh', windows: [{ id: 'monthly', label: 'Monthly searches', usedPercent: 14, resetsAt, limit: 2000, remaining: 1720 }], rateLimitPerSecond: 1 },
  ],
};

await mkdir(screenshots, { recursive: true });
await mkdir(videoDir, { recursive: true });
await rm(rawVideoDir, { recursive: true, force: true });
await mkdir(rawVideoDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(captureHostMapping ? { args: [`--host-resolver-rules=MAP ${captureHostMapping}`] } : {}),
});
const browserErrors = [];

async function installRoutes(context) {
  for (const pattern of ['**/runtime/edition.v1.json', '**/data/edition.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(edition) }));
  }
  for (const pattern of ['**/runtime/domain.v1.json', '**/data/domain.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(domain) }));
  }
  for (const pattern of ['**/runtime/provider-usage.v1.json', '**/data/provider-usage.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(providerUsage) }));
  }
  if (captureMode === 'authorized_snapshot') {
    await context.route('**/runtime/analytics/web/alexgeslani.com.v2.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(webAnalytics) }));
  } else {
    await context.route('**/data/analytics/showcase/kungfuclan-demo.v2.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(webAnalytics) }));
  }
}

function observeErrors(page) {
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });
}

async function ready(page) {
  await page.getByRole('heading', { name: 'Autobot Command Center' }).waitFor();
  if (captureMode === 'authorized_snapshot') {
    await page.getByText('Authorized dated showcase snapshot · sanitized projections · read-only', { exact: true }).waitFor();
    if (await page.getByText('Dev fixtures', { exact: true }).count()) throw new Error('Authorized snapshot is mislabeled as a fixture');
  } else {
    await page.getByText('Dev fixtures', { exact: true }).waitFor();
  }
  await page.waitForTimeout(700);
}

async function openSection(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function openAnalyticsDetail(page) {
  await openSection(page, 'Analytics');
  const buttonName = captureMode === 'authorized_snapshot'
    ? 'Open alexgeslani.com analytics'
    : 'Open Kung Fu Clan illustrative demo analytics';
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  await page.getByRole('heading', { name: webAnalytics.subject.label, exact: true }).waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
}

const contextOptions = { viewport: { width: 1440, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 1 };
const stillContext = await browser.newContext(contextOptions);
await installRoutes(stillContext);
const stillPage = await stillContext.newPage();
observeErrors(stillPage);
await stillPage.addInitScript(() => localStorage.setItem('acc.presentation-theme.v1', 'matrix'));
await stillPage.goto(baseURL, { waitUntil: 'networkidle' });
await ready(stillPage);

await openAnalyticsDetail(stillPage);
await stillPage.screenshot({ path: resolve(screenshots, 'analytics.png') });
await stillPage.evaluate(() => scrollTo(0, 650));
await stillPage.waitForTimeout(500);
await stillPage.screenshot({ path: resolve(screenshots, 'analytics-details.png') });

await openSection(stillPage, 'Portfolio');
await stillPage.screenshot({ path: resolve(screenshots, 'portfolio.png') });
await stillPage.evaluate(() => scrollTo(0, 720));
await stillPage.waitForTimeout(500);
await stillPage.screenshot({ path: resolve(screenshots, 'portfolio-details.png') });

await openSection(stillPage, 'Benchmarks');
await stillPage.screenshot({ path: resolve(screenshots, 'benchmarks.png') });
await stillPage.evaluate(() => scrollTo(0, 720));
await stillPage.waitForTimeout(500);
await stillPage.screenshot({ path: resolve(screenshots, 'benchmarks-details.png') });
await stillContext.close();

if (process.env.ACC_CAPTURE_STILLS_ONLY === '1') {
  await browser.close();
  if (browserErrors.length) throw new Error(`Browser errors during capture: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ screenshots: 6, captureMode, browserErrors: 0 }));
  process.exit(0);
}

const videoContext = await browser.newContext({
  ...contextOptions,
  reducedMotion: 'no-preference',
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
});
await installRoutes(videoContext);
const page = await videoContext.newPage();
observeErrors(page);
await page.addInitScript(() => localStorage.setItem('acc.presentation-theme.v1', 'matrix'));
await page.goto(baseURL, { waitUntil: 'networkidle' });
await ready(page);

await openAnalyticsDetail(page);
await page.waitForTimeout(11000);
await page.mouse.wheel(0, 620);
await page.waitForTimeout(14500);

await openSection(page, 'Portfolio');
await page.waitForTimeout(8500);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(8500);

await openSection(page, 'Benchmarks');
await page.waitForTimeout(11500);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(11500);

const recordedVideo = page.video();
await videoContext.close();
const rawPath = await recordedVideo.path();
await cp(rawPath, silentOutput);
await rm(rawVideoDir, { recursive: true, force: true });
await browser.close();

if (browserErrors.length) throw new Error(`Browser errors during capture: ${browserErrors.join(' | ')}`);
console.log(JSON.stringify({ screenshots: 6, captureMode, silentVideo: silentOutput, browserErrors: 0 }));
