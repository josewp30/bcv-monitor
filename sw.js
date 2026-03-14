// ─── VERSIÓN ────────────────────────────────────────────────────────────────
// Cambia este número cada vez que subas cambios a GitHub.
// Eso es todo lo que necesitas hacer para que los usuarios vean la notificación.
const VERSION = '1.0.0';
const CACHE_NAME = `bcv-monitor-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
// Precachea todos los assets pero NO activa el SW todavía.
// El SW nuevo espera en "waiting" hasta que el usuario acepte.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  // NO llamamos skipWaiting() aquí — esperamos confirmación del usuario
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Cuando el usuario acepta, borra cachés viejas y toma control.
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
  const url = new URL(e.request.url);

  // Network-first para llamadas a la API de tasas
  if (url.hostname.includes('dolarapi.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para assets estáticos
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }))
  );
});

// ─── MENSAJE DESDE LA APP ────────────────────────────────────────────────────
// Cuando el usuario toca "Actualizar", la app envía SKIP_WAITING
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
