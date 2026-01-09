/**
 * Workspaces API Client
 */
import { apiClient } from './client';

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
    return apiClient.get<Workspace>('/workspaces/me');
  }

  async getWorkspace(id: string): Promise<Workspace> {
    return apiClient.get<Workspace>(`/workspaces/${id}`);
  }

  async updateWorkspace(id: string, data: UpdateWorkspaceDto): Promise<Workspace> {
    return apiClient.patch<Workspace>(`/workspaces/${id}`, data);
  }

  async uploadLogo(id: string, file: File): Promise<Workspace> {
    const formData = new FormData();
    formData.append('logo', file);
    return apiClient.upload<Workspace>(`/workspaces/${id}/logo`, formData);
  }

  async deleteLogo(id: string): Promise<Workspace> {
    return apiClient.delete<Workspace>(`/workspaces/${id}/logo`);
  }

  // Members
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  }

  async updateMemberRole(workspaceId: string, memberId: string, role: string): Promise<WorkspaceMember> {
    return apiClient.patch<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, { role });
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    return apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  }

  // Invitations
  async inviteMember(workspaceId: string, data: InviteMemberDto): Promise<WorkspaceInvite> {
    return apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invite`, data);
  }

  async getInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    return apiClient.get<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`);
  }

  async cancelInvite(workspaceId: string, inviteId: string): Promise<void> {
    return apiClient.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
  }

  async resendInvite(workspaceId: string, inviteId: string): Promise<WorkspaceInvite> {
    return apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invites/${inviteId}/resend`, {});
  }

  // Stats
  async getStats(workspaceId: string): Promise<WorkspaceStats> {
    return apiClient.get<WorkspaceStats>(`/workspaces/${workspaceId}/stats`);
  }
}

export const workspacesApi = new WorkspacesApi();

