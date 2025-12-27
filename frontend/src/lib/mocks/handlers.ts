/**
 * =============================================================================
 * REAL-TIME PULSE - MSW MOCK SERVICE WORKER HANDLERS
 * =============================================================================
 * 
 * Mock API handlers for frontend development and testing.
 * Use with MSW (Mock Service Worker) for reliable API mocking.
 */

import { http, HttpResponse, delay } from 'msw';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const mockUsers = new Map([
  ['user-1', {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    workspaceId: 'workspace-1',
    role: 'OWNER',
    emailVerified: true,
    createdAt: new Date().toISOString(),
  }],
]);

const mockWorkspaces = new Map([
  ['workspace-1', {
    id: 'workspace-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    primaryColor: '#3B82F6',
    createdAt: new Date().toISOString(),
  }],
]);

const mockPortals = new Map([
  ['portal-1', {
    id: 'portal-1',
    name: 'Marketing Dashboard',
    slug: 'marketing-dashboard',
    workspaceId: 'workspace-1',
    status: 'ACTIVE',
    isPublic: false,
    createdAt: new Date().toISOString(),
    widgets: [],
  }],
  ['portal-2', {
    id: 'portal-2',
    name: 'Sales Dashboard',
    slug: 'sales-dashboard',
    workspaceId: 'workspace-1',
    status: 'ACTIVE',
    isPublic: true,
    createdAt: new Date().toISOString(),
    widgets: [],
  }],
]);

const mockWidgets = new Map([
  ['widget-1', {
    id: 'widget-1',
    title: 'Website Traffic',
    type: 'CHART',
    portalId: 'portal-1',
    position: 0,
    config: { chartType: 'line' },
    data: { values: [100, 150, 200, 175, 225] },
    createdAt: new Date().toISOString(),
  }],
  ['widget-2', {
    id: 'widget-2',
    title: 'Conversion Rate',
    type: 'METRIC',
    portalId: 'portal-1',
    position: 1,
    config: {},
    data: { value: 3.5, unit: '%', trend: 'up' },
    createdAt: new Date().toISOString(),
  }],
]);

const mockIntegrations = new Map([
  ['integration-1', {
    id: 'integration-1',
    provider: 'GOOGLE_ANALYTICS',
    workspaceId: 'workspace-1',
    status: 'ACTIVE',
    accountName: 'Test GA Account',
    lastSyncedAt: new Date().toISOString(),
  }],
]);

// ============================================================================
// AUTH HANDLERS
// ============================================================================

export const authHandlers = [
  // Login
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    await delay(500);
    
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        user: mockUsers.get('user-1'),
      });
    }
    
    return HttpResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 },
    );
  }),

  // Register
  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    await delay(500);
    
    const body = await request.json() as { email: string; password: string; name: string };
    
    const userId = generateId();
    const user = {
      id: userId,
      email: body.email,
      firstName: body.name.split(' ')[0],
      lastName: body.name.split(' ')[1] || '',
      workspaceId: generateId(),
      role: 'OWNER',
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    
    mockUsers.set(userId, user);
    
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      user,
    }, { status: 201 });
  }),

  // Get current user
  http.get(`${API_URL}/auth/me`, async () => {
    await delay(200);
    return HttpResponse.json(mockUsers.get('user-1'));
  }),

  // Logout
  http.post(`${API_URL}/auth/logout`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true });
  }),

  // Refresh token
  http.post(`${API_URL}/auth/refresh`, async () => {
    await delay(100);
    return HttpResponse.json({ accessToken: 'new-mock-access-token' });
  }),
];

// ============================================================================
// PORTAL HANDLERS
// ============================================================================

export const portalHandlers = [
  // List portals
  http.get(`${API_URL}/portals`, async ({ request }) => {
    await delay(300);
    
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    
    const portals = Array.from(mockPortals.values()).filter(
      p => !workspaceId || p.workspaceId === workspaceId,
    );
    
    return HttpResponse.json({
      data: portals,
      meta: { total: portals.length, page: 1, limit: 20, totalPages: 1 },
    });
  }),

  // Get portal
  http.get(`${API_URL}/portals/:id`, async ({ params }) => {
    await delay(200);
    
    const portal = mockPortals.get(params.id as string);
    
    if (!portal) {
      return HttpResponse.json({ message: 'Portal not found' }, { status: 404 });
    }
    
    return HttpResponse.json(portal);
  }),

  // Create portal
  http.post(`${API_URL}/portals`, async ({ request }) => {
    await delay(500);
    
    const body = await request.json() as { name: string; description?: string };
    
    const portal = {
      id: generateId(),
      name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      workspaceId: 'workspace-1',
      status: 'ACTIVE',
      isPublic: false,
      createdAt: new Date().toISOString(),
      widgets: [],
    };
    
    mockPortals.set(portal.id, portal);
    
    return HttpResponse.json(portal, { status: 201 });
  }),

  // Update portal
  http.patch(`${API_URL}/portals/:id`, async ({ params, request }) => {
    await delay(300);
    
    const portal = mockPortals.get(params.id as string);
    
    if (!portal) {
      return HttpResponse.json({ message: 'Portal not found' }, { status: 404 });
    }
    
    const body = await request.json() as Partial<typeof portal>;
    const updated = { ...portal, ...body, updatedAt: new Date().toISOString() };
    mockPortals.set(params.id as string, updated);
    
    return HttpResponse.json(updated);
  }),

  // Delete portal
  http.delete(`${API_URL}/portals/:id`, async ({ params }) => {
    await delay(300);
    
    if (!mockPortals.has(params.id as string)) {
      return HttpResponse.json({ message: 'Portal not found' }, { status: 404 });
    }
    
    mockPortals.delete(params.id as string);
    
    return HttpResponse.json({ success: true });
  }),
];

// ============================================================================
// WIDGET HANDLERS
// ============================================================================

export const widgetHandlers = [
  // List widgets
  http.get(`${API_URL}/widgets`, async ({ request }) => {
    await delay(200);
    
    const url = new URL(request.url);
    const portalId = url.searchParams.get('portalId');
    
    const widgets = Array.from(mockWidgets.values()).filter(
      w => !portalId || w.portalId === portalId,
    );
    
    return HttpResponse.json(widgets);
  }),

  // Get widget
  http.get(`${API_URL}/widgets/:id`, async ({ params }) => {
    await delay(150);
    
    const widget = mockWidgets.get(params.id as string);
    
    if (!widget) {
      return HttpResponse.json({ message: 'Widget not found' }, { status: 404 });
    }
    
    return HttpResponse.json(widget);
  }),

  // Create widget
  http.post(`${API_URL}/widgets`, async ({ request }) => {
    await delay(400);
    
    const body = await request.json() as { title: string; type: string; portalId: string };
    
    const widget = {
      id: generateId(),
      title: body.title,
      type: body.type,
      portalId: body.portalId,
      position: mockWidgets.size,
      config: {},
      data: null,
      createdAt: new Date().toISOString(),
    };
    
    mockWidgets.set(widget.id, widget);
    
    return HttpResponse.json(widget, { status: 201 });
  }),

  // Update widget
  http.patch(`${API_URL}/widgets/:id`, async ({ params, request }) => {
    await delay(250);
    
    const widget = mockWidgets.get(params.id as string);
    
    if (!widget) {
      return HttpResponse.json({ message: 'Widget not found' }, { status: 404 });
    }
    
    const body = await request.json() as Partial<typeof widget>;
    const updated = { ...widget, ...body, updatedAt: new Date().toISOString() };
    mockWidgets.set(params.id as string, updated);
    
    return HttpResponse.json(updated);
  }),

  // Delete widget
  http.delete(`${API_URL}/widgets/:id`, async ({ params }) => {
    await delay(200);
    
    if (!mockWidgets.has(params.id as string)) {
      return HttpResponse.json({ message: 'Widget not found' }, { status: 404 });
    }
    
    mockWidgets.delete(params.id as string);
    
    return HttpResponse.json({ success: true });
  }),

  // Refresh widget data
  http.post(`${API_URL}/widgets/:id/refresh`, async ({ params }) => {
    await delay(1000);
    
    const widget = mockWidgets.get(params.id as string);
    
    if (!widget) {
      return HttpResponse.json({ message: 'Widget not found' }, { status: 404 });
    }
    
    // Simulate updated data
    widget.data = {
      ...widget.data,
      lastRefreshed: new Date().toISOString(),
      value: Math.floor(Math.random() * 100),
    };
    
    return HttpResponse.json(widget);
  }),
];

// ============================================================================
// INTEGRATION HANDLERS
// ============================================================================

export const integrationHandlers = [
  // List integrations
  http.get(`${API_URL}/integrations`, async () => {
    await delay(300);
    return HttpResponse.json(Array.from(mockIntegrations.values()));
  }),

  // Get integration
  http.get(`${API_URL}/integrations/:id`, async ({ params }) => {
    await delay(200);
    
    const integration = mockIntegrations.get(params.id as string);
    
    if (!integration) {
      return HttpResponse.json({ message: 'Integration not found' }, { status: 404 });
    }
    
    return HttpResponse.json(integration);
  }),

  // Sync integration
  http.post(`${API_URL}/integrations/:id/sync`, async ({ params }) => {
    await delay(2000);
    
    const integration = mockIntegrations.get(params.id as string);
    
    if (!integration) {
      return HttpResponse.json({ message: 'Integration not found' }, { status: 404 });
    }
    
    integration.lastSyncedAt = new Date().toISOString();
    
    return HttpResponse.json({ success: true, lastSyncedAt: integration.lastSyncedAt });
  }),
];

// ============================================================================
// AI HANDLERS
// ============================================================================

export const aiHandlers = [
  // Get AI insights
  http.get(`${API_URL}/ai-insights`, async ({ request }) => {
    await delay(500);
    
    const url = new URL(request.url);
    const portalId = url.searchParams.get('portalId');
    
    return HttpResponse.json([
      {
        id: generateId(),
        type: 'ANOMALY',
        title: 'Traffic Spike Detected',
        description: 'Website traffic increased by 45% compared to last week.',
        severity: 'INFO',
        portalId,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        type: 'TREND',
        title: 'Conversion Rate Improving',
        description: 'Your conversion rate has been steadily improving over the past month.',
        severity: 'INFO',
        portalId,
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // Generate insights
  http.post(`${API_URL}/ai-insights/generate`, async () => {
    await delay(3000);
    
    return HttpResponse.json({
      success: true,
      insightsGenerated: 3,
    });
  }),

  // Natural language query
  http.post(`${API_URL}/ai-insights/query`, async ({ request }) => {
    await delay(1500);
    
    const body = await request.json() as { query: string };
    
    return HttpResponse.json({
      answer: `Based on your data, here's what I found regarding "${body.query}": Your metrics show positive trends with a 15% increase in overall engagement.`,
      confidence: 0.85,
      sources: ['Google Analytics', 'Internal Data'],
    });
  }),
];

// ============================================================================
// HEALTH HANDLERS
// ============================================================================

export const healthHandlers = [
  http.get(`${API_URL}/health`, async () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        integrations: 'healthy',
      },
    });
  }),
];

// ============================================================================
// ALL HANDLERS
// ============================================================================

export const handlers = [
  ...authHandlers,
  ...portalHandlers,
  ...widgetHandlers,
  ...integrationHandlers,
  ...aiHandlers,
  ...healthHandlers,
];
