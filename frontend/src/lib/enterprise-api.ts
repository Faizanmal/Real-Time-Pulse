/**
 * API Client for New Enterprise Features
 * Export, AI Insights, Alerts, and Webhooks
 * 
 * This module extends the main API client with enterprise features.
 * All API calls use the shared apiClient from './api' for consistent
 * authentication, error handling, and token refresh logic.
 */
import { apiClient } from './api';

// ========================================
// EXPORT API
// ========================================

export interface ExportFormat {
  format: 'pdf' | 'csv' | 'excel' | 'json';
}

export const exportApi = {
  /**
   * Export portal to PDF
   */
  exportPortalToPDF: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get(`/exports/portal/${portalId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export portal to CSV
   */
  exportPortalToCSV: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get(`/exports/portal/${portalId}/csv`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export portal to Excel
   */
  exportPortalToExcel: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get(`/exports/portal/${portalId}/excel`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export widget data
   */
  exportWidget: async (widgetId: string, format: ExportFormat['format']): Promise<Blob> => {
    const response = await apiClient.get(`/exports/widget/${widgetId}/${format}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ========================================
// AI INSIGHTS API
// ========================================

export interface AIInsight {
  id: string;
  type: 'ANOMALY' | 'TREND' | 'PREDICTION' | 'RECOMMENDATION' | 'SUMMARY';
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  status: 'NEW' | 'VIEWED' | 'ACTIONED' | 'DISMISSED';
  data: Record<string, unknown>;
  recommendations?: {
    actions: string[];
  };
  portalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateInsightsResponse {
  generated: number;
  insights: AIInsight[];
}

export const aiInsightsApi = {
  /**
   * Get workspace insights
   */
  getWorkspaceInsights: async (params?: {
    status?: string;
    type?: string;
  }): Promise<AIInsight[]> => {
    const response = await apiClient.get('/ai-insights', { params });
    return response.data;
  },

  /**
   * Get portal insights
   */
  getPortalInsights: async (portalId: string): Promise<AIInsight[]> => {
    const response = await apiClient.get(`/ai-insights/portal/${portalId}`);
    return response.data;
  },

  /**
   * Generate insights for portal
   */
  generateInsights: async (portalId: string): Promise<GenerateInsightsResponse> => {
    const response = await apiClient.post(`/ai-insights/portal/${portalId}/generate`);
    return response.data;
  },

  /**
   * Dismiss insight
   */
  dismissInsight: async (insightId: string): Promise<AIInsight> => {
    const response = await apiClient.patch(`/ai-insights/${insightId}/dismiss`);
    return response.data;
  },

  /**
   * Mark insight as actioned
   */
  actionInsight: async (insightId: string): Promise<AIInsight> => {
    const response = await apiClient.patch(`/ai-insights/${insightId}/action`);
    return response.data;
  },
};

// ========================================
// ALERTS API
// ========================================

export interface Alert {
  id: string;
  name: string;
  description?: string;
  portalId?: string;
  widgetId?: string;
  condition: {
    metric: string;
    operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
    threshold: number;
  };
  channels: string[];
  emailRecipients?: string[];
  webhookUrl?: string;
  slackWebhook?: string;
  slackChannel?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertDto {
  name: string;
  description?: string;
  portalId?: string;
  widgetId?: string;
  condition: Alert['condition'];
  channels: string[];
  emailRecipients?: string[];
  webhookUrl?: string;
  slackWebhook?: string;
  slackChannel?: string;
  isActive?: boolean;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  triggeredValue: Record<string, unknown>;
  condition: Alert['condition'];
  notificationsSent: Record<string, boolean>;
  triggeredAt: string;
}

export const alertsApi = {
  /**
   * Get all alerts
   */
  getAllAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get('/alerts');
    return response.data;
  },

  /**
   * Get alert by ID
   */
  getAlert: async (alertId: string): Promise<Alert> => {
    const response = await apiClient.get(`/alerts/${alertId}`);
    return response.data;
  },

  /**
   * Create alert
   */
  createAlert: async (data: CreateAlertDto): Promise<Alert> => {
    const response = await apiClient.post('/alerts', data);
    return response.data;
  },

  /**
   * Update alert
   */
  updateAlert: async (alertId: string, data: Partial<CreateAlertDto>): Promise<Alert> => {
    const response = await apiClient.patch(`/alerts/${alertId}`, data);
    return response.data;
  },

  /**
   * Delete alert
   */
  deleteAlert: async (alertId: string): Promise<void> => {
    await apiClient.delete(`/alerts/${alertId}`);
  },

  /**
   * Get alert history
   */
  getAlertHistory: async (alertId: string): Promise<AlertHistory[]> => {
    const response = await apiClient.get(`/alerts/${alertId}/history`);
    return response.data;
  },

  /**
   * Test alert
   */
  testAlert: async (alertId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/alerts/${alertId}/test`);
    return response.data;
  },
};

// ========================================
// WEBHOOKS API
// ========================================

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  maxRetries: number;
  retryDelay: number;
  timeoutSeconds: number;
  isActive: boolean;
  lastTriggeredAt?: string;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
  timeoutSeconds?: number;
  isActive?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
  responseCode?: number;
  responseBody?: string;
  responseTime?: number;
  error?: string;
  createdAt: string;
}

export const webhooksApi = {
  /**
   * Get all webhooks
   */
  getAllWebhooks: async (): Promise<Webhook[]> => {
    const response = await apiClient.get('/webhooks');
    return response.data;
  },

  /**
   * Get webhook by ID
   */
  getWebhook: async (webhookId: string): Promise<Webhook> => {
    const response = await apiClient.get(`/webhooks/${webhookId}`);
    return response.data;
  },

  /**
   * Create webhook
   */
  createWebhook: async (data: CreateWebhookDto): Promise<Webhook> => {
    const response = await apiClient.post('/webhooks', data);
    return response.data;
  },

  /**
   * Update webhook
   */
  updateWebhook: async (webhookId: string, data: Partial<CreateWebhookDto>): Promise<Webhook> => {
    const response = await apiClient.patch(`/webhooks/${webhookId}`, data);
    return response.data;
  },

  /**
   * Delete webhook
   */
  deleteWebhook: async (webhookId: string): Promise<void> => {
    await apiClient.delete(`/webhooks/${webhookId}`);
  },

  /**
   * Get webhook deliveries
   */
  getWebhookDeliveries: async (webhookId: string): Promise<WebhookDelivery[]> => {
    const response = await apiClient.get(`/webhooks/${webhookId}/deliveries`);
    return response.data;
  },

  /**
   * Test webhook
   */
  testWebhook: async (webhookId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/webhooks/${webhookId}/test`);
    return response.data;
  },

  /**
   * Regenerate webhook secret
   */
  regenerateSecret: async (webhookId: string): Promise<Webhook> => {
    const response = await apiClient.post(`/webhooks/${webhookId}/regenerate-secret`);
    return response.data;
  },
};

// ========================================
// AVAILABLE WEBHOOK EVENTS
// ========================================

export const WEBHOOK_EVENTS = {
  PORTAL: [
    { value: 'portal.created', label: 'Portal Created' },
    { value: 'portal.updated', label: 'Portal Updated' },
    { value: 'portal.deleted', label: 'Portal Deleted' },
  ],
  WIDGET: [
    { value: 'widget.added', label: 'Widget Added' },
    { value: 'widget.updated', label: 'Widget Updated' },
    { value: 'widget.deleted', label: 'Widget Deleted' },
  ],
  INTEGRATION: [
    { value: 'integration.connected', label: 'Integration Connected' },
    { value: 'integration.synced', label: 'Integration Synced' },
    { value: 'integration.failed', label: 'Integration Failed' },
  ],
  ALERT: [
    { value: 'alert.triggered', label: 'Alert Triggered' },
  ],
  REPORT: [
    { value: 'report.generated', label: 'Report Generated' },
  ],
};

// Helper function to download blob
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
