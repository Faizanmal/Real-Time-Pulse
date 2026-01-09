/**
 * =============================================================================
 * REAL-TIME PULSE - ENHANCED OFFLINE SYNC
 * =============================================================================
 * 
 * Comprehensive offline support with conflict resolution, sync status indicators,
 * and background synchronization.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import localforage from 'localforage';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncableOperation {
  id: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete';
  entity: string;
  entityId?: string;
  payload: Record<string, unknown>;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'conflict' | 'failed';
}

export interface ConflictResolution {
  operationId: string;
  resolution: 'local' | 'remote' | 'merge';
  mergedData?: Record<string, unknown>;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  conflicts: SyncableOperation[];
  lastSyncTime: Date | null;
  syncProgress: number;
}

export interface OfflineCacheConfig {
  maxAge: number;          // Max age of cached data in ms
  maxSize: number;         // Max number of items to cache per entity
  priorityEntities: string[]; // Entities to always keep cached
}

// ============================================================================
// OFFLINE STORAGE
// ============================================================================

const offlineStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'offline_data',
});

const operationsStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'pending_operations',
});

const cacheMetaStore = localforage.createInstance({
  name: 'real-time-pulse',
  storeName: 'cache_meta',
});

// ============================================================================
// ENHANCED OFFLINE SYNC HOOK
// ============================================================================

export function useEnhancedOfflineSync(config?: Partial<OfflineCacheConfig>) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingOperations: 0,
    conflicts: [],
    lastSyncTime: null,
    syncProgress: 0,
  });

  const syncInProgressRef = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const defaultConfig: OfflineCacheConfig = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 100,
    priorityEntities: ['portals', 'widgets', 'user'],
    ...config,
  };

  /* Online/offline effect moved below to avoid referencing callbacks before declaration (see the effect placed after syncPendingOperations). */

  // Update pending operations count
  const updatePendingCount = useCallback(async () => {
    try {
      const keys = await operationsStore.keys();
      const operations: SyncableOperation[] = [];
      
      for (const key of keys) {
        const op = await operationsStore.getItem<SyncableOperation>(key);
        if (op) operations.push(op);
      }

      const conflicts = operations.filter(op => op.status === 'conflict');
      
      setStatus(prev => ({
        ...prev,
        pendingOperations: operations.length,
        conflicts,
      }));
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }, []);

  // Sync pending operations
  const syncPendingOperations = useCallback(async (): Promise<void> => {
    // Execute a single operation
    const executeOperation = async (operation: SyncableOperation): Promise<void> => {
      const { type, entity, entityId, payload } = operation;

      // Import API client dynamically to avoid circular deps
      const { apiClient } = await import('./api');

      switch (type) {
        case 'create':
          await apiClient.post(`/${entity}`, payload);
          break;
        case 'update':
          if (!entityId) throw new Error('entityId required for update');
          await apiClient.patch(`/${entity}/${entityId}`, payload);
          break;
        case 'delete':
          if (!entityId) throw new Error('entityId required for delete');
          await apiClient.delete(`/${entity}/${entityId}`);
          break;
      }
    };

    if (syncInProgressRef.current || !navigator.onLine) return;
    
    syncInProgressRef.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const keys = await operationsStore.keys();
      const operations: SyncableOperation[] = [];
      
      for (const key of keys) {
        const op = await operationsStore.getItem<SyncableOperation>(key);
        if (op && op.status !== 'conflict') operations.push(op);
      }

      // Sort by timestamp (oldest first)
      operations.sort((a, b) => a.timestamp - b.timestamp);

      let completed = 0;
      
      for (const operation of operations) {
        try {
          // Update operation status
          operation.status = 'syncing';
          await operationsStore.setItem(operation.id, operation);

                // Execute the operation
          await executeOperation(operation);

          // Remove successful operation
          await operationsStore.removeItem(operation.id);
          completed++;
          
          setStatus(prev => ({
            ...prev,
            syncProgress: (completed / operations.length) * 100,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check if it's a conflict
          if (errorMessage.includes('conflict') || errorMessage.includes('409')) {
            operation.status = 'conflict';
            operation.lastError = errorMessage;
          } else {
            operation.status = 'pending';
            operation.retryCount++;
            operation.lastError = errorMessage;
            
            // Max retries reached
            if (operation.retryCount >= 5) {
              operation.status = 'failed';
            }
          }
          
          await operationsStore.setItem(operation.id, operation);
        }
      }

      setStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        syncProgress: 100,
      }));

      await updatePendingCount();

      if (completed > 0) {
        toast.success(`Synced ${completed} change${completed > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
      setStatus(prev => ({ ...prev, isSyncing: false, syncProgress: 0 }));
    }
  }, [updatePendingCount]);

  // Online/offline handlers and periodic sync (moved here so callbacks are declared first)
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online', { description: 'Syncing pending changes...' });
      syncPendingOperations();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline', { 
        description: 'Changes will be saved and synced when online.' 
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync when online
    syncIntervalRef.current = setInterval(() => {
      if (navigator.onLine) {
        syncPendingOperations();
      }
    }, 30000); // Every 30 seconds

    // Initial sync check
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncPendingOperations, updatePendingCount]);



  // Queue an operation for sync
  const queueOperation = useCallback(async (
    type: SyncableOperation['type'],
    entity: string,
    payload: Record<string, unknown>,
    entityId?: string,
  ): Promise<string> => {
    const operation: SyncableOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      entity,
      entityId,
      payload,
      retryCount: 0,
      status: 'pending',
    };

    await operationsStore.setItem(operation.id, operation);
    await updatePendingCount();

    // Try to sync immediately if online
    if (navigator.onLine) {
      syncPendingOperations();
    }

    return operation.id;
  }, [updatePendingCount, syncPendingOperations]);

  // Resolve a conflict
  const resolveConflict = useCallback(async (
    resolution: ConflictResolution,
  ): Promise<void> => {
    const operation = await operationsStore.getItem<SyncableOperation>(resolution.operationId);
    if (!operation) return;

    switch (resolution.resolution) {
      case 'local':
        // Retry with local data
        operation.status = 'pending';
        operation.retryCount = 0;
        await operationsStore.setItem(operation.id, operation);
        break;
      
      case 'remote':
        // Discard local changes
        await operationsStore.removeItem(operation.id);
        // Invalidate cache for this entity
        await offlineStore.removeItem(`${operation.entity}:${operation.entityId}`);
        break;
      
      case 'merge':
        // Apply merged data
        if (resolution.mergedData) {
          operation.payload = resolution.mergedData;
          operation.status = 'pending';
          operation.retryCount = 0;
          await operationsStore.setItem(operation.id, operation);
        }
        break;
    }

    await updatePendingCount();
    
    // Try to sync if online
    if (navigator.onLine && resolution.resolution !== 'remote') {
      syncPendingOperations();
    }
  }, [syncPendingOperations, updatePendingCount]);

  // Cache data for offline use
  const cacheData = useCallback(async (
    entity: string,
    id: string,
    data: unknown,
  ): Promise<void> => {
    const key = `${entity}:${id}`;
    await offlineStore.setItem(key, {
      data,
      timestamp: Date.now(),
    });

    // Update cache meta
    const meta = await cacheMetaStore.getItem<string[]>(entity) || [];
    if (!meta.includes(id)) {
      meta.push(id);
      
      // Enforce max size
      if (meta.length > defaultConfig.maxSize) {
        const removed = meta.shift();
        if (removed) {
          await offlineStore.removeItem(`${entity}:${removed}`);
        }
      }
      
      await cacheMetaStore.setItem(entity, meta);
    }
  }, [defaultConfig.maxSize]);

  // Get cached data
  const getCachedData = useCallback(async <T>(
    entity: string,
    id: string,
  ): Promise<T | null> => {
    const key = `${entity}:${id}`;
    const cached = await offlineStore.getItem<{ data: T; timestamp: number }>(key);
    
    if (!cached) return null;
    
    // Check if data is stale
    if (Date.now() - cached.timestamp > defaultConfig.maxAge) {
      // Return stale data but mark for refresh
      console.log(`Stale cache for ${key}, should refresh`);
    }
    
    return cached.data;
  }, [defaultConfig.maxAge]);

  // Clear all caches
  const clearCache = useCallback(async (): Promise<void> => {
    await offlineStore.clear();
    await cacheMetaStore.clear();
    toast.info('Offline cache cleared');
  }, []);

  // Discard failed operations
  const discardFailedOperations = useCallback(async (): Promise<void> => {
    const keys = await operationsStore.keys();
    
    for (const key of keys) {
      const op = await operationsStore.getItem<SyncableOperation>(key);
      if (op && op.status === 'failed') {
        await operationsStore.removeItem(key);
      }
    }
    
    await updatePendingCount();
    toast.info('Discarded failed operations');
  }, [updatePendingCount]);

  return {
    status,
    queueOperation,
    syncPendingOperations,
    resolveConflict,
    cacheData,
    getCachedData,
    clearCache,
    discardFailedOperations,
  };
}

// ============================================================================
// SYNC STATUS INDICATOR COMPONENT
// ============================================================================

export interface SyncStatusIndicatorProps {
  status: SyncStatus;
  onSync?: () => void;
  onViewConflicts?: () => void;
  className?: string;
}

/**
 * Visual indicator for sync status (use in your UI)
 * 
 * Example usage:
 * ```tsx
 * const { status, syncPendingOperations } = useEnhancedOfflineSync();
 * 
 * <SyncStatusIndicator 
 *   status={status} 
 *   onSync={syncPendingOperations}
 * />
 * ```
 */
export function getSyncStatusInfo(status: SyncStatus): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  icon: 'check' | 'sync' | 'warning' | 'offline';
} {
  if (!status.isOnline) {
    return {
      label: 'Offline',
      color: 'gray',
      icon: 'offline',
    };
  }

  if (status.conflicts.length > 0) {
    return {
      label: `${status.conflicts.length} conflict${status.conflicts.length > 1 ? 's' : ''}`,
      color: 'red',
      icon: 'warning',
    };
  }

  if (status.isSyncing) {
    return {
      label: 'Syncing...',
      color: 'yellow',
      icon: 'sync',
    };
  }

  if (status.pendingOperations > 0) {
    return {
      label: `${status.pendingOperations} pending`,
      color: 'yellow',
      icon: 'sync',
    };
  }

  return {
    label: 'Synced',
    color: 'green',
    icon: 'check',
  };
}

// ============================================================================
// OFFLINE-FIRST QUERY WRAPPER
// ============================================================================

/**
 * Higher-order function to make queries offline-first
 */
export function withOfflineSupport<TData>(
  queryFn: () => Promise<TData>,
  cacheKey: string,
  options?: {
    cacheData: (entity: string, id: string, data: TData) => Promise<void>;
    getCachedData: (entity: string, id: string) => Promise<TData | null>;
  },
): () => Promise<TData> {
  return async () => {
    try {
      // Try to fetch fresh data
      const data = await queryFn();
      
      // Cache the result
      if (options?.cacheData) {
        await options.cacheData('queries', cacheKey, data);
      }
      
      return data;
    } catch (error) {
      // If offline or network error, try cache
      if (!navigator.onLine || (error instanceof Error && error.message.includes('network'))) {
        if (options?.getCachedData) {
          const cached = await options.getCachedData('queries', cacheKey);
          if (cached) {
            console.log(`Serving cached data for ${cacheKey}`);
            return cached;
          }
        }
      }
      
      throw error;
    }
  };
}
