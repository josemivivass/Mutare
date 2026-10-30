'use strict';

// Service worker de Mutare: permite usar la app sin conexión.
// - La interfaz (HTML, CSS, JS) se pide primero a la red y, si no hay conexión,
//   se sirve la última copia guardada: así siempre ves la versión más reciente.
// - Las librerías, fuentes e iconos llevan la versión en la ruta y no cambian:
//   se sirven de la caché y solo se descargan la primera vez que hacen falta.
// Los PDF nunca pasan por aquí: se procesan en la página y no salen del navegador.

const CACHE = 'mutare-v1';
const INTERFAZ = [
  '/', '/index.html', '/styles.css', '/tema.js', '/app.js', '/herramientas.js', '/ui.js',
  '/motor.js', '/util.js', '/iconos.js', '/zip.js', '/manifest.webmanifest',
  '/iconos/icono.svg', '/iconos/icono-192.png', '/iconos/icono-512.png', '/iconos/apple-touch-icon.png',
];
const LIBRERIAS = [
  '/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js',
  '/vendor/pdfjs-6.2.108/pdf.min.mjs',
  '/vendor/pdfjs-6.2.108/pdf.worker.min.mjs',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...INTERFAZ, ...LIBRERIAS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Inmutables: caché primero
  if (/^\/(vendor|fuentes|iconos)\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const guardada = await c.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      const resp = await fetch(req);
      if (resp.ok) c.put(req, resp.clone());
      return resp;
    }));
    return;
  }

  // Interfaz: red primero, caché si no hay conexión
  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return resp;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('/') : Response.error())),
  );
});
