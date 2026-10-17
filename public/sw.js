/* DealFlow service worker — installability only. Caches NOTHING except
   immutable versioned static assets; API responses and pages always hit
   the network, so money data can never go stale. */
const CACHE = 'dealflow-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/_next/static/')) return; // pages + API: network only
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
      )
    )
  );
});
