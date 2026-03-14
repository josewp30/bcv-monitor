// ─── VERSIÓN ────────────────────────────────────────────────────────────────
// Cambia este número cada vez que subas cambios a GitHub.
const VERSION = '1.0.3';
const CACHE_NAME = `bcv-monitor-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  // Primera instalación: activa de inmediato (sin SW anterior = no hay conflicto)
  // Actualizaciones: NO skip aquí — esperamos confirmación del usuario (ver mensaje SKIP_WAITING)
  if (!self.registration.active) {
    self.skipWaiting();
  }
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('bcv-monitor-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  // Solo manejar peticiones GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Network-first para la API de tasas
  if (url.hostname.includes('dolarapi.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para assets estáticos (fuentes externas: no cachear)
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }

  // Cache-first para archivos propios
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ─── MENSAJE DESDE LA APP ────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
