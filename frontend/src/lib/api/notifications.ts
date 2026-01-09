/**
 * Notifications API Client
 */
import { apiClient } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: NotificationChannel[];
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export type NotificationChannel = 'email' | 'push' | 'sms' | 'in-app' | 'slack' | 'webhook';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  channels: Record<string, NotificationChannel[]>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface CreateNotificationDto {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channels?: NotificationChannel[];
  scheduledFor?: string;
}

class NotificationsApi {
  // Notifications
  async getNotifications(params?: {
    unreadOnly?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.type) query.append('type', params.type);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    return apiClient.get<Notification[]>(`/notifications?${query.toString()}`);
  }

  async getNotification(id: string): Promise<Notification> {
    return apiClient.get<Notification>(`/notifications/${id}`);
  }

  async markAsRead(id: string): Promise<Notification> {
    return apiClient.patch<Notification>(`/notifications/${id}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    return apiClient.post('/notifications/read-all', {});
  }

  async deleteNotification(id: string): Promise<void> {
    return apiClient.delete(`/notifications/${id}`);
  }

  async deleteAllRead(): Promise<void> {
    return apiClient.delete('/notifications/read');
  }

  // Stats
  async getStats(): Promise<NotificationStats> {
    return apiClient.get<NotificationStats>('/notifications/stats');
  }

  // Preferences
  async getPreferences(): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>('/notifications/preferences');
  }

  async updatePreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return apiClient.patch<NotificationPreferences>('/notifications/preferences', data);
  }

  // Push subscriptions
  async subscribeToPush(subscription: PushSubscription): Promise<void> {
    return apiClient.post('/notifications/push/subscribe', { subscription });
  }

  async unsubscribeFromPush(): Promise<void> {
    return apiClient.delete('/notifications/push/subscribe');
  }

  // Test notification
  async sendTestNotification(channel: NotificationChannel): Promise<void> {
    return apiClient.post('/notifications/test', { channel });
  }
}

export const notificationsApi = new NotificationsApi();

