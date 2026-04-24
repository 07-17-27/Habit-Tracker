/* ============================================================
   HABIT TRACKER — sw.js (Service Worker)
   Handles caching so the app works fully offline.
   Strategy: Cache First — serve from cache, update in background.
============================================================ */

const CACHE_NAME    = 'habit-tracker-v1';
const CACHE_VERSION = 1;

/** All files to pre-cache on install */
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ── Install ──────────────────────────────────────────────────
   Fires once when the service worker is first installed.
   Pre-caches all core app assets so the app loads offline
   from the very first visit.
─────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Take control immediately without waiting for old SW to die
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────────────
   Fires after install. Cleans up old cache versions so stale
   assets don't linger after an app update.
─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Claim all open tabs immediately
  self.clients.claim();
});

/* ── Fetch ────────────────────────────────────────────────────
   Intercepts every network request.
   Strategy: Cache First with Network Fallback.
     1. Try to serve from cache (instant, works offline)
     2. If not in cache, fetch from network
     3. Cache the new network response for next time
─────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests — skip POST/PUT etc.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // ── Serve from cache if available ──
      if (cachedResponse) {
        return cachedResponse;
      }

      // ── Otherwise fetch from network ──
      return fetch(event.request)
        .then(networkResponse => {
          // Don't cache bad responses or non-basic (cross-origin) requests
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }

          // Clone the response — one copy for cache, one to return
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // If both cache and network fail, return the offline fallback
          return caches.match('/index.html');
        });
    })
  );
});