'use client';

/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX SOCKET CONTEXT
 * ============================================================================
 * WebSocket context provider for real-time communication.
 */

import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

import type { Annotation as ApiAnnotation } from '@/lib/api/annotations';
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

type SocketEventHandler = (...args: never[]) => void;

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
  const desiredWidgetsRef = useRef(new Set<string>());
  const wrappedHandlersRef = useRef(new WeakMap<SocketEventHandler, Map<string, SocketEventHandler>>());
  const handlerRevisionsRef = useRef(new WeakMap<SocketEventHandler, Map<string, number>>());
  const handlerEventIdsRef = useRef(new WeakMap<SocketEventHandler, Set<string>>());

  const { isAuthenticated } = useAuthStore();

  // Initialize socket connection
  useLayoutEffect(() => {
    if (!isAuthenticated) {
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
      withCredentials: true,
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
      handlerRevisionsRef.current = new WeakMap();
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionState('connected');
      if (desiredWidgetsRef.current.size) {
        newSocket.emit('widget:subscribe', { widgetIds: [...desiredWidgetsRef.current] });
      }
    });

    newSocket.on('disconnect', (reason: string) => {
      handlerRevisionsRef.current = new WeakMap();
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionState('disconnected');
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error.message);
      setConnectionState('disconnected');
    });

    newSocket.io.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Socket reconnecting, attempt:', attemptNumber);
      setConnectionState('reconnecting');
    });

    newSocket.io.on('reconnect', (attemptNumber: number) => {
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
      newSocket.removeAllListeners();
      newSocket.io.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionState('disconnected');
    };
  }, [isAuthenticated]);

  // Event subscription
  const on = useCallback(<K extends keyof SocketEvents>(
    event: K,
    handler: SocketEvents[K],
  ) => {
    if (socket) {
      const wrapped = (data: unknown) => {
        if (data && typeof data === 'object') {
          const envelope = data as { eventId?: unknown; revision?: unknown; tenantId?: unknown; resourceType?: unknown; resourceId?: unknown };
          if (typeof envelope.eventId === 'string' && Number.isInteger(envelope.revision) &&
            typeof envelope.resourceType === 'string' && typeof envelope.resourceId === 'string') {
            let seenEventIds = handlerEventIdsRef.current.get(handler as SocketEventHandler);
            if (!seenEventIds) {
              seenEventIds = new Set();
              handlerEventIdsRef.current.set(handler as SocketEventHandler, seenEventIds);
            }
            if (seenEventIds.has(envelope.eventId)) return;
            seenEventIds.add(envelope.eventId);
            if (seenEventIds.size > 2000) {
              const oldestEventId = seenEventIds.values().next().value;
              if (oldestEventId) seenEventIds.delete(oldestEventId);
            }
            const key = `${String(envelope.tenantId ?? '')}:${envelope.resourceType}:${envelope.resourceId}`;
            let handlerRevisions = handlerRevisionsRef.current.get(handler as SocketEventHandler);
            if (!handlerRevisions) {
              handlerRevisions = new Map();
              handlerRevisionsRef.current.set(handler as SocketEventHandler, handlerRevisions);
            }
            const previousRevision = handlerRevisions.get(key) ?? 0;
            if ((envelope.revision as number) <= previousRevision) return;
            handlerRevisions.set(key, envelope.revision as number);
          }
        }
        (handler as (eventData: unknown) => void)(data);
      };
      let handlersByEvent = wrappedHandlersRef.current.get(handler as SocketEventHandler);
      if (!handlersByEvent) {
        handlersByEvent = new Map();
        wrappedHandlersRef.current.set(handler as SocketEventHandler, handlersByEvent);
      }
      handlersByEvent.set(event as string, wrapped as SocketEventHandler);
      socket.on(event as string, wrapped as typeof handler);
    }
  }, [socket]);

  const off = useCallback(<K extends keyof SocketEvents>(
    event: K,
    handler: SocketEvents[K],
  ) => {
    if (socket) {
      const handlersByEvent = wrappedHandlersRef.current.get(handler as SocketEventHandler);
      const wrapped = handlersByEvent?.get(event as string);
      socket.off(event as string, (wrapped ?? handler) as typeof handler);
      handlersByEvent?.delete(event as string);
      if (handlersByEvent?.size === 0) wrappedHandlersRef.current.delete(handler as SocketEventHandler);
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
    widgetIds.forEach((id) => desiredWidgetsRef.current.add(id));
    if (socket && isConnected) {
      socket.emit('widget:subscribe', { widgetIds: [...new Set(widgetIds)] });
    }
  }, [socket, isConnected]);

  const unsubscribeFromWidgets = useCallback((widgetIds: string[]) => {
    widgetIds.forEach((id) => desiredWidgetsRef.current.delete(id));
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
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const stableHandler = useCallback((...args: Parameters<SocketEvents[K]>) => {
    (handlerRef.current as (...handlerArgs: Parameters<SocketEvents[K]>) => void)(...args);
  }, []);

  useEffect(() => {
    on(event, stableHandler as SocketEvents[K]);
    return () => off(event, stableHandler as SocketEvents[K]);
  }, [event, stableHandler, on, off]);
}

// Hook for portal room subscription
export function usePortalRoom(portalId: string | null) {
  const { joinPortal, leavePortal, isConnected } = useSocket();
  const [viewerState, setViewerState] = useState<{ portalId: string | null; viewers: { userId: string }[] }>({
    portalId: null,
    viewers: [],
  });

  useSocketEvent('portal:viewers', (data) => {
    if (data.portalId === portalId) {
      setViewerState({ portalId, viewers: data.viewers as { userId: string }[] });
    }
  });

  useSocketEvent('portal:viewer:joined', (data) => {
    if (data.portalId === portalId) {
      setViewerState((current) => {
        const prev = current.portalId === portalId ? current.viewers : [];
        return {
          portalId,
          viewers: prev.some((viewer) => viewer.userId === data.userId)
            ? prev
            : [...prev, { userId: data.userId }],
        };
      });
    }
  });

  useSocketEvent('portal:viewer:left', (data) => {
    if (data.portalId === portalId) {
      setViewerState((current) => ({
        portalId,
        viewers: current.portalId === portalId
          ? current.viewers.filter((viewer) => viewer.userId !== data.userId)
          : [],
      }));
    }
  });

  useEffect(() => {
    if (portalId && isConnected) {
      joinPortal(portalId);
      return () => leavePortal(portalId);
    }
  }, [portalId, isConnected, joinPortal, leavePortal]);

  useSocketEvent('disconnect', () => setViewerState({ portalId, viewers: [] }));

  return { viewers: viewerState.portalId === portalId ? viewerState.viewers : [] };
}
