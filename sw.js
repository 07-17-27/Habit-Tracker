/* ============================================================
   HABIT TRACKER — sw.js (Service Worker)
   Fixed for GitHub Pages + proper caching
============================================================ */

const CACHE_NAME = 'habit-tracker-v3';

/** All files to pre-cache on install */
const ASSETS_TO_CACHE = [
  '/Habit-Tracker/',
  '/Habit-Tracker/index.html',
  '/Habit-Tracker/style.css',
  '/Habit-Tracker/app.js',
  '/Habit-Tracker/manifest.json',
  '/Habit-Tracker/icons/icon-192.png',
  '/Habit-Tracker/icons/icon-512.png',
];

/* ── Install ───────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch ────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {

      // ✅ If found in cache → return immediately
      if (cachedResponse) {
        return cachedResponse;
      }

      // ✅ Else fetch from network
      return fetch(event.request)
        .then(networkResponse => {

          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Clone and store in cache
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {
          // ✅ IMPORTANT FIX (correct fallback path)
          return caches.match('/Habit-Tracker/index.html');
        });
    })
  );
});