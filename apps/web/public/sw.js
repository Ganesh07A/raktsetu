// apps/web/public/sw.js
const STATIC_CACHE = 'raktkhoj-static-v1';
const RUNTIME_CACHE = 'raktkhoj-runtime-v1';

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        console.warn('[SW] Pre-caching encountered an error:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. Bypass real-time API and external notification services
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('facebook.com')
  ) {
    return;
  }

  // 2. Navigation requests: Network-First with /offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const offlinePage = await caches.match('/offline');
        if (offlinePage) return offlinePage;
        return new Response(
          '<html><body><h1>Offline</h1><p>You are offline. Please call National Blood Helpline: 104 or Ambulance: 108.</p></body></html>',
          {
            headers: { 'Content-Type': 'text/html' },
          }
        );
      })
    );
    return;
  }

  // 3. OpenStreetMap raster tiles: Cache-First with Stale-While-Revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkRes) => {
            if (networkRes.status === 200) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Static assets (images, fonts, CSS, JS chunks): Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkRes) => {
        if (
          networkRes.status === 200 &&
          (url.pathname.startsWith('/_next/static') ||
            url.pathname.startsWith('/icons') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.woff2'))
        ) {
          const resClone = networkRes.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, resClone));
        }
        return networkRes;
      });
    })
  );
});
