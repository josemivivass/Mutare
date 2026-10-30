// ZIP: crear (con o sin compresión) y leer. La compresión «deflate» la hace el
// propio navegador (CompressionStream), así que no hace falta ninguna librería.

const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(datos) {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function porFlujo(datos, flujo) {
  return new Uint8Array(await new Response(new Blob([datos]).stream().pipeThrough(flujo)).arrayBuffer());
}
const desinflar = (d) => porFlujo(d, new DecompressionStream('deflate-raw'));
const inflar = (d) => porFlujo(d, new CompressionStream('deflate-raw'));

function fechaDos(d = new Date()) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// Montaje común. entradas: [{ nombre, datos (ya comprimidos o no), crc, tam, metodo }]
function montar(entradas) {
  const enc = new TextEncoder();
  const { hora, fecha } = fechaDos();
  const partes = [], central = [];
  let desp = 0;
  const usados = new Set();
  for (const e of entradas) {
    // Nombres repetidos: «a.pdf», «a (2).pdf»…
    let nombre = e.nombre, k = 2;
    while (usados.has(nombre)) nombre = e.nombre.replace(/(\.[^./]+)?$/, ` (${k++})$1`);
    usados.add(nombre);
    const n = enc.encode(nombre);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
    loc.setUint16(8, e.metodo, true); loc.setUint16(10, hora, true); loc.setUint16(12, fecha, true);
    loc.setUint32(14, e.crc, true); loc.setUint32(18, e.datos.length, true); loc.setUint32(22, e.tam, true);
    loc.setUint16(26, n.length, true);
    partes.push(loc, n, e.datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, e.metodo, true); cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true);
    cen.setUint32(16, e.crc, true); cen.setUint32(20, e.datos.length, true); cen.setUint32(24, e.tam, true);
    cen.setUint16(28, n.length, true); cen.setUint32(42, desp, true);
    central.push(cen, n);
    desp += 30 + n.length + e.datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.byteLength, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desp, true);
  if (desp + tamCentral > 0xffffffff || entradas.length > 0xffff) throw new Error('El ZIP sería demasiado grande (más de 4 GB)');
  return new Blob([...partes, ...central, fin], { type: 'application/zip' });
}

// Sin comprimir (rápido): para entregar varios PDF o imágenes de una vez.
// archivos: [{ nombre, datos: Uint8Array }]  →  Blob
export function crearZip(archivos) {
  return montar(archivos.map((a) => ({ nombre: a.nombre, datos: a.datos, crc: crc32(a.datos), tam: a.datos.length, metodo: 0 })));
}

// Con compresión. Si un archivo no se reduce (JPG, MP4…) se guarda tal cual.
export async function crearZipComprimido(archivos, progreso = () => {}) {
  const entradas = [];
  for (const [i, a] of archivos.entries()) {
    progreso(`Comprimiendo ${i + 1} de ${archivos.length}…`);
    const c = await inflar(a.datos);
    const comp = c.length < a.datos.length;
    entradas.push({ nombre: a.nombre, datos: comp ? c : a.datos, crc: crc32(a.datos), tam: a.datos.length, metodo: comp ? 8 : 0 });
  }
  return montar(entradas);
}

// Lee el índice de un ZIP. Devuelve [{ nombre, carpeta, tam, tamComp, fecha, extraer() }]
export function leerZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('No es un ZIP o está dañado');
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  if (p === 0xffffffff || total === 0xffff) throw new Error('Este ZIP usa el formato de más de 4 GB (ZIP64), que no se puede abrir aquí');
  const utf8 = new TextDecoder(), antiguo = new TextDecoder('ibm866');
  const entradas = [];
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('El índice del ZIP está dañado');
    const flags = dv.getUint16(p + 8, true), metodo = dv.getUint16(p + 10, true);
    const t = dv.getUint16(p + 12, true), f = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), tamComp = dv.getUint32(p + 20, true), tam = dv.getUint32(p + 24, true);
    const ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
    const loc = dv.getUint32(p + 42, true);
    const crudo = bytes.subarray(p + 46, p + 46 + ln);
    const nombre = (flags & 0x800 ? utf8 : antiguo).decode(crudo).replace(/\\/g, '/');
    p += 46 + ln + lx + lc;
    if (nombre.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(nombre)) continue;
    entradas.push({
      nombre, carpeta: nombre.endsWith('/'), tam, tamComp, cifrado: !!(flags & 1),
      fecha: new Date(1980 + (f >> 9), ((f >> 5) & 15) - 1, f & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2),
      async extraer() {
        if (flags & 1) throw new Error(`«${nombre}» está protegido con contraseña`);
        const ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
        const datos = bytes.subarray(ini, ini + tamComp);
        let salida;
        if (metodo === 0) salida = datos;
        else if (metodo === 8) salida = await desinflar(datos);
        else throw new Error(`«${nombre}» usa una compresión que no se puede abrir aquí (método ${metodo})`);
        if (crc32(salida) !== crc) throw new Error(`«${nombre}» está dañado (no cuadra la comprobación)`);
        return salida;
      },
    });
  }
  return entradas;
}
