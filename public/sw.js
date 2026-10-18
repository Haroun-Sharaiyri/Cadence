/* Cadence PWA App Shell Service Worker */
const CACHE_NAME = 'cadence-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/apple-touch-icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/splash/splash-light-1260x2736.png',
  '/splash/splash-dark-1260x2736.png',
];

// Install: Precache application shell and hashed Vite JS/CSS assets from index.html
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(SHELL_ASSETS);
        try {
          const indexRes = (await cache.match('/index.html')) || (await fetch('/index.html'));
          if (indexRes && indexRes.ok) {
            const html = await indexRes.clone().text();
            const matches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
            const uniqueAssets = [...new Set(matches)];
            if (uniqueAssets.length > 0) {
              await cache.addAll(uniqueAssets);
            }
          }
        } catch (_err) {
          // Ignore asset precache errors in dev mode
        }
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Serve app shell offline; bypass Supabase cloud sync
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass third-party requests (e.g. Supabase REST & Auth)
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML SPA fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback to cached index.html
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Static Assets (Cache-first with network fallback)
  event.respondWith(
    caches
      .match(request)
      .then((res) => res || caches.match(url.pathname))
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch in background to revalidate cache
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(url.pathname, responseToCache);
          });
          return networkResponse;
        });
      })
  );
});
