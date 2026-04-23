import { apiClient } from './client';

export interface Portal {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: string;
  status: 'active' | 'draft';
  widgets: string[];
  users: number;
  views: number;
  createdAt: string;
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
}

export interface PortalResponse {
  data: Portal[];
  total: number;
  page: number;
  pageSize: number;
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

  async deletePortal(id: string): Promise<void> {
    return apiClient.delete<void>(`/portals/${id}`);
  }
}

export const portalsApi = new PortalsApi();