'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  update: () => Promise<void>;
  unregister: () => Promise<boolean>;
  checkForUpdates: () => Promise<void>;
  subscribeToPush: (publicKey: string) => Promise<PushSubscription | null>;
  unsubscribeFromPush: () => Promise<boolean>;
  clearCache: (cacheName?: string) => Promise<void>;
  getCacheSize: () => Promise<number>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isInstalled: false,
    isOnline: true,
    updateAvailable: false,
    registration: null,
  });

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;
    setState((s) => ({ ...s, isSupported }));

    if (!isSupported) return;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState((s) => ({
          ...s,
          isInstalled: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState((s) => ({ ...s, updateAvailable: true }));
              }
            });
          }
        });

        // Handle controller change (after update)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    // Online/offline listeners
    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setState((s) => ({ ...s, isOnline: navigator.onLine }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const update = useCallback(async () => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (state.registration) {
      return state.registration.unregister();
    }
    return false;
  }, [state.registration]);

  const checkForUpdates = useCallback(async () => {
    if (state.registration) {
      await state.registration.update();
    }
  }, [state.registration]);

  const subscribeToPush = useCallback(
    async (publicKey: string): Promise<PushSubscription | null> => {
      if (!state.registration) return null;

      try {
        const subscription = await state.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        return subscription;
      } catch (error) {
        console.error('Push subscription failed:', error);
        return null;
      }
    },
    [state.registration]
  );

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!state.registration) return false;

    try {
      const subscription = await state.registration.pushManager.getSubscription();
      if (subscription) {
        return subscription.unsubscribe();
      }
      return true;
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      return false;
    }
  }, [state.registration]);

  const clearCache = useCallback(
    async (cacheName?: string) => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE',
          payload: { cacheName },
        });
      }
    },
    []
  );

  const getCacheSize = useCallback(async (): Promise<number> => {
    return new Promise((resolve) => {
      if (!navigator.serviceWorker.controller) {
        resolve(0);
        return;
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_SIZE') {
          resolve(event.data.size);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [channel.port2]
      );
    });
  }, []);

  return {
    ...state,
    update,
    unregister,
    checkForUpdates,
    subscribeToPush,
    unsubscribeFromPush,
    clearCache,
    getCacheSize,
  };
}

// Helper function
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
