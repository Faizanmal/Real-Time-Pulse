'use client';

import { apiClient } from './client';

export interface GdprConsent {
  id: string;
  userId: string;
  type: 'marketing' | 'analytics' | 'functional' | 'necessary';
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  version: string;
  purpose?: string;
  description?: string;
  updatedAt?: string;
  required?: boolean;
}

export interface GdprDataRequest {
  id: string;
  userId: string;
  type: 'access' | 'erasure' | 'portability' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  completedAt?: string;
  notes?: string;
  downloadUrl?: string;
  email?: string;
}

export interface GdprComplianceReport {
  id: string;
  workspaceId: string;
  generatedAt: string;
  period: { start: string; end: string };
  summary: {
    totalConsents: number;
    activeConsents: number;
    revokedConsents: number;
    dataRequests: number;
    completedRequests: number;
    avgResponseTime: number;
  };
  issues?: string[];
  score?: number;
  downloadUrl?: string;
}

export interface GdprDashboard {
  consentStats: {
    total: number;
    byType: Record<string, number>;
    recentChanges: number;
  };
  requestStats: {
    pending: number;
    processing: number;
    completed: number;
    avgResponseDays: number;
  };
  complianceScore: number;
  recommendations: string[];
}

export const gdprApi = {
  // Consents
  recordConsent: async (data: {
    type: GdprConsent['type'];
    granted: boolean;
    version: string;
  }): Promise<GdprConsent> => {
    const response = await apiClient.post<GdprConsent>('/gdpr/consents', data);
    return response as GdprConsent;
  },

  revokeConsent: async (consentId: string, reason?: string): Promise<GdprConsent> => {
    const response = await apiClient.patch<GdprConsent>(`/gdpr/consents/${consentId}/revoke`, { reason });
    return response as GdprConsent;
  },

  getConsents: async (
    workspaceId = 'current',
    options?: { type?: string; status?: string; limit?: number }
  ): Promise<GdprConsent[]> => {
    const response = await apiClient.get<GdprConsent[]>(`/gdpr/consents/workspace/${workspaceId}`, { params: options });
    return response as GdprConsent[];
  },

  getConsentDetails: async (consentId: string): Promise<GdprConsent> => {
    const response = await apiClient.get<GdprConsent>(`/gdpr/consents/${consentId}`);
    return response as GdprConsent;
  },

  getConsentStats: async (workspaceId: string): Promise<GdprDashboard['consentStats']> => {
    const response = await apiClient.get<GdprDashboard['consentStats']>(`/gdpr/consents/workspace/${workspaceId}/stats`);
    return response as GdprDashboard['consentStats'];
  },

  // Data Requests
  createDataRequest: async (data: {
    type: GdprDataRequest['type'];
    notes?: string;
  }): Promise<GdprDataRequest> => {
    const response = await apiClient.post<GdprDataRequest>('/gdpr/requests', data);
    return response as GdprDataRequest;
  },

  getDataRequests: async (
    workspaceId = 'current',
    options?: { type?: string; status?: string; limit?: number }
  ): Promise<GdprDataRequest[]> => {
    const response = await apiClient.get<GdprDataRequest[]>(`/gdpr/requests/workspace/${workspaceId}`, { params: options });
    return response as GdprDataRequest[];
  },

  getDataRequestDetails: async (requestId: string): Promise<GdprDataRequest> => {
    const response = await apiClient.get<GdprDataRequest>(`/gdpr/requests/${requestId}`);
    return response as GdprDataRequest;
  },

  updateRequestStatus: async (
    requestId: string,
    data: { status: GdprDataRequest['status']; notes?: string }
  ): Promise<GdprDataRequest> => {
    const response = await apiClient.patch(`/gdpr/requests/${requestId}`, data);
    return response as GdprDataRequest;
  },

  processAccessRequest: async (requestId: string, data: { format?: string }): Promise<GdprDataRequest> => {
    const response = await apiClient.post(`/gdpr/requests/${requestId}/process-access`, data);
    return response as GdprDataRequest;
  },

  processErasureRequest: async (requestId: string, data: { confirm: boolean }): Promise<GdprDataRequest> => {
    const response = await apiClient.post(`/gdpr/requests/${requestId}/process-erasure`, data);
    return response as GdprDataRequest;
  },

  getRequestStats: async (workspaceId: string): Promise<GdprDashboard['requestStats']> => {
    const response = await apiClient.get<GdprDashboard['requestStats']>(`/gdpr/requests/workspace/${workspaceId}/stats`);
    return response;
  },

  // Compliance Reports
  generateComplianceReport: async (data: {
    startDate: string;
    endDate: string;
    format?: string;
  }): Promise<GdprComplianceReport> => {
    const response = await apiClient.post('/gdpr/compliance/reports/generate', data);
    return response as GdprComplianceReport;
  },

  getComplianceReports: async (
    workspaceId = 'current',
    limit?: number
  ): Promise<GdprComplianceReport[]> => {
    const response = await apiClient.get<GdprComplianceReport[]>(`/gdpr/compliance/reports/workspace/${workspaceId}`, {
      params: { limit },
    });
    return response as GdprComplianceReport[];
  },

  getComplianceReportDetails: async (reportId: string): Promise<GdprComplianceReport> => {
    const response = await apiClient.get<GdprComplianceReport>(`/gdpr/compliance/reports/${reportId}`);
    return response as GdprComplianceReport;
  },

  getComplianceDashboard: async (workspaceId: string): Promise<GdprDashboard> => {
    const response = await apiClient.get<GdprDashboard>(`/gdpr/compliance/dashboard/${workspaceId}`);
    return response as GdprDashboard;
  },

  submitDataRequest: async (data: { type: GdprDataRequest['type']; email: string; notes?: string }): Promise<GdprDataRequest> => {
    const response = await apiClient.post<GdprDataRequest>('/gdpr/requests', data);
    return response as GdprDataRequest;
  },

  processDataRequest: async (requestId: string): Promise<GdprDataRequest> => {
    const response = await apiClient.post<GdprDataRequest>(`/gdpr/requests/${requestId}/process`);
    return response as GdprDataRequest;
  },

  rejectDataRequest: async (requestId: string): Promise<GdprDataRequest> => {
    const response = await apiClient.patch<GdprDataRequest>(`/gdpr/requests/${requestId}/reject`, {});
    return response as GdprDataRequest;
  },

  updateConsent: async (consentId: string, data: Partial<GdprConsent>): Promise<GdprConsent> => {
    const response = await apiClient.patch<GdprConsent>(`/gdpr/consents/${consentId}`, data);
    return response as GdprConsent;
  },

  exportPersonalData: async (): Promise<Blob> => {
    const response = await apiClient.get<Blob>('/gdpr/export', { responseType: 'blob' });
    return response as Blob;
  },
};

