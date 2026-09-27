import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.CHROME_PATH || undefined;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8899', trace: 'retain-on-failure', launchOptions: { executablePath } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: 'rm -rf .data-e2e && CNM_DATA_DIR=.data-e2e CNM_RATELIMIT_SCALE=20 PORT=8899 node scripts/dev-server.mjs',
    url: 'http://localhost:8899',
    reuseExistingServer: false,
  },
});
