const { defineConfig } = require('@playwright/test');

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'test-results/playwright-junit.xml' }]
      ]
    : 'list',
  outputDir: 'test-results/playwright-artifacts',
  use: {
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [{ name: 'cookie-consent', value: 'necessary' }]
        }
      ]
    },
    trace: process.env.CI ? 'retain-on-failure-and-retries' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  globalSetup: require.resolve('./e2e/global-setup.js'),
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      BROWSER: 'none',
      DATABASE: 'local',
      JSON_DB_PATH: '.tmp/db.e2e.json',
      JWT_SECRET: 'playwright-only-secret-not-for-production',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      E2E_TEST_MODE: 'true'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
