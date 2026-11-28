import { apiClient } from './client';

export interface Portal {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shareToken: string;
  isPublic: boolean;
  draftMode: boolean;
  publishedAt: string | null;
  publishRevision: number;
  layout: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  widgetCount?: number;
  clientStatus?: 'ON_TRACK' | 'NEEDS_ATTENTION' | 'BLOCKED' | 'COMPLETED' | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
}

export interface CreatePortalDto {
  name: string;
  slug: string;
  description?: string;
  isPublic?: boolean;
  layout?: Record<string, any>;
}

export interface UpdatePortalDto {
  name?: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
  layout?: Record<string, any>;
  clientStatus?: Portal['clientStatus'];
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
}

export interface PortalResponse {
  portals: Portal[];
  total: number;
}

class PortalsApi {
  async getPortals(page = 1, pageSize = 20): Promise<PortalResponse> {
    return apiClient.get<PortalResponse>(
      `/portals?page=${page}&pageSize=${pageSize}`
    );
  }

  async createPortal(dto: CreatePortalDto): Promise<Portal> {
    return apiClient.post<Portal>('/portals', dto);
  }

  async getPortal(id: string): Promise<Portal> {
    return apiClient.get<Portal>(`/portals/${id}`);
  }

  async updatePortal(id: string, dto: UpdatePortalDto): Promise<Portal> {
    return apiClient.patch<Portal>(`/portals/${id}`, dto);
  }

  async previewDraft(id: string) {
    return apiClient.get<import('@/types').PublicPortalView>(`/portals/${id}/preview`);
  }

  async publishDraft(id: string, expectedUpdatedAt: string): Promise<{ portalId: string; publishedAt: string; publishRevision: number; isPublic: boolean }> {
    return apiClient.post(`/portals/${id}/publish`, { expectedUpdatedAt });
  }

  async unpublish(id: string): Promise<{ portalId: string; isPublic: false }> {
    return apiClient.post(`/portals/${id}/unpublish`, {});
  }

  async deletePortal(id: string): Promise<void> {
    return apiClient.delete<void>(`/portals/${id}`);
  }
}

export const portalsApi = new PortalsApi();
