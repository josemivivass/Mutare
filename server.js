'use strict';

// PDF Converter: servidor de archivos estáticos sin dependencias (solo Node).
// Arranque: node server.js   →   http://localhost:9996
// Variables de entorno opcionales: PORT, HOST
//
// Los PDF NUNCA llegan aquí: todo se procesa en el navegador. Este servidor
// solo entrega la página y las librerías, y no acepta subidas (solo GET/HEAD).
// La cabecera Content-Security-Policy impide además que la página se conecte
// a cualquier otro sitio, así que los archivos no pueden salir del dispositivo.
//
// Pensado para gastar lo mínimo: sin estado, sin base de datos, archivos
// leídos de disco y la versión comprimida de los de texto guardada en memoria
// la primera vez que se pide (unos pocos MB en total).

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 9996;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.pfb': 'application/octet-stream',
  '.bcmap': 'application/octet-stream',
  '.icc': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
// Se comprimen al vuelo (y se guardan comprimidos en memoria) solo estos
const COMPRIMIBLES = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.ttf', '.pfb', '.wasm', '.txt']);

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const CABECERAS_COMUNES = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Caché de respuestas comprimidas: ruta -> { etag, gz }
const comprimidos = new Map();

function etagDe(st) { return `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`; }

// Las librerías llevan la versión en la ruta y los iconos/fuentes no cambian:
// se pueden guardar en caché un año. La app en sí se revalida siempre (ETag).
function cacheControl(rel) {
  if (rel.startsWith('/vendor/') || rel.startsWith('/fuentes/') || rel.startsWith('/iconos/')) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

function responder(res, codigo, texto) {
  res.writeHead(codigo, { 'Content-Type': 'text/plain; charset=utf-8', ...CABECERAS_COMUNES });
  res.end(texto);
}

const servidor = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return responder(res, 405, 'Solo lectura: aquí no se suben archivos');
  }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { return responder(res, 400, 'Ruta no válida'); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return responder(res, 403, 'Prohibido');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return responder(res, 404, 'No encontrado');
    const ext = path.extname(file).toLowerCase();
    const etag = etagDe(st);
    const cab = {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl(rel),
      ETag: etag,
      ...CABECERAS_COMUNES,
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, cab); return res.end(); }

    const aceptaGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (COMPRIMIBLES.has(ext) && aceptaGzip && st.size > 1024) {
      cab['Content-Encoding'] = 'gzip';
      cab.Vary = 'Accept-Encoding';
      const enCache = comprimidos.get(file);
      if (enCache && enCache.etag === etag) {
        res.writeHead(200, { ...cab, 'Content-Length': enCache.gz.length });
        return res.end(req.method === 'HEAD' ? undefined : enCache.gz);
      }
      return fs.readFile(file, (e2, buf) => {
        if (e2) return responder(res, 500, 'Error al leer');
        zlib.gzip(buf, { level: 9 }, (e3, gz) => {
          if (e3) return responder(res, 500, 'Error al comprimir');
          comprimidos.set(file, { etag, gz });
          res.writeHead(200, { ...cab, 'Content-Length': gz.length });
          res.end(req.method === 'HEAD' ? undefined : gz);
        });
      });
    }

    res.writeHead(200, { ...cab, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

servidor.keepAliveTimeout = 5000;
servidor.listen(PORT, HOST, () => {
  console.log(`PDF Converter en http://localhost:${PORT}  (los PDF se procesan en el navegador; aquí no llega ninguno)`);
});

for (const senal of ['SIGTERM', 'SIGINT']) process.on(senal, () => servidor.close(() => process.exit(0)));
