// Motor: todas las operaciones con PDF. Trabajan con bytes (Uint8Array) en el
// propio navegador; nada se envía a ningún sitio.
//
// - pdf-lib crea y modifica documentos (juntar, separar, rotar, numerar…).
// - pdf.js los lee y los dibuja (miniaturas, PDF a imagen, texto, comprimir).
// Las dos se cargan solo cuando una herramienta las necesita.

const PDFJS = '/vendor/pdfjs-6.2.108/';
const PDFLIB = '/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';

let _pdfLib, _pdfjs;
export function pdfLib() { return (_pdfLib ||= import(PDFLIB)); }
export function pdfjs() {
  return (_pdfjs ||= import(PDFJS + 'pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
    return m;
  }));
}

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

export const esPdf = (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

// Para dibujar (pdf.js). Se le pasa una copia: pdf.js se queda con el buffer.
export async function abrirVista(bytes) {
  const lib = await pdfjs();
  const tarea = lib.getDocument({
    data: bytes.slice(),
    wasmUrl: PDFJS + 'wasm/',
    standardFontDataUrl: PDFJS + 'standard_fonts/',
    cMapUrl: PDFJS + 'cmaps/',
    cMapPacked: true,
    iccUrl: PDFJS + 'iccs/',
    enableXfa: false,
  });
  const doc = await tarea.promise;
  // En pdf.js 6 se libera desde la tarea de carga (worker incluido)
  doc.destroy = () => tarea.destroy();
  return doc;
}

// Para modificar (pdf-lib), con errores entendibles
export async function cargar(bytes, nombre = 'El PDF') {
  const { PDFDocument } = await pdfLib();
  if (!esPdf(bytes)) throw new Error(`${nombre} no es un PDF`);
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(e.message)) throw new Error(`${nombre} está protegido con contraseña y no se puede modificar`);
    throw new Error(`No se pudo leer ${nombre}: ${e.message}`);
  }
}

async function nuevo() {
  const { PDFDocument } = await pdfLib();
  return PDFDocument.create({ updateMetadata: false });
}

const guardar = (doc) => doc.save({ useObjectStreams: true });

// ---------------------------------------------------------------------------
// Coordenadas «visuales»: lo que se ve en pantalla, aunque la página tenga
// una rotación guardada (/Rotate). Origen abajo a la izquierda, en puntos.
// Así el número de página, la marca de agua o la firma salen derechos.
// ---------------------------------------------------------------------------

export function cajaVisual(page) {
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const { x, y, width, height } = page.getCropBox();
  return { r, x, y, width, height, vw: r % 180 ? height : width, vh: r % 180 ? width : height };
}
function aPagina(c, vx, vy) {
  switch (c.r) {
    case 90: return { x: c.x + c.width - vy, y: c.y + vx };
    case 180: return { x: c.x + c.width - vx, y: c.y + c.height - vy };
    case 270: return { x: c.x + vy, y: c.y + c.height - vx };
    default: return { x: c.x + vx, y: c.y + vy };
  }
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

export function tipoImagen(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  return null;
}

// Orientación EXIF de un JPEG (las fotos del móvil suelen venir «tumbadas»)
function orientacionJpeg(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return 1;
    const marca = b[i + 1], largo = v.getUint16(i + 2);
    if (marca === 0xe1 && v.getUint32(i + 4) === 0x45786966) { // «Exif»
      const t = i + 10, le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le), n = v.getUint16(ifd, le);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
      }
      return 1;
    }
    if (marca === 0xda) return 1;
    i += 2 + largo;
  }
  return 1;
}

// Vuelve a codificar con el navegador (aplica la orientación EXIF y vale para
// WebP, GIF, BMP…). Si la imagen tiene transparencia sale PNG; si no, JPEG.
async function recodificar(bytes, mime) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime || '' }), { imageOrientation: 'from-image' });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0); bmp.close();
  let transparente = false;
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let k = 3; k < px.length; k += 64) if (px[k] < 255) { transparente = true; break; }
  const blob = await new Promise((r) => c.toBlob(r, transparente ? 'image/png' : 'image/jpeg', 0.92));
  c.width = c.height = 0;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo: transparente ? 'png' : 'jpg' };
}

export async function incrustarImagen(doc, bytes, mime) {
  let tipo = tipoImagen(bytes);
  if (tipo === 'jpg' && orientacionJpeg(bytes) > 1) tipo = null;
  if (!tipo) ({ bytes, tipo } = await recodificar(bytes, mime));
  try { return tipo === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); }
  catch (_) { ({ bytes, tipo } = await recodificar(bytes, mime)); return tipo === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes); }
}

export const TAMANOS = { a4: [595.28, 841.89], carta: [612, 792] };

// Coloca una imagen en una página nueva: «ajustar» = la página mide lo que la
// imagen; A4/carta = la imagen centrada dentro de los márgenes.
function paginaConImagen(doc, img, { tam = 'ajustar', orientacion = 'auto', margen = 0 } = {}) {
  if (tam === 'ajustar') {
    const p = doc.addPage([img.width * 0.75, img.height * 0.75]); // 96 ppp → puntos
    p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
    return;
  }
  let [w, h] = TAMANOS[tam];
  const horizontal = orientacion === 'horizontal' || (orientacion === 'auto' && img.width > img.height);
  if (horizontal) [w, h] = [h, w];
  const p = doc.addPage([w, h]);
  const aw = w - 2 * margen, ah = h - 2 * margen;
  const k = Math.min(aw / img.width, ah / img.height);
  const iw = img.width * k, ih = img.height * k;
  p.drawImage(img, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

// Juntar PDFs (e imágenes) en el orden dado. items: [{ bytes, nombre, mime }]
export async function juntar(items, progreso = () => {}) {
  const doc = await nuevo();
  for (const [i, it] of items.entries()) {
    progreso(`Añadiendo ${i + 1} de ${items.length}: ${it.nombre}`);
    if (esPdf(it.bytes)) {
      const src = await cargar(it.bytes, it.nombre);
      for (const p of await doc.copyPages(src, src.getPageIndices())) doc.addPage(p);
    } else {
      paginaConImagen(doc, await incrustarImagen(doc, it.bytes, it.mime), { tam: 'a4', margen: 0 });
    }
  }
  progreso('Guardando…');
  return guardar(doc);
}

// Compone un documento página a página. fuentes: [Uint8Array] (PDF);
// paginas: [{ f: índice de fuente, i: índice de página, giro: 0|90|180|270 } | { blanca: [w, h] }]
export async function componer(fuentes, paginas, progreso = () => {}) {
  const { degrees } = await pdfLib();
  const doc = await nuevo();
  const cargados = new Map();
  for (const [k, p] of paginas.entries()) {
    if (k % 20 === 0) progreso(`Página ${k + 1} de ${paginas.length}`);
    if (p.blanca) { doc.addPage(p.blanca); continue; }
    if (!cargados.has(p.f)) cargados.set(p.f, await cargar(fuentes[p.f]));
    const [copia] = await doc.copyPages(cargados.get(p.f), [p.i]);
    if (p.giro) copia.setRotation(degrees((copia.getRotation().angle + p.giro) % 360));
    doc.addPage(copia);
  }
  progreso('Guardando…');
  return guardar(doc);
}

// Un PDF por cada grupo de índices
export async function separar(bytes, grupos, progreso = () => {}) {
  const src = await cargar(bytes);
  const salida = [];
  for (const [k, g] of grupos.entries()) {
    progreso(`Creando el archivo ${k + 1} de ${grupos.length}`);
    const doc = await nuevo();
    for (const p of await doc.copyPages(src, g)) doc.addPage(p);
    salida.push(await guardar(doc));
  }
  return salida;
}

export async function rotar(bytes, grados, indices = null) {
  const { degrees } = await pdfLib();
  const doc = await cargar(bytes);
  const paginas = doc.getPages();
  for (const i of indices || paginas.map((_, k) => k)) {
    const p = paginas[i];
    p.setRotation(degrees((((p.getRotation().angle + grados) % 360) + 360) % 360));
  }
  return guardar(doc);
}

export async function imagenesAPdf(items, opciones, progreso = () => {}) {
  const doc = await nuevo();
  for (const [i, it] of items.entries()) {
    progreso(`Imagen ${i + 1} de ${items.length}`);
    paginaConImagen(doc, await incrustarImagen(doc, it.bytes, it.mime), opciones);
  }
  progreso('Guardando…');
  return guardar(doc);
}

function colorHex(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Números de página. formato: «{n}», «{n} / {t}», «Página {n} de {t}»…
export async function numerar(bytes, o) {
  const { StandardFonts, rgb, degrees } = await pdfLib();
  const doc = await cargar(bytes);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const paginas = doc.getPages();
  const desdeIdx = o.saltarPrimera ? 1 : 0;
  const total = paginas.length - desdeIdx + (o.inicio - 1);
  const [cr, cg, cb] = colorHex(o.color || '#333333');
  paginas.forEach((page, k) => {
    if (k < desdeIdx) return;
    const n = k - desdeIdx + o.inicio;
    const texto = o.formato.replace('{n}', n).replace('{t}', total);
    const c = cajaVisual(page);
    const ancho = fuente.widthOfTextAtSize(texto, o.tamano);
    const m = o.margen;
    const [vert, hor] = o.posicion.split('-');
    const vx = hor === 'izquierda' ? m : hor === 'derecha' ? c.vw - m - ancho : (c.vw - ancho) / 2;
    const vy = vert === 'arriba' ? c.vh - m - o.tamano * 0.72 : m;
    const { x, y } = aPagina(c, vx, vy);
    page.drawText(texto, { x, y, size: o.tamano, font: fuente, color: rgb(cr, cg, cb), rotate: degrees(c.r) });
  });
  return guardar(doc);
}

// Marca de agua de texto: en el centro o repetida en mosaico
export async function marcaAgua(bytes, o) {
  const { StandardFonts, rgb, degrees } = await pdfLib();
  const doc = await cargar(bytes);
  const fuente = await doc.embedFont(o.negrita ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
  const [cr, cg, cb] = colorHex(o.color);
  const th = (o.angulo * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const ancho = fuente.widthOfTextAtSize(o.texto, o.tamano), alto = o.tamano * 0.7;
  for (const page of doc.getPages()) {
    const c = cajaVisual(page);
    const centros = [];
    if (o.modo === 'mosaico') {
      const paso = Math.max(ancho, alto) * 0.9 + o.tamano * 2;
      for (let cy = paso / 2; cy < c.vh + paso; cy += paso * 0.75) for (let cx = paso / 2; cx < c.vw + paso; cx += paso) centros.push([cx, cy]);
    } else centros.push([c.vw / 2, c.vh / 2]);
    for (const [cx, cy] of centros) {
      // Ancla del texto para que su centro quede en (cx, cy) una vez girado
      const vx = cx - (cos * ancho / 2 - sin * alto / 2), vy = cy - (sin * ancho / 2 + cos * alto / 2);
      const { x, y } = aPagina(c, vx, vy);
      page.drawText(o.texto, { x, y, size: o.tamano, font: fuente, color: rgb(cr, cg, cb), opacity: o.opacidad, rotate: degrees(c.r + o.angulo) });
    }
  }
  return guardar(doc);
}

// Firma (o cualquier imagen) en una página. rect: fracciones de la página tal
// como se ve, con origen arriba a la izquierda: { fx, fy, fw, fh }
export async function estampar(bytes, imagenPng, indice, rect, todas = false) {
  const { degrees } = await pdfLib();
  const doc = await cargar(bytes);
  const img = await doc.embedPng(imagenPng);
  const paginas = doc.getPages();
  for (const [k, page] of paginas.entries()) {
    if (!todas && k !== indice) continue;
    const c = cajaVisual(page);
    const w = rect.fw * c.vw, h = rect.fh * c.vh;
    const { x, y } = aPagina(c, rect.fx * c.vw, c.vh - (rect.fy + rect.fh) * c.vh);
    page.drawImage(img, { x, y, width: w, height: h, rotate: degrees(c.r) });
  }
  return guardar(doc);
}

const CAMPOS_META = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'];
export async function leerMetadatos(bytes) {
  const doc = await cargar(bytes);
  return {
    titulo: doc.getTitle() || '', autor: doc.getAuthor() || '', asunto: doc.getSubject() || '',
    palabras: doc.getKeywords() || '', creador: doc.getCreator() || '', productor: doc.getProducer() || '',
    creado: doc.getCreationDate() || null, modificado: doc.getModificationDate() || null, paginas: doc.getPageCount(),
  };
}
export async function escribirMetadatos(bytes, m, limpiar = false) {
  const { PDFName } = await pdfLib();
  const doc = await cargar(bytes);
  if (limpiar) {
    const info = doc.getInfoDict();
    for (const k of [...CAMPOS_META, 'CreationDate', 'ModDate']) info.delete(PDFName.of(k));
    doc.catalog.delete(PDFName.of('Metadata')); // XMP
    return guardar(doc);
  }
  const poner = (k, v, fn) => { if (v) fn(v); else doc.getInfoDict().delete(PDFName.of(k)); };
  poner('Title', m.titulo, (v) => doc.setTitle(v));
  poner('Author', m.autor, (v) => doc.setAuthor(v));
  poner('Subject', m.asunto, (v) => doc.setSubject(v));
  poner('Keywords', m.palabras, (v) => doc.setKeywords(v.split(/\s*[,;]\s*/).filter(Boolean)));
  poner('Creator', m.creador, (v) => doc.setCreator(v));
  poner('Producer', m.productor, (v) => doc.setProducer(v));
  doc.setModificationDate(new Date());
  return guardar(doc);
}

// Compresión sin pérdida: reescribe el archivo con «object streams».
export async function optimizar(bytes, quitarMeta) {
  return quitarMeta ? escribirMetadatos(bytes, null, true) : guardar(await cargar(bytes));
}

// ---------------------------------------------------------------------------
// Con pdf.js (dibujar páginas)
// ---------------------------------------------------------------------------

export async function dibujar(pagina, escala, canvas = document.createElement('canvas')) {
  const vp = pagina.getViewport({ scale: escala });
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
  return canvas;
}
const aBlob = (canvas, tipo, calidad) => new Promise((r) => canvas.toBlob(r, tipo, calidad));

// Cada página a PNG o JPG
export async function aImagenes(bytes, { formato, ppp, indices, nombre, calidad = 0.9 }, progreso = () => {}) {
  const vista = await abrirVista(bytes);
  const salida = [];
  try {
    const lista = indices || [...Array(vista.numPages).keys()];
    const ancho = String(vista.numPages).length;
    for (const [k, i] of lista.entries()) {
      progreso(`Página ${k + 1} de ${lista.length}`);
      const pag = await vista.getPage(i + 1);
      const c = await dibujar(pag, ppp / 72);
      const blob = await aBlob(c, formato === 'png' ? 'image/png' : 'image/jpeg', calidad);
      c.width = c.height = 0; pag.cleanup();
      salida.push({ nombre: `${nombre}-${String(i + 1).padStart(ancho, '0')}.${formato}`, datos: new Uint8Array(await blob.arrayBuffer()) });
    }
  } finally { vista.destroy(); }
  return salida;
}

// Compresión fuerte: cada página se convierte en una imagen JPEG. Reduce mucho
// los escaneos y documentos con fotos, pero el texto deja de ser seleccionable.
export async function rasterizar(bytes, { ppp, calidad, gris, limite = Infinity }, progreso = () => {}) {
  const vista = await abrirVista(bytes);
  const doc = await nuevo();
  try {
    for (let i = 1; i <= Math.min(vista.numPages, limite); i++) {
      progreso(`Página ${i} de ${vista.numPages}`);
      const pag = await vista.getPage(i);
      const tam = pag.getViewport({ scale: 1 });
      const c = await dibujar(pag, ppp / 72);
      if (gris) {
        const ctx = c.getContext('2d');
        ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
      }
      const blob = await aBlob(c, 'image/jpeg', calidad);
      c.width = c.height = 0; pag.cleanup();
      const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      doc.addPage([tam.width, tam.height]).drawImage(img, { x: 0, y: 0, width: tam.width, height: tam.height });
    }
  } finally { vista.destroy(); }
  progreso('Guardando…');
  return guardar(doc);
}

export async function extraerTexto(bytes, progreso = () => {}) {
  const vista = await abrirVista(bytes);
  const trozos = [];
  try {
    for (let i = 1; i <= vista.numPages; i++) {
      progreso(`Página ${i} de ${vista.numPages}`);
      const pag = await vista.getPage(i);
      const tc = await pag.getTextContent();
      let linea = '';
      const lineas = [];
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        linea += it.str;
        if (it.hasEOL) { lineas.push(linea); linea = ''; }
      }
      if (linea) lineas.push(linea);
      trozos.push(`--- Página ${i} ---\n` + lineas.join('\n').replace(/[ \t]+\n/g, '\n').trim());
      pag.cleanup();
    }
  } finally { vista.destroy(); }
  return trozos.join('\n\n') + '\n';
}
