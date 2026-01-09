'use client';

import { apiClient } from './client';

export interface Backup {
  id: string;
  type: 'full' | 'incremental';
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  size?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  name?: string;
  downloadUrl?: string;
}

export const backupApi = {
  create: async (data: { type?: 'full' | 'incremental'; description?: string; name?: string }): Promise<Backup> => {
    const response = await apiClient.post<Backup>('/backups', data);
    return response;
  },

  list: async (): Promise<Backup[]> => {
    const response = await apiClient.get<Backup[]>('/backups');
    return response;
  },

  restore: async (id: string): Promise<{ success: boolean; backupId: string }> => {
    const response = await apiClient.post<{ success: boolean; backupId: string }>(`/backups/${id}/restore`);
    return response;
  },

  restoreToPointInTime: async (timestamp: string): Promise<{ success: boolean; timestamp: string }> => {
    const response = await apiClient.post<{ success: boolean; timestamp: string }>('/backups/restore/point-in-time', { timestamp });
    return response;
  },
};

