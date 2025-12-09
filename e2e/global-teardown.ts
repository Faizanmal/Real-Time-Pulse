/**
 * Global Teardown for Playwright Tests
 * Runs once after all tests
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  // Clean up auth state
  const authDir = path.join(__dirname, '.auth');
  if (fs.existsSync(authDir) && process.env.CLEANUP_AUTH === 'true') {
    fs.rmSync(authDir, { recursive: true });
    console.log('✅ Cleaned up auth state');
  }
  
  // Clean up test data (if needed)
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    console.log('🗄️ Cleaning up test data...');
    // Add database cleanup logic here
  }
  
  // Generate test summary
  const resultsDir = path.join(__dirname, 'test-results');
  if (fs.existsSync(path.join(resultsDir, 'results.json'))) {
    const results = JSON.parse(
      fs.readFileSync(path.join(resultsDir, 'results.json'), 'utf-8')
    );
    
    const summary = {
      total: results.suites?.length || 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
    };
    
    // Calculate summary from results
    // ... (simplified for example)
    
    fs.writeFileSync(
      path.join(resultsDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log(`📊 Test Summary:`);
    console.log(`   Total: ${summary.total}`);
    console.log(`   Passed: ${summary.passed}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Skipped: ${summary.skipped}`);
  }
  
  console.log('✅ Global teardown complete');
}

export default globalTeardown;
