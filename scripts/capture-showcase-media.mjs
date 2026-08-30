#!/usr/bin/env node
import { chromium } from 'playwright';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { FILM_DURATION_SECONDS } from './showcase-film-contract.mjs';

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

async function openSection(page, name, headingName = name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.getByRole('heading', { name: headingName, exact: true }).waitFor();
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
const recordingStartedAt = Date.now();
const page = await videoContext.newPage();
observeErrors(page);
await page.addInitScript(() => localStorage.setItem('acc.presentation-theme.v1', 'matrix'));
await page.goto(baseURL, { waitUntil: 'networkidle' });
await ready(page);
const filmStartOffsetSeconds = (Date.now() - recordingStartedAt) / 1000;
const filmStartedAt = Date.now();

async function waitUntilFilm(second) {
  const remaining = filmStartedAt + second * 1000 - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
}

async function ensureFilmStyles() {
  await page.evaluate(() => {
    if (document.getElementById('acc-film-styles')) return;
    const style = document.createElement('style');
    style.id = 'acc-film-styles';
    style.textContent = `
      #acc-film-card { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; overflow: hidden; color: #e7fff1; background: radial-gradient(circle at 50% 45%, #0b241c 0%, #040907 52%, #010202 100%); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; opacity: 1; transition: opacity 420ms ease; }
      #acc-film-card::before { content: ''; position: absolute; inset: 0; opacity: .22; background-image: linear-gradient(rgba(91,255,168,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(91,255,168,.08) 1px, transparent 1px); background-size: 42px 42px; animation: acc-grid-drift 8s linear infinite; }
      #acc-film-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 49%, rgba(0,0,0,.22) 50%); background-size: 100% 4px; pointer-events: none; }
      #acc-film-card.is-hidden { opacity: 0; pointer-events: none; }
      .acc-film-card__inner { position: relative; width: min(1080px, 80vw); padding: 44px; border-left: 3px solid #65ffad; text-align: left; text-shadow: 0 0 24px rgba(92,255,170,.28); animation: acc-card-in 700ms ease both; }
      .acc-film-card__eyebrow { margin: 0 0 18px; color: #65ffad; font-size: 20px; font-weight: 800; letter-spacing: .18em; }
      .acc-film-card__title { margin: 0; max-width: 980px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: clamp(46px, 6vw, 84px); line-height: .98; letter-spacing: -.045em; }
      .acc-film-card__subtitle { margin: 24px 0 0; max-width: 880px; color: #b7c9bf; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 24px; line-height: 1.45; }
      .acc-film-card__footer { margin: 44px 0 0; color: #8ca79a; font-size: 17px; letter-spacing: .13em; }
      #acc-film-label { position: fixed; z-index: 2147483646; top: 74px; right: 42px; max-width: 510px; padding: 14px 18px; border: 1px solid rgba(91,255,168,.58); border-right: 4px solid #65ffad; background: rgba(2,10,7,.88); box-shadow: 0 0 30px rgba(56,255,151,.14); color: #e7fff1; font: 800 16px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; opacity: 0; transform: translateX(18px); transition: opacity 260ms ease, transform 260ms ease; }
      #acc-film-label.is-visible { opacity: 1; transform: translateX(0); }
      #acc-film-highlight { position: fixed; z-index: 2147483645; pointer-events: none; border: 2px solid #65ffad; border-radius: 16px; box-shadow: 0 0 0 1px rgba(101,255,173,.28), 0 0 34px rgba(65,255,156,.46), inset 0 0 24px rgba(65,255,156,.10); opacity: 0; transform: scale(.985); transition: opacity 300ms ease, transform 300ms ease, inset 300ms ease; }
      #acc-film-highlight.is-visible { opacity: 1; transform: scale(1); }
      @keyframes acc-grid-drift { to { background-position: 42px 42px, 42px 42px; } }
      @keyframes acc-card-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.append(style);
  });
}

async function showFilmCard({ eyebrow, title, subtitle, footer }) {
  await ensureFilmStyles();
  await page.evaluate((content) => {
    document.getElementById('acc-film-card')?.remove();
    const card = document.createElement('section');
    card.id = 'acc-film-card';
    card.innerHTML = `<div class="acc-film-card__inner"><p class="acc-film-card__eyebrow"></p><h1 class="acc-film-card__title"></h1><p class="acc-film-card__subtitle"></p><p class="acc-film-card__footer"></p></div>`;
    card.querySelector('.acc-film-card__eyebrow').textContent = content.eyebrow;
    card.querySelector('.acc-film-card__title').textContent = content.title;
    card.querySelector('.acc-film-card__subtitle').textContent = content.subtitle;
    card.querySelector('.acc-film-card__footer').textContent = content.footer;
    document.body.append(card);
  }, { eyebrow, title, subtitle, footer });
}

async function hideFilmCard() {
  await page.evaluate(() => document.getElementById('acc-film-card')?.classList.add('is-hidden'));
}

async function showFilmLabel(text) {
  await ensureFilmStyles();
  await page.evaluate((value) => {
    let label = document.getElementById('acc-film-label');
    if (!label) {
      label = document.createElement('div');
      label.id = 'acc-film-label';
      document.body.append(label);
    }
    label.textContent = value;
    label.classList.remove('is-visible');
    requestAnimationFrame(() => label.classList.add('is-visible'));
  }, text);
}

async function highlight(selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;
  await page.evaluate((bounds) => {
    let marker = document.getElementById('acc-film-highlight');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'acc-film-highlight';
      document.body.append(marker);
    }
    const inset = 8;
    marker.style.left = `${Math.max(8, bounds.x - inset)}px`;
    marker.style.top = `${Math.max(8, bounds.y - inset)}px`;
    marker.style.width = `${Math.min(innerWidth - 16, bounds.width + inset * 2)}px`;
    marker.style.height = `${Math.min(innerHeight - 16, bounds.height + inset * 2)}px`;
    marker.classList.add('is-visible');
  }, box);
}

async function clearHighlight() {
  await page.evaluate(() => document.getElementById('acc-film-highlight')?.classList.remove('is-visible'));
}

await showFilmCard({
  eyebrow: 'AUTOBOT COMMAND CENTER // ONLINE',
  title: 'Evidence before instinct.',
  subtitle: 'One command center for what my AI systems built, how models perform, and what the evidence says now.',
  footer: 'PROJECT AGENT // PUBLIC SHOWCASE',
});
await waitUntilFilm(5);
await hideFilmCard();
await openSection(page, 'Portfolio');
await showFilmLabel('SYSTEM OVERVIEW // SHIPPED EVIDENCE');
await waitUntilFilm(7.4);
await openSection(page, 'Benchmarks');
await waitUntilFilm(8.7);
await waitUntilFilm(10.6);
await openAnalyticsDetail(page);

await waitUntilFilm(15.2);
await openSection(page, 'Portfolio');
await showFilmLabel('PORTFOLIO // SHIPPED SYSTEMS');
await waitUntilFilm(18.5);
await highlight('.acc-showcase-card');
await waitUntilFilm(22.5);
await clearHighlight();
await page.mouse.wheel(0, 620);
await waitUntilFilm(27.5);

await openSection(page, 'Benchmarks');
await showFilmLabel('MODEL OBSERVATORY // EXACT CONDITIONS');
await waitUntilFilm(30.5);
await highlight('.acc-three-score');
await waitUntilFilm(35.8);
await clearHighlight();
await page.mouse.wheel(0, 680);
await waitUntilFilm(37.2);
await highlight('.acc-measured-suite');
await waitUntilFilm(42.5);
await clearHighlight();

await openAnalyticsDetail(page);
await showFilmLabel('ANALYTICS // PRIVACY-SAFE AGGREGATES');
await waitUntilFilm(45.2);
await highlight('.acc-analytics-trust');
await waitUntilFilm(48.2);
await clearHighlight();
await page.mouse.wheel(0, 520);
await waitUntilFilm(52.9);

await openSection(page, 'Portfolio');
await showFilmLabel('ONE EVIDENCE LAYER // NO SECOND SOURCE OF TRUTH');
await waitUntilFilm(56.2);
await highlight('.acc-portfolio-grid');
await waitUntilFilm(61.9);
await clearHighlight();

await waitUntilFilm(62.8);
await showFilmCard({
  eyebrow: 'PROJECT AGENT',
  title: 'BUILD → VERIFY → LEARN',
  subtitle: 'ALEX GESLANI',
  footer: 'AI • AUTOMATION • AGENTIC SYSTEMS  //  github.com/AlexGeslani',
});
await waitUntilFilm(FILM_DURATION_SECONDS);

const recordedVideo = page.video();
await videoContext.close();
const rawPath = await recordedVideo.path();
await cp(rawPath, silentOutput);
await rm(rawVideoDir, { recursive: true, force: true });
await browser.close();

if (browserErrors.length) throw new Error(`Browser errors during capture: ${browserErrors.join(' | ')}`);
console.log(JSON.stringify({
  screenshots: 6,
  captureMode,
  silentVideo: silentOutput,
  filmDurationSeconds: FILM_DURATION_SECONDS,
  filmStartOffsetSeconds,
  browserErrors: 0,
}));
