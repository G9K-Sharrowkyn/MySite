// Service Worker for PWA
// Bump this when caching rules change to force clients to drop stale cached entries.
const CACHE_NAME = 'fight-site-v4';
const urlsToCache = [
  '/',
  '/logo192.png',
  '/logo512.png',
  '/manifest.json',
  '/favicon.ico'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Add error handling for cache operations
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn('Failed to cache:', url, err);
              return null;
            })
          )
        );
      })
  );
});

// Fetch event - serve from cache if offline
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests
  if (!event.request.url.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Skip API, socket, and cross-origin requests
  if (requestUrl.origin !== self.location.origin) return;
  // Also skip backend-served static media (uploads) and large static libraries (characters).
  // These are already cached by the browser via HTTP cache headers, and we don't want SW
  // to accidentally pin an incorrect response (e.g. HTML during a server migration).
  if (
    requestUrl.pathname.startsWith('/api') ||
    requestUrl.pathname.startsWith('/socket.io') ||
    requestUrl.pathname.startsWith('/uploads') ||
    requestUrl.pathname.startsWith('/characters')
  ) {
    return;
  }

  // Always fetch latest HTML to prevent "reverting" to old UI after reload.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache))
            .catch((err) => console.warn('Failed to cache navigation response:', err));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match('/');
        })
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseToCache))
          .catch((err) => console.warn('Failed to cache response:', err));

        return response;
      });
    }).catch(() => caches.match('/'))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { body: event.data ? event.data.text() : 'New notification' };
  }

  const options = {
    body: payload.body || 'New notification from VersusVerseVault',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: payload.url || '/notifications'
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(payload.title || 'VersusVerseVault', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(event.notification?.data?.url || '/')
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

const doBackgroundSync = async () => {
  try {
    // Get stored offline actions
    const offlineActions = await getOfflineActions();
    
    // Process each action
    for (const action of offlineActions) {
      await processOfflineAction(action);
    }
    
    // Clear processed actions
    await clearOfflineActions();
  } catch (error) {
    console.error('Background sync failed:', error);
  }
};

const getOfflineActions = async () => {
  // Implementation for getting stored offline actions
  return [];
};

const processOfflineAction = async (action) => {
  // Implementation for processing offline actions
  console.log('Processing offline action:', action);
};

const clearOfflineActions = async () => {
  // Implementation for clearing processed actions
  console.log('Clearing offline actions');
}; 
