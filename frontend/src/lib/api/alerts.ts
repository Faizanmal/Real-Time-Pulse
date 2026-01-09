'use client';

import { apiClient } from './client';

export interface Alert {
  id: string;
  name: string;
  description?: string;
  type: 'THRESHOLD' | 'ANOMALY' | 'TREND' | 'CUSTOM';
  metric: string;
  condition: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
    value: number;
    duration?: number;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  channels: ('EMAIL' | 'SMS' | 'SLACK' | 'WEBHOOK')[];
  enabled: boolean;
  portalId?: string;
  widgetId?: string;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  triggeredAt: string;
  value: number;
  status: 'TRIGGERED' | 'RESOLVED' | 'ACKNOWLEDGED';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface CreateAlertDto {
  name: string;
  description?: string;
  type: Alert['type'];
  metric: string;
  condition: Alert['condition'];
  severity: Alert['severity'];
  channels: Alert['channels'];
  enabled?: boolean;
  portalId?: string;
  widgetId?: string;
}

export type UpdateAlertDto = Partial<CreateAlertDto>;

export const alertsApi = {
  getAll: async (): Promise<Alert[]> => {
    const response = await apiClient.get<Alert[]>('/alerts');
    return response;
  },

  getById: async (id: string): Promise<Alert> => {
    const response = await apiClient.get<Alert>(`/alerts/${id}`);
    return response;
  },

  create: async (data: CreateAlertDto): Promise<Alert> => {
    const response = await apiClient.post<Alert>('/alerts', data);
    return response;
  },

  update: async (id: string, data: UpdateAlertDto): Promise<Alert> => {
    const response = await apiClient.patch<Alert>(`/alerts/${id}`, data);
    return response;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/alerts/${id}`);
  },

  getHistory: async (id: string): Promise<AlertHistory[]> => {
    const response = await apiClient.get<AlertHistory[]>(`/alerts/${id}/history`);
    return response;
  },

  test: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`/alerts/${id}/test`);
    return response;
  },
};

