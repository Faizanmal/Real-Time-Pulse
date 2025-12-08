/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface SyncEvent extends Event {
  tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

interface PeriodicSyncEvent extends Event {
  tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

const STATIC_CACHE = 'rtpulse-static-v2';
const DYNAMIC_CACHE = 'rtpulse-dynamic-v2';
const API_CACHE = 'rtpulse-api-v2';
const PENDING_SYNC = 'rtpulse-pending-sync';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/portals',
  '/api/widgets',
  '/api/insights',
  '/api/dashboards',
  '/api/alerts',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.error('[ServiceWorker] Failed to cache assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => 
            name !== STATIC_CACHE && 
            name !== DYNAMIC_CACHE && 
            name !== API_CACHE && 
            name !== PENDING_SYNC
          )
          .map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
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

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets - Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Pages and other requests - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Check if request is for static asset
function isStaticAsset(pathname: string): boolean {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname);
}

// Cache-first strategy
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Cache-first fetch failed:', error);
    return new Response('Network error', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(() => {
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/offline.html');
      }
      return null;
    });

  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options: NotificationOptions = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: data.url || '/',
    },
    tag: data.tag || 'default',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Real-Time Pulse', options));
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});


async function syncPendingActions(): Promise<void> {
  const cache = await caches.open(PENDING_SYNC);
  const requests = await cache.keys();

  for (const request of requests) {
    try {
      const response = await fetch(request.clone());
      if (response.ok) {
        await cache.delete(request);
        console.log('[ServiceWorker] Synced pending action:', request.url);
        
        // Notify all clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            url: request.url,
          });
        });
      }
    } catch (error) {
      console.error('[ServiceWorker] Failed to sync action:', error);
    }
  }
}

async function syncDashboards(): Promise<void> {
  const cache = await caches.open(PENDING_SYNC);
  const requests = await cache.keys();

  for (const request of requests) {
    if (request.url.includes('/dashboards')) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const data = await cachedResponse.json();
          
          // Send the pending data to the server
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: JSON.stringify(data),
          });

          if (response.ok) {
            await cache.delete(request);
            console.log('[ServiceWorker] Dashboard synced:', request.url);
          }
        }
      } catch (error) {
        console.error('[ServiceWorker] Dashboard sync failed:', error);
      }
    }
  }
}

async function syncAlerts(): Promise<void> {
  const cache = await caches.open(PENDING_SYNC);
  const requests = await cache.keys();

  for (const request of requests) {
    if (request.url.includes('/alerts')) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const data = await cachedResponse.json();
          
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: JSON.stringify(data),
          });

          if (response.ok) {
            await cache.delete(request);
            console.log('[ServiceWorker] Alert synced:', request.url);
          }
        }
      } catch (error) {
        console.error('[ServiceWorker] Alert sync failed:', error);
      }
    }
  }
} 

interface PeriodicSyncEvent extends Event {
  tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

// Periodic background sync
// Periodic background sync

async function updateCachedData(): Promise<void> {
  const apiCache = await caches.open(API_CACHE);

  for (const route of API_ROUTES) {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await apiCache.put(route, response);
        console.log('[ServiceWorker] Updated cached data for:', route);
      }
    } catch (error) {
      console.error('[ServiceWorker] Failed to update cache:', error);
    }
  }
}

export {};
