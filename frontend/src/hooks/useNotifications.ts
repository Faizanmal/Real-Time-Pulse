/**
 * WebSocket Hook for Real-Time Notifications
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import type { Notification } from '../types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    // Create WebSocket connection
    const socket = io(`${WS_URL}/notifications`, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('notification', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    socket.on('portal:updated', (data: { portalId: string; portal?: unknown }) => {
      console.log('Portal updated:', data);
      // Emit custom event for other components to listen
      window.dispatchEvent(new CustomEvent('portal:updated', { detail: data }));
    });

    socket.on('widget:refreshed', (data: { widgetId: string; widget?: unknown }) => {
      console.log('Widget refreshed:', data);
      window.dispatchEvent(new CustomEvent('widget:refreshed', { detail: data }));
    });

    socket.on('integration:synced', (data: { integrationId: string; integration?: unknown }) => {
      console.log('Integration synced:', data);
      window.dispatchEvent(new CustomEvent('integration:synced', { detail: data }));
    });

    socket.on('workspace:member:added', (data: { memberId: string; member?: unknown }) => {
      console.log('Member added:', data);
      window.dispatchEvent(new CustomEvent('workspace:member:added', { detail: data }));
    });

    socket.on('error', (error: { message: string; code?: string }) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );
  }, []);

  return {
    notifications,
    isConnected,
    markAsRead,
    clearAll,
    markAllAsRead,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}
