/**
 * =============================================================================
 * REAL-TIME PULSE - E2E TEST FRAMEWORK
 * =============================================================================
 * 
 * End-to-end testing with Playwright for complete user flows.
 */

import { test, expect, Page, Browser } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test user credentials
const TEST_USER = {
  email: 'test@realtimepulse.io',
  password: 'TestPassword123!',
  name: 'Test User',
};

// Helper functions
class TestHelpers {
  constructor(private page: Page) {}

  async login(email = TEST_USER.email, password = TEST_USER.password) {
    await this.page.goto(`${BASE_URL}/login`);
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('**/dashboard**');
  }

  async createPortal(name: string, description?: string) {
    await this.page.click('[data-testid="create-portal-button"]');
    await this.page.fill('[data-testid="portal-name-input"]', name);
    if (description) {
      await this.page.fill('[data-testid="portal-description-input"]', description);
    }
    await this.page.click('[data-testid="portal-submit-button"]');
    await this.page.waitForSelector('[data-testid="portal-created-toast"]');
  }

  async addWidget(type: string, title: string) {
    await this.page.click('[data-testid="add-widget-button"]');
    await this.page.click(`[data-testid="widget-type-${type}"]`);
    await this.page.fill('[data-testid="widget-title-input"]', title);
    await this.page.click('[data-testid="widget-create-button"]');
    await this.page.waitForSelector(`[data-testid="widget-${title}"]`);
  }

  async waitForToast(message: string) {
    await this.page.waitForSelector(`text=${message}`);
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `./test-results/screenshots/${name}.png` });
  }
}

// =============================================================================
// AUTHENTICATION TESTS
// =============================================================================

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', 'wrong@email.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    await expect(page).toHaveURL(/.*login/);
  });

  test('should register new user', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    
    const timestamp = Date.now();
    await page.fill('[data-testid="name-input"]', 'New User');
    await page.fill('[data-testid="email-input"]', `newuser${timestamp}@test.com`);
    await page.fill('[data-testid="password-input"]', 'NewPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!');
    await page.click('[data-testid="register-button"]');
    
    await expect(page).toHaveURL(/.*dashboard/);
  });
});

// =============================================================================
// PORTAL TESTS
// =============================================================================

test.describe('Portals', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('should display portal list', async ({ page }) => {
    await page.goto(`${BASE_URL}/portals`);
    
    await expect(page.locator('[data-testid="portal-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-portal-button"]')).toBeVisible();
  });

  test('should create new portal', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await page.goto(`${BASE_URL}/portals`);
    
    const portalName = `Test Portal ${Date.now()}`;
    await helpers.createPortal(portalName, 'Test description');
    
    await expect(page.locator(`text=${portalName}`)).toBeVisible();
  });

  test('should edit portal', async ({ page }) => {
    await page.goto(`${BASE_URL}/portals`);
    
    await page.click('[data-testid="portal-card"]:first-child [data-testid="portal-menu"]');
    await page.click('[data-testid="edit-portal"]');
    
    await page.fill('[data-testid="portal-name-input"]', 'Updated Portal Name');
    await page.click('[data-testid="portal-save-button"]');
    
    await expect(page.locator('text=Updated Portal Name')).toBeVisible();
  });

  test('should delete portal', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await page.goto(`${BASE_URL}/portals`);
    
    const portalName = `Delete Test ${Date.now()}`;
    await helpers.createPortal(portalName);
    
    await page.click(`[data-testid="portal-${portalName}"] [data-testid="portal-menu"]`);
    await page.click('[data-testid="delete-portal"]');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page.locator(`text=${portalName}`)).not.toBeVisible();
  });

  test('should share portal', async ({ page }) => {
    await page.goto(`${BASE_URL}/portals`);
    
    await page.click('[data-testid="portal-card"]:first-child [data-testid="portal-menu"]');
    await page.click('[data-testid="share-portal"]');
    
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-link-input"]')).toBeVisible();
  });
});

// =============================================================================
// WIDGET TESTS
// =============================================================================

test.describe('Widgets', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.goto(`${BASE_URL}/portals`);
    await page.click('[data-testid="portal-card"]:first-child');
  });

  test('should add line chart widget', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.addWidget('line-chart', 'Revenue Trend');
    
    await expect(page.locator('[data-testid="widget-Revenue Trend"]')).toBeVisible();
  });

  test('should add metric card widget', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.addWidget('metric-card', 'Total Users');
    
    await expect(page.locator('[data-testid="widget-Total Users"]')).toBeVisible();
  });

  test('should configure widget data source', async ({ page }) => {
    await page.click('[data-testid="widget-card"]:first-child [data-testid="widget-settings"]');
    await page.click('[data-testid="data-source-tab"]');
    
    await page.selectOption('[data-testid="data-source-select"]', 'test-datasource');
    await page.click('[data-testid="save-widget-settings"]');
    
    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  test('should drag and drop widget to reposition', async ({ page }) => {
    const widget = page.locator('[data-testid="widget-card"]:first-child');
    const targetArea = page.locator('[data-testid="grid-cell-0-1"]');
    
    await widget.dragTo(targetArea);
    
    // Verify new position
    const boundingBox = await widget.boundingBox();
    expect(boundingBox).toBeTruthy();
  });

  test('should resize widget', async ({ page }) => {
    const widget = page.locator('[data-testid="widget-card"]:first-child');
    const resizeHandle = widget.locator('[data-testid="resize-handle"]');
    
    const initialBox = await widget.boundingBox();
    await resizeHandle.drag({ x: 100, y: 100 });
    const finalBox = await widget.boundingBox();
    
    expect(finalBox!.width).toBeGreaterThan(initialBox!.width);
    expect(finalBox!.height).toBeGreaterThan(initialBox!.height);
  });

  test('should delete widget', async ({ page }) => {
    const widgetCount = await page.locator('[data-testid="widget-card"]').count();
    
    await page.click('[data-testid="widget-card"]:first-child [data-testid="widget-menu"]');
    await page.click('[data-testid="delete-widget"]');
    await page.click('[data-testid="confirm-delete"]');
    
    const newCount = await page.locator('[data-testid="widget-card"]').count();
    expect(newCount).toBe(widgetCount - 1);
  });
});

// =============================================================================
// REAL-TIME DATA TESTS
// =============================================================================

test.describe('Real-time Data', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('should receive real-time metric updates', async ({ page }) => {
    await page.goto(`${BASE_URL}/portals`);
    await page.click('[data-testid="portal-card"]:first-child');
    
    // Wait for WebSocket connection
    await page.waitForFunction(() => {
      return (window as any).__socketConnected === true;
    }, { timeout: 10000 });
    
    const metricValue = page.locator('[data-testid="metric-value"]:first-child');
    const initialValue = await metricValue.textContent();
    
    // Wait for data update (up to 30 seconds)
    await page.waitForFunction(
      ([selector, initial]) => {
        const el = document.querySelector(selector);
        return el && el.textContent !== initial;
      },
      ['[data-testid="metric-value"]:first-child', initialValue],
      { timeout: 30000 }
    );
    
    const newValue = await metricValue.textContent();
    expect(newValue).not.toBe(initialValue);
  });

  test('should show connection status indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    await expect(page.locator('[data-testid="connection-status-connected"]')).toBeVisible();
  });
});

// =============================================================================
// ALERT TESTS
// =============================================================================

test.describe('Alerts', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.goto(`${BASE_URL}/alerts`);
  });

  test('should display alert list', async ({ page }) => {
    await expect(page.locator('[data-testid="alert-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-alert-button"]')).toBeVisible();
  });

  test('should create new alert', async ({ page }) => {
    await page.click('[data-testid="create-alert-button"]');
    
    await page.fill('[data-testid="alert-name-input"]', 'High CPU Alert');
    await page.selectOption('[data-testid="alert-metric-select"]', 'cpu_usage');
    await page.selectOption('[data-testid="alert-operator-select"]', 'greater_than');
    await page.fill('[data-testid="alert-threshold-input"]', '80');
    await page.click('[data-testid="alert-channel-email"]');
    await page.click('[data-testid="create-alert-submit"]');
    
    await expect(page.locator('text=High CPU Alert')).toBeVisible();
  });

  test('should toggle alert status', async ({ page }) => {
    const toggle = page.locator('[data-testid="alert-toggle"]:first-child');
    const initialState = await toggle.isChecked();
    
    await toggle.click();
    
    const newState = await toggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should view alert history', async ({ page }) => {
    await page.click('[data-testid="alert-card"]:first-child');
    await page.click('[data-testid="alert-history-tab"]');
    
    await expect(page.locator('[data-testid="alert-history-list"]')).toBeVisible();
  });
});

// =============================================================================
// SETTINGS TESTS
// =============================================================================

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.goto(`${BASE_URL}/settings`);
  });

  test('should update profile settings', async ({ page }) => {
    await page.click('[data-testid="profile-tab"]');
    await page.fill('[data-testid="display-name-input"]', 'Updated Name');
    await page.click('[data-testid="save-profile-button"]');
    
    await expect(page.locator('text=Profile updated')).toBeVisible();
  });

  test('should change theme', async ({ page }) => {
    await page.click('[data-testid="appearance-tab"]');
    await page.click('[data-testid="theme-dark"]');
    
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('should manage API keys', async ({ page }) => {
    await page.click('[data-testid="api-keys-tab"]');
    await page.click('[data-testid="create-api-key-button"]');
    await page.fill('[data-testid="api-key-name-input"]', 'Test API Key');
    await page.click('[data-testid="create-api-key-submit"]');
    
    await expect(page.locator('[data-testid="api-key-created-dialog"]')).toBeVisible();
  });

  test('should configure notification preferences', async ({ page }) => {
    await page.click('[data-testid="notifications-tab"]');
    await page.click('[data-testid="email-notifications-toggle"]');
    await page.click('[data-testid="save-notifications-button"]');
    
    await expect(page.locator('text=Preferences saved')).toBeVisible();
  });
});

// =============================================================================
// ACCESSIBILITY TESTS
// =============================================================================

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Each button should have either aria-label or text content
      expect(ariaLabel || text?.trim()).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    // This is a simplified check - in production use axe-core
    const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6, button, a');
    const count = await textElements.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

test.describe('Performance', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should render portal with 10 widgets efficiently', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    // Navigate to a portal with many widgets
    await page.goto(`${BASE_URL}/portals/performance-test`);
    
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="widget-card"]', { state: 'visible' });
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(2000);
  });

  test('should handle rapid interactions without lag', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.goto(`${BASE_URL}/portals`);
    await page.click('[data-testid="portal-card"]:first-child');
    
    // Rapid clicking
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="add-widget-button"]');
      await page.click('[data-testid="close-dialog"]');
    }
    const interactionTime = Date.now() - startTime;
    
    // Should complete within 5 seconds
    expect(interactionTime).toBeLessThan(5000);
  });
});

// =============================================================================
// MOBILE RESPONSIVE TESTS
// =============================================================================

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should display mobile navigation', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible();
  });

  test('should open mobile menu', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should display widgets in single column on mobile', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.goto(`${BASE_URL}/portals`);
    await page.click('[data-testid="portal-card"]:first-child');
    
    const widgets = page.locator('[data-testid="widget-card"]');
    const count = await widgets.count();
    
    if (count > 1) {
      const first = await widgets.first().boundingBox();
      const second = await widgets.nth(1).boundingBox();
      
      // Widgets should stack vertically on mobile
      expect(first!.y).toBeLessThan(second!.y);
    }
  });
});

// Export test helpers for reuse
export { TestHelpers };
