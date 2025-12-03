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

// ========================================
// SCHEDULED REPORTS API
// ========================================

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  portalId: string;
  format: 'pdf' | 'csv' | 'excel';
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour: number;
    minute: number;
    timezone: string;
  };
  recipients: string[];
  includeCharts: boolean;
  includeTables: boolean;
  customMessage?: string;
  isActive: boolean;
  lastSentAt?: string;
  nextScheduledAt?: string;
  sendCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledReportDto {
  name: string;
  description?: string;
  portalId: string;
  format: 'pdf' | 'csv' | 'excel';
  schedule: ScheduledReport['schedule'];
  recipients: string[];
  includeCharts?: boolean;
  includeTables?: boolean;
  customMessage?: string;
  isActive?: boolean;
}

export const scheduledReportsApi = {
  getAll: async (): Promise<ScheduledReport[]> => {
    const response = await apiClient.get('/scheduled-reports');
    return response.data;
  },

  getById: async (id: string): Promise<ScheduledReport> => {
    const response = await apiClient.get(`/scheduled-reports/${id}`);
    return response.data;
  },

  create: async (data: CreateScheduledReportDto): Promise<ScheduledReport> => {
    const response = await apiClient.post('/scheduled-reports', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateScheduledReportDto>): Promise<ScheduledReport> => {
    const response = await apiClient.patch(`/scheduled-reports/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scheduled-reports/${id}`);
  },

  sendNow: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/scheduled-reports/${id}/send`);
    return response.data;
  },

  preview: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/scheduled-reports/${id}/preview`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ========================================
// SHARE LINKS API
// ========================================

export interface ShareLink {
  id: string;
  token: string;
  resourceType: 'portal' | 'widget' | 'report';
  resourceId: string;
  name?: string;
  expiresAt?: string;
  passwordProtected: boolean;
  maxViews?: number;
  viewCount: number;
  allowDownload: boolean;
  permissions: string[];
  lastAccessedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShareLinkDto {
  resourceType: 'portal' | 'widget' | 'report';
  resourceId: string;
  name?: string;
  expiresAt?: string;
  password?: string;
  maxViews?: number;
  allowDownload?: boolean;
  permissions?: string[];
}

export const shareLinksApi = {
  getAll: async (): Promise<ShareLink[]> => {
    const response = await apiClient.get('/share-links');
    return response.data;
  },

  getById: async (id: string): Promise<ShareLink> => {
    const response = await apiClient.get(`/share-links/${id}`);
    return response.data;
  },

  create: async (data: CreateShareLinkDto): Promise<ShareLink & { shareUrl: string }> => {
    const response = await apiClient.post('/share-links', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateShareLinkDto>): Promise<ShareLink> => {
    const response = await apiClient.patch(`/share-links/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/share-links/${id}`);
  },

  regenerate: async (id: string): Promise<ShareLink & { shareUrl: string }> => {
    const response = await apiClient.post(`/share-links/${id}/regenerate`);
    return response.data;
  },

  access: async (token: string, password?: string): Promise<{ resource: unknown; type: string }> => {
    const response = await apiClient.post(`/share-links/access/${token}`, { password });
    return response.data;
  },
};

// ========================================
// COMMENTS API
// ========================================

export interface Comment {
  id: string;
  content: string;
  resourceType: 'portal' | 'widget';
  resourceId: string;
  authorId: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  parentId?: string;
  replies?: Comment[];
  mentions: string[];
  isEdited: boolean;
  isPinned: boolean;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentDto {
  content: string;
  resourceType: 'portal' | 'widget';
  resourceId: string;
  parentId?: string;
  mentions?: string[];
}

export const commentsApi = {
  getByResource: async (resourceType: string, resourceId: string): Promise<Comment[]> => {
    const response = await apiClient.get(`/comments/${resourceType}/${resourceId}`);
    return response.data;
  },

  create: async (data: CreateCommentDto): Promise<Comment> => {
    const response = await apiClient.post('/comments', data);
    return response.data;
  },

  update: async (id: string, content: string): Promise<Comment> => {
    const response = await apiClient.patch(`/comments/${id}`, { content });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/comments/${id}`);
  },

  togglePin: async (id: string): Promise<Comment> => {
    const response = await apiClient.post(`/comments/${id}/pin`);
    return response.data;
  },

  toggleResolved: async (id: string): Promise<Comment> => {
    const response = await apiClient.post(`/comments/${id}/resolve`);
    return response.data;
  },

  getThread: async (commentId: string): Promise<Comment> => {
    const response = await apiClient.get(`/comments/${commentId}/thread`);
    return response.data;
  },
};

// ========================================
// TEMPLATES API
// ========================================

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'widget' | 'portal';
  category: string;
  thumbnail?: string;
  config: Record<string, unknown>;
  previewData?: Record<string, unknown>;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  usageCount: number;
  rating: number;
  ratingCount: number;
  authorId: string;
  author?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  type: 'widget' | 'portal';
  category: string;
  thumbnail?: string;
  config: Record<string, unknown>;
  previewData?: Record<string, unknown>;
  tags?: string[];
  isPublic?: boolean;
}

export interface TemplateRating {
  rating: number;
  review?: string;
}

export const templatesApi = {
  getAll: async (params?: {
    type?: string;
    category?: string;
    search?: string;
    featured?: boolean;
  }): Promise<Template[]> => {
    const response = await apiClient.get('/templates', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Template> => {
    const response = await apiClient.get(`/templates/${id}`);
    return response.data;
  },

  getMyTemplates: async (): Promise<Template[]> => {
    const response = await apiClient.get('/templates/my-templates');
    return response.data;
  },

  create: async (data: CreateTemplateDto): Promise<Template> => {
    const response = await apiClient.post('/templates', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateTemplateDto>): Promise<Template> => {
    const response = await apiClient.patch(`/templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
  },

  rate: async (id: string, data: TemplateRating): Promise<Template> => {
    const response = await apiClient.post(`/templates/${id}/rate`, data);
    return response.data;
  },

  use: async (id: string, targetId: string): Promise<{ message: string; resourceId: string }> => {
    const response = await apiClient.post(`/templates/${id}/use`, { targetId });
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get('/templates/categories');
    return response.data;
  },

  getFeatured: async (): Promise<Template[]> => {
    const response = await apiClient.get('/templates/featured');
    return response.data;
  },
};

// ========================================
// BILLING API
// ========================================

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    portals: number;
    widgets: number;
    integrations: number;
    members: number;
    storage: number;
    apiCalls: number;
  };
  stripePriceId?: string;
}

export interface Subscription {
  id: string;
  planId: string;
  plan: BillingPlan;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface UsageStats {
  portals: { used: number; limit: number };
  widgets: { used: number; limit: number };
  integrations: { used: number; limit: number };
  members: { used: number; limit: number };
  storage: { used: number; limit: number };
  apiCalls: { used: number; limit: number };
}

export const billingApi = {
  getPlans: async (): Promise<BillingPlan[]> => {
    const response = await apiClient.get('/billing/plans');
    return response.data;
  },

  getCurrentSubscription: async (): Promise<Subscription | null> => {
    const response = await apiClient.get('/billing/subscription');
    return response.data;
  },

  createCheckoutSession: async (priceId: string): Promise<{ sessionUrl: string }> => {
    const response = await apiClient.post('/billing/checkout', { priceId });
    return response.data;
  },

  createPortalSession: async (): Promise<{ portalUrl: string }> => {
    const response = await apiClient.post('/billing/portal');
    return response.data;
  },

  cancelSubscription: async (): Promise<Subscription> => {
    const response = await apiClient.post('/billing/cancel');
    return response.data;
  },

  resumeSubscription: async (): Promise<Subscription> => {
    const response = await apiClient.post('/billing/resume');
    return response.data;
  },

  getInvoices: async (): Promise<Invoice[]> => {
    const response = await apiClient.get('/billing/invoices');
    return response.data;
  },

  getUsage: async (): Promise<UsageStats> => {
    const response = await apiClient.get('/billing/usage');
    return response.data;
  },
};

// ========================================
// ANALYTICS API
// ========================================

export interface AnalyticsData {
  period: string;
  metrics: {
    pageViews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    latency: number;
  }[];
}

export interface UserActivity {
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface UsageMetrics {
  apiCalls: { total: number; byEndpoint: Record<string, number> };
  storage: { total: number; byType: Record<string, number> };
  bandwidth: { total: number; byDay: Record<string, number> };
}

export const analyticsApi = {
  getOverview: async (startDate: string, endDate: string): Promise<AnalyticsData[]> => {
    const response = await apiClient.get('/analytics/overview', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getPortalAnalytics: async (
    portalId: string,
    startDate: string,
    endDate: string
  ): Promise<AnalyticsData[]> => {
    const response = await apiClient.get(`/analytics/portal/${portalId}`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getSystemHealth: async (): Promise<SystemHealth> => {
    const response = await apiClient.get('/analytics/health');
    return response.data;
  },

  getUserActivity: async (params?: {
    userId?: string;
    action?: string;
    limit?: number;
  }): Promise<UserActivity[]> => {
    const response = await apiClient.get('/analytics/activity', { params });
    return response.data;
  },

  getUsageMetrics: async (): Promise<UsageMetrics> => {
    const response = await apiClient.get('/analytics/usage');
    return response.data;
  },

  trackEvent: async (event: {
    name: string;
    properties?: Record<string, unknown>;
  }): Promise<void> => {
    await apiClient.post('/analytics/track', event);
  },
};

// ========================================
// SECURITY API
// ========================================

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  method: 'totp' | 'email' | null;
  lastVerified?: string;
}

export interface Session {
  id: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
  };
  ipAddress: string;
  location?: string;
  isCurrent: boolean;
  lastActive: string;
  createdAt: string;
}

export interface SSOProvider {
  id: string;
  name: string;
  type: 'oidc' | 'saml' | 'oauth2';
  enabled: boolean;
  config: {
    clientId?: string;
    issuer?: string;
    authorizationUrl?: string;
  };
}

export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
  sessionPolicy: {
    maxSessions: number;
    sessionTimeout: number;
    requireReauth: boolean;
  };
  ipWhitelist: string[];
}

export const securityApi = {
  // Two-Factor Authentication
  get2FAStatus: async (): Promise<TwoFactorStatus> => {
    const response = await apiClient.get('/security/2fa/status');
    return response.data;
  },

  setup2FA: async (method: 'totp' | 'email'): Promise<TwoFactorSetup> => {
    const response = await apiClient.post('/security/2fa/setup', { method });
    return response.data;
  },

  verify2FA: async (code: string): Promise<{ verified: boolean }> => {
    const response = await apiClient.post('/security/2fa/verify', { code });
    return response.data;
  },

  disable2FA: async (code: string): Promise<{ disabled: boolean }> => {
    const response = await apiClient.post('/security/2fa/disable', { code });
    return response.data;
  },

  regenerateBackupCodes: async (): Promise<{ backupCodes: string[] }> => {
    const response = await apiClient.post('/security/2fa/backup-codes');
    return response.data;
  },

  // Sessions
  getSessions: async (): Promise<Session[]> => {
    const response = await apiClient.get('/security/sessions');
    return response.data;
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/security/sessions/${sessionId}`);
  },

  revokeAllSessions: async (): Promise<void> => {
    await apiClient.delete('/security/sessions');
  },

  // SSO
  getSSOProviders: async (): Promise<SSOProvider[]> => {
    const response = await apiClient.get('/security/sso/providers');
    return response.data;
  },

  configureSSOProvider: async (
    providerId: string,
    config: Partial<SSOProvider['config']>
  ): Promise<SSOProvider> => {
    const response = await apiClient.patch(`/security/sso/providers/${providerId}`, config);
    return response.data;
  },

  initiateSSOLogin: async (providerId: string): Promise<{ redirectUrl: string }> => {
    const response = await apiClient.post(`/security/sso/login/${providerId}`);
    return response.data;
  },

  // Security Settings
  getSecuritySettings: async (): Promise<SecuritySettings> => {
    const response = await apiClient.get('/security/settings');
    return response.data;
  },

  updateSecuritySettings: async (
    settings: Partial<SecuritySettings>
  ): Promise<SecuritySettings> => {
    const response = await apiClient.patch('/security/settings', settings);
    return response.data;
  },
};

// ========================================
// ENHANCED INTEGRATIONS API
// ========================================

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee?: string;
}

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  listId: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  labels: string[];
}

export interface HubSpotContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

export interface HubSpotDeal {
  id: string;
  dealName: string;
  amount: number;
  stage: string;
  closeDate?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export const integrationsApi = {
  // Jira
  jira: {
    getProjects: async (integrationId: string): Promise<JiraProject[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/jira/projects`);
      return response.data;
    },
    getIssues: async (integrationId: string, projectKey: string): Promise<JiraIssue[]> => {
      const response = await apiClient.get(
        `/integrations/${integrationId}/jira/projects/${projectKey}/issues`
      );
      return response.data;
    },
    createIssue: async (
      integrationId: string,
      projectKey: string,
      data: { summary: string; description?: string; issueType: string }
    ): Promise<JiraIssue> => {
      const response = await apiClient.post(
        `/integrations/${integrationId}/jira/projects/${projectKey}/issues`,
        data
      );
      return response.data;
    },
  },

  // Trello
  trello: {
    getBoards: async (integrationId: string): Promise<TrelloBoard[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/trello/boards`);
      return response.data;
    },
    getCards: async (integrationId: string, boardId: string): Promise<TrelloCard[]> => {
      const response = await apiClient.get(
        `/integrations/${integrationId}/trello/boards/${boardId}/cards`
      );
      return response.data;
    },
    createCard: async (
      integrationId: string,
      listId: string,
      data: { name: string; desc?: string }
    ): Promise<TrelloCard> => {
      const response = await apiClient.post(
        `/integrations/${integrationId}/trello/lists/${listId}/cards`,
        data
      );
      return response.data;
    },
  },

  // GitHub
  github: {
    getRepos: async (integrationId: string): Promise<GitHubRepo[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/github/repos`);
      return response.data;
    },
    getIssues: async (integrationId: string, owner: string, repo: string): Promise<GitHubIssue[]> => {
      const response = await apiClient.get(
        `/integrations/${integrationId}/github/repos/${owner}/${repo}/issues`
      );
      return response.data;
    },
    createIssue: async (
      integrationId: string,
      owner: string,
      repo: string,
      data: { title: string; body?: string; labels?: string[] }
    ): Promise<GitHubIssue> => {
      const response = await apiClient.post(
        `/integrations/${integrationId}/github/repos/${owner}/${repo}/issues`,
        data
      );
      return response.data;
    },
  },

  // HubSpot
  hubspot: {
    getContacts: async (integrationId: string): Promise<HubSpotContact[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/hubspot/contacts`);
      return response.data;
    },
    getDeals: async (integrationId: string): Promise<HubSpotDeal[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/hubspot/deals`);
      return response.data;
    },
    createContact: async (
      integrationId: string,
      data: Partial<HubSpotContact>
    ): Promise<HubSpotContact> => {
      const response = await apiClient.post(
        `/integrations/${integrationId}/hubspot/contacts`,
        data
      );
      return response.data;
    },
  },

  // Slack
  slack: {
    getChannels: async (integrationId: string): Promise<SlackChannel[]> => {
      const response = await apiClient.get(`/integrations/${integrationId}/slack/channels`);
      return response.data;
    },
    sendMessage: async (
      integrationId: string,
      channelId: string,
      message: string
    ): Promise<{ sent: boolean }> => {
      const response = await apiClient.post(`/integrations/${integrationId}/slack/message`, {
        channelId,
        message,
      });
      return response.data;
    },
  },
};

// ========================================
// BULK OPERATIONS API
// ========================================

export interface BulkOperationResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: {
    id: string;
    success: boolean;
    error?: string;
  }[];
}

export interface BulkUpdateWidgetsDto {
  widgetIds: string[];
  updates: {
    refreshInterval?: number;
    isActive?: boolean;
    settings?: Record<string, unknown>;
  };
}

export interface BulkClonePortalsDto {
  portalIds: string[];
  options?: {
    includeWidgets?: boolean;
    includeSettings?: boolean;
    nameSuffix?: string;
  };
}

export interface BulkCreateAlertsDto {
  alerts: {
    name: string;
    portalId?: string;
    widgetId?: string;
    condition: {
      metric: string;
      operator: string;
      threshold: number;
    };
    channels: string[];
  }[];
}

export interface BulkImportResult {
  success: boolean;
  imported: number;
  errors: { row: number; error: string }[];
}

export const bulkOperationsApi = {
  /**
   * Bulk update widgets
   */
  updateWidgets: async (data: BulkUpdateWidgetsDto): Promise<BulkOperationResult> => {
    const response = await apiClient.post('/bulk/widgets/update', data);
    return response.data;
  },

  /**
   * Bulk delete widgets
   */
  deleteWidgets: async (widgetIds: string[]): Promise<BulkOperationResult> => {
    const response = await apiClient.post('/bulk/widgets/delete', { widgetIds });
    return response.data;
  },

  /**
   * Bulk clone portals
   */
  clonePortals: async (data: BulkClonePortalsDto): Promise<BulkOperationResult & { clonedPortals?: { originalId: string; clonedId: string }[] }> => {
    const response = await apiClient.post('/bulk/portals/clone', data);
    return response.data;
  },

  /**
   * Bulk delete portals
   */
  deletePortals: async (portalIds: string[]): Promise<BulkOperationResult> => {
    const response = await apiClient.post('/bulk/portals/delete', { portalIds });
    return response.data;
  },

  /**
   * Bulk create alerts
   */
  createAlerts: async (data: BulkCreateAlertsDto): Promise<BulkOperationResult> => {
    const response = await apiClient.post('/bulk/alerts/create', data);
    return response.data;
  },

  /**
   * Bulk delete alerts
   */
  deleteAlerts: async (alertIds: string[]): Promise<BulkOperationResult> => {
    const response = await apiClient.post('/bulk/alerts/delete', { alertIds });
    return response.data;
  },

  /**
   * Import data from CSV
   */
  importFromCSV: async (file: File, type: 'portals' | 'widgets' | 'alerts'): Promise<BulkImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const response = await apiClient.post('/bulk/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Export data to CSV
   */
  exportToCSV: async (type: 'portals' | 'widgets' | 'alerts', ids?: string[]): Promise<Blob> => {
    const response = await apiClient.post(
      '/bulk/export/csv',
      { type, ids },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// ========================================
// ADVANCED SEARCH API
// ========================================

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: unknown;
}

export interface SearchResult {
  type: 'portal' | 'widget' | 'alert' | 'integration' | 'report' | 'comment';
  id: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  score: number;
  highlights?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    type: Record<string, number>;
    dateRange: { min: string; max: string };
  };
  suggestions?: string[];
}

export interface SearchPreset {
  id: string;
  name: string;
  filters: SearchFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isDefault: boolean;
  createdAt: string;
}

export const advancedSearchApi = {
  /**
   * Global search across all entities
   */
  globalSearch: async (params: {
    query: string;
    types?: string[];
    filters?: SearchFilter[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<GlobalSearchResponse> => {
    const response = await apiClient.post('/search/global', params);
    return response.data;
  },

  /**
   * Get search suggestions/autocomplete
   */
  getSuggestions: async (query: string, types?: string[]): Promise<string[]> => {
    const response = await apiClient.get('/search/suggestions', {
      params: { query, types: types?.join(',') },
    });
    return response.data;
  },

  /**
   * Get saved search presets
   */
  getPresets: async (): Promise<SearchPreset[]> => {
    const response = await apiClient.get('/search/presets');
    return response.data;
  },

  /**
   * Save search preset
   */
  savePreset: async (data: {
    name: string;
    filters: SearchFilter[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isDefault?: boolean;
  }): Promise<SearchPreset> => {
    const response = await apiClient.post('/search/presets', data);
    return response.data;
  },

  /**
   * Delete search preset
   */
  deletePreset: async (presetId: string): Promise<void> => {
    await apiClient.delete(`/search/presets/${presetId}`);
  },

  /**
   * Get recent searches
   */
  getRecentSearches: async (): Promise<{ query: string; timestamp: string }[]> => {
    const response = await apiClient.get('/search/recent');
    return response.data;
  },
};

// ========================================
// WIDGET CUSTOMIZATION API
// ========================================

export interface WidgetStyling {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  margin?: { top: number; right: number; bottom: number; left: number };
  shadow?: {
    enabled: boolean;
    color?: string;
    blur?: number;
    spread?: number;
    x?: number;
    y?: number;
  };
  font?: {
    family?: string;
    size?: number;
    weight?: number;
    lineHeight?: number;
  };
  customCSS?: string;
}

export interface ConditionalFormat {
  id: string;
  field: string;
  conditions: {
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between';
    value: unknown;
    style: Partial<WidgetStyling>;
    icon?: string;
    label?: string;
  }[];
  priority: number;
}

export interface DataTransformation {
  id: string;
  type: 'filter' | 'sort' | 'aggregate' | 'calculate' | 'format';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface WidgetTheme {
  id: string;
  name: string;
  description?: string;
  styling: WidgetStyling;
  conditionalFormats?: ConditionalFormat[];
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
}

export const widgetCustomizationApi = {
  /**
   * Get widget styling
   */
  getStyling: async (widgetId: string): Promise<WidgetStyling> => {
    const response = await apiClient.get(`/widgets/${widgetId}/styling`);
    return response.data;
  },

  /**
   * Update widget styling
   */
  updateStyling: async (widgetId: string, styling: Partial<WidgetStyling>): Promise<WidgetStyling> => {
    const response = await apiClient.patch(`/widgets/${widgetId}/styling`, styling);
    return response.data;
  },

  /**
   * Get conditional formats
   */
  getConditionalFormats: async (widgetId: string): Promise<ConditionalFormat[]> => {
    const response = await apiClient.get(`/widgets/${widgetId}/conditional-formats`);
    return response.data;
  },

  /**
   * Add conditional format
   */
  addConditionalFormat: async (widgetId: string, format: Omit<ConditionalFormat, 'id'>): Promise<ConditionalFormat> => {
    const response = await apiClient.post(`/widgets/${widgetId}/conditional-formats`, format);
    return response.data;
  },

  /**
   * Update conditional format
   */
  updateConditionalFormat: async (
    widgetId: string,
    formatId: string,
    format: Partial<ConditionalFormat>
  ): Promise<ConditionalFormat> => {
    const response = await apiClient.patch(`/widgets/${widgetId}/conditional-formats/${formatId}`, format);
    return response.data;
  },

  /**
   * Delete conditional format
   */
  deleteConditionalFormat: async (widgetId: string, formatId: string): Promise<void> => {
    await apiClient.delete(`/widgets/${widgetId}/conditional-formats/${formatId}`);
  },

  /**
   * Get data transformations
   */
  getTransformations: async (widgetId: string): Promise<DataTransformation[]> => {
    const response = await apiClient.get(`/widgets/${widgetId}/transformations`);
    return response.data;
  },

  /**
   * Update data transformations
   */
  updateTransformations: async (widgetId: string, transformations: DataTransformation[]): Promise<DataTransformation[]> => {
    const response = await apiClient.put(`/widgets/${widgetId}/transformations`, { transformations });
    return response.data;
  },

  /**
   * Preview widget with styling
   */
  preview: async (widgetId: string, styling: Partial<WidgetStyling>): Promise<{ html: string; css: string }> => {
    const response = await apiClient.post(`/widgets/${widgetId}/preview`, { styling });
    return response.data;
  },

  /**
   * Get available themes
   */
  getThemes: async (): Promise<WidgetTheme[]> => {
    const response = await apiClient.get('/widgets/themes');
    return response.data;
  },

  /**
   * Apply theme to widget
   */
  applyTheme: async (widgetId: string, themeId: string): Promise<WidgetStyling> => {
    const response = await apiClient.post(`/widgets/${widgetId}/apply-theme`, { themeId });
    return response.data;
  },

  /**
   * Save widget styling as theme
   */
  saveAsTheme: async (widgetId: string, data: { name: string; description?: string; isPublic?: boolean }): Promise<WidgetTheme> => {
    const response = await apiClient.post(`/widgets/${widgetId}/save-theme`, data);
    return response.data;
  },
};

// ========================================
// ADMIN ANALYTICS API
// ========================================

export interface SystemMetrics {
  users: {
    total: number;
    activeThisMonth: number;
    newThisMonth: number;
    byPlan: Record<string, number>;
  };
  workspaces: {
    total: number;
    activeThisMonth: number;
    newThisMonth: number;
  };
  portals: {
    total: number;
    public: number;
    private: number;
    totalViews: number;
  };
  widgets: {
    total: number;
    byType: Record<string, number>;
  };
  integrations: {
    total: number;
    active: number;
    byProvider: Record<string, number>;
  };
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  averageRevenuePerUser: number;
  byPlan: {
    plan: string;
    count: number;
    revenue: number;
  }[];
  growth: {
    period: string;
    mrr: number;
    subscribers: number;
  }[];
}

export interface AdminSystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  database: {
    status: string;
    responseTime: number;
    connectionCount: number;
  };
  cache: {
    status: string;
    hitRate: number;
    memoryUsage: number;
  };
  jobs: {
    pending: number;
    failed: number;
    completed: number;
    failureRate: number;
  };
  integrations: {
    healthy: number;
    failing: number;
    failingProviders: string[];
  };
  alerts: {
    criticalCount: number;
    unresolvedCount: number;
  };
}

export interface UserActivityMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  sessionStats: {
    avgSessionDuration: number;
    avgSessionsPerUser: number;
    bounceRate: number;
  };
  topFeatures: {
    feature: string;
    usageCount: number;
    uniqueUsers: number;
  }[];
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

export interface AdminActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userEmail: string;
  workspaceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
  type: string;
}

export interface WorkspaceComparison {
  workspaceId: string;
  name: string;
  plan: string;
  status: string;
  portals: number;
  members: number;
  integrations: number;
  insights: number;
  totalActivity: number;
  createdAt: string;
}

export const adminAnalyticsApi = {
  /**
   * Get system-wide metrics (admin only)
   */
  getSystemMetrics: async (): Promise<SystemMetrics> => {
    const response = await apiClient.get('/admin/analytics/system');
    return response.data;
  },

  /**
   * Get revenue metrics (admin only)
   */
  getRevenueMetrics: async (): Promise<RevenueMetrics> => {
    const response = await apiClient.get('/admin/analytics/revenue');
    return response.data;
  },

  /**
   * Get system health status (admin only)
   */
  getSystemHealth: async (): Promise<AdminSystemHealth> => {
    const response = await apiClient.get('/admin/analytics/health');
    return response.data;
  },

  /**
   * Get user activity metrics (admin only)
   */
  getUserActivityMetrics: async (): Promise<UserActivityMetrics> => {
    const response = await apiClient.get('/admin/analytics/user-activity');
    return response.data;
  },

  /**
   * Get admin activity feed (admin only)
   */
  getActivityFeed: async (limit?: number): Promise<AdminActivityItem[]> => {
    const response = await apiClient.get('/admin/analytics/activity', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get workspace comparison (admin only)
   */
  getWorkspaceComparison: async (workspaceIds?: string[]): Promise<WorkspaceComparison[]> => {
    const response = await apiClient.get('/admin/analytics/workspaces', {
      params: { workspaceIds: workspaceIds?.join(',') },
    });
    return response.data;
  },

  /**
   * Export analytics data (admin only)
   */
  exportData: async (params: {
    type: 'users' | 'revenue' | 'activity' | 'workspaces';
    format: 'json' | 'csv';
    startDate?: string;
    endDate?: string;
  }): Promise<Blob | unknown> => {
    const response = await apiClient.get('/admin/analytics/export', {
      params,
      responseType: params.format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  },
};

// ========================================
// SHARE LINK ANALYTICS API (EXTENDED)
// ========================================

export interface ShareLinkAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  viewsByDate: { date: string; views: number }[];
  viewsByCountry: { country: string; views: number }[];
  viewsByDevice: { device: string; views: number }[];
  averageViewDuration: number;
  downloadCount: number;
}

export const shareLinkAnalyticsApi = {
  /**
   * Get share link analytics
   */
  getAnalytics: async (shareLinkId: string): Promise<ShareLinkAnalytics> => {
    const response = await apiClient.get(`/share-links/${shareLinkId}/analytics`);
    return response.data;
  },

  /**
   * Get QR code for share link
   */
  getQRCode: async (shareLinkId: string, options?: { size?: number; format?: 'png' | 'svg' }): Promise<Blob> => {
    const response = await apiClient.get(`/share-links/${shareLinkId}/qr-code`, {
      params: options,
      responseType: 'blob',
    });
    return response.data;
  },
};
