/**
 * Global Setup for Playwright Tests
 * Runs once before all tests
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
  
  console.log('🚀 Starting global test setup...');
  
  // Create auth directory if it doesn't exist
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  // Create test results directory
  const resultsDir = path.join(__dirname, 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Create screenshots directory
  const screenshotsDir = path.join(resultsDir, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Launch browser for authentication
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log('📝 Authenticating test user...');
    await page.goto(`${baseURL}/login`);
    
    // Perform login
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@realtimepulse.io');
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('[data-testid="login-button"]');
    
    // Wait for authentication to complete
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    
    // Save authentication state
    await context.storageState({ path: path.join(authDir, 'user.json') });
    console.log('✅ Authentication state saved');
    
  } catch (error) {
    console.error('❌ Failed to authenticate test user:', error);
    
    // Create a mock auth state for tests that don't require real auth
    const mockAuthState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            {
              name: 'auth-token',
              value: 'mock-token-for-testing',
            },
          ],
        },
      ],
    };
    
    fs.writeFileSync(
      path.join(authDir, 'user.json'),
      JSON.stringify(mockAuthState, null, 2)
    );
    console.log('⚠️ Created mock auth state');
  }

  await browser.close();
  
  // Setup test database (if needed)
  if (process.env.SETUP_TEST_DB === 'true') {
    console.log('🗄️ Setting up test database...');
    // Add database setup logic here
  }
  
  console.log('✅ Global setup complete');
}

export default globalSetup;
