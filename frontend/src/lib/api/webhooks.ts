'use client';

import { apiClient } from './client';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  active: boolean;
  headers?: Record<string, string>;
  retryCount: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: 'success' | 'failed';
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  statusCode?: number;
  response?: string;
  responseTime?: number;
  error?: string;
  attempts: number;
  attempt: number;
  deliveredAt?: string;
  createdAt: string;
}

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  secret?: string;
  enabled?: boolean;
  active?: boolean;
  retryCount?: number;
  timeoutMs?: number;
}

export type UpdateWebhookDto = Partial<CreateWebhookDto>;

export const webhooksApi = {
  create: async (data: CreateWebhookDto): Promise<Webhook> => {
    const response = await apiClient.post('/webhooks', data);
    return response as Webhook;
  },

  getAll: async (): Promise<Webhook[]> => {
    const response = await apiClient.get<Webhook[]>('/webhooks');
    return response as Webhook[];
  },

  getById: async (id: string): Promise<Webhook> => {
    const response = await apiClient.get<Webhook>(`/webhooks/${id}`);
    return response as Webhook;
  },

  update: async (id: string, data: UpdateWebhookDto): Promise<Webhook> => {
    const response = await apiClient.patch(`/webhooks/${id}`, data);
    return response as Webhook;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/webhooks/${id}`);
  },

  getDeliveries: async (id: string): Promise<WebhookDelivery[]> => {
    const response = await apiClient.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`);
    return response;
  },

  test: async (id: string): Promise<{ success: boolean; statusCode?: number; error?: string }> => {
    const response = await apiClient.post(`/webhooks/${id}/test`);
    return response as { success: boolean; statusCode?: number; error?: string };
  },

  regenerateSecret: async (id: string): Promise<{ secret: string }> => {
    const response = await apiClient.post(`/webhooks/${id}/regenerate-secret`);
    return response as { secret: string };
  },
};

// Available webhook events
export const WEBHOOK_EVENTS = [
  'portal.created',
  'portal.updated',
  'portal.deleted',
  'widget.created',
  'widget.updated',
  'widget.deleted',
  'data.synced',
  'alert.triggered',
  'user.invited',
  'user.removed',
  'integration.connected',
  'integration.disconnected',
  'export.completed',
  'report.generated',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

