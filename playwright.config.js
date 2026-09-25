// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Expense & Budget Visualizer.
 *
 * Tests load index.html via the file:// protocol — no server needed.
 * Only Chromium is used for the smoke tests; add Firefox/WebKit entries
 * when cross-browser coverage is required (Task 15).
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Maximum time one test can run */
  timeout: 30_000,
  /* Retry once on CI to handle flaky screenshot timing */
  retries: process.env.CI ? 1 : 0,
  /* Run tests sequentially to keep screenshot filenames deterministic */
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    /* No baseURL — tests construct file:// URLs themselves */
    headless: true,
    /* Capture screenshot on failure for debugging */
    screenshot: 'only-on-failure',
    /* Capture trace on first retry */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Ensure screenshots directory exists before tests run */
  globalSetup: './tests/global-setup.js',
});
