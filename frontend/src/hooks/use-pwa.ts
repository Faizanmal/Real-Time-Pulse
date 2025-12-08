'use client';

import { useEffect, useState, useCallback } from 'react';

// Add a minimal type for BeforeInstallPromptEvent for TypeScript
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  // Extend Window with an optional deferredPrompt for the install event
  interface WindowEventMap {
    'beforeinstallprompt': BeforeInstallPromptEvent;
  }

  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

interface UsePWAReturn extends ServiceWorkerState {
  install: () => Promise<void>;
  update: () => Promise<void>;
  unregister: () => Promise<void>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<PushSubscription | null>;
}

export function usePWA(): UsePWAReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    registration: null,
    updateAvailable: false,
  });

  // Check if service workers are supported and register
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;

    if (!isSupported) return;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState((prev) => ({ ...prev, updateAvailable: true }));
              }
            });
          }
        });

        // Check for existing updates
        if (registration.waiting) {
          setState((prev) => ({ ...prev, updateAvailable: true }));
        }
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Install PWA
  const install = useCallback(async () => {
    const deferredPrompt = (window as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
    if (!deferredPrompt) {
      console.log('PWA install prompt not available');
      return;
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const { outcome } = choice || { outcome: 'dismissed' };
    console.log('PWA install outcome:', outcome);
    (window as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = undefined;
  }, []);

  // Update service worker
  const update = useCallback(async () => {
    if (!state.registration?.waiting) return;

    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page when new service worker activates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, [state.registration]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (!state.registration) return;

    await state.registration.unregister();
    setState((prev) => ({
      ...prev,
      isRegistered: false,
      registration: null,
    }));
  }, [state.registration]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (): Promise<PushSubscription | null> => {
    if (!state.registration) return null;

    try {
      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await response.json() as { publicKey: string };

      const keyArray = urlBase64ToUint8Array(publicKey);
      const subscription = await state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }, [state.registration]);

  return {
    ...state,
    install,
    update,
    unregister,
    requestNotificationPermission,
    subscribeToPush,
  };
}

// Helper function to convert VAPID key
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

// Hook to capture install prompt
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      window.deferredPrompt = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled as EventListener);
    };
  }, []);

  return canInstall;
}
