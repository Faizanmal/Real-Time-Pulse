'use client';

import { apiClient } from './client';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertChannel = 'email' | 'slack' | 'webhook';
export type AlertOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

export interface AlertCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
}

export interface AlertDelivery {
  id: string;
  channel: AlertChannel;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  attemptCount: number;
  nextAttemptAt?: string | null;
  sentAt?: string | null;
  lastErrorCode?: string | null;
}

export interface AlertHistory {
  id: string;
  eventId?: string | null;
  alertId: string;
  triggeredAt: string;
  triggeredValue: { metric?: string; value?: number };
  source: string;
  severity: AlertSeverity;
  freshnessAt?: string | null;
  reason?: string | null;
  nextAction?: string | null;
  status: 'TRIGGERED' | 'RESOLVED' | 'SUPPRESSED';
  suppressedCount: number;
  deliveries: AlertDelivery[];
}

export interface Alert {
  id: string;
  name: string;
  description?: string | null;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  emailRecipients: string[];
  isActive: boolean;
  isFiring: boolean;
  suppressionWindowSeconds: number;
  triggerCount: number;
  lastTriggeredAt?: string | null;
  lastEvaluatedAt?: string | null;
  history?: AlertHistory[];
  createdAt: string;
  updatedAt: string;
}

export type CreateAlertDto = Pick<Alert, 'name' | 'condition' | 'channels'> & Partial<Pick<Alert, 'description' | 'severity' | 'emailRecipients' | 'isActive' | 'suppressionWindowSeconds'>> & {
  portalId?: string;
  widgetId?: string;
  webhookUrl?: string;
  slackWebhook?: string;
};

export type UpdateAlertDto = Partial<CreateAlertDto>;

export const alertsApi = {
  getAll: () => apiClient.get<Alert[]>('/alerts'),
  getById: (id: string) => apiClient.get<Alert>(`/alerts/${id}`),
  create: (data: CreateAlertDto) => apiClient.post<Alert>('/alerts', data),
  update: (id: string, data: UpdateAlertDto) => apiClient.patch<Alert>(`/alerts/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/alerts/${id}`),
  getHistory: (id: string) => apiClient.get<AlertHistory[]>(`/alerts/${id}/history`),
  retryDelivery: (alertId: string, deliveryId: string) =>
    apiClient.post<AlertDelivery>(`/alerts/${alertId}/deliveries/${deliveryId}/retry`),
  test: (id: string) => apiClient.post<{ message: string; alertId: string; deliverySent: false }>(`/alerts/${id}/test`),
};
