import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /acc\.spec\.mjs/,
  timeout: 30_000,
  fullyParallel: false,
  webServer: {
    command: 'python3 -m http.server 9130 --directory standalone/public',
    url: 'http://127.0.0.1:9130',
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:9130',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
