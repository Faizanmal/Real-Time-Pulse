'use client';

import { apiClient } from './client';

export interface Comment {
  id: string;
  content: string;
  portalId: string;
  widgetId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  user?: { id: string; name: string; avatar?: string; };
}

export interface CreateCommentDto {
  content: string;
  portalId: string;
  widgetId?: string;
  parentId?: string;
}

export interface UpdateCommentDto {
  content?: string;
  resolved?: boolean;
}

export const commentsApi = {
  getByPortal: async (
    portalId: string,
    options?: {
      widgetId?: string;
      includeReplies?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Comment[]> => {
    const response = await apiClient.get<Comment[]>(`/comments/portal/${portalId}`, { params: options });
    return response;
  },

  getById: async (id: string): Promise<Comment> => {
    const response = await apiClient.get<Comment>(`/comments/${id}`);
    return response;
  },

  getThread: async (id: string): Promise<Comment> => {
    const response = await apiClient.get<Comment>(`/comments/${id}/thread`);
    return response;
  },

  create: async (data: CreateCommentDto): Promise<Comment> => {
    const response = await apiClient.post<Comment>('/comments', data);
    return response;
  },

  update: async (id: string, data: UpdateCommentDto): Promise<Comment> => {
    const response = await apiClient.patch<Comment>(`/comments/${id}`, data);
    return response;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/comments/${id}`);
  },

  resolve: async (id: string): Promise<Comment> => {
    return commentsApi.update(id, { resolved: true });
  },

  unresolve: async (id: string): Promise<Comment> => {
    return commentsApi.update(id, { resolved: false });
  },
};

