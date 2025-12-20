/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 30_000,
  // Test outputs go to tests/e2e/ (gitignored), not root
  outputDir: 'tests/e2e/playwright-results',
  use: {
    headless: true,
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8000',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/playwright-report', open: 'never' }],
  ],
};
