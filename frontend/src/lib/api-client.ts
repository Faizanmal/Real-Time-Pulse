import { apiClient } from '@/lib/api';
import type {
  AuthResponse,
  User,
  Workspace,
  Portal,
  WorkspaceMember,
  Widget,
  Integration,
  AuditLog,
  WorkspaceStats,
  HealthStatus
} from '@/types';
import { gamificationApi } from './api/gamification';
import { annotationsApi } from './api/annotations';

// Auth API
export const authApi = {
  signup: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    workspaceName: string;
    workspaceSlug: string;
  }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  signin: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/signin', data);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// Workspace API
export const workspaceApi = {
  getMyWorkspace: async (): Promise<Workspace> => {
    const response = await apiClient.get('/workspaces/me');
    return response.data;
  },

  updateWorkspace: async (
    workspaceId: string,
    data: { name?: string; brandColor?: string }
  ): Promise<Workspace> => {
    const response = await apiClient.patch(`/workspaces/${workspaceId}`, data);
    return response.data;
  },

  uploadLogo: async (workspaceId: string, file: File): Promise<Workspace> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/workspaces/${workspaceId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    const response = await apiClient.get(`/workspaces/${workspaceId}/members`);
    return response.data;
  },

  inviteMember: async (
    workspaceId: string,
    data: { email: string; role: string }
  ): Promise<WorkspaceMember> => {
    const response = await apiClient.post(`/workspaces/${workspaceId}/members`, data);
    return response.data;
  },

  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  },

  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    role: string
  ): Promise<WorkspaceMember> => {
    const response = await apiClient.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role });
    return response.data;
  },

  getStats: async (workspaceId: string): Promise<WorkspaceStats> => {
    const response = await apiClient.get(`/workspaces/${workspaceId}/stats`);
    return response.data;
  },

  deleteLogo: async (workspaceId: string): Promise<Workspace> => {
    const response = await apiClient.delete(`/workspaces/${workspaceId}/logo`);
    return response.data;
  },
};

// Portal API
export const portalApi = {
  create: async (data: {
    name: string;
    slug: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Portal> => {
    const response = await apiClient.post('/portals', data);
    return response.data;
  },

  getAll: async (page = 1, pageSize = 20): Promise<{ portals: Portal[]; total: number }> => {
    const response = await apiClient.get('/portals', { params: { page, pageSize } });
    return response.data;
  },

  getOne: async (portalId: string): Promise<Portal> => {
    const response = await apiClient.get(`/portals/${portalId}`);
    return response.data;
  },

  getByShareToken: async (shareToken: string): Promise<Portal> => {
    const response = await apiClient.get(`/portals/share/${shareToken}`);
    return response.data;
  },

  update: async (
    portalId: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      layout?: Record<string, unknown> | null;
    }
  ): Promise<Portal> => {
    const response = await apiClient.patch(`/portals/${portalId}`, data);
    return response.data;
  },

  delete: async (portalId: string): Promise<void> => {
    await apiClient.delete(`/portals/${portalId}`);
  },

  regenerateToken: async (portalId: string): Promise<{ shareToken: string }> => {
    const response = await apiClient.post(`/portals/${portalId}/regenerate-token`);
    return response.data;
  },
};

// Widget API
export const widgetApi = {
  create: async (data: {
    name: string;
    type: string;
    portalId: string;
    integrationId?: string;
    config?: Record<string, unknown>;
    gridWidth?: number;
    gridHeight?: number;
    gridX?: number;
    gridY?: number;
    refreshInterval?: number;
  }): Promise<Widget> => {
    const response = await apiClient.post('/widgets', data);
    return response.data;
  },

  refreshData: async (widgetId: string): Promise<Widget> => {
    const response = await apiClient.post(`/widgets/${widgetId}/refresh`);
    return response.data;
  },

  getAllByPortal: async (portalId: string): Promise<Widget[]> => {
    const response = await apiClient.get(`/widgets/portal/${portalId}`);
    return response.data;
  },

  delete: async (widgetId: string): Promise<void> => {
    await apiClient.delete(`/widgets/${widgetId}`);
  },
};

// Integration API
export const integrationApi = {
  create: async (data: {
    workspaceId: string;
    provider: string;
    name: string;
    settings: Record<string, unknown>;
  }): Promise<Integration> => {
    const response = await apiClient.post('/v1/integrations', data);
    return response.data;
  },

  getAllByWorkspace: async (workspaceId: string): Promise<Integration[]> => {
    const response = await apiClient.get(`/v1/integrations/workspace/${workspaceId}`);
    return response.data;
  },

  getById: async (id: string): Promise<Integration> => {
    const response = await apiClient.get(`/v1/integrations/${id}`);
    return response.data;
  },

  update: async (id: string, settings: Record<string, unknown>): Promise<Integration> => {
    const response = await apiClient.put(`/v1/integrations/${id}`, settings);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/integrations/${id}`);
  },

  testConnection: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.get(`/v1/integrations/${id}/test`);
    return response.data;
  },

  triggerSync: async (
    id: string,
    syncType: 'full' | 'incremental' = 'incremental'
  ): Promise<{ message: string }> => {
    const response = await apiClient.post(`/v1/integrations/${id}/sync`, { syncType });
    return response.data;
  },

  fetchData: async (
    id: string,
    dataType: string,
    params?: Record<string, unknown>
  ): Promise<unknown> => {
    const response = await apiClient.post(`/v1/integrations/${id}/fetch`, { dataType, params });
    return response.data;
  },
};

// Health API
export const healthApi = {
  check: async (): Promise<HealthStatus> => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// Audit API
export const auditApi = {
  getLogs: async (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: AuditLog[]; total: number }> => {
    const response = await apiClient.get('/audit/logs', { params });
    return response.data;
  },
};

// ========================================
// DATA HEALTH MONITORING API
// ========================================

export const dataHealthApi = {
  createMonitor: async (data: {
    workspaceId: string;
    integrationId: string;
    freshnessThreshold?: number;
    alertThreshold?: number;
  }) => {
    const response = await apiClient.post('/data-health', data);
    return response.data;
  },

  getWorkspaceHealth: async (workspaceId: string) => {
    const response = await apiClient.get(`/data-health/workspace/${workspaceId}`);
    return response.data;
  },

  getHealthDetails: async (healthId: string) => {
    const response = await apiClient.get(`/data-health/${healthId}`);
    return response.data;
  },

  triggerCheck: async (healthId: string) => {
    const response = await apiClient.post(`/data-health/${healthId}/check`);
    return response.data;
  },

  getMetrics: async (workspaceId: string, days = 7) => {
    const response = await apiClient.get(`/data-health/workspace/${workspaceId}/metrics`, {
      params: { days },
    });
    return response.data;
  },

  updateSettings: async (healthId: string, settings: Record<string, unknown>) => {
    const response = await apiClient.patch(`/data-health/${healthId}/settings`, settings);
    return response.data;
  },

  acknowledgeSchemaChange: async (healthId: string) => {
    const response = await apiClient.post(`/data-health/${healthId}/acknowledge-schema-change`);
    return response.data;
  },

  getDegradedSources: async (workspaceId: string) => {
    const response = await apiClient.get(`/data-health/workspace/${workspaceId}/degraded`);
    return response.data;
  },
};

// ========================================
// DATA VALIDATION API
// ========================================

export const dataValidationApi = {
  createRule: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/data-validation/rules', data);
    return response.data;
  },

  getRules: async (workspaceId: string, enabled?: boolean) => {
    const response = await apiClient.get(`/data-validation/rules/workspace/${workspaceId}`, {
      params: enabled !== undefined ? { enabled } : {},
    });
    return response.data;
  },

  getRuleById: async (ruleId: string) => {
    const response = await apiClient.get(`/data-validation/rules/${ruleId}`);
    return response.data;
  },

  updateRule: async (ruleId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/data-validation/rules/${ruleId}`, data);
    return response.data;
  },

  deleteRule: async (ruleId: string) => {
    const response = await apiClient.delete(`/data-validation/rules/${ruleId}`);
    return response.data;
  },

  getViolations: async (workspaceId: string, filters?: Record<string, unknown>) => {
    const response = await apiClient.get(`/data-validation/violations/workspace/${workspaceId}`, {
      params: filters,
    });
    return response.data;
  },

  resolveViolation: async (violationId: string, resolvedBy: string, notes?: string) => {
    const response = await apiClient.patch(`/data-validation/violations/${violationId}/resolve`, {
      resolvedBy,
      notes,
    });
    return response.data;
  },

  getStats: async (workspaceId: string, days = 7) => {
    const response = await apiClient.get(`/data-validation/violations/workspace/${workspaceId}/stats`, {
      params: { days },
    });
    return response.data;
  },

  validateOnDemand: async (workspaceId: string, data: unknown, fieldPath: string) => {
    const response = await apiClient.post('/data-validation/validate-on-demand', {
      workspaceId,
      data,
      fieldPath,
    });
    return response.data;
  },
};

// ========================================
// PROFITABILITY ANALYTICS API
// ========================================

export const profitabilityApi = {
  createProject: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/profitability/projects', data);
    return response.data;
  },

  getProjects: async (workspaceId: string, status?: string) => {
    const response = await apiClient.get(`/profitability/projects/workspace/${workspaceId}`, {
      params: status ? { status } : {},
    });
    return response.data;
  },

  getProjectById: async (projectId: string) => {
    const response = await apiClient.get(`/profitability/projects/${projectId}`);
    return response.data;
  },

  updateProject: async (projectId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/profitability/projects/${projectId}`, data);
    return response.data;
  },

  deleteProject: async (projectId: string) => {
    const response = await apiClient.delete(`/profitability/projects/${projectId}`);
    return response.data;
  },

  addTimeEntry: async (projectId: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/profitability/projects/${projectId}/time-entries`, data);
    return response.data;
  },

  updateTimeEntry: async (entryId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/profitability/time-entries/${entryId}`, data);
    return response.data;
  },

  deleteTimeEntry: async (entryId: string) => {
    const response = await apiClient.delete(`/profitability/time-entries/${entryId}`);
    return response.data;
  },

  addExpense: async (projectId: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/profitability/projects/${projectId}/expenses`, data);
    return response.data;
  },

  updateExpense: async (expenseId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/profitability/expenses/${expenseId}`, data);
    return response.data;
  },

  deleteExpense: async (expenseId: string) => {
    const response = await apiClient.delete(`/profitability/expenses/${expenseId}`);
    return response.data;
  },

  calculateProfitability: async (projectId: string) => {
    const response = await apiClient.post(`/profitability/projects/${projectId}/calculate`);
    return response.data;
  },

  getHeatmap: async (workspaceId: string) => {
    const response = await apiClient.get(`/profitability/workspace/${workspaceId}/heatmap`);
    return response.data;
  },

  getClientScoring: async (workspaceId: string) => {
    const response = await apiClient.get(`/profitability/workspace/${workspaceId}/client-scoring`);
    return response.data;
  },

  getResourceUtilization: async (workspaceId: string) => {
    const response = await apiClient.get(`/profitability/workspace/${workspaceId}/resource-utilization`);
    return response.data;
  },

  getSummary: async (workspaceId: string, period?: string) => {
    const response = await apiClient.get(`/profitability/workspace/${workspaceId}/summary`, {
      params: period ? { period } : {},
    });
    return response.data;
  },
};

// ========================================
// ANALYTICS API
// ========================================

export const analyticsApi = {
  getDashboard: async (workspaceId: string, dateRange?: { from: string; to: string }) => {
    const response = await apiClient.get(`/analytics/dashboard/${workspaceId}`, {
      params: dateRange,
    });
    return response.data;
  },

  getPortalAnalytics: async (portalId: string, dateRange?: { from: string; to: string }) => {
    const response = await apiClient.get(`/analytics/portal/${portalId}`, {
      params: dateRange,
    });
    return response.data;
  },

  getWidgetAnalytics: async (widgetId: string, dateRange?: { from: string; to: string }) => {
    const response = await apiClient.get(`/analytics/widget/${widgetId}`, {
      params: dateRange,
    });
    return response.data;
  },

  getMetrics: async (workspaceId: string, metricType: string, period = '7d') => {
    const response = await apiClient.get(`/analytics/metrics/${workspaceId}`, {
      params: { metricType, period },
    });
    return response.data;
  },

  getTrends: async (workspaceId: string, period = '30d') => {
    const response = await apiClient.get(`/analytics/trends/${workspaceId}`, {
      params: { period },
    });
    return response.data;
  },
};

// ========================================
// AI INSIGHTS API
// ========================================

export const aiInsightsApi = {
  getInsights: async (portalId: string) => {
    const response = await apiClient.get(`/ai-insights/portal/${portalId}`);
    return response.data;
  },

  getWorkspaceInsights: async (workspaceId: string) => {
    const response = await apiClient.get(`/ai-insights/workspace/${workspaceId}`);
    return response.data;
  },

  getRecommendations: async (portalId: string) => {
    const response = await apiClient.get(`/ai-insights/recommendations/${portalId}`);
    return response.data;
  },

  getAnomalies: async (workspaceId: string, days = 7) => {
    const response = await apiClient.get(`/ai-insights/anomalies/${workspaceId}`, {
      params: { days },
    });
    return response.data;
  },

  getPredictions: async (portalId: string, metricType: string) => {
    const response = await apiClient.get(`/ai-insights/predictions/${portalId}`, {
      params: { metricType },
    });
    return response.data;
  },

  generateSummary: async (portalId: string) => {
    const response = await apiClient.post(`/ai-insights/summary/${portalId}`);
    return response.data;
  },
};

// ========================================
// CLIENT REPORTING API
// ========================================

export const clientReportApi = {
  createReport: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/client-reports', data);
    return response.data;
  },

  getReports: async (workspaceId: string, filters?: Record<string, unknown>) => {
    const response = await apiClient.get(`/client-reports/workspace/${workspaceId}`, {
      params: filters,
    });
    return response.data;
  },

  getReportById: async (reportId: string) => {
    const response = await apiClient.get(`/client-reports/${reportId}`);
    return response.data;
  },

  updateReport: async (reportId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/client-reports/${reportId}`, data);
    return response.data;
  },

  deleteReport: async (reportId: string) => {
    const response = await apiClient.delete(`/client-reports/${reportId}`);
    return response.data;
  },

  generateReport: async (reportId: string) => {
    const response = await apiClient.post(`/client-reports/${reportId}/generate`);
    return response.data;
  },

  getStats: async (workspaceId: string) => {
    const response = await apiClient.get(`/client-reports/workspace/${workspaceId}/stats`);
    return response.data;
  },
};

// ========================================
// GDPR COMPLIANCE API
// ========================================

export const gdprApi = {
  recordConsent: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/gdpr/consents', data);
    return response.data;
  },

  getConsents: async (workspaceId: string, filters?: Record<string, unknown>) => {
    const response = await apiClient.get(`/gdpr/consents/workspace/${workspaceId}`, {
      params: filters,
    });
    return response.data;
  },

  revokeConsent: async (consentId: string, reason?: string) => {
    const response = await apiClient.patch(`/gdpr/consents/${consentId}/revoke`, { reason });
    return response.data;
  },

  getConsentBySubject: async (workspaceId: string, subjectEmail: string) => {
    const response = await apiClient.get(`/gdpr/consents/workspace/${workspaceId}/subject/${subjectEmail}`);
    return response.data;
  },

  createDataRequest: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/gdpr/data-requests', data);
    return response.data;
  },

  getDataRequests: async (workspaceId: string, filters?: Record<string, unknown>) => {
    const response = await apiClient.get(`/gdpr/data-requests/workspace/${workspaceId}`, {
      params: filters,
    });
    return response.data;
  },

  getDataRequestById: async (requestId: string) => {
    const response = await apiClient.get(`/gdpr/data-requests/${requestId}`);
    return response.data;
  },

  processDataRequest: async (requestId: string, processedBy: string) => {
    const response = await apiClient.post(`/gdpr/data-requests/${requestId}/process`, { processedBy });
    return response.data;
  },

  rejectDataRequest: async (requestId: string, processedBy: string, reason?: string) => {
    const response = await apiClient.post(`/gdpr/data-requests/${requestId}/reject`, {
      processedBy,
      reason,
    });
    return response.data;
  },

  getConsentStats: async (workspaceId: string) => {
    const response = await apiClient.get(`/gdpr/consents/workspace/${workspaceId}/stats`);
    return response.data;
  },

  getRequestStats: async (workspaceId: string) => {
    const response = await apiClient.get(`/gdpr/data-requests/workspace/${workspaceId}/stats`);
    return response.data;
  },

  generateComplianceReport: async (workspaceId: string, reportType: string, generatedBy?: string) => {
    const response = await apiClient.post(`/gdpr/compliance/reports`, {
      workspaceId,
      reportType,
      generatedBy,
    });
    return response.data;
  },

  getComplianceReports: async (workspaceId: string, reportType?: string) => {
    const response = await apiClient.get(`/gdpr/compliance/reports/workspace/${workspaceId}`, {
      params: reportType ? { reportType } : {},
    });
    return response.data;
  },

  getComplianceReportById: async (reportId: string) => {
    const response = await apiClient.get(`/gdpr/compliance/reports/${reportId}`);
    return response.data;
  },

  getDashboard: async (workspaceId: string) => {
    const response = await apiClient.get(`/gdpr/compliance/dashboard/${workspaceId}`);
    return response.data;
  },
};

// ========================================
// BLOCKCHAIN API
// ========================================

export const blockchainApi = {
  createAuditEntry: async (data: {
    entityType: string;
    entityId: string;
    action: string;
    data: Record<string, unknown>;
  }) => {
    const response = await apiClient.post('/blockchain/audit', data);
    return response.data;
  },

  forceCreateBlock: async () => {
    const response = await apiClient.post('/blockchain/block');
    return response.data;
  },

  verifyIntegrity: async () => {
    const response = await apiClient.get('/blockchain/verify');
    return response.data;
  },

  verifyEntry: async (entryId: string) => {
    const response = await apiClient.get(`/blockchain/verify/${entryId}`);
    return response.data;
  },

  getAuditTrail: async (entityType: string, entityId: string) => {
    const response = await apiClient.get(`/blockchain/audit/${entityType}/${entityId}`);
    return response.data;
  },

  generateComplianceReport: async (params?: {
    startDate?: string;
    endDate?: string;
    entityTypes?: string[];
    actions?: string[];
  }) => {
    const response = await apiClient.get('/blockchain/compliance', { params });
    return response.data;
  },

  exportChain: async () => {
    const response = await apiClient.get('/blockchain/export');
    return response.data;
  },
};

// Export all APIs as a single object
export const apiResources = {
  auth: authApi,
  workspaces: workspaceApi,
  portals: portalApi,
  widgets: widgetApi,
  integrations: integrationApi,
  health: healthApi,
  audit: auditApi,
  analytics: analyticsApi,
  aiInsights: aiInsightsApi,
  dataHealth: dataHealthApi,
  dataValidation: dataValidationApi,
  profitability: profitabilityApi,
  clientReport: clientReportApi,
  gdpr: gdprApi,
  gamification: gamificationApi,
  annotations: annotationsApi,
  blockchain: blockchainApi,
};

// Cache clearing function
export const clearCache = () => {
  // Implementation for clearing cache
  if (typeof window !== 'undefined') {
    // Clear local storage cache keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache-')) {
        localStorage.removeItem(key);
      }
    });
  }
};
