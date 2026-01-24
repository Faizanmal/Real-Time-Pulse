'use client';

/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX SOCKET CONTEXT
 * ============================================================================
 * WebSocket context provider for real-time communication.
 */

import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, ReactNode } from 'react';
import type { Annotation as ApiAnnotation } from '@/lib/api/annotations';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

// Socket event types
export interface SocketEvents {
  // Portal events
  'portal:created': (data: unknown) => void;
  'portal:updated': (data: unknown) => void;
  'portal:deleted': (data: { portalId: string }) => void;
  'portal:viewer:joined': (data: { userId: string; portalId: string }) => void;
  'portal:viewer:left': (data: { userId: string; portalId: string }) => void;
  'portal:viewers': (data: { portalId: string; viewers: unknown[] }) => void;

  // Widget events
  'widget:created': (data: unknown) => void;
  'widget:updated': (data: unknown) => void;
  'widget:deleted': (data: { widgetId: string }) => void;
  'widget:data:updated': (data: { widgetId: string; data: unknown }) => void;

  // Alert events
  'alert:triggered': (data: unknown) => void;
  'alert:resolved': (data: { alertId: string }) => void;
  'alert:new': (data: { type: string; message: string }) => void;

  // Metrics events
  'metrics:update': (data: Partial<unknown>) => void;

  // Insight events
  'insight:generated': (data: unknown) => void;

  // Notification events
  'notification:new': (data: unknown) => void;

  // Comment events
  'comment:added': (data: unknown) => void;
  'comment:updated': (data: unknown) => void;
  'comment:deleted': (data: { commentId: string }) => void;
  'comment:user:typing': (data: unknown) => void;
  'comment:user:stopped-typing': (data: unknown) => void;

  // Presence events
  'presence:updated': (data: unknown) => void;
  'user:joined': (data: { userId: string }) => void;
  'user:left': (data: { userId: string }) => void;

  // Cursor events
  'cursor:moved': (data: unknown) => void;

  // Gamification events
  'xp_gained': (data: { userId: string; amount: number; totalXp: number; level: number }) => void;
  'level_up': (data: { userId: string; level: number }) => void;
  'badge_earned': (data: { userId: string; badge: unknown }) => void;

  // Annotation events
  'annotation:created': (data: ApiAnnotation) => void;
  'annotation:updated': (data: ApiAnnotation) => void;
  'annotation:deleted': (data: { id: string }) => void;
  'annotation:reply_added': (data: { parentId: string; reply: ApiAnnotation }) => void;

  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'error': (error: { message: string }) => void;
  'reconnect': (attemptNumber: number) => void;
  'reconnect_attempt': (attemptNumber: number) => void;
  'reconnect_failed': () => void;
}

// Context value type
interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

  // Event subscription
  on: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;
  off: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;

  // Portal methods
  joinPortal: (portalId: string) => void;
  leavePortal: (portalId: string) => void;

  // Widget methods
  subscribeToWidgets: (widgetIds: string[]) => void;
  unsubscribeFromWidgets: (widgetIds: string[]) => void;

  // Cursor methods
  sendCursorPosition: (portalId: string, x: number, y: number) => void;

  // Typing methods
  sendTyping: (portalId: string, widgetId?: string) => void;
  sendStopTyping: (portalId: string) => void;

  // Connection methods
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<SocketContextValue['connectionState']>('disconnected');

  const { accessToken, isAuthenticated } = useAuthStore();

  // Initialize socket connection
  useLayoutEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socket) {
        socket.disconnect();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(null);
      }
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Connect to the realtime namespace
    const newSocket = io(`${apiUrl}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    // Connection handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionState('connected');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionState('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnectionState('disconnected');
    });

    newSocket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnecting, attempt:', attemptNumber);
      setConnectionState('reconnecting');
    });

    newSocket.io.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionState('connected');
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setConnectionState('disconnected');
    });

    setSocket(newSocket);
    setConnectionState('connecting');

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionState('disconnected');
    };
  }, [isAuthenticated, accessToken, socket]);

  // Event subscription
  const on = useCallback(<K extends keyof SocketEvents>(
    event: K,
    handler: SocketEvents[K],
  ) => {
    if (socket) {
      socket.on(event as string, handler);
    }
  }, [socket]);

  const off = useCallback(<K extends keyof SocketEvents>(
    event: K,
    handler: SocketEvents[K],
  ) => {
    if (socket) {
      socket.off(event as string, handler);
    }
  }, [socket]);

  // Portal methods
  const joinPortal = useCallback((portalId: string) => {
    if (socket && isConnected) {
      socket.emit('portal:join', { portalId });
    }
  }, [socket, isConnected]);

  const leavePortal = useCallback((portalId: string) => {
    if (socket && isConnected) {
      socket.emit('portal:leave', { portalId });
    }
  }, [socket, isConnected]);

  // Widget methods
  const subscribeToWidgets = useCallback((widgetIds: string[]) => {
    if (socket && isConnected) {
      socket.emit('widget:subscribe', { widgetIds });
    }
  }, [socket, isConnected]);

  const unsubscribeFromWidgets = useCallback((widgetIds: string[]) => {
    if (socket && isConnected) {
      socket.emit('widget:unsubscribe', { widgetIds });
    }
  }, [socket, isConnected]);

  // Cursor methods
  const sendCursorPosition = useCallback((portalId: string, x: number, y: number) => {
    if (socket && isConnected) {
      socket.emit('cursor:move', { portalId, x, y });
    }
  }, [socket, isConnected]);

  // Typing methods
  const sendTyping = useCallback((portalId: string, widgetId?: string) => {
    if (socket && isConnected) {
      socket.emit('comment:typing', { portalId, widgetId });
    }
  }, [socket, isConnected]);

  const sendStopTyping = useCallback((portalId: string) => {
    if (socket && isConnected) {
      socket.emit('comment:stop-typing', { portalId });
    }
  }, [socket, isConnected]);

  // Reconnect method
  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  const value: SocketContextValue = {
    socket,
    isConnected,
    connectionState,
    on,
    off,
    joinPortal,
    leavePortal,
    subscribeToWidgets,
    unsubscribeFromWidgets,
    sendCursorPosition,
    sendTyping,
    sendStopTyping,
    reconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook to use socket context
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// Hook for subscribing to specific socket events
export function useSocketEvent<K extends keyof SocketEvents>(
  event: K,
  handler: SocketEvents[K],
) {
  const { on, off } = useSocket();

  useEffect(() => {
    on(event, handler);
    return () => off(event, handler);
  }, [event, handler, on, off]);
}

// Hook for portal room subscription
export function usePortalRoom(portalId: string | null) {
  const { joinPortal, leavePortal, isConnected } = useSocket();
  const [viewers, setViewers] = useState<{ userId: string }[]>([]);

  useSocketEvent('portal:viewers', (data) => {
    if (data.portalId === portalId) {
      setViewers(data.viewers as { userId: string }[]);
    }
  });

  useSocketEvent('portal:viewer:joined', (data) => {
    if (data.portalId === portalId) {
      setViewers((prev) => [...prev, { userId: data.userId }]);
    }
  });

  useSocketEvent('portal:viewer:left', (data) => {
    if (data.portalId === portalId) {
      setViewers((prev) => prev.filter((v) => v.userId !== data.userId));
    }
  });

  useEffect(() => {
    if (portalId && isConnected) {
      joinPortal(portalId);
      return () => leavePortal(portalId);
    }
  }, [portalId, isConnected, joinPortal, leavePortal]);

  return { viewers };
}
