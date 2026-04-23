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
    return await apiClient.post<Backup>('/backups', data);
  },

  list: async (): Promise<Backup[]> => {
    return await apiClient.get<Backup[]>('/backups');
  },

  restore: async (id: string): Promise<{ success: boolean; backupId: string }> => {
    return await apiClient.post<{ success: boolean; backupId: string }>(`/backups/${id}/restore`);
  },

  restoreToPointInTime: async (timestamp: string): Promise<{ success: boolean; timestamp: string }> => {
    return await apiClient.post<{ success: boolean; timestamp: string }>('/backups/restore/point-in-time', { timestamp });
  },
};

