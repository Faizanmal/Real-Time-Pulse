import { useEffect, useState } from 'react';
import localforage from 'localforage';

// Configure localforage for offline storage
const dashboardStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'dashboards',
});

const widgetStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'widgets',
});

const alertStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'alerts',
});

export interface OfflineData<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  save: (data: T) => Promise<void>;
  remove: () => Promise<void>;
  sync: () => Promise<void>;
}

export function useOfflineStorage<T>(
  key: string,
  storeName: 'dashboards' | 'widgets' | 'alerts' = 'dashboards',
): OfflineData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const store = 
    storeName === 'dashboards' ? dashboardStore :
    storeName === 'widgets' ? widgetStore :
    alertStore;

  useEffect(() => {
    loadData();
  }, [key]);

  const loadData = async () => {
    try {
      setLoading(true);
      const stored = await store.getItem<T>(key);
      setData(stored);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const save = async (newData: T) => {
    try {
      await store.setItem(key, newData);
      setData(newData);
      setError(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const remove = async () => {
    try {
      await store.removeItem(key);
      setData(null);
      setError(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const sync = async () => {
    // Sync with server when online
    if (navigator.onLine && data) {
      try {
        // Implementation depends on your API structure
        // This is a placeholder for the sync logic
        console.log('Syncing data to server:', key);
      } catch (err) {
        setError(err as Error);
      }
    }
  };

  return { data, loading, error, save, remove, sync };
}

// Helper functions for conflict resolution
export async function mergeConflicts<T>(
  localData: T,
  serverData: T,
  strategy: 'local-wins' | 'server-wins' | 'merge' = 'server-wins',
): Promise<T> {
  switch (strategy) {
    case 'local-wins':
      return localData;
    case 'server-wins':
      return serverData;
    case 'merge':
      // Simple merge strategy - override with server data but keep local additions
      if (Array.isArray(localData) && Array.isArray(serverData)) {
        return [...localData, ...serverData] as T;
      }
      return { ...localData, ...serverData };
    default:
      return serverData;
  }
}

// Batch operations
export async function saveMultiple(
  items: Array<{ key: string; data: any; store: 'dashboards' | 'widgets' | 'alerts' }>,
): Promise<void> {
  const operations = items.map(({ key, data, store: storeName }) => {
    const store = 
      storeName === 'dashboards' ? dashboardStore :
      storeName === 'widgets' ? widgetStore :
      alertStore;
    return store.setItem(key, data);
  });

  await Promise.all(operations);
}

export async function clearAllStores(): Promise<void> {
  await Promise.all([
    dashboardStore.clear(),
    widgetStore.clear(),
    alertStore.clear(),
  ]);
}
