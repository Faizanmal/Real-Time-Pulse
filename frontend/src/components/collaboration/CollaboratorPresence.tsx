'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { widgetId: string; elementId?: string };
  avatar?: string;
  isActive: boolean;
}

interface CollaboratorCursorsProps {
  collaborators: Collaborator[];
  containerRef: React.RefObject<HTMLElement>;
}

export function CollaboratorCursors({ collaborators, containerRef }: CollaboratorCursorsProps) {
  return (
    <>
      {collaborators
        .filter((c) => c.isActive && c.cursor)
        .map((collaborator) => (
          <CollaboratorCursor
            key={collaborator.id}
            collaborator={collaborator}
            containerRef={containerRef}
          />
        ))}
    </>
  );
}

interface CollaboratorCursorProps {
  collaborator: Collaborator;
  containerRef: React.RefObject<HTMLElement>;
}

function CollaboratorCursor({ collaborator, containerRef }: CollaboratorCursorProps) {
  const { cursor, name, color } = collaborator;

  if (!cursor || !containerRef.current) return null;

  const containerRect = containerRef.current.getBoundingClientRect();
  const x = cursor.x - containerRect.left;
  const y = cursor.y - containerRect.top;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={color}
        className="drop-shadow-md"
      >
        <path d="M5.5 3.21V20.8c0 .45.54.67.86.35l4.27-4.27 2.84 6.84c.13.32.5.47.82.35l2.12-.88c.31-.13.46-.5.33-.82l-2.83-6.83 6-1.49c.44-.11.57-.66.23-.96L6.36 2.56c-.33-.3-.86-.08-.86.35z" />
      </svg>
      
      {/* Name tag */}
      <div
        className="absolute left-4 top-4 px-2 py-1 text-xs font-medium text-white rounded-md shadow-md whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}

// Collaborator presence list
interface CollaboratorListProps {
  collaborators: Collaborator[];
  maxVisible?: number;
}

export function CollaboratorList({ collaborators, maxVisible = 5 }: CollaboratorListProps) {
  const activeCollaborators = collaborators.filter((c) => c.isActive);
  const visibleCollaborators = activeCollaborators.slice(0, maxVisible);
  const overflowCount = Math.max(0, activeCollaborators.length - maxVisible);

  if (activeCollaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center -space-x-2">
      {visibleCollaborators.map((collaborator) => (
        <div
          key={collaborator.id}
          className="relative group"
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: collaborator.color }}
          >
            {collaborator.avatar ? (
              <img
                src={collaborator.avatar}
                alt={collaborator.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              collaborator.name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Status dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {collaborator.name}
          </div>
        </div>
      ))}
      
      {overflowCount > 0 && (
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

// Real-time typing indicator
interface TypingIndicatorProps {
  collaborators: Collaborator[];
  typingUsers: string[]; // Array of user IDs currently typing
}

export function TypingIndicator({ collaborators, typingUsers }: TypingIndicatorProps) {
  const typingCollaborators = collaborators.filter((c) => typingUsers.includes(c.id));

  if (typingCollaborators.length === 0) {
    return null;
  }

  const names = typingCollaborators.map((c) => c.name);
  let message: string;

  if (names.length === 1) {
    message = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    message = `${names[0]} and ${names[1]} are typing...`;
  } else {
    message = `${names[0]} and ${names.length - 1} others are typing...`;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
      <div className="flex space-x-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{message}</span>
    </div>
  );
}

// Selection highlight for co-editing
interface SelectionHighlightProps {
  collaborator: Collaborator;
  elementRef: React.RefObject<HTMLElement>;
}

export function SelectionHighlight({ collaborator, elementRef }: SelectionHighlightProps) {
  if (!elementRef.current) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded border-2"
      style={{
        borderColor: collaborator.color,
        boxShadow: `0 0 0 2px ${collaborator.color}33`,
      }}
    >
      <div
        className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name}
      </div>
    </div>
  );
}

// Hook for managing collaboration state
export function useCollaboration(portalId: string, userId: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sendCursorPosition = useCallback((position: { x: number; y: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor',
        position,
      }));
    }
  }, []);

  const sendSelection = useCallback((selection: { widgetId: string; elementId?: string } | null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'selection',
        selection,
      }));
    }
  }, []);

  useEffect(() => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/collaboration?portalId=${portalId}&userId=${userId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'collaborators':
          setCollaborators(data.collaborators);
          break;
        case 'join':
          setCollaborators((prev) => [...prev, data.collaborator]);
          break;
        case 'leave':
          setCollaborators((prev) => prev.filter((c) => c.id !== data.userId));
          break;
        case 'cursor':
          setCollaborators((prev) =>
            prev.map((c) =>
              c.id === data.userId ? { ...c, cursor: data.position } : c
            )
          );
          break;
        case 'selection':
          setCollaborators((prev) =>
            prev.map((c) =>
              c.id === data.userId ? { ...c, selection: data.selection } : c
            )
          );
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [portalId, userId]);

  return {
    collaborators,
    isConnected,
    sendCursorPosition,
    sendSelection,
  };
}
