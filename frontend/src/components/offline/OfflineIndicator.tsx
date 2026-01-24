'use client';

import React from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, pendingSync, sync } = useOfflineSync();
  const [syncing, setSyncing] = React.useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sync();
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && pendingSync === 0) {
    return null; // Hide when online and nothing to sync
  }

  return (
    <div className={`
      fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50
      ${isOnline 
        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
      }
    `}>
      <div className="flex items-center gap-3">
        {isOnline ? (
          <Wifi className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <WifiOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        )}
        
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            isOnline 
              ? 'text-blue-800 dark:text-blue-200' 
              : 'text-yellow-800 dark:text-yellow-200'
          }`}>
            {isOnline ? 'Back Online' : 'You are offline'}
          </p>
          
          {pendingSync > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {pendingSync} action{pendingSync > 1 ? 's' : ''} pending sync
            </p>
          )}
        </div>

        {isOnline && pendingSync > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {!isOnline && (
        <div className="mt-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Your changes are saved locally and will sync when connection is restored.
          </p>
        </div>
      )}
    </div>
  );
}
