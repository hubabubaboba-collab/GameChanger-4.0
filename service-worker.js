// ============================================
// GAMECHANGER SERVICE WORKER
// ============================================

const CACHE_NAME = 'gamechanger-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// === NEW: Push notification support ===
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Напоминание о задаче',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'task-reminder',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'dismiss',
        title: 'Закрыть'
      }
    ],
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '⏰ GameChanger', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'open' || !action) {
    event.waitUntil(
      clients.openWindow('./index.html')
    );
  }
});
// === END: Push notification support ===

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached response and update cache in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || !networkResponse.ok) {
              return networkResponse;
            }
            
            // Cache the response
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // Network failed, try to return offline fallback
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Sync any pending data when connection is restored
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

// Message handler from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // === NEW: Handle notification scheduling ===
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, tag } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag,
        requireInteraction: true
      });
    }, delay);
  }
  // === END: Handle notification scheduling ===
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-tasks') {
    event.waitUntil(checkUpcomingTasks());
  }
});

async function checkUpcomingTasks() {
  // This would check for upcoming tasks and show notifications
  // Implementation depends on how tasks are stored
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'CHECK_TASKS' });
  });
}
