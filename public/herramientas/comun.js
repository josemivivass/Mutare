// Piezas que comparten las pantallas de las herramientas.
import { $, tamano } from '../util.js';
import { zona, prepararArchivos } from '../ui.js';

export const html = (el, h) => { el.insertAdjacentHTML('beforeend', h); return el.lastElementChild; };

export function radios(nombre, opciones, valor) {
  return `<div class="segmentado" role="radiogroup">${opciones.map(([v, t]) =>
    `<label><input type="radio" name="${nombre}" value="${v}" ${v === valor ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
}
export const valorRadio = (el, nombre) => $(`input[name="${nombre}"]:checked`, el)?.value;

// Un solo archivo de entrada: zona grande y, una vez elegido, una línea compacta
// para cambiarlo. alCargar recibe el archivo preparado ({ nombre, bytes, … }).
export function unArchivo(el, { acepta, titulo, info = (it) => tamano(it.tam), alCargar }) {
  const caja = html(el, '<div></div>');
  const poner = async (files) => {
    const [it] = await prepararArchivos(files);
    if (!it) return;
    caja.replaceChildren(zona({ acepta, multiple: false, titulo: it.nombre, subtitulo: `${info(it)} · toca para cambiarlo`, compacta: true, alElegir: poner }));
    await alCargar(it);
  };
  caja.appendChild(zona({ acepta, multiple: false, titulo, subtitulo: 'o arrástralo aquí', alElegir: poner }));
}

export const unPdf = (el, alCargar, titulo = 'Elige un PDF') => unArchivo(el, {
  acepta: 'application/pdf,.pdf', titulo, alCargar,
  info: (it) => `${it.paginas} página${it.paginas === 1 ? '' : 's'} · ${tamano(it.tam)}`,
});

// Nombre del archivo con otra extensión
export const conExtension = (nombre, ext) => `${String(nombre).replace(/\.[^.]+$/, '') || 'archivo'}.${ext}`;

// Entrega uno o varios archivos: uno suelto tal cual, varios en un ZIP.
// archivos: [{ nombre, datos: Uint8Array, mime }]
import { resultado } from '../ui.js';
import { crearZip } from '../zip.js';
export async function entregar(panel, archivos, nombreZip, detalle = '') {
  if (archivos.length === 1) {
    const [a] = archivos;
    return resultado(panel, { blob: new Blob([a.datos], { type: a.mime || 'application/octet-stream' }), nombre: a.nombre, detalle });
  }
  const zip = crearZip(archivos.map((a) => ({ nombre: a.nombre, datos: a.datos })));
  return resultado(panel, { blob: zip, nombre: nombreZip, detalle: detalle || `${archivos.length} archivos · ${tamano(zip.size)}` });
}
