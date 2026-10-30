// Herramientas de imágenes.
import { $, $$, aviso, tamano, base, esc } from '../util.js';
import { I } from '../iconos.js';
import { zona, prepararArchivos, ListaArchivos, tarea } from '../ui.js';
import { html, radios, valorRadio, entregar, conExtension } from './comun.js';
import * as IM from '../motor-imagen.js';

const { FORMATOS, ACEPTA_IMAGEN } = IM;

// Zona + lista de imágenes + panel de opciones. Devuelve { lista, panel }
function lote(el, titulo, opcionesHtml, boton) {
  el.appendChild(zona({ acepta: ACEPTA_IMAGEN, titulo, alElegir: async (f) => lista.anadir(await prepararArchivos(f)) }));
  const lista = new ListaArchivos(el, (items) => { panel.hidden = !items.length; }, { ordenable: false });
  const panel = html(el, `<div class="panel" hidden>${opcionesHtml}<button type="button" class="btn acento grande">${boton}</button><div class="progreso"></div></div>`);
  return { lista, panel };
}

// Recorre las imágenes con fn(it, canvas) → { nombre, datos, mime } y entrega el resultado
async function procesar(panel, lista, fn, prog, nombreZip) {
  const salida = [];
  for (const [k, it] of lista.items.entries()) {
    prog(`Imagen ${k + 1} de ${lista.items.length}: ${it.nombre}`);
    salida.push(await fn(it));
  }
  const antes = lista.items.reduce((s, it) => s + it.tam, 0), despues = salida.reduce((s, a) => s + a.datos.length, 0);
  await entregar(panel, salida, nombreZip, `${salida.length > 1 ? `${salida.length} imágenes · ` : ''}${tamano(antes)} → ${tamano(despues)}`);
}

const selectorFormato = (nombre = 'formato', valor = 'jpg', conOriginal = false) => `<label class="campo">Formato
  <select name="${nombre}">${conOriginal ? '<option value="">El mismo que tenía</option>' : ''}${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}" ${k === valor ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select></label>`;
const opcionCalidad = (v = 85) => `<label class="campo" data-si="calidad">Calidad <span class="valor" data-v="calidad">${v} %</span><input type="range" name="calidad" min="30" max="100" step="5" value="${v}"></label>`;
const opcionFondo = `<label class="campo" data-si="fondo">Fondo (donde había transparencia) <input type="color" name="fondo" value="#ffffff"></label>`;

// Muestra u oculta calidad/fondo según el formato elegido
function enlazarFormato(panel, original = () => null) {
  const act = () => {
    const f = FORMATOS[$('[name=formato]', panel).value || original()] || FORMATOS.png;
    $$('[data-si=calidad]', panel).forEach((x) => { x.hidden = !f.calidad; });
    $$('[data-si=fondo]', panel).forEach((x) => { x.hidden = f.alfa; });
    $$('[data-si=ico]', panel).forEach((x) => { x.hidden = $('[name=formato]', panel).value !== 'ico'; });
    const q = $('[data-v=calidad]', panel); if (q) q.textContent = `${$('[name=calidad]', panel).value} %`;
  };
  panel.addEventListener('input', act); act();
}
const opcionesGuardar = (panel) => ({
  calidad: Number($('[name=calidad]', panel)?.value || 85) / 100,
  fondo: $('[name=fondo]', panel)?.value || '#ffffff',
  tamanosIco: $$('[name=ico]:checked', panel).map((x) => Number(x.value)),
});

// Formato de salida «el mismo»: los que no se pueden guardar (HEIC, AVIF, SVG) pasan a JPG o PNG
function mismoFormato(it, canvas) {
  const f = IM.formatoDe(it);
  if (FORMATOS[f]) return f;
  return f === 'svg' ? 'png' : 'jpg';
}

export const IMAGENES = [
  {
    id: 'img-convertir', categoria: 'imagenes', nombre: 'Convertir imágenes', icono: I.convertirImg,
    desc: 'Entre JPG, PNG, WebP, GIF, BMP, ICO y TIFF. También abre HEIC del iPhone, AVIF y SVG.',
    palabras: 'heic iphone avif svg ico favicon tiff bmp webp png jpg jpeg gif cambiar formato',
    montar(el) {
      const { lista, panel } = lote(el, 'Elige las imágenes', `<div class="opciones-rejilla">
        ${selectorFormato('formato', 'jpg')}${opcionCalidad(90)}${opcionFondo}
        <div class="campo" data-si="ico">Tamaños del icono <div class="fila">${[16, 24, 32, 48, 64, 128, 256].map((t) => `<label class="check"><input type="checkbox" name="ico" value="${t}" ${[16, 32, 48, 256].includes(t) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
        </div><p class="ayuda">GIF y TIFF usan el conversor de audio y vídeo: la primera vez se descargan 32 MB (luego queda guardado).</p>`, 'Convertir');
      enlazarFormato(panel);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const formato = $('[name=formato]', panel).value, op = opcionesGuardar(panel);
        if (formato === 'ico' && !op.tamanosIco.length) throw new Error('Elige al menos un tamaño para el icono');
        await procesar(panel, lista, async (it) => {
          const datos = await IM.guardar(await IM.abrir(it), formato, op);
          return { nombre: conExtension(it.nombre, FORMATOS[formato].ext), datos, mime: FORMATOS[formato].mime };
        }, prog, `imagenes-${formato}.zip`);
      }));
    },
  },
  {
    id: 'img-redimensionar', categoria: 'imagenes', nombre: 'Cambiar tamaño', icono: I.redimensionar,
    desc: 'Haz las imágenes más pequeñas (o más grandes): por porcentaje o por medidas.',
    palabras: 'redimensionar reducir escalar pixeles resolucion ancho alto',
    montar(el) {
      const { lista, panel } = lote(el, 'Elige las imágenes', `
        <div class="campo">Cómo ${radios('modo', [['maximo', 'Que no pase de…'], ['porcentaje', 'Porcentaje'], ['exacto', 'Medidas exactas']], 'maximo')}</div>
        <div class="opciones-rejilla">
          <label class="campo" data-m="porcentaje" hidden>Porcentaje <span class="valor" data-v="pct">50 %</span><input type="range" name="pct" min="5" max="200" step="5" value="50"></label>
          <label class="campo" data-m="maximo exacto">Ancho (px) <input type="number" name="ancho" min="1" value="1920" placeholder="automático"></label>
          <label class="campo" data-m="maximo exacto">Alto (px) <input type="number" name="alto" min="1" value="1920" placeholder="automático"></label>
          ${selectorFormato('formato', '', true)}${opcionCalidad(90)}
        </div>
        <p class="ayuda" data-m="maximo">La imagen se reduce hasta caber en esas medidas sin deformarse. Las que ya son más pequeñas no se tocan.</p>
        <p class="ayuda" data-m="exacto">Si dejas una medida vacía, se calcula para no deformar la imagen.</p>`, 'Cambiar tamaño');
      const act = () => {
        const m = valorRadio(panel, 'modo');
        $$('[data-m]', panel).forEach((x) => { x.hidden = !x.dataset.m.split(' ').includes(m); });
        $('[data-v=pct]', panel).textContent = `${$('[name=pct]', panel).value} %`;
      };
      panel.addEventListener('input', act); act();
      enlazarFormato(panel, () => 'jpg');
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const modo = valorRadio(panel, 'modo');
        const ancho = Number($('[name=ancho]', panel).value) || 0, alto = Number($('[name=alto]', panel).value) || 0;
        if (modo !== 'porcentaje' && !ancho && !alto) throw new Error('Pon al menos el ancho o el alto');
        const op = opcionesGuardar(panel);
        await procesar(panel, lista, async (it) => {
          const c = await IM.abrir(it);
          const [w, h] = IM.medidas(c.width, c.height, { modo, porcentaje: Number($('[name=pct]', panel).value), ancho, alto });
          const formato = $('[name=formato]', panel).value || mismoFormato(it);
          const datos = await IM.guardar(IM.escalar(c, w, h), formato, op);
          return { nombre: conExtension(`${base(it.nombre)}-${w}x${h}`, FORMATOS[formato].ext), datos, mime: FORMATOS[formato].mime };
        }, prog, 'imagenes-redimensionadas.zip');
      }));
    },
  },
  {
    id: 'img-comprimir', categoria: 'imagenes', nombre: 'Comprimir imágenes', icono: I.comprimir,
    desc: 'Que ocupen mucho menos para enviarlas o subirlas, casi sin que se note.',
    palabras: 'reducir peso optimizar kb mb tamaño archivo',
    montar(el) {
      const { lista, panel } = lote(el, 'Elige las imágenes', `<div class="opciones-rejilla">
        <label class="campo">Formato <select name="formato"><option value="jpg">JPG (fotos)</option><option value="webp">WebP (más pequeño)</option></select></label>
        <label class="campo">Calidad <span class="valor" data-v="calidad">75 %</span><input type="range" name="calidad" min="30" max="95" step="5" value="75"></label>
        <label class="campo">Medida máxima <select name="max"><option value="0">Sin cambiar</option><option value="3840">4K (3840 px)</option><option value="2560">2560 px</option><option value="1920" selected>Full HD (1920 px)</option><option value="1280">1280 px</option><option value="800">800 px</option></select></label>
        ${opcionFondo}</div>
        <p class="ayuda">También se quitan los datos ocultos (ubicación, cámara…). Si alguna saliera más grande que la original, se deja la original.</p>`, 'Comprimir');
      enlazarFormato(panel);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const formato = $('[name=formato]', panel).value, max = Number($('[name=max]', panel).value), op = opcionesGuardar(panel);
        let iguales = 0;
        await procesar(panel, lista, async (it) => {
          const c = await IM.abrir(it);
          const [w, h] = max ? IM.medidas(c.width, c.height, { modo: 'maximo', ancho: max, alto: max }) : [c.width, c.height];
          const datos = await IM.guardar(IM.escalar(c, w, h), formato, op);
          if (datos.length >= it.tam) { iguales++; return { nombre: it.nombre, datos: it.bytes, mime: it.mime }; }
          return { nombre: conExtension(it.nombre, FORMATOS[formato].ext), datos, mime: FORMATOS[formato].mime };
        }, prog, 'imagenes-comprimidas.zip');
        if (iguales) aviso(`${iguales} imagen${iguales === 1 ? '' : 'es'} ya estaba${iguales === 1 ? '' : 'n'} bien comprimida${iguales === 1 ? '' : 's'}: se deja${iguales === 1 ? '' : 'n'} como estaba${iguales === 1 ? '' : 'n'}`);
      }));
    },
  },
  {
    id: 'img-limpiar', categoria: 'imagenes', nombre: 'Quitar datos ocultos', icono: I.limpiar,
    desc: 'Borra la ubicación GPS, la cámara y la fecha que llevan las fotos antes de compartirlas.',
    palabras: 'exif gps ubicacion privacidad metadatos camara',
    montar(el) {
      el.appendChild(zona({ acepta: ACEPTA_IMAGEN, titulo: 'Elige las fotos', alElegir: async (f) => { lista.anadir(await prepararArchivos(f)); informe(); } }));
      const lista = new ListaArchivos(el, (items) => { panel.hidden = !items.length; informe(); }, { ordenable: false });
      const panel = html(el, `<div class="panel" hidden><div class="informe"></div>
        <p class="ayuda">En JPG y PNG se quitan sin volver a comprimir: la imagen queda exactamente igual. Las fotos giradas por la cámara se enderezan (eso sí recomprime, a calidad máxima).</p>
        <button type="button" class="btn acento grande">Quitar datos</button><div class="progreso"></div></div>`);
      function informe() {
        $('.informe', panel).innerHTML = lista.items.map((it) => {
          const d = IM.datosOcultos(it.bytes);
          const cosas = [d.gps && '📍 <b>ubicación GPS</b>', (d.marca || d.modelo) && `cámara: ${esc([d.marca, d.modelo].filter(Boolean).join(' '))}`, d.fecha && `fecha: ${esc(d.fecha)}`, d.programa && `programa: ${esc(d.programa)}`, d.autor && `autor: ${esc(d.autor)}`, d.xmp && 'datos XMP', d.exif && !d.marca && !d.gps && 'datos EXIF'].filter(Boolean);
          return `<div>${esc(it.nombre)}: ${cosas.length ? cosas.join(' · ') : '<span class="ayuda">no se ven datos ocultos</span>'}</div>`;
        }).join('');
        $('.informe', panel).className = 'informe datos-ocultos';
      }
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        await procesar(panel, lista, async (it) => {
          const f = IM.formatoDe(it);
          let datos;
          if (f === 'jpg') datos = await IM.limpiarJpg(it);
          else if (f === 'png') datos = IM.limpiarPng(it.bytes);
          else { const ff = mismoFormato(it); datos = await IM.guardar(await IM.abrir(it), ff, { calidad: 0.95 }); return { nombre: conExtension(it.nombre, FORMATOS[ff].ext), datos, mime: FORMATOS[ff].mime }; }
          return { nombre: it.nombre, datos, mime: it.mime };
        }, prog, 'fotos-limpias.zip');
      }));
    },
  },
  {
    id: 'img-girar', categoria: 'imagenes', nombre: 'Girar y voltear', icono: I.girarImg,
    desc: 'Endereza fotos giradas o haz el efecto espejo.',
    palabras: 'rotar voltear espejo invertir orientacion',
    montar(el) {
      const { lista, panel } = lote(el, 'Elige las imágenes', `
        <div class="campo">Giro ${radios('giro', [['90', '90° derecha'], ['180', '180°'], ['270', '90° izquierda'], ['0', 'Sin girar']], '90')}</div>
        <div class="fila"><label class="check"><input type="checkbox" name="h"> Voltear en horizontal (espejo)</label><label class="check"><input type="checkbox" name="v"> Voltear en vertical</label></div>
        <div class="opciones-rejilla">${selectorFormato('formato', '', true)}${opcionCalidad(92)}</div>`, 'Aplicar');
      enlazarFormato(panel, () => 'jpg');
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const g = Number(valorRadio(panel, 'giro')), h = $('[name=h]', panel).checked, v = $('[name=v]', panel).checked;
        if (!g && !h && !v) throw new Error('Elige un giro o un volteo');
        const op = opcionesGuardar(panel);
        await procesar(panel, lista, async (it) => {
          const formato = $('[name=formato]', panel).value || mismoFormato(it);
          const datos = await IM.guardar(IM.girar(await IM.abrir(it), g, h, v), formato, op);
          return { nombre: conExtension(it.nombre, FORMATOS[formato].ext), datos, mime: FORMATOS[formato].mime };
        }, prog, 'imagenes-giradas.zip');
      }));
    },
  },
];
