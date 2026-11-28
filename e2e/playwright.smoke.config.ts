import { defineConfig, devices } from '@playwright/test';

const backendUrl = 'http://127.0.0.1:3000';
const frontendUrl = 'http://127.0.0.1:3001';
const postgresPort = process.env.TEST_POSTGRES_PORT || '55432';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/smoke.spec.ts', '**/chaos.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/smoke-report', open: 'never' }],
    ['json', { outputFile: 'test-results/smoke-report.json' }],
  ],
  globalTeardown: './global-teardown-smoke.ts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: frontendUrl,
    // Traces can capture Cookie request headers. Keep them disabled for auth flows.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ./scripts/start-smoke-api.cjs',
      cwd: '../backend-nest',
      url: `${backendUrl}/api/v1/health/live`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        FRONTEND_URL: frontendUrl,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: process.env.TEST_REDIS_PORT || '57379',
        TEST_REDIS_PORT: process.env.TEST_REDIS_PORT || '57379',
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || `postgresql://pulse_test:pulse_test_only_password@127.0.0.1:${postgresPort}/pulse_test?schema=public`,
        CLIENT_BRIEFINGS_ENABLED: 'true',
        EMAIL_TEST_TRANSPORT: 'true',
        ONBOARDING_FUNNEL_HMAC_KEY: 'local-smoke-only-funnel-hmac-key-32-bytes',
      },
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
      cwd: '../frontend',
      url: `${frontendUrl}/auth/login`,
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_PUBLIC_API_URL: backendUrl },
    },
  ],
  outputDir: 'test-results/smoke-artifacts',
  timeout: 180000,
  expect: { timeout: 15000 },
});
