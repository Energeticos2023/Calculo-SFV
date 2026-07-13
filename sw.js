const CACHE = 'energeticos-solar-v2.0.0';
const CORE = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './assets/logo.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];
const GALLERY = Array.from({length:18},(_,i)=>`./assets/gallery/obra-${String(i+1).padStart(2,'0')}.webp`);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...CORE, ...GALLERY])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
