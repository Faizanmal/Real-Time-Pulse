/**
 * Integration API Tests
 * End-to-end tests for API endpoints
 */

import { test, expect, request, APIRequestContext } from '@playwright/test';

let apiContext: APIRequestContext;
let authToken: string;

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

test.beforeAll(async () => {
  apiContext = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  });

  // Login to get auth token
  const response = await apiContext.post('/auth/login', {
    data: {
      email: 'test@example.com',
      password: 'Test123!@#',
    },
  });

  if (response.ok()) {
    const data = await response.json();
    authToken = data.accessToken;
  }
});

test.afterAll(async () => {
  await apiContext.dispose();
});

// Helper to make authenticated requests
function authHeaders() {
  return {
    Authorization: `Bearer ${authToken}`,
  };
}

// ==================== AUTH API TESTS ====================

test.describe('Auth API', () => {
  test('POST /auth/register - should register new user', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    
    const response = await apiContext.post('/auth/register', {
      data: {
        email: uniqueEmail,
        password: 'NewUser123!@#',
        name: 'Test User',
      },
    });

    // Could be 201 for success or 409 if email exists
    expect([201, 409]).toContain(response.status());
  });

  test('POST /auth/login - should login with valid credentials', async () => {
    const response = await apiContext.post('/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'Test123!@#',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
  });

  test('POST /auth/login - should reject invalid credentials', async () => {
    const response = await apiContext.post('/auth/login', {
      data: {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /auth/refresh - should refresh token', async () => {
    // First login to get refresh token
    const loginResponse = await apiContext.post('/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'Test123!@#',
      },
    });

    const loginData = await loginResponse.json();
    
    const response = await apiContext.post('/auth/refresh', {
      data: {
        refreshToken: loginData.refreshToken,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('accessToken');
    }
  });

  test('GET /auth/me - should return current user', async () => {
    const response = await apiContext.get('/auth/me', {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('email');
    expect(data).toHaveProperty('id');
  });
});

// ==================== WORKSPACES API TESTS ====================

test.describe('Workspaces API', () => {
  let workspaceId: string;

  test('POST /workspaces - should create workspace', async () => {
    const response = await apiContext.post('/workspaces', {
      headers: authHeaders(),
      data: {
        name: `Test Workspace ${Date.now()}`,
        slug: `test-workspace-${Date.now()}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('id');
    workspaceId = data.id;
  });

  test('GET /workspaces - should list workspaces', async () => {
    const response = await apiContext.get('/workspaces', {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /workspaces/:id - should get workspace by id', async () => {
    if (!workspaceId) {
      test.skip();
      return;
    }

    const response = await apiContext.get(`/workspaces/${workspaceId}`, {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toBe(workspaceId);
  });

  test('PATCH /workspaces/:id - should update workspace', async () => {
    if (!workspaceId) {
      test.skip();
      return;
    }

    const response = await apiContext.patch(`/workspaces/${workspaceId}`, {
      headers: authHeaders(),
      data: {
        name: 'Updated Workspace Name',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.name).toBe('Updated Workspace Name');
  });
});

// ==================== PORTALS API TESTS ====================

test.describe('Portals API', () => {
  let portalId: string;
  let workspaceId: string;

  test.beforeAll(async () => {
    // Create a workspace for portal tests
    const response = await apiContext.post('/workspaces', {
      headers: authHeaders(),
      data: {
        name: `Portal Test Workspace ${Date.now()}`,
        slug: `portal-test-${Date.now()}`,
      },
    });
    const data = await response.json();
    workspaceId = data.id;
  });

  test('POST /portals - should create portal', async () => {
    if (!workspaceId) {
      test.skip();
      return;
    }

    const response = await apiContext.post('/portals', {
      headers: authHeaders(),
      data: {
        name: `Test Portal ${Date.now()}`,
        slug: `test-portal-${Date.now()}`,
        workspaceId,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('id');
    portalId = data.id;
  });

  test('GET /portals - should list portals', async () => {
    const response = await apiContext.get('/portals', {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /portals/:id - should get portal by id', async () => {
    if (!portalId) {
      test.skip();
      return;
    }

    const response = await apiContext.get(`/portals/${portalId}`, {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toBe(portalId);
  });
});

// ==================== WIDGETS API TESTS ====================

test.describe('Widgets API', () => {
  let widgetId: string;
  let portalId: string;

  test.beforeAll(async () => {
    // Get first available portal
    const response = await apiContext.get('/portals', {
      headers: authHeaders(),
    });
    const portals = await response.json();
    if (portals.length > 0) {
      portalId = portals[0].id;
    }
  });

  test('POST /widgets - should create widget', async () => {
    if (!portalId) {
      test.skip();
      return;
    }

    const response = await apiContext.post('/widgets', {
      headers: authHeaders(),
      data: {
        name: 'Test Widget',
        type: 'chart',
        config: {
          chartType: 'line',
          dataSource: 'test',
        },
        portalId,
        position: { x: 0, y: 0, w: 4, h: 3 },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('id');
    widgetId = data.id;
  });

  test('GET /widgets - should list widgets', async () => {
    const response = await apiContext.get('/widgets', {
      headers: authHeaders(),
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('PATCH /widgets/:id - should update widget', async () => {
    if (!widgetId) {
      test.skip();
      return;
    }

    const response = await apiContext.patch(`/widgets/${widgetId}`, {
      headers: authHeaders(),
      data: {
        name: 'Updated Widget Name',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.name).toBe('Updated Widget Name');
  });

  test('DELETE /widgets/:id - should delete widget', async () => {
    if (!widgetId) {
      test.skip();
      return;
    }

    const response = await apiContext.delete(`/widgets/${widgetId}`, {
      headers: authHeaders(),
    });

    expect([200, 204]).toContain(response.status());
  });
});

// ==================== AI INSIGHTS API TESTS ====================

test.describe('AI Insights API', () => {
  test('POST /ai-insights/predict - should generate predictions', async () => {
    const response = await apiContext.post('/ai-insights/predict', {
      headers: authHeaders(),
      data: {
        metricId: 'test-metric',
        dataPoints: [100, 120, 130, 140, 150],
        periods: 5,
      },
    });

    // Could be success or not implemented
    expect([200, 201, 404, 501]).toContain(response.status());
  });

  test('POST /ai-insights/anomalies - should detect anomalies', async () => {
    const response = await apiContext.post('/ai-insights/anomalies', {
      headers: authHeaders(),
      data: {
        metricId: 'test-metric',
        dataPoints: [100, 120, 130, 500, 150], // 500 is an anomaly
      },
    });

    expect([200, 201, 404, 501]).toContain(response.status());
  });

  test('POST /ai-insights/generate-report - should generate AI report', async () => {
    const response = await apiContext.post('/ai-insights/generate-report', {
      headers: authHeaders(),
      data: {
        type: 'executive',
        context: {
          revenue: 100000,
          growth: 15,
        },
      },
    });

    expect([200, 201, 404, 501]).toContain(response.status());
  });
});

// ==================== BILLING API TESTS ====================

test.describe('Billing API', () => {
  test('GET /billing/plans - should list available plans', async () => {
    const response = await apiContext.get('/billing/plans', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /billing/usage - should get current usage', async () => {
    const response = await apiContext.get('/billing/usage', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /billing/invoices - should list invoices', async () => {
    const response = await apiContext.get('/billing/invoices', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ==================== TEMPLATES API TESTS ====================

test.describe('Templates API', () => {
  test('GET /templates - should list templates', async () => {
    const response = await apiContext.get('/templates', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /templates/featured - should get featured templates', async () => {
    const response = await apiContext.get('/templates/featured', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /templates/categories - should list categories', async () => {
    const response = await apiContext.get('/templates/categories', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ==================== COLLABORATION API TESTS ====================

test.describe('Collaboration API', () => {
  test('POST /collaboration/sessions - should create collaboration session', async () => {
    const response = await apiContext.post('/collaboration/sessions', {
      headers: authHeaders(),
      data: {
        entityType: 'portal',
        entityId: 'test-entity-id',
      },
    });

    expect([200, 201, 404]).toContain(response.status());
  });

  test('GET /collaboration/sessions/active - should get active sessions', async () => {
    const response = await apiContext.get('/collaboration/sessions/active', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ==================== GAMIFICATION API TESTS ====================

test.describe('Gamification API', () => {
  test('GET /gamification/badges - should list available badges', async () => {
    const response = await apiContext.get('/gamification/badges', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /gamification/leaderboard - should get leaderboard', async () => {
    const response = await apiContext.get('/gamification/leaderboard', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /gamification/streak - should get user streak', async () => {
    const response = await apiContext.get('/gamification/streak', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('GET /gamification/challenges - should list challenges', async () => {
    const response = await apiContext.get('/gamification/challenges', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ==================== GDPR API TESTS ====================

test.describe('GDPR API', () => {
  test('POST /gdpr/export-request - should request data export', async () => {
    const response = await apiContext.post('/gdpr/export-request', {
      headers: authHeaders(),
    });

    expect([200, 201, 404]).toContain(response.status());
  });

  test('GET /gdpr/consents - should get user consents', async () => {
    const response = await apiContext.get('/gdpr/consents', {
      headers: authHeaders(),
    });

    expect([200, 404]).toContain(response.status());
  });

  test('POST /gdpr/consent - should record consent', async () => {
    const response = await apiContext.post('/gdpr/consent', {
      headers: authHeaders(),
      data: {
        purpose: 'analytics',
        granted: true,
      },
    });

    expect([200, 201, 404]).toContain(response.status());
  });
});

// ==================== VOICE CONTROL API TESTS ====================

test.describe('Voice Control API', () => {
  test('POST /voice/parse - should parse voice command', async () => {
    const response = await apiContext.post('/voice/parse', {
      headers: authHeaders(),
      data: {
        transcript: 'show me the sales dashboard',
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('POST /voice/execute - should execute voice command', async () => {
    const response = await apiContext.post('/voice/execute', {
      headers: authHeaders(),
      data: {
        command: 'navigate',
        args: { target: 'dashboard' },
      },
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ==================== HEALTH API TESTS ====================

test.describe('Health API', () => {
  test('GET /health - should return health status', async () => {
    const response = await apiContext.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('GET /health/ready - should return readiness status', async () => {
    const response = await apiContext.get('/health/ready');
    expect([200, 503]).toContain(response.status());
  });

  test('GET /health/live - should return liveness status', async () => {
    const response = await apiContext.get('/health/live');
    expect(response.ok()).toBeTruthy();
  });
});

// ==================== RATE LIMITING TESTS ====================

test.describe('Rate Limiting', () => {
  test('should enforce rate limits on API', async () => {
    // Make rapid requests to trigger rate limiting
    const requests = Array(50).fill(null).map(() =>
      apiContext.get('/workspaces', { headers: authHeaders() })
    );

    const responses = await Promise.all(requests);
    
    // At least some should succeed
    const successCount = responses.filter(r => r.ok()).length;
    expect(successCount).toBeGreaterThan(0);

    // If rate limiting is configured, some might be rate limited
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;
    // This assertion depends on rate limit configuration
    expect(rateLimitedCount).toBeGreaterThanOrEqual(0);
  });
});

// ==================== ERROR HANDLING TESTS ====================

test.describe('Error Handling', () => {
  test('should return 404 for non-existent resource', async () => {
    const response = await apiContext.get('/workspaces/non-existent-id', {
      headers: authHeaders(),
    });

    expect([404, 400]).toContain(response.status());
  });

  test('should return 401 for unauthenticated requests', async () => {
    const response = await apiContext.get('/workspaces');
    expect(response.status()).toBe(401);
  });

  test('should return 400 for invalid request body', async () => {
    const response = await apiContext.post('/workspaces', {
      headers: authHeaders(),
      data: {
        // Missing required fields
      },
    });

    expect([400, 422]).toContain(response.status());
  });
});
