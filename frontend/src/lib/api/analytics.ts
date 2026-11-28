"use client";

import { apiClient } from "./client";

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
  type: "API_CALL" | "DATA_SYNC" | "EXPORT" | "USER_ACTION" | "WIDGET_VIEW";
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
  topWidgets: {
    id: string;
    name: string;
    interactions: number;
    growth: number;
  }[];
  popularIntegrations: { provider: string; count: number }[];
  peakHours: { hour: number; requests: number }[];
}

export interface CanonicalMetricDefinition {
  id: string;
  name: string;
  key: string;
  provider: string;
  unit: string;
  aggregation: string;
  timeZone: string;
  samplePeriod: string;
  definition: string;
  transformVersion: string;
}
export interface CanonicalMetricMapping {
  id: string;
  displayName: string;
  clientVisible: boolean;
  allowSourceDrilldown: boolean;
  feedHealth: string;
  integration: { lastSyncedAt: string | null; connectionState: string };
  portal: { id: string; name: string };
  metricDefinition: CanonicalMetricDefinition;
  latestSnapshot?: {
    value: string | null;
    unit: string;
    quality: string;
    confidence: string | null;
    calculatedAt: string;
    limitations?: unknown;
  } | null;
  milestones: Array<{
    id: string;
    name: string;
    targetValue: string;
    targetDate: string;
    status: string;
  }>;
}

export interface ValueLedgerEntry {
  id: string;
  revision: number;
  title: string;
  formulaKey: string;
  formulaVersion: string;
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  resultValue: string;
  unit: string;
  assumptions: Record<string, unknown>;
  sensitivity: {
    formula: string;
    low: number;
    base: number;
    high: number;
    unit: string;
  };
  status: "DRAFT" | "APPROVED";
  clientVisible: boolean;
  createdByLabel: string;
  createdAt: string;
  approvedByLabel?: string | null;
  approvedAt?: string | null;
}

export interface ProductAnalyticsSummary {
  periodDays: number;
  since: string;
  generatedAt: string;
  lastEventAt: string | null;
  features: Array<{
    featureKey: string;
    adoptionEvents: number;
    successEvents: number;
    guardrailEvents: number;
    usage: Array<{ category: string; unit: string; quantity: number; events: number }>;
    costs: Array<{ category: string; basis: "OBSERVED" | "ESTIMATED"; currency: string; amount: number }>;
    latestEventAt: string | null;
  }>;
  experiments: Array<{
    experimentKey: string;
    variantKey: string;
    metric: string;
    samples: number;
    total: number;
    mean: number;
  }>;
}

export interface ProductTelemetryEventInput {
  eventId: string;
  featureKey: string;
  kind: "FEATURE_ADOPTION" | "FEATURE_SUCCESS" | "FEATURE_GUARDRAIL" | "COST" | "EXPERIMENT";
  eventName: string;
  value?: number;
  unit?: string;
  costCategory?: "PROVIDER_CALL" | "JOB_RUNTIME" | "EMAIL" | "STORAGE" | "AI_TOKENS";
  costBasis?: "OBSERVED" | "ESTIMATED";
  costMicros?: number;
  currency?: string;
  experimentKey?: string;
  variantKey?: string;
}

export const analyticsApi = {
  getProductAnalytics: (days = 30): Promise<ProductAnalyticsSummary> =>
    apiClient.get("/analytics/product-analytics", { params: { days } }),
  recordProductEvent: (data: ProductTelemetryEventInput): Promise<{ accepted: boolean; duplicate: boolean }> =>
    apiClient.post("/analytics/product-events", data),
  exportExperimentResults: (days = 30): Promise<Blob> =>
    apiClient.get("/analytics/product-analytics/experiments.csv", {
      params: { days },
      responseType: "blob",
    }),
  getMetricCatalog: async (): Promise<CanonicalMetricDefinition[]> =>
    apiClient.get("/analytics/metric-catalog"),
  getMetricMappings: async (): Promise<CanonicalMetricMapping[]> =>
    apiClient.get("/analytics/metric-mappings"),
  createMetricMapping: async (data: {
    portalId: string;
    integrationId: string;
    metricDefinitionId: string;
    displayName: string;
    clientVisible: boolean;
    allowSourceDrilldown: boolean;
    targetValue?: number;
    targetUnit?: string;
  }): Promise<CanonicalMetricMapping> =>
    apiClient.post("/analytics/metric-mappings", data),
  reprocessMetric: async (id: string, reason: string) =>
    apiClient.post(`/analytics/metric-mappings/${id}/reprocess`, { reason }),
  createMilestone: async (
    id: string,
    data: {
      name: string;
      targetValue: number;
      targetDate: string;
      description?: string;
    },
  ) => apiClient.post(`/analytics/metric-mappings/${id}/milestones`, data),
  getValueLedger: (portalId: string): Promise<ValueLedgerEntry[]> =>
    apiClient.get("/analytics/value-ledger", { params: { portalId } }),
  createValueLedgerDraft: (data: {
    portalId: string;
    expectedRevision: number;
    title: string;
    periodStart: string;
    periodEnd: string;
    timeZone: string;
    hoursSaved: {
      low: number;
      base: number;
      high: number;
      evidence: { kind: "HUMAN_NOTE"; label: string; note: string };
    };
    loadedHourlyRate: {
      low: number;
      base: number;
      high: number;
      evidence: { kind: "HUMAN_NOTE"; label: string; note: string };
    };
  }): Promise<ValueLedgerEntry> =>
    apiClient.post("/analytics/value-ledger", data),
  approveValueLedgerEntry: (
    id: string,
    expectedRevision: number,
    clientVisible: boolean,
  ): Promise<ValueLedgerEntry> =>
    apiClient.post(`/analytics/value-ledger/${id}/approve`, {
      expectedRevision,
      clientVisible,
    }),
  exportValueLedger: (portalId: string): Promise<Blob> =>
    apiClient.get(`/exports/portal/${portalId}/value-ledger.json`, {
      responseType: "blob",
    }),
  getDashboardOverview: async (): Promise<DashboardOverview> => {
    return await apiClient.get<DashboardOverview>("/analytics/dashboard");
  },

  getPortalAnalytics: async (portalId: string): Promise<PortalAnalytics> => {
    return await apiClient.get<PortalAnalytics>(
      `/analytics/portal/${portalId}`,
    );
  },

  getUsageMetrics: async (params: {
    type?: string;
    startDate?: string;
    endDate?: string;
    period?: "hour" | "day" | "week" | "month";
  }): Promise<UsageMetric[]> => {
    return await apiClient.get<UsageMetric[]>("/analytics/metrics", { params });
  },

  getPerformanceMetrics: async (): Promise<PerformanceMetrics> => {
    return await apiClient.get<PerformanceMetrics>("/analytics/performance");
  },

  getActivityFeed: async (limit?: number): Promise<ActivityItem[]> => {
    return await apiClient.get<ActivityItem[]>("/analytics/activity", {
      params: { limit },
    });
  },

  getTrendingData: async (): Promise<TrendingData> => {
    return await apiClient.get<TrendingData>("/analytics/trending");
  },

  trackMetric: async (data: {
    type: UsageMetric["type"];
    value: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> => {
    await apiClient.post("/analytics/track", data);
  },
};
