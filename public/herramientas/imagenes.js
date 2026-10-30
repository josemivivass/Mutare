// Herramientas de imágenes.
import { $, $$, aviso, tamano, base, esc } from '../util.js';
import { I } from '../iconos.js';
import { zona, prepararArchivos, ListaArchivos, tarea, VistaPrevia } from '../ui.js';
import { html, radios, valorRadio, entregar, conExtension } from './comun.js';
import * as IM from '../motor-imagen.js';

const { FORMATOS, ACEPTA_IMAGEN } = IM;

// Pantalla común de las herramientas de imágenes: zona, lista, opciones,
// vista previa en directo de la imagen elegida y botón para procesarlas todas.
// transformar(it, canvas, { previa }) → { nombre, datos, mime, ancho, alto }
function pantalla(el, { titulo = 'Elige las imágenes', opciones, boton, nombreZip, transformar, alCambiar = () => {}, informe = null, previa = true }) {
  const lienzos = new Map(); // imagen ya abierta, para no decodificarla cada vez
  const abrir = (it) => { if (!lienzos.has(it.id)) lienzos.set(it.id, IM.abrir(it)); return lienzos.get(it.id); };
  let actual = null;
  el.appendChild(zona({ acepta: ACEPTA_IMAGEN, titulo, alElegir: async (f) => { lista.anadir(await prepararArchivos(f)); } }));
  const lista = new ListaArchivos(el, (items) => {
    panel.hidden = !items.length;
    if (!items.find((x) => x.id === actual)) actual = items[0]?.id || null;
    $$('.arch', lista.el).forEach((n) => n.classList.toggle('viendo', n.dataset.id === actual && items.length > 1));
    for (const id of lienzos.keys()) if (!items.find((x) => x.id === id)) lienzos.delete(id);
    if (informe) informe(items);
    refrescar();
  }, { ordenable: false });
  lista.el.addEventListener('click', (e) => {
    const n = e.target.closest('.arch'); if (!n || e.target.closest('button')) return;
    actual = n.dataset.id; lista.pintar();
  });
  const panel = html(el, `<div class="panel" hidden>${opciones}<div class="hueco-vista"></div><button type="button" class="btn acento grande">${boton}</button><div class="progreso"></div></div>`);
  const vista = previa ? new VistaPrevia($('.hueco-vista', panel)) : null;
  function refrescar() {
    alCambiar(panel, lista);
    if (!vista || !lista.items.length) return;
    vista.programar(async () => {
      const it = lista.items.find((x) => x.id === actual) || lista.items[0];
      const c = await abrir(it);
      const r = await transformar(it, c, { previa: true, lista });
      if (r.nodo) return r;
      const varias = lista.items.length > 1 ? `${it.nombre}: ` : '';
      return { blob: new Blob([r.datos], { type: r.mime }), nombre: r.nombre, info: r.info || `${varias}${c.width}×${c.height} · ${tamano(it.tam)} → ${r.ancho}×${r.alto} · ${r.datos ? tamano(r.datos.length) : '?'}${lista.items.length > 1 ? '  (toca otra imagen de la lista para verla)' : ''}` };
    });
  }
  panel.addEventListener('input', refrescar);
  $('.panel > button.acento', el).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
    const salida = [];
    for (const [k, it] of lista.items.entries()) {
      prog(`Imagen ${k + 1} de ${lista.items.length}: ${it.nombre}`);
      const r = await transformar(it, await abrir(it), { previa: false, lista });
      if (r.todas) return entregar(panel, [r], nombreZip, `${lista.items.length} página${lista.items.length === 1 ? '' : 's'} · ${tamano(r.datos.length)}`, false); // un solo archivo con todas (PDF)
      salida.push(r);
    }
    const antes = lista.items.reduce((s, it) => s + it.tam, 0), despues = salida.reduce((s, a) => s + a.datos.length, 0);
    await entregar(panel, salida, nombreZip, `${salida.length > 1 ? `${salida.length} imágenes · ` : ''}${tamano(antes)} → ${tamano(despues)}`, salida.length === 1 && !vista);
  }));
  return { lista, panel, refrescar };
}

const selectorFormato = (nombre = 'formato', valor = 'jpg', conOriginal = false, conPdf = false) => `<label class="campo">Formato
  <select name="${nombre}">${conOriginal ? '<option value="">El mismo que tenía</option>' : ''}${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}" ${k === valor ? 'selected' : ''}>${f.nombre}</option>`).join('')}${conPdf ? '<option value="pdf">PDF (todas en uno)</option>' : ''}</select></label>`;
const opcionCalidad = (v = 85) => `<label class="campo" data-si="calidad">Calidad <span class="valor" data-v="calidad">${v} %</span><input type="range" name="calidad" min="30" max="100" step="5" value="${v}"></label>`;
const opcionFondo = `<label class="campo" data-si="fondo">Fondo (donde había transparencia) <input type="color" name="fondo" value="#ffffff"></label>`;

// Muestra u oculta calidad/fondo según el formato elegido
function mostrarSegunFormato(panel, original = 'jpg') {
  const v = $('[name=formato]', panel).value || original;
  const f = FORMATOS[v] || { alfa: true };
  $$('[data-si=calidad]', panel).forEach((x) => { x.hidden = !f.calidad; });
  $$('[data-si=fondo]', panel).forEach((x) => { x.hidden = f.alfa; });
  $$('[data-si=ico]', panel).forEach((x) => { x.hidden = v !== 'ico'; });
  $$('[data-si=pdf]', panel).forEach((x) => { x.hidden = v !== 'pdf'; });
  $$('[data-si=ffmpeg]', panel).forEach((x) => { x.hidden = v !== 'gif' && v !== 'tiff'; });
  const q = $('[data-v=calidad]', panel); if (q) q.textContent = `${$('[name=calidad]', panel).value} %`;
}
const opcionesGuardar = (panel) => ({
  calidad: Number($('[name=calidad]', panel)?.value || 85) / 100,
  fondo: $('[name=fondo]', panel)?.value || '#ffffff',
  tamanosIco: $$('[name=ico]:checked', panel).map((x) => Number(x.value)),
});

// Formato de salida «el mismo»: los que no se pueden guardar (HEIC, AVIF, SVG) pasan a JPG o PNG
function mismoFormato(it) {
  const f = IM.formatoDe(it);
  if (FORMATOS[f]) return f;
  return f === 'svg' ? 'png' : 'jpg';
}

// Guarda el canvas. En la vista previa, GIF y TIFF (que necesitan ffmpeg, 32 MB)
// se enseñan como PNG y el peso se sabe al convertir.
async function guardarComo(c, formato, op, previa, nombre) {
  const F = FORMATOS[formato];
  if (previa && (formato === 'gif' || formato === 'tiff')) {
    const datos = await IM.guardar(c, 'png', op);
    return { nombre: conExtension(nombre, F.ext), datos, mime: 'image/png', ancho: c.width, alto: c.height, info: `${c.width}×${c.height} · el peso en ${F.nombre} se verá al convertir` };
  }
  const datos = await IM.guardar(c, formato, op);
  return { nombre: conExtension(nombre, F.ext), datos, mime: F.mime, ancho: c.width, alto: c.height };
}

export const IMAGENES = [
  {
    id: 'img-convertir', alias: ['imagenes'], categoria: 'imagenes', nombre: 'Convertir imágenes', icono: I.convertirImg,
    desc: 'A JPG, PNG, WebP, GIF, BMP, ICO, TIFF o PDF. También abre HEIC del iPhone, AVIF y SVG.',
    palabras: 'heic iphone avif svg ico favicon tiff bmp webp png jpg jpeg gif pdf imagenes a pdf fotos a pdf cambiar formato',
    montar(el) {
      const { lista } = pantalla(el, {
        boton: 'Convertir', nombreZip: 'imagenes.zip',
        opciones: `<div class="opciones-rejilla">
          ${selectorFormato('formato', 'jpg', false, true)}${opcionCalidad(90)}${opcionFondo}
          <label class="campo" data-si="pdf">Tamaño de página <select name="tam"><option value="a4">A4</option><option value="carta">Carta</option><option value="ajustar">El de cada imagen</option></select></label>
          <label class="campo" data-si="pdf">Orientación <select name="orientacion"><option value="auto">Según la imagen</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
          <label class="campo" data-si="pdf">Margen <select name="margen"><option value="0">Sin margen</option><option value="20" selected>Pequeño</option><option value="40">Grande</option></select></label>
          </div>
          <div class="campo" data-si="ico">Tamaños del icono <div class="fila">${[16, 24, 32, 48, 64, 128, 256].map((t) => `<label class="check"><input type="checkbox" name="ico" value="${t}" ${[16, 32, 48, 256].includes(t) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
          <p class="ayuda" data-si="pdf">Una página por imagen, en el orden de la lista (usa las flechas para cambiarlo).</p>
          <p class="ayuda" data-si="ffmpeg">GIF y TIFF usan el conversor de audio y vídeo: la primera vez se descargan 32 MB (luego queda guardado).</p>`,
        alCambiar: (panel, l) => {
          mostrarSegunFormato(panel);
          const pdf = $('[name=formato]', panel).value === 'pdf';
          if (l.ordenable !== pdf) { l.ordenable = pdf; l.pintar(); }
        },
        transformar: async (it, c, { previa, lista: l }) => {
          const panel = el.querySelector('.panel');
          const formato = $('[name=formato]', panel).value, op = opcionesGuardar(panel);
          if (formato === 'ico' && !op.tamanosIco.length) throw new Error('Elige al menos un tamaño para el icono');
          if (formato === 'pdf') {
            const { imagenesAPdf } = await import('../motor.js');
            const opPdf = { tam: $('[name=tam]', panel).value, orientacion: $('[name=orientacion]', panel).value, margen: Number($('[name=margen]', panel).value) };
            // Las que el PDF no admite tal cual (HEIC, WebP, SVG…) pasan antes a JPG o PNG
            const preparar = async (x) => (/^image\/(jpeg|png)$/.test(x.mime) && IM.formatoDe(x) !== 'heic' ? x : { ...x, mime: 'image/png', bytes: await IM.guardar(await IM.abrir(x), 'png') });
            if (previa) {
              const bytes = await imagenesAPdf([await preparar(it)], opPdf);
              return { nombre: 'previa.pdf', datos: bytes, mime: 'application/pdf', info: `Página de «${it.nombre}» · ${l.items.length} página${l.items.length === 1 ? '' : 's'} en total` };
            }
            const items = []; for (const x of l.items) items.push(await preparar(x));
            const bytes = await imagenesAPdf(items, opPdf);
            const r = { nombre: conExtension(l.items[0].nombre, 'pdf'), datos: bytes, mime: 'application/pdf', todas: true };
            return r;
          }
          return guardarComo(c, formato, op, previa, it.nombre);
        },
      });
    },
  },
  {
    id: 'img-redimensionar', categoria: 'imagenes', nombre: 'Cambiar tamaño', icono: I.redimensionar,
    desc: 'Haz las imágenes más pequeñas (o más grandes): por porcentaje o por medidas.',
    palabras: 'redimensionar reducir escalar pixeles resolucion ancho alto',
    montar(el) {
      pantalla(el, {
        boton: 'Cambiar tamaño', nombreZip: 'imagenes-redimensionadas.zip',
        opciones: `<div class="campo">Cómo ${radios('modo', [['maximo', 'Tamaño máximo'], ['porcentaje', 'Porcentaje'], ['exacto', 'Medidas exactas']], 'maximo')}</div>
          <div class="opciones-rejilla">
            <label class="campo" data-m="porcentaje">Porcentaje <span class="valor" data-v="pct">50 %</span><input type="range" name="pct" min="5" max="200" step="5" value="50"></label>
            <label class="campo" data-m="maximo exacto">Ancho (px) <input type="number" name="ancho" min="1" value="1920" placeholder="automático"></label>
            <label class="campo" data-m="maximo exacto">Alto (px) <input type="number" name="alto" min="1" value="1920" placeholder="automático"></label>
            ${selectorFormato('formato', '', true)}${opcionCalidad(90)}
          </div>
          <p class="ayuda" data-m="maximo">La imagen se reduce hasta caber en esas medidas sin deformarse. Las que ya son más pequeñas no se tocan.</p>
          <p class="ayuda" data-m="exacto">Si dejas una medida vacía, se calcula para no deformar la imagen.</p>`,
        alCambiar: (panel) => {
          const m = valorRadio(panel, 'modo');
          $$('[data-m]', panel).forEach((x) => { x.hidden = !x.dataset.m.split(' ').includes(m); });
          $('[data-v=pct]', panel).textContent = `${$('[name=pct]', panel).value} %`;
          mostrarSegunFormato(panel);
        },
        transformar: async (it, c, { previa }) => {
          const panel = el.querySelector('.panel');
          const modo = valorRadio(panel, 'modo');
          const ancho = Number($('[name=ancho]', panel).value) || 0, alto = Number($('[name=alto]', panel).value) || 0;
          if (modo !== 'porcentaje' && !ancho && !alto) throw new Error('Pon al menos el ancho o el alto');
          const [w, h] = IM.medidas(c.width, c.height, { modo, porcentaje: Number($('[name=pct]', panel).value), ancho, alto });
          if (w * h > 16384 * 16384 / 2) throw new Error('Demasiado grande para el navegador');
          const formato = $('[name=formato]', panel).value || mismoFormato(it);
          return guardarComo(IM.escalar(c, w, h), formato, opcionesGuardar(panel), previa, `${base(it.nombre)}-${w}x${h}.x`);
        },
      });
    },
  },
  {
    id: 'img-comprimir', categoria: 'imagenes', nombre: 'Comprimir imágenes', icono: I.comprimir,
    desc: 'Que ocupen mucho menos para enviarlas o subirlas, casi sin que se note.',
    palabras: 'reducir peso optimizar kb mb tamaño archivo',
    montar(el) {
      pantalla(el, {
        boton: 'Comprimir', nombreZip: 'imagenes-comprimidas.zip',
        opciones: `<div class="opciones-rejilla">
          <label class="campo">Formato <select name="formato"><option value="jpg">JPG (fotos)</option><option value="webp">WebP (más pequeño)</option></select></label>
          <label class="campo">Calidad <span class="valor" data-v="calidad">75 %</span><input type="range" name="calidad" min="30" max="95" step="5" value="75"></label>
          <label class="campo">Medida máxima <select name="max"><option value="0">Sin cambiar</option><option value="3840">4K (3840 px)</option><option value="2560">2560 px</option><option value="1920" selected>Full HD (1920 px)</option><option value="1280">1280 px</option><option value="800">800 px</option></select></label>
          ${opcionFondo}</div>
          <p class="ayuda">También se quitan los datos ocultos (ubicación, cámara…). Si alguna saliera más grande que la original, se deja la original.</p>`,
        alCambiar: (panel) => mostrarSegunFormato(panel),
        transformar: async (it, c, { previa }) => {
          const panel = el.querySelector('.panel');
          const formato = $('[name=formato]', panel).value, max = Number($('[name=max]', panel).value);
          const [w, h] = max ? IM.medidas(c.width, c.height, { modo: 'maximo', ancho: max, alto: max }) : [c.width, c.height];
          const r = await guardarComo(IM.escalar(c, w, h), formato, opcionesGuardar(panel), previa, it.nombre);
          if (r.datos.length >= it.tam) {
            if (previa) return { ...r, info: `${c.width}×${c.height} · ${tamano(it.tam)} → ya estaba bien comprimida, se dejará como está` };
            return { nombre: it.nombre, datos: it.bytes, mime: it.mime, ancho: c.width, alto: c.height };
          }
          return { ...r, info: `${c.width}×${c.height} · ${tamano(it.tam)} → ${w}×${h} · ${tamano(r.datos.length)} (−${Math.round((1 - r.datos.length / it.tam) * 100)} %)` };
        },
      });
    },
  },
  {
    id: 'img-limpiar', categoria: 'imagenes', nombre: 'Quitar datos ocultos', icono: I.limpiar,
    desc: 'Borra la ubicación GPS, la cámara y la fecha que llevan las fotos antes de compartirlas.',
    palabras: 'exif gps ubicacion privacidad metadatos camara',
    montar(el) {
      pantalla(el, {
        titulo: 'Elige las fotos', boton: 'Quitar datos', nombreZip: 'fotos-limpias.zip', previa: false,
        opciones: `<div class="informe datos-ocultos"></div>
          <p class="ayuda">En JPG y PNG se quitan sin volver a comprimir: la imagen queda exactamente igual. Las fotos giradas por la cámara se enderezan (eso sí recomprime, a calidad máxima).</p>`,
        informe: (items) => {
          const caja = el.querySelector('.informe'); if (!caja) return;
          caja.innerHTML = items.map((it) => {
            const d = IM.datosOcultos(it.bytes);
            const cosas = [d.gps && '📍 <b>ubicación GPS</b>', (d.marca || d.modelo) && `cámara: ${esc([d.marca, d.modelo].filter(Boolean).join(' '))}`, d.fecha && `fecha: ${esc(d.fecha)}`, d.programa && `programa: ${esc(d.programa)}`, d.autor && `autor: ${esc(d.autor)}`, d.xmp && 'datos XMP', d.exif && !d.marca && !d.gps && 'datos EXIF'].filter(Boolean);
            return `<div>${esc(it.nombre)}: ${cosas.length ? cosas.join(' · ') : '<span class="ayuda">no se ven datos ocultos</span>'}</div>`;
          }).join('');
        },
        transformar: async (it, c) => {
          const f = IM.formatoDe(it);
          if (f === 'jpg') return { nombre: it.nombre, datos: await IM.limpiarJpg(it), mime: it.mime };
          if (f === 'png') return { nombre: it.nombre, datos: IM.limpiarPng(it.bytes), mime: it.mime };
          const ff = mismoFormato(it);
          return { nombre: conExtension(it.nombre, FORMATOS[ff].ext), datos: await IM.guardar(c, ff, { calidad: 0.95 }), mime: FORMATOS[ff].mime };
        },
      });
    },
  },
  {
    id: 'img-girar', categoria: 'imagenes', nombre: 'Girar y voltear', icono: I.girarImg,
    desc: 'Endereza fotos giradas o haz el efecto espejo.',
    palabras: 'rotar voltear espejo invertir orientacion',
    montar(el) {
      pantalla(el, {
        boton: 'Aplicar', nombreZip: 'imagenes-giradas.zip',
        opciones: `<div class="campo">Giro ${radios('giro', [['90', '90° derecha'], ['180', '180°'], ['270', '90° izquierda'], ['0', 'Sin girar']], '90')}</div>
          <div class="fila"><label class="check"><input type="checkbox" name="h"> Voltear en horizontal (espejo)</label><label class="check"><input type="checkbox" name="v"> Voltear en vertical</label></div>
          <div class="opciones-rejilla">${selectorFormato('formato', '', true)}${opcionCalidad(92)}</div>`,
        alCambiar: (panel) => mostrarSegunFormato(panel),
        transformar: async (it, c, { previa }) => {
          const panel = el.querySelector('.panel');
          const g = Number(valorRadio(panel, 'giro')), h = $('[name=h]', panel).checked, v = $('[name=v]', panel).checked;
          if (!g && !h && !v) throw new Error('Elige un giro o un volteo');
          const formato = $('[name=formato]', panel).value || mismoFormato(it);
          return guardarComo(IM.girar(c, g, h, v), formato, opcionesGuardar(panel), previa, it.nombre);
        },
      });
    },
  },
];
