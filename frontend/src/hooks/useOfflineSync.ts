import { useEffect, useState, useCallback } from 'react';

interface UseOfflineSyncResult {
  isOnline: boolean;
  pendingSync: number;
  sync: () => Promise<void>;
  queueRequest: (url: string, options: RequestInit) => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncResult {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);

  const updatePendingCount = useCallback(async () => {
    try {
      const cache = await caches.open('pending-sync');
      const keys = await cache.keys();
      setPendingSync(keys.length);
    } catch (error) {
      console.error('Failed to get pending count', error);
    }
  }, []);

  const syncPendingRequests = useCallback(async () => {
    if (!isOnline) return;

    try {
      const cache = await caches.open('pending-sync');
      const requests = await cache.keys();

      for (const request of requests) {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.delete(request);
          }
        } catch (error) {
          console.error('Sync failed for request:', error);
        }
      }

      await updatePendingCount();
    } catch (error) {
      console.error('Failed to sync pending requests', error);
    }
  }, [isOnline, updatePendingCount]);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingRequests();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending sync count
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingRequests, updatePendingCount]);

  const queueRequest = async (url: string, options: RequestInit) => {
    try {
      // Store request for later sync
      const cache = await caches.open('pending-sync');
      const request = new Request(url, options);
      const response = new Response(JSON.stringify({ queued: true, timestamp: Date.now() }));
      await cache.put(request, response);
      await updatePendingCount();

      // Register background sync if available
      if ('sync' in navigator && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-dashboards');
      }
    } catch (error) {
      console.error('Failed to queue request', error);
    }
  };

  const sync = async () => {
    await syncPendingRequests();
  };

  return {
    isOnline,
    pendingSync,
    sync,
    queueRequest,
  };
}
