'use client';

import { apiClient } from './client';

export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'json';

export interface ExportOptions {
  includeMetadata?: boolean;
  dateRange?: { start: string; end: string };
  widgets?: string[];
}

export const exportsApi = {
  exportPortalToPdf: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/exports/portal/${portalId}/pdf`, {
      responseType: 'blob',
    });
    return response;
  },

  exportPortalToCsv: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/exports/portal/${portalId}/csv`, {
      responseType: 'blob',
    });
    return response;
  },

  exportPortalToExcel: async (portalId: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/exports/portal/${portalId}/excel`, {
      responseType: 'blob',
    });
    return response;
  },

  exportWidget: async (widgetId: string, format: ExportFormat): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/exports/widget/${widgetId}/${format}`, {
      responseType: 'blob',
    });
    return response;
  },

  downloadBlob: (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

