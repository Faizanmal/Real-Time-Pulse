'use client';

import { apiClient } from './client';

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  portalId?: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
  };
  format: 'pdf' | 'csv' | 'excel';
  recipients: string[];
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRun {
  id: string;
  reportId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  downloadUrl?: string;
  recipientsSent: number;
}

export interface CreateScheduledReportDto {
  name: string;
  description?: string;
  portalId?: string;
  schedule: ScheduledReport['schedule'];
  format: ScheduledReport['format'];
  recipients: string[];
  enabled?: boolean;
}

export type UpdateScheduledReportDto = Partial<CreateScheduledReportDto>;

export const scheduledReportsApi = {
  create: async (data: CreateScheduledReportDto): Promise<ScheduledReport> => {
    const response = await apiClient.post('/scheduled-reports', data);
    return response as ScheduledReport;
  },

  getAll: async (): Promise<ScheduledReport[]> => {
    const response = await apiClient.get<ScheduledReport[]>('/scheduled-reports');
    return response as ScheduledReport[];
  },

  getById: async (id: string): Promise<ScheduledReport> => {
    const response = await apiClient.get<ScheduledReport>(`/scheduled-reports/${id}`);
    return response as ScheduledReport;
  },

  update: async (id: string, data: UpdateScheduledReportDto): Promise<ScheduledReport> => {
    const response = await apiClient.patch(`/scheduled-reports/${id}`, data);
    return response as ScheduledReport;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scheduled-reports/${id}`);
  },

  runNow: async (id: string): Promise<ReportRun> => {
    const response = await apiClient.post(`/scheduled-reports/${id}/run`);
    return response as ReportRun;
  },

  sendNow: async (id: string): Promise<{ message: string; downloadUrl?: string; }> => {
    const response = await apiClient.post(`/scheduled-reports/${id}/send`);
    return response as { message: string; downloadUrl?: string };
  },

  getHistory: async (id: string, limit?: number): Promise<ReportRun[]> => {
    const response = await apiClient.get<ReportRun[]>(`/scheduled-reports/${id}/history`, {
      params: { limit },
    });
    return response as ReportRun[];
  },
};

