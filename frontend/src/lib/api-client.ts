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
