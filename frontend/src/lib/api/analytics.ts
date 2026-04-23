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
    return await apiClient.get<DashboardOverview>('/analytics/dashboard');
  },

  getPortalAnalytics: async (portalId: string): Promise<PortalAnalytics> => {
    return await apiClient.get<PortalAnalytics>(`/analytics/portal/${portalId}`);
  },

  getUsageMetrics: async (params: {
    type?: string;
    startDate?: string;
    endDate?: string;
    period?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<UsageMetric[]> => {
    return await apiClient.get<UsageMetric[]>('/analytics/metrics', { params });
  },

  getPerformanceMetrics: async (): Promise<PerformanceMetrics> => {
    return await apiClient.get<PerformanceMetrics>('/analytics/performance');
  },

  getActivityFeed: async (limit?: number): Promise<ActivityItem[]> => {
    return await apiClient.get<ActivityItem[]>('/analytics/activity', { params: { limit } });
  },

  getTrendingData: async (): Promise<TrendingData> => {
    return await apiClient.get<TrendingData>('/analytics/trending');
  },

  trackMetric: async (data: {
    type: UsageMetric['type'];
    value: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> => {
    await apiClient.post('/analytics/track', data);
  },
};

