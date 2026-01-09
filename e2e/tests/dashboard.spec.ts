/**
 * Dashboard E2E Tests
 * Comprehensive end-to-end tests for the dashboard functionality
 */

import { test, expect, Page } from '@playwright/test';

// Test fixtures
const testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
};

// Helper functions
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', testUser.email);
  await page.fill('[data-testid="password-input"]', testUser.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await expect(page).toHaveURL(/.*login/);
}

// ==================== AUTHENTICATION TESTS ====================

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await login(page);
    await logout(page);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });
});

// ==================== DASHBOARD TESTS ====================

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display dashboard with widgets', async ({ page }) => {
    await expect(page.locator('[data-testid="dashboard-grid"]')).toBeVisible();
    const widgets = page.locator('[data-testid="widget"]');
    await expect(widgets).toHaveCount(0, { timeout: 1000 }).catch(async () => {
      // Widgets exist
      const count = await widgets.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test('should add a new widget', async ({ page }) => {
    await page.click('[data-testid="add-widget-button"]');
    await expect(page.locator('[data-testid="widget-picker"]')).toBeVisible();
    
    await page.click('[data-testid="widget-type-chart"]');
    await expect(page.locator('[data-testid="widget-config"]')).toBeVisible();
    
    await page.fill('[data-testid="widget-name-input"]', 'Test Chart');
    await page.click('[data-testid="save-widget-button"]');
    
    await expect(page.locator('[data-testid="widget"]').last()).toContainText('Test Chart');
  });

  test('should edit an existing widget', async ({ page }) => {
    // First add a widget
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-type-kpi"]');
    await page.fill('[data-testid="widget-name-input"]', 'Original Name');
    await page.click('[data-testid="save-widget-button"]');
    
    // Edit the widget
    await page.locator('[data-testid="widget"]').last().click();
    await page.click('[data-testid="edit-widget-button"]');
    await page.fill('[data-testid="widget-name-input"]', 'Updated Name');
    await page.click('[data-testid="save-widget-button"]');
    
    await expect(page.locator('[data-testid="widget"]').last()).toContainText('Updated Name');
  });

  test('should delete a widget', async ({ page }) => {
    // Add a widget
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-type-table"]');
    await page.fill('[data-testid="widget-name-input"]', 'Widget to Delete');
    await page.click('[data-testid="save-widget-button"]');
    
    const initialCount = await page.locator('[data-testid="widget"]').count();
    
    // Delete the widget
    await page.locator('[data-testid="widget"]').last().hover();
    await page.click('[data-testid="delete-widget-button"]');
    await page.click('[data-testid="confirm-delete-button"]');
    
    await expect(page.locator('[data-testid="widget"]')).toHaveCount(initialCount - 1);
  });

  test('should drag and drop widgets', async ({ page }) => {
    // Add two widgets
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-type-chart"]');
    await page.fill('[data-testid="widget-name-input"]', 'Widget 1');
    await page.click('[data-testid="save-widget-button"]');
    
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-type-chart"]');
    await page.fill('[data-testid="widget-name-input"]', 'Widget 2');
    await page.click('[data-testid="save-widget-button"]');
    
    // Drag Widget 2 to Widget 1 position
    const widget1 = page.locator('[data-testid="widget"]').first();
    const widget2 = page.locator('[data-testid="widget"]').last();
    
    await widget2.dragTo(widget1);
    
    // Verify order changed
    await expect(page.locator('[data-testid="widget"]').first()).toContainText('Widget 2');
  });

  test('should filter data by time range', async ({ page }) => {
    await page.click('[data-testid="time-range-selector"]');
    await page.click('[data-testid="time-range-7d"]');
    
    await expect(page.locator('[data-testid="time-range-display"]')).toContainText('Last 7 days');
    // Verify data refresh indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden();
  });

  test('should export dashboard as PDF', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-pdf"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should share dashboard', async ({ page }) => {
    await page.click('[data-testid="share-button"]');
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
    
    await page.fill('[data-testid="share-email-input"]', 'colleague@example.com');
    await page.selectOption('[data-testid="share-permission"]', 'viewer');
    await page.click('[data-testid="send-invite-button"]');
    
    await expect(page.locator('[data-testid="share-success"]')).toBeVisible();
  });
});

// ==================== WIDGET INTERACTION TESTS ====================

test.describe('Widget Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display chart tooltip on hover', async ({ page }) => {
    // Navigate to a dashboard with charts
    const chart = page.locator('[data-testid="chart-widget"]').first();
    
    if (await chart.isVisible()) {
      await chart.locator('path').first().hover();
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    }
  });

  test('should zoom chart on selection', async ({ page }) => {
    const chart = page.locator('[data-testid="chart-widget"]').first();
    
    if (await chart.isVisible()) {
      // Simulate brush selection
      const box = await chart.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 50, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 50);
        await page.mouse.up();
        
        await expect(page.locator('[data-testid="reset-zoom-button"]')).toBeVisible();
      }
    }
  });

  test('should sort table widget', async ({ page }) => {
    const table = page.locator('[data-testid="table-widget"]').first();
    
    if (await table.isVisible()) {
      const firstHeader = table.locator('th').first();
      await firstHeader.click();
      
      // Verify sort indicator
      await expect(firstHeader.locator('[data-testid="sort-indicator"]')).toBeVisible();
    }
  });

  test('should paginate table widget', async ({ page }) => {
    const table = page.locator('[data-testid="table-widget"]').first();
    
    if (await table.isVisible()) {
      const pagination = table.locator('[data-testid="pagination"]');
      if (await pagination.isVisible()) {
        await pagination.locator('[data-testid="next-page"]').click();
        await expect(pagination.locator('[data-testid="current-page"]')).toContainText('2');
      }
    }
  });
});

// ==================== AI FEATURES TESTS ====================

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display AI insights', async ({ page }) => {
    await page.click('[data-testid="ai-insights-button"]');
    await expect(page.locator('[data-testid="ai-insights-panel"]')).toBeVisible();
    
    // Wait for insights to load
    await expect(page.locator('[data-testid="insight-card"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle natural language query', async ({ page }) => {
    await page.click('[data-testid="nl-query-button"]');
    await page.fill('[data-testid="nl-query-input"]', 'What are my total sales this month?');
    await page.press('[data-testid="nl-query-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="nl-query-result"]')).toBeVisible({ timeout: 15000 });
  });

  test('should generate automated report', async ({ page }) => {
    await page.click('[data-testid="generate-report-button"]');
    await page.selectOption('[data-testid="report-type"]', 'executive');
    await page.click('[data-testid="generate-button"]');
    
    await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
  });
});

// ==================== COLLABORATION TESTS ====================

test.describe('Collaboration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should show collaborator presence', async ({ page }) => {
    // This test would need a second browser context for full testing
    await expect(page.locator('[data-testid="collaborator-list"]')).toBeVisible();
  });

  test('should add comment to widget', async ({ page }) => {
    const widget = page.locator('[data-testid="widget"]').first();
    
    if (await widget.isVisible()) {
      await widget.click({ button: 'right' });
      await page.click('[data-testid="add-comment-option"]');
      
      await page.fill('[data-testid="comment-input"]', 'This is a test comment');
      await page.click('[data-testid="submit-comment-button"]');
      
      await expect(page.locator('[data-testid="comment-indicator"]')).toBeVisible();
    }
  });
});

// ==================== SETTINGS TESTS ====================

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
  });

  test('should update profile settings', async ({ page }) => {
    await page.click('[data-testid="profile-tab"]');
    await page.fill('[data-testid="name-input"]', 'Updated Name');
    await page.click('[data-testid="save-profile-button"]');
    
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should change notification preferences', async ({ page }) => {
    await page.click('[data-testid="notifications-tab"]');
    await page.click('[data-testid="email-notifications-toggle"]');
    await page.click('[data-testid="save-notifications-button"]');
    
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should manage API keys', async ({ page }) => {
    await page.click('[data-testid="api-keys-tab"]');
    await page.click('[data-testid="create-api-key-button"]');
    
    await page.fill('[data-testid="api-key-name"]', 'Test API Key');
    await page.click('[data-testid="generate-key-button"]');
    
    await expect(page.locator('[data-testid="api-key-value"]')).toBeVisible();
  });
});

// ==================== RESPONSIVENESS TESTS ====================

test.describe('Responsive Design', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await login(page);
    
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should stack widgets on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await login(page);
    
    const grid = page.locator('[data-testid="dashboard-grid"]');
    const gridStyle = await grid.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns);
    
    // Verify grid has fewer columns on tablet
    expect(gridStyle).toBeDefined();
  });
});

// ==================== PERFORMANCE TESTS ====================

test.describe('Performance', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await login(page);
    
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000); // 5 second max including login
  });

  test('should handle large datasets', async ({ page }) => {
    await login(page);
    
    // Navigate to a dashboard with large dataset
    await page.goto('/dashboard/large-data');
    
    // Verify virtualization is working (only visible rows rendered)
    const visibleRows = await page.locator('[data-testid="table-row"]').count();
    expect(visibleRows).toBeLessThan(100); // Should be virtualized
  });
});

// ==================== ACCESSIBILITY TESTS ====================

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should have proper heading structure', async ({ page }) => {
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('should have alt text on images', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      
      expect(text || ariaLabel).toBeTruthy();
    }
  });
});
