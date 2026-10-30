// Utilidades comunes de la interfaz.

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function aviso(mensaje, opciones = {}) {
  const div = document.createElement('div');
  div.className = 'aviso' + (opciones.error ? ' error' : '');
  div.textContent = mensaje;
  $('#avisos').appendChild(div);
  setTimeout(() => div.remove(), opciones.error ? 6000 : 3500);
}

export function tamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
}

// Nombre sin extensión, para construir el de los resultados
export function base(nombre) { return String(nombre).replace(/\.[^.]+$/, '') || 'documento'; }

export function leer(file) {
  return file.arrayBuffer().then((b) => new Uint8Array(b));
}

// Descarga un Blob con un nombre. El enlace temporal se libera enseguida.
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const respirar = () => new Promise((r) => setTimeout(r, 0));

// Interpreta «1-3, 5, 8-» sobre un total de páginas. Devuelve grupos de índices (desde 0).
export function rangos(texto, total) {
  const grupos = [];
  for (const trozo of String(texto).split(/[,;]+/).map((t) => t.trim()).filter(Boolean)) {
    const m = trozo.match(/^(\d*)\s*(?:-|–|a)\s*(\d*)$/) || trozo.match(/^(\d+)$/);
    if (!m) throw new Error(`No entiendo «${trozo}». Usa algo como 1-3, 5, 8-10`);
    let desde, hasta;
    if (m.length === 2) { desde = hasta = Number(m[1]); }
    else { desde = m[1] ? Number(m[1]) : 1; hasta = m[2] ? Number(m[2]) : total; }
    if (desde < 1 || hasta > total || desde > hasta) throw new Error(`El rango «${trozo}» no cabe: el documento tiene ${total} páginas`);
    const g = []; for (let i = desde; i <= hasta; i++) g.push(i - 1);
    grupos.push(g);
  }
  if (!grupos.length) throw new Error('Escribe qué páginas quieres, por ejemplo 1-3, 5');
  return grupos;
}

// Por http:// con una IP (como se abre desde el panel del homelab) el navegador
// no da algunas funciones «seguras»: crypto.randomUUID ni el portapapeles moderno.
export const nuevoId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

export async function copiarTexto(texto) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
  const ta = document.createElement('textarea');
  ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { if (!document.execCommand('copy')) throw new Error('no se pudo copiar'); } finally { ta.remove(); }
}
