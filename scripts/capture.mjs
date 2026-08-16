import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = new URL('../artifacts/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const failedResponses = [];

async function capture(name, url, viewport) {
  const page = await browser.newPage({ viewport, colorScheme: 'dark' });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ page: name, type: 'console', text: msg.text() });
  });
  page.on('pageerror', (error) => errors.push({ page: name, type: 'pageerror', text: error.message }));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push({ page: name, status: response.status(), url: response.url() });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, out)), fullPage: true });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    title: document.title,
  }));
  await page.close();
  return { name, url, viewport, dimensions };
}

const captures = [];
captures.push(await capture('acc-overview-desktop', 'http://127.0.0.1:9129/autobot-command-center', { width: 1440, height: 1000 }));
captures.push(await capture('acc-benchmarks-mobile', 'http://127.0.0.1:9129/autobot-command-center?view=benchmarks', { width: 390, height: 844 }));
captures.push(await capture('acc-condition-desktop', 'http://127.0.0.1:9129/autobot-command-center?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm', { width: 1440, height: 1000 }));
await browser.close();
const expectedResponses = failedResponses.filter((item) => item.status === 401 && new URL(item.url).pathname === '/api/auth/me');
const unexpectedResponses = failedResponses.filter((item) => !expectedResponses.includes(item));
const expectedProbePages = new Set(expectedResponses.map((item) => item.page));
const unexpectedErrors = errors.filter((item) => !(item.type === 'console' && /401 \(Unauthorized\)/.test(item.text) && expectedProbePages.has(item.page)));
console.log(JSON.stringify({ captures, unexpectedErrors, unexpectedResponses, expectedAuthProbes: expectedResponses.length }, null, 2));
if (unexpectedErrors.length || unexpectedResponses.length) process.exitCode = 1;
