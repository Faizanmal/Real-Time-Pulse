'use client';

import { apiClient } from './client';

export interface DashboardOverview {
  totalPortals: number;
  activePortals: number;
  totalWidgets: number;
  totalIntegrations: number;
  activeUsers: number;
  dataPointsToday: number;
  trends: {
    portals: number;
    widgets: number;
    users: number;
  };
}

export interface PortalAnalytics {
  portalId: string;
  views: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  topWidgets: { widgetId: string; name: string; views: number }[];
  recentActivity: { timestamp: string; action: string; userId: string }[];
}

export interface UsageMetric {
  id: string;
  type: 'API_CALL' | 'DATA_SYNC' | 'EXPORT' | 'USER_ACTION' | 'WIDGET_VIEW';
  value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  uptime: number;
  requestsPerMinute: number;
}

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TrendingData {
  topPortals: { id: string; name: string; views: number; growth: number }[];
  topWidgets: { id: string; name: string; interactions: number; growth: number }[];
  popularIntegrations: { provider: string; count: number }[];
  peakHours: { hour: number; requests: number }[];
}

export const analyticsApi = {
  getDashboardOverview: async (): Promise<DashboardOverview> => {
    const response = await apiClient.get<DashboardOverview>('/analytics/dashboard');
    return response;
  },

  getPortalAnalytics: async (portalId: string): Promise<PortalAnalytics> => {
    const response = await apiClient.get<PortalAnalytics>(`/analytics/portal/${portalId}`);
    return response;
  },

  getUsageMetrics: async (params: {
    type?: string;
    startDate?: string;
    endDate?: string;
    period?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<UsageMetric[]> => {
    const response = await apiClient.get<UsageMetric[]>('/analytics/metrics', { params });
    return response;
  },

  getPerformanceMetrics: async (): Promise<PerformanceMetrics> => {
    const response = await apiClient.get<PerformanceMetrics>('/analytics/performance');
    return response;
  },

  getActivityFeed: async (limit?: number): Promise<ActivityItem[]> => {
    const response = await apiClient.get<ActivityItem[]>('/analytics/activity', { params: { limit } });
    return response;
  },

  getTrendingData: async (): Promise<TrendingData> => {
    const response = await apiClient.get<TrendingData>('/analytics/trending');
    return response;
  },

  trackMetric: async (data: {
    type: UsageMetric['type'];
    value: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> => {
    await apiClient.post('/analytics/track', data);
  },
};

