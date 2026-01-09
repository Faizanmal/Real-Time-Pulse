/**
 * MSW Handlers for Frontend Tests
 * Mocks API responses for testing
 */
import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE}/v1/auth/login`, async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
      });
    }
    
    return HttpResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 },
    );
  }),

  http.post(`${API_BASE}/v1/auth/register`, async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      message: 'Registration successful',
      user: {
        id: 'new-user-1',
        email: body.email,
        name: body.name,
      },
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/v1/auth/me`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      avatar: null,
    });
  }),

  http.post(`${API_BASE}/v1/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  // Workspace endpoints
  http.get(`${API_BASE}/v1/workspaces`, () => {
    return HttpResponse.json([
      {
        id: 'ws-1',
        name: 'My Workspace',
        slug: 'my-workspace',
        description: 'My primary workspace',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ws-2',
        name: 'Team Workspace',
        slug: 'team-workspace',
        description: 'Shared team workspace',
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  http.get(`${API_BASE}/v1/workspaces/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'My Workspace',
      slug: 'my-workspace',
      description: 'My primary workspace',
      members: [],
      settings: {},
      createdAt: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/v1/workspaces`, async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      id: 'new-ws-1',
      ...body,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Portal endpoints
  http.get(`${API_BASE}/v1/portals`, () => {
    return HttpResponse.json([
      {
        id: 'portal-1',
        name: 'Analytics Dashboard',
        slug: 'analytics-dashboard',
        isPublished: true,
        widgets: [],
      },
      {
        id: 'portal-2',
        name: 'Sales Overview',
        slug: 'sales-overview',
        isPublished: false,
        widgets: [],
      },
    ]);
  }),

  http.get(`${API_BASE}/v1/portals/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Analytics Dashboard',
      slug: 'analytics-dashboard',
      description: 'Main analytics dashboard',
      isPublished: true,
      widgets: [
        {
          id: 'widget-1',
          type: 'chart',
          name: 'Revenue Chart',
          config: { chartType: 'line' },
          position: { x: 0, y: 0, w: 6, h: 4 },
        },
      ],
    });
  }),

  // Widget endpoints
  http.get(`${API_BASE}/v1/widgets/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Revenue Chart',
      type: 'chart',
      config: { chartType: 'line' },
      data: [
        { date: '2024-01', value: 1000 },
        { date: '2024-02', value: 1500 },
        { date: '2024-03', value: 1200 },
      ],
    });
  }),

  http.post(`${API_BASE}/v1/widgets`, async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      id: 'new-widget-1',
      ...body,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Analytics endpoints
  http.get(`${API_BASE}/v1/analytics/overview`, () => {
    return HttpResponse.json({
      totalViews: 15234,
      uniqueVisitors: 4521,
      avgSessionDuration: 245,
      bounceRate: 32.5,
      topPortals: [
        { name: 'Analytics Dashboard', views: 5234 },
        { name: 'Sales Overview', views: 3421 },
      ],
    });
  }),

  // AI Insights endpoints
  http.post(`${API_BASE}/v1/ai-insights/analyze`, async () => {
    return HttpResponse.json({
      insights: [
        {
          type: 'trend',
          title: 'Revenue Growing',
          description: 'Revenue has increased by 15% this month',
          confidence: 0.92,
        },
        {
          type: 'anomaly',
          title: 'Unusual Traffic Spike',
          description: 'Traffic was 3x higher than average on Monday',
          confidence: 0.87,
        },
      ],
    });
  }),

  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }),

  // Notifications
  http.get(`${API_BASE}/v1/notifications`, () => {
    return HttpResponse.json([
      {
        id: 'notif-1',
        type: 'info',
        title: 'Welcome!',
        message: 'Welcome to Real-Time Pulse',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }),
];
