/**
 * Service Worker for Real-Time Pulse
 * Provides offline support, caching, and background sync
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Extend NotificationOptions to include vibrate, actions, and renotify
interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  actions?: any[];
  renotify?: boolean;
}

// Declare SyncEvent
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

declare var SyncEvent: {
  prototype: SyncEvent;
  new(type: string, eventInitDict?: ExtendableEventInit): SyncEvent;
};

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/v1\/dashboards/,
  /\/api\/v1\/widgets/,
  /\/api\/v1\/portals/,
];

// Cache duration in seconds
const CACHE_DURATIONS = {
  static: 60 * 60 * 24 * 30, // 30 days
  dynamic: 60 * 60 * 24 * 7, // 7 days
  api: 60 * 5, // 5 minutes
};

// ==================== INSTALL ====================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ==================== ACTIVATE ====================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ==================== FETCH ====================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(handleDynamicRequest(request));
});

// ==================== REQUEST HANDLERS ====================

async function handleApiRequest(request: Request): Promise<Response> {
  const shouldCache = API_CACHE_PATTERNS.some((pattern) => 
    pattern.test(new URL(request.url).pathname)
  );

  // Network first for API
  try {
    const response = await fetch(request);
    
    if (shouldCache && response.ok) {
      const cache = await caches.open(API_CACHE);
      const clonedResponse = response.clone();
      
      // Add cache timestamp header
      const headers = new Headers(clonedResponse.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      
      const cachedResponse = new Response(await clonedResponse.blob(), {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers,
      });
      
      cache.put(request, cachedResponse);
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      // Check if cache is still valid
      const timestamp = cached.headers.get('sw-cache-timestamp');
      if (timestamp) {
        const age = (Date.now() - parseInt(timestamp)) / 1000;
        if (age < CACHE_DURATIONS.api) {
          return cached;
        }
      }
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ error: 'offline', message: 'You are offline' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleStaticRequest(request: Request): Promise<Response> {
  // Cache first for static assets
  const cached = await caches.match(request);
  if (cached) {
    // Refresh cache in background
    refreshCache(request, STATIC_CACHE);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Asset not available offline', { status: 404 });
  }
}

async function handleNavigationRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Cache the page for offline use
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to return cached page
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

async function handleDynamicRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// ==================== BACKGROUND SYNC ====================

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  console.log('[SW] Background sync:', syncEvent.tag);
  
  if (syncEvent.tag === 'sync-data') {
    syncEvent.waitUntil(syncPendingData());
  }
  
  if (syncEvent.tag === 'sync-analytics') {
    syncEvent.waitUntil(syncAnalytics());
  }
});

async function syncPendingData(): Promise<void> {
  const pendingRequests = await getPendingRequests();
  
  for (const request of pendingRequests) {
    try {
      await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      await removePendingRequest(request.id);
    } catch (error) {
      console.log('[SW] Failed to sync:', error);
    }
  }
}

async function syncAnalytics(): Promise<void> {
  const analytics = await getStoredAnalytics();
  
  if (analytics.length > 0) {
    try {
      await fetch('/api/v1/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: analytics }),
      });
      
      await clearStoredAnalytics();
    } catch (error) {
      console.log('[SW] Failed to sync analytics:', error);
    }
  }
}

// ==================== PUSH NOTIFICATIONS ====================

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  const data = event.data?.json() || {
    title: 'Real-Time Pulse',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
  };
  
  const options: ExtendedNotificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if open
        for (const client of clients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// ==================== MESSAGE HANDLING ====================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      cacheUrls(payload.urls, payload.cacheName || DYNAMIC_CACHE);
      break;
      
    case 'CLEAR_CACHE':
      clearCache(payload.cacheName);
      break;
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
  }
});

// ==================== HELPER FUNCTIONS ====================

function isStaticAsset(pathname: string): boolean {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.ico'];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

async function refreshCache(request: Request, cacheName: string): Promise<void> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response);
    }
  } catch (error) {
    // Ignore errors during background refresh
  }
}

async function cacheUrls(urls: string[], cacheName: string): Promise<void> {
  const cache = await caches.open(cacheName);
  await cache.addAll(urls);
}

async function clearCache(cacheName?: string): Promise<void> {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

async function getCacheSize(): Promise<number> {
  let totalSize = 0;
  
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

// IndexedDB helpers for pending requests
async function getPendingRequests(): Promise<any[]> {
  // Implementation would use IndexedDB
  return [];
}

async function removePendingRequest(id: string): Promise<void> {
  // Implementation would use IndexedDB
}

async function getStoredAnalytics(): Promise<any[]> {
  // Implementation would use IndexedDB
  return [];
}

async function clearStoredAnalytics(): Promise<void> {
  // Implementation would use IndexedDB
}

export {};
