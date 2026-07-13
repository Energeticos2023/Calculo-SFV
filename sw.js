/* Service Worker — ENERGÉTICOS Solicitud Solar PWA */
const CACHE = 'energeticos-solicitud-v1';
const ASSETS = [
  'solicitud.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png'
];

// Instalación: precachear los recursos de la app
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

// Activación: limpiar cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: estrategia "cache first" con respaldo a red
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(resp => {
          // Guardar copias de recursos propios
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
