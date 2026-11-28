import { defineConfig } from '@playwright/test';
import smokeConfig from './playwright.smoke.config';

export default defineConfig({
  ...smokeConfig,
  testMatch: '**/chaos.spec.ts',
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/chaos-report', open: 'never' }],
    ['json', { outputFile: 'test-results/chaos-report.json' }],
  ],
  outputDir: 'test-results/chaos-artifacts',
  // Chaos fixtures are synthetic and unauthenticated; retain trace on failure for diagnosis.
  use: {
    ...smokeConfig.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
