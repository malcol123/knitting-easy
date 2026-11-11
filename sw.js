// Service worker: rende l'app disponibile senza connessione.
// Quando modifichi i file dell'app, aumenta VERSION per distribuire l'aggiornamento.
const VERSION = 'v1.1.0';
const CACHE = 'contagiri-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/model.js',
  './js/schema.js',
  './js/store.js',
  './js/ui.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('contagiri-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Pagine: sempre l'app (funziona offline)
    if (req.mode === 'navigate') {
      const cached = await cache.match('./index.html');
      if (cached) return cached;
      return fetch(req);
    }
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
