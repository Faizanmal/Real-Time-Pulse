'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCollaboration } from '@/hooks/useAdvancedFeatures';

interface CollaboratorCursor {
  odId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
}

interface CollaborationOverlayProps {
  portalId: string;
  children: React.ReactNode;
}

export function CollaborationOverlay({ portalId, children }: CollaborationOverlayProps) {
  const {
    session,
    participants,
    isConnected,
    joinSession,
    leaveSession,
    updateCursor,
  } = useCollaboration(portalId);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    joinSession();
    return () => leaveSession();
  }, [joinSession, leaveSession]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (containerRef.current && isConnected) {
        const rect = containerRef.current.getBoundingClientRect();
        updateCursor({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [isConnected, updateCursor]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
    >
      {/* Collaboration Status Bar */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border text-sm"
        >
          <span className="flex -space-x-2">
            {participants.slice(0, 3).map((p) => (
              <div
                key={p.odId}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: p.color }}
                title={p.name}
              >
                {p.name[0].toUpperCase()}
              </div>
            ))}
          </span>
          {participants.length > 0 && (
            <span className="text-gray-600 dark:text-gray-300">
              {participants.length} online
            </span>
          )}
        </button>
      </div>

      {/* Participants Panel */}
      {showParticipants && (
        <div className="absolute top-12 right-2 z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3">
          <h4 className="font-medium mb-2 text-sm">Active Collaborators</h4>
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.odId} className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.selection ? 'Editing...' : 'Viewing'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remote Cursors */}
      {participants
        .filter((p) => p.cursor)
        .map((p) => (
          <div
            key={p.odId}
            className="absolute pointer-events-none z-40 transition-all duration-75"
            style={{
              left: p.cursor?.x ?? 0,
              top: p.cursor?.y ?? 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={p.color}
              className="drop-shadow-md"
            >
              <path d="M5.65 2.65l12 12-5.5 1.5 1.5 5.5-3.5 0-1.5-5.5-5.5 1.5 2.5-15z" />
            </svg>
            <div
              className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: p.color }}
            >
              {p.name}
            </div>
          </div>
        ))}

      {/* Main Content */}
      {children}
    </div>
  );
}

export function CollaborationIndicator({ isConnected, participantCount }: { isConnected: boolean; participantCount: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {isConnected ? `${participantCount} collaborating` : 'Connecting...'}
      </span>
    </div>
  );
}
