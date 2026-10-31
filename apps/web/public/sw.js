/* global firebase */
// Firebase background messages share this worker with the existing offline cache worker.
// Handle notification clicks before loading the Firebase SDK so the custom action routing wins.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const destination = new URL(data.responsePath || '/', self.location.origin);
  if (event.action === 'accept') destination.searchParams.set('action', 'accepted');
  if (event.action === 'decline') destination.searchParams.set('action', 'declined');
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) await client.navigate(destination.href);
      await client.focus();
      return;
    }
    await self.clients.openWindow(destination.href);
  })());
});

// Native push event listener ensures system notifications always pop up on all platforms
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { data: { body: event.data.text() } };
    }
    const data = payload.data || {};
    const notif = payload.notification || {};
    const title = notif.title || data.title || 'RaktSetu Blood Alert';
    const body = notif.body || data.body || 'A nearby patient urgently needs your blood group.';
    const responsePath = data.responsePath || notif.data?.responsePath || '/';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: data.icon || notif.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data.tag || notif.tag || `raktsetu-${data.requestId || 'alert'}`,
        requireInteraction: true,
        data: { responsePath },
        actions: data.language === 'hi'
          ? [
              { action: 'accept', title: 'मैं उपलब्ध हूँ' },
              { action: 'decline', title: 'अभी उपलब्ध नहीं' },
            ]
          : [
              { action: 'accept', title: "I'm available" },
              { action: 'decline', title: 'Not available' },
            ],
      })
    );
  } catch (err) {
    console.warn('[SW] Native push event handler error:', err);
  }
});

try {
  importScripts('/firebase-config.js');
  if (self.__RAKTSETU_FIREBASE_CONFIG__?.apiKey) {
    importScripts(
      'https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js'
    );
    firebase.initializeApp(self.__RAKTSETU_FIREBASE_CONFIG__);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      self.registration.showNotification(data.title || 'RaktSetu', {
        body: data.body || 'A nearby patient may need your help.',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data.tag || `raktsetu-${data.requestId || 'alert'}`,
        requireInteraction: true,
        data: { responsePath: data.responsePath || '/' },
        actions: data.language === 'hi'
          ? [
              { action: 'accept', title: 'मैं उपलब्ध हूँ' },
              { action: 'decline', title: 'अभी उपलब्ध नहीं' },
            ]
          : [
              { action: 'accept', title: "I'm available" },
              { action: 'decline', title: 'Not available' },
            ],
      });
    });
  }
} catch (error) {
  // FCM is optional for the offline app shell; never fail SW installation because of it.
  console.warn('[SW] Firebase messaging could not be initialized:', error);
}

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
