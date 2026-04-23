'use client';

import { apiClient } from './client';

export interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'ACCESS';
  entity: string;
  entityId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}

export interface AuditLogFilters {
  limit?: number;
  offset?: number;
  action?: AuditLog['action'];
  entity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export const auditApi = {
  getLogs: async (filters?: AuditLogFilters): Promise<AuditLogResponse> => {
    return await apiClient.get<AuditLogResponse>('/audit', { params: filters as Record<string, string> });
  },

  getEntityLogs: async (entity: string, entityId: string): Promise<AuditLog[]> => {
    return await apiClient.get<AuditLog[]>('/audit/entity', {
      params: { entity, entityId },
    });
  },
};

