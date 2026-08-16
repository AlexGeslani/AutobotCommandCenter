import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.ACC_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: /acc\.spec\.mjs/,
  timeout: 30_000,
  fullyParallel: false,
  webServer: externalBaseUrl ? undefined : {
    command: 'HERMES_ENABLE_PROJECT_PLUGINS=1 hermes dashboard --host 127.0.0.1 --port 9129 --no-open --isolated',
    url: 'http://127.0.0.1:9129/autobot-command-center',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: externalBaseUrl || 'http://127.0.0.1:9129',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
