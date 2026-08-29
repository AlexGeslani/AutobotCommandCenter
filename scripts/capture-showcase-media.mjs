#!/usr/bin/env node
import { chromium } from 'playwright';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const baseURL = process.env.ACC_CAPTURE_BASE_URL || 'http://127.0.0.1:9130';
const screenshots = resolve(root, 'docs/screenshots');
const themesDir = resolve(screenshots, 'themes');
const videoDir = resolve(root, 'docs/demo');
const rawVideoDir = resolve(videoDir, '.raw');
const edition = JSON.parse(await readFile(resolve(root, 'config/demo.edition.v1.json'), 'utf8'));
const domain = JSON.parse(await readFile(resolve(root, 'fixtures/demo/domain.v1.json'), 'utf8'));
const showcase = JSON.parse(await readFile(resolve(root, 'src/generated/showcase-projection.v1.json'), 'utf8'));
const illustrativeWebAnalytics = JSON.parse(await readFile(resolve(root, 'tests/fixtures/analytics/kungfuclan-demo.v2.json'), 'utf8'));
const observedAt = new Date().toISOString();
const resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
domain.generatedAt = observedAt;
domain.data.meta.generatedAt = observedAt;
domain.showcase = showcase;
edition.analytics.web = [{
  id: 'kungfuclan-demo',
  label: 'Kung Fu Clan illustrative demo',
  description: 'Clearly labeled, non-current aggregate web analytics fixture.',
  projection: 'data/analytics/showcase/kungfuclan-demo.v2.json',
}];
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

await mkdir(themesDir, { recursive: true });
await mkdir(videoDir, { recursive: true });
await rm(rawVideoDir, { recursive: true, force: true });
await mkdir(rawVideoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function installFixtureRoutes(context) {
  for (const pattern of ['**/runtime/edition.v1.json', '**/data/edition.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(edition) }));
  }
  for (const pattern of ['**/runtime/domain.v1.json', '**/data/domain.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(domain) }));
  }
  for (const pattern of ['**/runtime/provider-usage.v1.json', '**/data/provider-usage.v1.json']) {
    await context.route(pattern, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(providerUsage) }));
  }
  await context.route('**/data/analytics/showcase/kungfuclan-demo.v2.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(illustrativeWebAnalytics),
  }));
}

async function ready(page) {
  await page.getByRole('heading', { name: 'Autobot Command Center' }).waitFor();
  await page.getByText('Dev fixtures', { exact: true }).waitFor();
  await page.waitForTimeout(700);
}

async function openSection(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
}

const stillContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 1 });
await installFixtureRoutes(stillContext);
const stillPage = await stillContext.newPage();
const browserErrors = [];
stillPage.on('pageerror', (error) => { browserErrors.push(`pageerror: ${error.message}`); console.error(`pageerror: ${error.message}`); });
stillPage.on('console', (message) => { if (message.type() === 'error') { browserErrors.push(`console: ${message.text()}`); console.error(`console: ${message.text()}`); } });
await stillPage.addInitScript(() => localStorage.setItem('acc.presentation-theme.v1', 'matrix'));
await stillPage.goto(baseURL, { waitUntil: 'networkidle' });
await ready(stillPage);
await stillPage.screenshot({ path: resolve(screenshots, 'overview.png') });
for (const [name, file] of [['Portfolio', 'portfolio.png'], ['Analytics', 'analytics.png'], ['Benchmarks', 'benchmarks.png'], ['Search', 'search.png']]) {
  await openSection(stillPage, name);
  if (name === 'Search') await stillPage.getByRole('searchbox', { name: 'Search ACC', exact: true }).fill('benchmark');
  await stillPage.screenshot({ path: resolve(screenshots, file) });
  if (name === 'Analytics') {
    await stillPage.getByRole('button', { name: 'Open Kung Fu Clan illustrative demo analytics' }).click();
    await stillPage.getByRole('heading', { name: 'Kung Fu Clan illustrative demo', exact: true }).waitFor();
    await stillPage.screenshot({ path: resolve(screenshots, 'cloudflare-report.png') });
  }
}
await stillPage.getByRole('button', { name: 'Settings' }).click();
await stillPage.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
await stillPage.screenshot({ path: resolve(screenshots, 'settings.png') });
const themes = [
  ['autobots', 'autobots.png'],
  ['decepticons', 'decepticons.png'],
  ['matrix', 'matrix.png'],
  ['g1-console', 'teletraan1.png'],
  ['current-dark', 'terminal-dark.png'],
];
for (const [theme, file] of themes) {
  await stillPage.evaluate((value) => localStorage.setItem('acc.presentation-theme.v1', value), theme);
  await stillPage.goto(baseURL, { waitUntil: 'networkidle' });
  await ready(stillPage);
  await stillPage.screenshot({ path: resolve(themesDir, file) });
}
await stillContext.close();

if (process.env.ACC_CAPTURE_STILLS_ONLY === '1') {
  await browser.close();
  if (browserErrors.length) throw new Error(`Browser errors during capture: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ screenshots: 12, fixtureBoundary: 'Dev fixtures', browserErrors: 0 }));
  process.exit(0);
}

const videoContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
  deviceScaleFactor: 1,
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
});
await installFixtureRoutes(videoContext);
const page = await videoContext.newPage();
const videoErrors = [];
page.on('pageerror', (error) => videoErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') videoErrors.push(`console: ${message.text()}`); });
await page.addInitScript(() => localStorage.setItem('acc.presentation-theme.v1', 'matrix'));
await page.goto(baseURL, { waitUntil: 'networkidle' });
await ready(page);
await page.waitForTimeout(7000);
await page.mouse.wheel(0, 360);
await page.waitForTimeout(4000);
await page.mouse.wheel(0, -360);
await page.waitForTimeout(3200);

await openSection(page, 'Portfolio');
await page.waitForTimeout(6500);
await page.mouse.wheel(0, 420);
await page.waitForTimeout(5400);

await openSection(page, 'Analytics');
await page.waitForTimeout(7300);
await page.mouse.wheel(0, 360);
await page.waitForTimeout(6800);

await openSection(page, 'Benchmarks');
await page.waitForTimeout(7800);
await page.mouse.wheel(0, 460);
await page.waitForTimeout(7300);

await openSection(page, 'Search');
await page.getByRole('searchbox', { name: 'Search ACC', exact: true }).fill('benchmark');
await page.waitForTimeout(7600);
await page.mouse.wheel(0, 380);
await page.waitForTimeout(7600);

await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
for (const theme of ['autobots', 'decepticons', 'matrix', 'g1-console', 'current-dark']) {
  await page.getByLabel('Presentation theme').selectOption(theme);
  await page.waitForTimeout(2400);
}
await page.waitForTimeout(700);
const recordedVideo = page.video();
await videoContext.close();
const rawPath = await recordedVideo.path();
await cp(rawPath, resolve(videoDir, 'autobot-command-center-demo-silent.webm'));
await rm(rawVideoDir, { recursive: true, force: true });
await browser.close();

if (browserErrors.length || videoErrors.length) {
  throw new Error(`Browser errors during capture: ${[...browserErrors, ...videoErrors].join(' | ')}`);
}
console.log(JSON.stringify({ screenshots: 12, fixtureBoundary: 'Dev fixtures', rawVideo: 'docs/demo/autobot-command-center-demo-silent.webm', browserErrors: 0 }));
