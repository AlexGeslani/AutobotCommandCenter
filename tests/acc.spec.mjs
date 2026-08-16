import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pluginUrl = process.env.ACC_PLUGIN_PATH || '/autobot-command-center';

async function routeProviderUsage(page, providers, generatedAt = '2026-07-31T23:30:00.000Z') {
  await page.route('**/data/provider-usage.v1.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ schemaVersion: 'provider-usage-v1', generatedAt, providers }),
    });
  });
}

async function routeHiveMind(page) {
  for (const pattern of ['http://127.0.0.1:8788/health', '**/api/hivemind/health']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    });
  }
  for (const pattern of ['http://127.0.0.1:8788/search', '**/api/hivemind/search']) {
    await page.route(pattern, async (route) => {
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
}

test('ten-second facts are visible and primary IA is bounded', async ({ page }) => {
  await page.goto(pluginUrl);
  await expect(page.getByRole('heading', { name: 'Autobot Command Center' })).toBeVisible();
  await expect(page.locator('img.acc-command-mark')).toHaveAttribute('src', /^data:image\/svg\+xml,/);
  if (pluginUrl === '/') await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/command-center-mark.svg?v=1');
  await expect(page.getByText('Recently landed', { exact: true })).toBeVisible();
  await expect(page.getByText('Durable capabilities', { exact: true })).toBeVisible();
  await expect(page.getByText('Model leaders', { exact: true })).toBeVisible();
  await expect(page.getByText('Decision pending', { exact: true })).toBeVisible();
  const localNav = page.getByRole('navigation', { name: 'Command Center sections' });
  await expect(localNav.getByRole('button')).toHaveCount(5);
});

test('Hive Mind search returns source-linked QMD results', async ({ page }) => {
  await routeHiveMind(page);
  await page.goto(pluginUrl + '?view=hivemind');
  await expect(page.getByRole('heading', { name: 'Search Hive Mind' })).toBeVisible();
  await expect(page.getByText('Live QMD retrieval', { exact: true })).toBeVisible();
  await page.getByLabel('Search query').fill('Project Grin');
  await page.getByLabel('Wiki scope').selectOption('wiki-openai');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project Grin — 2005 Subaru Forester XT' })).toBeVisible();
  await expect(page.getByText('wiki-openai/projects/project-grin.md', { exact: true })).toBeVisible();
  await expect(page.getByText(/reliability-first modernization/i)).toBeVisible();
});

test('Voice Lab exposes the measured six-route performance visual and reliability boundary', async ({ page }) => {
  await page.goto(pluginUrl + '?view=portfolio&product=voice-lab');
  await expect(page.getByRole('heading', { name: 'Voice runtime comparison' })).toBeVisible();
  await expect(page.locator('img.acc-voice-visual')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('[data-voice-route]')).toHaveCount(6);
  await expect(page.getByText('1 timeout', { exact: true })).toBeVisible();
  await expect(page.getByText(/same sentence.*three warm end-to-end requests/i)).toBeVisible();
  await expect(page.getByText('Measured 2026-07-26', { exact: true })).toBeVisible();
});

test('Voice Lab comparison is readable without mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=portfolio&product=voice-lab');
  await expect(page.getByRole('heading', { name: 'Voice runtime comparison' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.acc-voice-mobile')).toBeVisible();
  await expect(page.locator('.acc-voice-desktop')).toBeHidden();
});

test('leaderboard opens exact tested condition then run evidence', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks');
  await page.getByRole('button', { name: /Qwen3\.6 35B.*AWQ.*vLLM/i }).click();
  await expect(page).toHaveURL(/condition=qwen36-awq-vllm/);
  await expect(page.getByText('Condition fingerprint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open run evidence for tool-use bfcl-v3/i }).click();
  await expect(page).toHaveURL(/result=r-bfcl-qwen/);
  await expect(page).toHaveURL(/release=bfcl-v3/);
  await expect(page.getByRole('heading', { name: 'Run evidence' })).toBeVisible();
});

test('capability rollup ranks complete coverage and separates partial evidence', async ({ page }) => {
  await page.goto(pluginUrl + '?view=benchmarks');
  await page.getByRole('button', { name: 'Capability rollup' }).click();
  await expect(page).toHaveURL(/domain=rollup/);
  const complete = page.getByRole('region', { name: 'Comparable rollup' });
  await expect(complete.getByText('GPT-5.6 · Max · API', { exact: true })).toBeVisible();
  await expect(complete.getByText('Qwen3.6 35B · AWQ · vLLM', { exact: true })).toBeVisible();
  await expect(complete.getByText('3/3 domains', { exact: true })).toHaveCount(2);
  const qwenRow = complete.locator('.acc-capability-row').filter({ hasText: 'Qwen3.6 35B · AWQ · vLLM' });
  for (const contribution of ['94.1%', '84.9%', '87.6%']) await expect(qwenRow.getByText(contribution, { exact: true })).toBeVisible();
  const partial = page.getByRole('region', { name: 'Partial evidence' });
  await expect(partial.getByText('Devstral Small 2 · FP8 · vLLM', { exact: true })).toBeVisible();
  await expect(partial.getByText('2/3 domains · not ranked with complete coverage', { exact: true })).toBeVisible();
  await expect(page.getByText('Missing evidence is Unknown, never zero.', { exact: true })).toBeVisible();
});

test('evaluations are globally discoverable and attached to objects', async ({ page }) => {
  await page.goto(pluginUrl);
  await page.getByRole('button', { name: 'Evidence index' }).click();
  await expect(page).toHaveURL(/view=evidence/);
  await expect(page.getByRole('heading', { name: 'Evaluation evidence' })).toBeVisible();
  await page.getByRole('button', { name: /Voice interaction latency envelope/i }).click();
  await expect(page.getByText('Affected objects', { exact: true })).toBeVisible();
});

test('mobile composition has no primary horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=benchmarks');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('.acc-mobile-ranking')).toBeVisible();
  await expect(page.locator('.acc-desktop-table')).toBeHidden();
  await page.goto(pluginUrl + '?view=benchmarks&domain=rollup');
  const rollupOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(rollupOverflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('region', { name: 'Comparable rollup' })).toBeVisible();
});

test('critical accessibility scan is clean across overview and detail routes', async ({ page }) => {
  for (const route of [
    '',
    '?view=benchmarks&domain=rollup',
    '?view=benchmarks&domain=tool-use&condition=qwen36-awq-vllm',
    '?view=skills&skill=autobots',
    '?view=evidence&evaluation=eval-voice-latency',
    '?view=hivemind',
  ]) {
    await page.goto(pluginUrl + route);
    const results = await new AxeBuilder({ page }).analyze();
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

test('runtime-dependent service claims are withheld in overview and portfolio', async ({ page }) => {
  await page.goto(pluginUrl);
  const service = page.getByRole('button', { name: /Local Model Service/i });
  await expect(service.getByText('unknown', { exact: true })).toBeVisible();
  await service.click();
  await expect(page.getByRole('heading', { name: 'Current availability' })).toBeVisible();
  await expect(page.getByText('Unknown — runtime telemetry is stale', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenAI-compatible endpoint', { exact: true })).toHaveCount(0);
});

test('benchmark domain is reload-stable and participates in browser history', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pluginUrl + '?view=benchmarks');
  await page.getByRole('button', { name: 'Capability rollup' }).click();
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
  await expect(page.getByRole('heading', { name: 'Tool Use' })).toBeVisible();
  expect(errors.filter((message) => /hooks|rendered fewer|rendered more/i.test(message))).toEqual([]);
});

test('mobile detail routes retain an immediate fixture warning', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pluginUrl + '?view=benchmarks&condition=qwen36-awq-vllm');
  const label = page.getByText('Prototype fixtures', { exact: true });
  await expect(label).toBeVisible();
  expect(await label.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(844);
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
    '?view=skills',
    '?view=skills&skill=autobots',
    '?view=evidence',
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
  await page.goto(pluginUrl + '?view=benchmarks');
  await page.getByRole('button', { name: /Qwen3\.6 35B.*AWQ.*vLLM/i }).click();
  await expect(page.locator('.acc-main')).toBeFocused();
});

test('provider usage projects a sanitized snapshot without expanding primary navigation', async ({ page }) => {
  await page.goto(pluginUrl);
  await expect(page.getByRole('heading', { name: 'Provider usage' })).toBeVisible();
  await expect(page.locator('[data-provider="codex"]')).toContainText(/Codex \/ ChatGPT/);
  await expect(page.locator('[data-provider="claude"]').getByText(/^Last observed /)).toBeVisible();
  await expect(page.locator('[data-provider="claude"]').getByText('Genuine activity updates immediately; guarded /usage fallback runs after 12 hours.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-provider="claude"]').getByText(/^stale$/i)).toHaveCount(0);
  await expect(page.locator('[data-provider="antigravity"]').getByText(/^Last observed /)).toBeVisible();
  await expect(page.locator('[data-provider="antigravity"]').getByText(/^stale$/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Open details' }).click();
  await expect(page).toHaveURL(/view=usage/);
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

test('Brave Search is separated from frontier subscriptions and shows exact request headroom', async ({ page }) => {
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
  }]);
  await page.goto(pluginUrl + '?view=usage');
  await expect(page.getByRole('heading', { name: 'Search infrastructure' })).toBeVisible();
  const brave = page.locator('[data-provider="brave-search"]');
  await expect(brave).toContainText('1,842 of 2,000 searches available');
  await expect(brave).toContainText('1 request/second');
  await expect(brave).toContainText('Quota refresh uses one successful search and runs at most daily.');
  await expect(brave.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1,842 of 2,000 searches available');
});

test('expired Claude observations show last-known quota figures with a warning', async ({ page }) => {
  await page.route('**/data/provider-usage.v1.json', async (route) => {
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