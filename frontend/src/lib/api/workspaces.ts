/**
 * Workspaces API Client
 */
import { apiClient } from '../api';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  settings: WorkspaceSettings;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  timezone?: string;
  dateFormat?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  features?: Record<string, boolean>;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  joinedAt: string;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceStats {
  totalMembers: number;
  totalPortals: number;
  totalWidgets: number;
  storageUsed: number;
  apiCalls: number;
}

export interface UpdateWorkspaceDto {
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface InviteMemberDto {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

class WorkspacesApi {
  // Workspace operations
  async getMyWorkspace(): Promise<Workspace> {
    const response = await apiClient.get<Workspace>('/workspaces/me');
    return response.data;
  }

  async getWorkspace(id: string): Promise<Workspace> {
    const response = await apiClient.get<Workspace>(`/workspaces/${id}`);
    return response.data;
  }

  async updateWorkspace(id: string, data: UpdateWorkspaceDto): Promise<Workspace> {
    const response = await apiClient.patch<Workspace>(`/workspaces/${id}`, data);
    return response.data;
  }

  async uploadLogo(id: string, file: File): Promise<Workspace> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await apiClient.post<Workspace>(`/workspaces/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteLogo(id: string): Promise<Workspace> {
    const response = await apiClient.delete<Workspace>(`/workspaces/${id}/logo`);
    return response.data;
  }

  // Members
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const response = await apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
    return response.data;
  }

  async updateMemberRole(workspaceId: string, memberId: string, role: string): Promise<WorkspaceMember> {
    const response = await apiClient.patch<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, { role });
    return response.data;
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  }

  // Invitations
  async inviteMember(workspaceId: string, data: InviteMemberDto): Promise<WorkspaceInvite> {
    const response = await apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invite`, data);
    return response.data;
  }

  async getInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    const response = await apiClient.get<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`);
    return response.data;
  }

  async cancelInvite(workspaceId: string, inviteId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
  }

  async resendInvite(workspaceId: string, inviteId: string): Promise<WorkspaceInvite> {
    const response = await apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invites/${inviteId}/resend`, {});
    return response.data;
  }

  // Stats
  async getStats(workspaceId: string): Promise<WorkspaceStats> {
    const response = await apiClient.get<WorkspaceStats>(`/workspaces/${workspaceId}/stats`);
    return response.data;
  }
}

export const workspacesApi = new WorkspacesApi();

