// Motor de imágenes: abrir casi cualquier formato, cambiar tamaño, guardar en
// otro formato y quitar datos ocultos (GPS, cámara…). Todo en el navegador.
//
// - PNG, JPG, WebP, GIF, BMP, ICO, AVIF y SVG los abre el propio navegador.
// - HEIC/HEIF (iPhone): el navegador si sabe (Safari) y si no, heic2any.
// - TIFF: ffmpeg (solo si hace falta).
// - Para guardar: PNG/JPG/WebP con el navegador; BMP e ICO, aquí mismo;
//   GIF y TIFF, con ffmpeg.

import { aislado } from './aislado-cliente.js';

export const FORMATOS = {
  jpg: { nombre: 'JPG', mime: 'image/jpeg', ext: 'jpg', calidad: true, alfa: false },
  png: { nombre: 'PNG', mime: 'image/png', ext: 'png', alfa: true },
  webp: { nombre: 'WebP', mime: 'image/webp', ext: 'webp', calidad: true, alfa: true },
  gif: { nombre: 'GIF', mime: 'image/gif', ext: 'gif', alfa: true },
  bmp: { nombre: 'BMP', mime: 'image/bmp', ext: 'bmp', alfa: false },
  ico: { nombre: 'ICO (icono)', mime: 'image/x-icon', ext: 'ico', alfa: true },
  tiff: { nombre: 'TIFF', mime: 'image/tiff', ext: 'tiff', alfa: true },
};
export const ACEPTA_IMAGEN = 'image/*,.heic,.heif,.tif,.tiff,.avif,.ico,.bmp,.svg,.jfif';

const ext = (n) => (n.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
export const formatoDe = (it) => {
  const e = ext(it.nombre);
  if (e === 'jpeg' || e === 'jfif') return 'jpg';
  if (e === 'tif') return 'tiff';
  if (e === 'heif') return 'heic';
  return e;
};

// ---------------------------------------------------------------------------
// Abrir: devuelve un canvas con la imagen ya bien orientada
// ---------------------------------------------------------------------------
function aCanvas(fuente, ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  c.getContext('2d').drawImage(fuente, 0, 0, ancho, alto);
  return c;
}

async function porImg(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { w = 1024; h = 1024; } // SVG sin tamaño
    return aCanvas(img, w, h);
  } finally { URL.revokeObjectURL(url); }
}

export async function abrir(it) {
  const f = formatoDe(it);
  const blob = new Blob([it.bytes], { type: it.mime || '' });
  if (f === 'svg') return porImg(new Blob([it.bytes], { type: 'image/svg+xml' }));
  if (f === 'heic') {
    try { const b = await createImageBitmap(blob); return aCanvas(b, b.width, b.height); } catch {}
    const png = await aislado('heic', { bytes: it.bytes, tipo: 'image/png', calidad: 1 });
    const b = await createImageBitmap(new Blob([png], { type: 'image/png' }));
    return aCanvas(b, b.width, b.height);
  }
  if (f === 'tiff') {
    try { const b = await createImageBitmap(blob); return aCanvas(b, b.width, b.height); } catch {}
    const { ejecutar } = await import('./motor-ffmpeg.js');
    const png = await ejecutar({ entradas: [{ nombre: 'e.tiff', bytes: it.bytes }], args: ['-i', 'e.tiff', '-frames:v', '1'], salida: 's.png' });
    const b = await createImageBitmap(new Blob([png], { type: 'image/png' }));
    return aCanvas(b, b.width, b.height);
  }
  try {
    const b = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const c = aCanvas(b, b.width, b.height); b.close?.();
    return c;
  } catch {
    try { return await porImg(blob); } catch {}
    throw new Error(`No se pudo abrir «${it.nombre}»: el formato no es compatible con este navegador`);
  }
}

// ---------------------------------------------------------------------------
// Cambiar tamaño. modo: 'porcentaje' (valor) | 'maximo' (ancho/alto como tope) | 'exacto'
// ---------------------------------------------------------------------------
export function medidas(w, h, { modo, porcentaje = 100, ancho, alto, ampliar = false }) {
  if (modo === 'porcentaje') return [Math.max(1, Math.round(w * porcentaje / 100)), Math.max(1, Math.round(h * porcentaje / 100))];
  if (modo === 'exacto') return [ancho || Math.round(w * (alto / h)), alto || Math.round(h * (ancho / w))];
  let f = Math.min(ancho ? ancho / w : Infinity, alto ? alto / h : Infinity);
  if (!isFinite(f) || (!ampliar && f > 1)) f = 1;
  return [Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f))];
}

export function escalar(canvas, ancho, alto) {
  if (ancho === canvas.width && alto === canvas.height) return canvas;
  let actual = canvas;
  // Reducir a mitades da mucha más calidad que de golpe
  while (actual.width / 2 >= ancho && actual.height / 2 >= alto) {
    actual = aCanvasSuave(actual, Math.round(actual.width / 2), Math.round(actual.height / 2));
  }
  return aCanvasSuave(actual, ancho, alto);
}
function aCanvasSuave(fuente, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fuente, 0, 0, w, h);
  return c;
}

export function girar(canvas, grados, voltearH = false, voltearV = false) {
  const g = ((grados % 360) + 360) % 360;
  const c = document.createElement('canvas');
  c.width = g % 180 ? canvas.height : canvas.width;
  c.height = g % 180 ? canvas.width : canvas.height;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((g * Math.PI) / 180);
  ctx.scale(voltearH ? -1 : 1, voltearV ? -1 : 1);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

// ---------------------------------------------------------------------------
// Guardar en un formato
// ---------------------------------------------------------------------------
function conFondo(canvas, color) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

const aBlob = (canvas, mime, calidad) => new Promise((ok) => canvas.toBlob(ok, mime, calidad));

export async function guardar(canvas, formato, { calidad = 0.85, fondo = '#ffffff', tamanosIco = [16, 32, 48, 256] } = {}) {
  const F = FORMATOS[formato];
  if (!F.alfa) canvas = conFondo(canvas, fondo);
  if (formato === 'png' || formato === 'jpg' || formato === 'webp') {
    const b = await aBlob(canvas, F.mime, F.calidad ? calidad : undefined);
    if (!b || b.type !== F.mime) throw new Error(`Este navegador no sabe guardar en ${F.nombre}. Prueba con Chrome, Edge o Firefox.`);
    return new Uint8Array(await b.arrayBuffer());
  }
  if (formato === 'bmp') return bmp(canvas);
  if (formato === 'ico') return ico(canvas, tamanosIco);
  const { ejecutar } = await import('./motor-ffmpeg.js');
  const png = new Uint8Array(await (await aBlob(canvas, 'image/png')).arrayBuffer());
  if (formato === 'gif') {
    return ejecutar({ entradas: [{ nombre: 'e.png', bytes: png }], args: ['-i', 'e.png', '-filter_complex', 'split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=sierra2_4a'], salida: 's.gif' });
  }
  if (formato === 'tiff') return ejecutar({ entradas: [{ nombre: 'e.png', bytes: png }], args: ['-i', 'e.png', '-compression_algo', 'deflate'], salida: 's.tiff' });
  throw new Error('Formato desconocido');
}

// BMP de 24 bits (sin transparencia, el formato más compatible)
function bmp(canvas) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const fila = Math.ceil((w * 3) / 4) * 4;
  const out = new Uint8Array(54 + fila * h);
  const dv = new DataView(out.buffer);
  out[0] = 0x42; out[1] = 0x4d; dv.setUint32(2, out.length, true); dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, fila * h, true);
  dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
  for (let y = 0; y < h; y++) {
    let o = 54 + (h - 1 - y) * fila, i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) { out[o++] = px[i + 2]; out[o++] = px[i + 1]; out[o++] = px[i]; }
  }
  return out;
}

// ICO con varios tamaños (cada uno es un PNG, como hace Windows desde Vista)
async function ico(canvas, tamanos) {
  // Cuadrado: se centra la imagen sobre transparente
  const lado = Math.max(canvas.width, canvas.height);
  const cuadrado = document.createElement('canvas');
  cuadrado.width = cuadrado.height = lado;
  cuadrado.getContext('2d').drawImage(canvas, (lado - canvas.width) / 2, (lado - canvas.height) / 2);
  const pngs = [];
  for (const t of tamanos) {
    const b = await aBlob(escalar(cuadrado, t, t), 'image/png');
    pngs.push([t, new Uint8Array(await b.arrayBuffer())]);
  }
  const cab = 6 + 16 * pngs.length;
  const out = new Uint8Array(cab + pngs.reduce((s, [, p]) => s + p.length, 0));
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
  let desp = cab;
  pngs.forEach(([t, p], k) => {
    const o = 6 + 16 * k;
    out[o] = t >= 256 ? 0 : t; out[o + 1] = t >= 256 ? 0 : t;
    dv.setUint16(o + 4, 1, true); dv.setUint16(o + 6, 32, true);
    dv.setUint32(o + 8, p.length, true); dv.setUint32(o + 12, desp, true);
    out.set(p, desp); desp += p.length;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Datos ocultos (EXIF): leerlos y quitarlos
// ---------------------------------------------------------------------------
function leerTiff(t) {
  // t: bytes del bloque TIFF dentro de EXIF
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const le = dv.getUint16(0) === 0x4949;
  const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  const datos = {};
  const texto = (o, n) => new TextDecoder('latin1').decode(t.subarray(o, o + n)).replace(/\0+$/, '').trim();
  const ifd = (o, fn) => {
    if (o <= 0 || o + 2 > t.length) return;
    const n = u16(o);
    for (let k = 0; k < n; k++) {
      const e = o + 2 + k * 12;
      if (e + 12 > t.length) return;
      const tag = u16(e), tipo = u16(e + 2), cuenta = u32(e + 4);
      const valor = cuenta > 4 && tipo === 2 ? u32(e + 8) : e + 8;
      fn(tag, tipo, cuenta, valor, e);
    }
  };
  ifd(u32(4), (tag, tipo, cuenta, v, e) => {
    if (tag === 0x010f) datos.marca = texto(v, cuenta);
    if (tag === 0x0110) datos.modelo = texto(v, cuenta);
    if (tag === 0x0112) datos.orientacion = u16(e + 8);
    if (tag === 0x0131) datos.programa = texto(v, cuenta);
    if (tag === 0x013b) datos.autor = texto(v, cuenta);
    if (tag === 0x8825) datos.gps = true;
    if (tag === 0x8769) ifd(u32(e + 8), (tg, tp, c2, v2) => { if (tg === 0x9003) datos.fecha = texto(v2, c2); });
  });
  return datos;
}

// Qué datos ocultos lleva una imagen (solo JPG; en los demás formatos, si hay EXIF)
export function datosOcultos(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 4 < bytes.length && bytes[p] === 0xff) {
      const m = bytes[p + 1], n = (bytes[p + 2] << 8) | bytes[p + 3];
      if (m === 0xda) break;
      if (m === 0xe1 && String.fromCharCode(...bytes.subarray(p + 4, p + 8)) === 'Exif') {
        try { return { exif: true, ...leerTiff(bytes.subarray(p + 10, p + 2 + n)) }; } catch { return { exif: true }; }
      }
      p += 2 + n;
    }
    return { exif: false };
  }
  const t = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 200000)));
  return { exif: /eXIf|Exif\0\0|EXIF/.test(t), xmp: /x:xmpmeta|XML:com\.adobe\.xmp/.test(t) };
}

// JPG: quita EXIF, XMP, comentarios y miniaturas sin volver a comprimir (no
// pierde calidad). Si la foto dependía de la orientación EXIF, hay que girar
// los píxeles, y entonces sí se recomprime (a calidad muy alta).
export async function limpiarJpg(it) {
  const b = it.bytes;
  const ocultos = datosOcultos(b);
  if (ocultos.orientacion && ocultos.orientacion !== 1) {
    return guardar(await abrir(it), 'jpg', { calidad: 0.95 });
  }
  const partes = [b.subarray(0, 2)];
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1];
    if (m === 0xda) break; // empiezan los datos de la imagen
    const n = (b[p + 2] << 8) | b[p + 3];
    const quitar = (m >= 0xe1 && m <= 0xef && !(m === 0xe2 && String.fromCharCode(...b.subarray(p + 4, p + 15)) === 'ICC_PROFILE')) || m === 0xfe;
    if (!quitar) partes.push(b.subarray(p, p + 2 + n));
    p += 2 + n;
  }
  partes.push(b.subarray(p));
  return new Uint8Array(await new Blob(partes).arrayBuffer());
}

// PNG: quita los bloques de texto, EXIF y fecha (sin tocar la imagen)
export function limpiarPng(b) {
  const quitar = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  const partes = [b.subarray(0, 8)];
  let p = 8;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (p + 12 <= b.length) {
    const n = dv.getUint32(p), tipo = String.fromCharCode(...b.subarray(p + 4, p + 8));
    if (!quitar.has(tipo)) partes.push(b.subarray(p, p + 12 + n));
    p += 12 + n;
    if (tipo === 'IEND') break;
  }
  const out = new Uint8Array(partes.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of partes) { out.set(x, o); o += x.length; }
  return out;
}
