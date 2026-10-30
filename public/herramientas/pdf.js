// Las herramientas: cada una monta su pantalla dentro de «el» y devuelve una
// función de limpieza (libera los documentos abiertos al salir).

import { $, $$, esc, aviso, tamano, base, rangos, descargar } from '../util.js';
import { I } from '../iconos.js';
import { crearZip } from '../zip.js';
import * as M from '../motor.js';
import { zona, prepararArchivos, ListaArchivos, RejillaPaginas, resultado, tarea, PanelFirma, imagenAFirma, VistaPrevia, ACEPTA_PDF, ACEPTA_IMG, ACEPTA_TODO } from '../ui.js';
import { html, radios, valorRadio, unPdf } from './comun.js';

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });

// ===========================================================================

export const PDF = [
  // ------------------------------------------------------------------ Organizar
  {
    id: 'juntar', categoria: 'pdf', nombre: 'Juntar PDF', icono: I.juntar,
    desc: 'Une varios PDF (y fotos) en uno, en el orden que quieras.',
    montar(el) {
      el.appendChild(zona({ acepta: ACEPTA_TODO, titulo: 'Elige los PDF o imágenes', alElegir: async (f) => lista.anadir(await prepararArchivos(f)) }));
      const lista = new ListaArchivos(el, (items) => {
        accion.hidden = !items.length;
        $('button', accion).textContent = `Juntar ${items.length} archivo${items.length === 1 ? '' : 's'}`;
        $('.info', accion).textContent = items.length < 2 ? 'Añade al menos dos. Arrástralos o usa las flechas para ordenarlos.' : 'Arrástralos o usa las flechas para cambiar el orden.';
      });
      const accion = html(el, `<div class="panel" hidden><p class="ayuda info"></p><button type="button" class="btn acento grande"></button><div class="progreso"></div></div>`);
      $('button', accion).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', accion), async (prog) => {
        if (lista.items.length < 1) throw new Error('Añade algún archivo');
        const bytes = await M.juntar(lista.items, prog);
        await resultado(accion, { blob: pdfBlob(bytes), nombre: `${base(lista.items[0].nombre)}-juntado.pdf` });
      }));
    },
  },
  {
    id: 'organizar', alias: ['rotar'], categoria: 'pdf', nombre: 'Ordenar y girar páginas', icono: I.organizar,
    desc: 'Mueve, gira, quita o añade páginas en blanco. También mezcla varios PDF.',
    palabras: 'rotar girar orientacion quitar borrar eliminar paginas reordenar mover extraer',
    montar(el) {
      el.appendChild(zona({ acepta: ACEPTA_PDF, titulo: 'Elige uno o varios PDF', compacta: false, alElegir: async (files) => {
        for (const it of await prepararArchivos(files)) await rej.anadirPdf(it.nombre, it.bytes);
        panel.hidden = false; el.querySelector('.zona').classList.add('compacta');
      } }));
      const panel = html(el, `<div class="panel" hidden>
        <div class="barra-herr"><span class="info"></span>
          <button type="button" class="btn pequeno" data-a="todo">Todas</button>
          <button type="button" class="btn pequeno" data-a="nada">Ninguna</button></div>
        <div class="barra-herr">
          <button type="button" class="btn pequeno" data-a="izq" title="Girar a la izquierda">${I.girarIzq}Girar</button>
          <button type="button" class="btn pequeno" data-a="der" title="Girar a la derecha">${I.girarDer}Girar</button>
          <button type="button" class="btn pequeno" data-a="antes" title="Mover antes">${I.izquierda}Mover</button>
          <button type="button" class="btn pequeno" data-a="despues" title="Mover después">Mover${I.derecha}</button>
          <button type="button" class="btn pequeno" data-a="blanca">${I.blanca}En blanco</button>
          <button type="button" class="btn pequeno peligro" data-a="borrar">${I.borrar}Quitar</button>
        </div>
        <p class="ayuda">Toca las páginas para elegirlas. En el ordenador también puedes arrastrarlas. Los botones de arriba actúan sobre las elegidas (o sobre todas si no hay ninguna elegida).</p>
        <div class="rejilla"></div>
        <div class="acciones-final">
          <button type="button" class="btn acento grande" data-a="guardar">Descargar PDF</button>
          <button type="button" class="btn grande" data-a="extraer">Solo las elegidas</button>
        </div><div class="progreso"></div></div>`);
      const rej = new RejillaPaginas($('.rejilla', panel), { ordenable: true, acciones: ['girar', 'borrar'], alCambiar: () => {
        const n = rej.sel.size;
        $('.info', panel).textContent = `${rej.paginas.length} páginas${n ? ` · ${n} elegida${n === 1 ? '' : 's'}` : ''}`;
        $('[data-a="extraer"]', panel).hidden = !n;
      } });
      const objetivo = () => (rej.sel.size ? rej.seleccionadas() : rej.paginas);
      panel.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'todo' || a === 'nada') rej.seleccionarTodo(a === 'todo');
        if (a === 'izq') rej.girar(-90, objetivo());
        if (a === 'der') rej.girar(90, objetivo());
        if (a === 'antes') rej.mover(-1);
        if (a === 'despues') rej.mover(1);
        if (a === 'blanca') rej.anadirBlanca(rej.seleccionadas().at(-1) || null);
        if (a === 'borrar') { if (!rej.sel.size) return aviso('Elige primero las páginas que quieres quitar'); rej.borrar(rej.seleccionadas()); }
        if (a === 'guardar' || a === 'extraer') {
          tarea(e.target.closest('button'), $('.progreso', panel), async (prog) => {
            const lista = a === 'extraer' ? rej.seleccionadas() : rej.paginas;
            if (!lista.length) throw new Error('No queda ninguna página');
            const bytes = await M.componer(rej.fuentes.map((f) => f.bytes), rej.plan(lista), prog);
            await resultado(panel, { blob: pdfBlob(bytes), nombre: `${base(rej.fuentes[0].nombre)}-${a === 'extraer' ? 'extracto' : 'ordenado'}.pdf` });
          });
        }
      });
      return () => rej.destruir();
    },
  },
  {
    id: 'separar', categoria: 'pdf', nombre: 'Separar PDF', icono: I.separar,
    desc: 'Divide un PDF en varios: por páginas, cada cierto número o por rangos.',
    montar(el) {
      let doc = null;
      unPdf(el, (it) => { doc = it; panel.hidden = false; actualizar(); });
      const panel = html(el, `<div class="panel" hidden>
        <div class="campo">Cómo separar
          ${radios('modo', [['cada', 'Cada página'], ['n', 'Cada N páginas'], ['rangos', 'Por rangos'], ['extraer', 'Sacar unas páginas']], 'cada')}</div>
        <label class="campo" data-modo="n" hidden>Páginas por archivo <input type="number" min="1" value="2" name="n"></label>
        <label class="campo" data-modo="rangos" hidden>Rangos (un archivo por cada uno) <input type="text" name="rangos" placeholder="1-3, 4-6, 7-"></label>
        <label class="campo" data-modo="extraer" hidden>Páginas que quieres (en un solo PDF) <input type="text" name="extraer" placeholder="1, 3, 5-8"></label>
        <p class="ayuda info"></p><div class="hueco-vista"></div>
        <button type="button" class="btn acento grande">Separar</button><div class="progreso"></div></div>`);
      const vista = new VistaPrevia($('.hueco-vista', panel), 'Saldrán estos archivos');
      const grupos = () => {
        const t = doc.paginas, modo = valorRadio(panel, 'modo');
        if (modo === 'cada') return [...Array(t).keys()].map((i) => [i]);
        if (modo === 'n') { const n = Math.max(1, Number($('[name=n]', panel).value) || 1); const g = []; for (let i = 0; i < t; i += n) g.push([...Array(Math.min(n, t - i)).keys()].map((k) => i + k)); return g; }
        if (modo === 'rangos') return rangos($('[name=rangos]', panel).value, t);
        return [rangos($('[name=extraer]', panel).value, t).flat()];
      };
      const nombreDe = (g) => (g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`);
      const actualizar = () => {
        const modo = valorRadio(panel, 'modo');
        $$('[data-modo]', panel).forEach((x) => { x.hidden = x.dataset.modo !== modo; });
        const t = doc?.paginas || 0;
        const info = { cada: `Saldrán ${t} archivos, uno por página, dentro de un ZIP.`, n: 'Saldrá un ZIP con los archivos.', rangos: 'Por ejemplo «1-3, 4-6, 7-»: el último va hasta el final. Saldrá un ZIP.', extraer: 'Por ejemplo «1, 3, 5-8». Saldrá un solo PDF con esas páginas.' };
        $('.info', panel).textContent = `El documento tiene ${t} páginas. ${info[modo]}`;
        vista.programar(async () => {
          const g = grupos();
          if (!g.length || !g[0].length) return null;
          const b = base(doc.nombre);
          const ul = document.createElement('ol'); ul.className = 'vp-lista';
          const nombres = g.length === 1 ? [`${b}-paginas.pdf`] : g.map((x) => `${b}-${nombreDe(x)}.pdf`);
          ul.innerHTML = g.slice(0, 60).map((x, k) => `<li>${esc(nombres[k])} <small>· ${x.length} página${x.length === 1 ? '' : 's'}${x.length > 1 && x.length < 12 ? `: ${x.map((i) => i + 1).join(', ')}` : ''}</small></li>`).join('') + (g.length > 60 ? `<li>… y ${g.length - 60} más</li>` : '');
          return { nodo: ul, info: `${g.length} archivo${g.length === 1 ? '' : 's'}${g.length > 1 ? ' en un ZIP' : ''}` };
        }, 200);
      };
      panel.addEventListener('input', actualizar);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const g = grupos();
        const salida = await M.separar(doc.bytes, g, prog);
        const b = base(doc.nombre);
        if (salida.length === 1) return resultado(panel, { blob: pdfBlob(salida[0]), nombre: `${b}-paginas.pdf` });
        const grupos_ = g;
        const zip = crearZip(salida.map((d, k) => ({ nombre: `${b}-${nombreDe(grupos_[k])}.pdf`, datos: d })));
        await resultado(panel, { ver: false, blob: zip, nombre: `${b}-separado.zip`, detalle: `${salida.length} archivos · ${tamano(zip.size)}` });
      }));
    },
  },
  {
    id: 'pdf-convertir', alias: ['aimagenes', 'texto'], categoria: 'pdf', nombre: 'Convertir PDF', icono: I.aimagenes,
    desc: 'Cada página como imagen JPG o PNG, o todo el texto para copiarlo o guardarlo.',
    palabras: 'pdf a jpg png imagen imagenes texto txt extraer copiar',
    montar(el) {
      let doc = null, texto = null;
      unPdf(el, (it) => { doc = it; texto = null; panel.hidden = false; act(); });
      const panel = html(el, `<div class="panel" hidden>
        <div class="campo">Convertir a ${radios('modo', [['imagenes', 'Imágenes'], ['texto', 'Texto']], 'imagenes')}</div>
        <div data-modo="imagenes"><div class="opciones-rejilla">
          <div class="campo">Formato ${radios('formato', [['jpg', 'JPG'], ['png', 'PNG']], 'jpg')}</div>
          <label class="campo">Resolución <select name="ppp"><option value="72">Pantalla (72 ppp)</option><option value="150" selected>Buena (150 ppp)</option><option value="300">Impresión (300 ppp)</option></select></label>
          <label class="campo" data-si="jpg">Calidad <span class="valor" data-v="calidad">90 %</span><input type="range" name="calidad" min="40" max="100" step="5" value="90"></label>
          <label class="campo">Páginas <input type="text" name="paginas" placeholder="Todas (o p. ej. 1-3, 5)"></label>
        </div><div class="hueco-vista"></div>
        <p class="ayuda">Si sale más de una imagen, se descargan juntas en un ZIP.</p>
        <button type="button" class="btn acento grande" data-a="imagenes">Convertir</button></div>
        <div data-modo="texto" hidden>
          <textarea class="texto-salida" readonly></textarea>
          <div class="acciones-final"><button type="button" class="btn acento" data-a="txt">${I.descargar}Descargar .txt</button><button type="button" class="btn" data-a="copiar">${I.copiar}Copiar</button></div>
          <p class="ayuda">Si el PDF es un escaneo (una foto del papel), no tiene texto que sacar.</p></div>
        <div class="progreso"></div></div>`);
      const vista = new VistaPrevia($('.hueco-vista', panel), 'Vista previa (primera página elegida)');
      const indices = () => { const t = $('[name=paginas]', panel).value.trim(); return t ? [...new Set(rangos(t, doc.paginas).flat())] : null; };
      async function act() {
        const modo = valorRadio(panel, 'modo'), formato = valorRadio(panel, 'formato');
        $$('[data-modo]', panel).forEach((x) => { x.hidden = x.dataset.modo !== modo; });
        $('[data-si=jpg]', panel).hidden = formato !== 'jpg';
        $('[data-v=calidad]', panel).textContent = `${$('[name=calidad]', panel).value} %`;
        if (modo === 'imagenes') vista.programar(async () => {
          let ind; try { ind = indices(); } catch (e) { throw e; }
          const primera = ind ? ind[0] : 0, total = ind ? ind.length : doc.paginas;
          const [img] = await M.aImagenes(doc.bytes, { formato, ppp: Number($('[name=ppp]', panel).value), indices: [primera], nombre: base(doc.nombre), calidad: Number($('[name=calidad]', panel).value) / 100 });
          const blob = new Blob([img.datos], { type: formato === 'png' ? 'image/png' : 'image/jpeg' });
          const bm = await createImageBitmap(blob); const dims = `${bm.width}×${bm.height} px`; bm.close();
          return { blob, nombre: img.nombre, info: `Página ${primera + 1} · ${dims} · ${tamano(img.datos.length)}${total > 1 ? ` · ${total} imágenes, ≈ ${tamano(img.datos.length * total)} en total` : ''}` };
        });
        else if (texto === null) {
          const ta = $('textarea', panel); ta.value = 'Sacando el texto…';
          texto = await M.extraerTexto(doc.bytes, (m) => { $('.progreso', panel).textContent = m; });
          $('.progreso', panel).textContent = '';
          ta.value = texto;
          if (!texto.replace(/--- Página \d+ ---/g, '').trim()) aviso('Este PDF no tiene texto: probablemente es un escaneo', { error: true });
        }
      }
      panel.addEventListener('input', act);
      panel.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'txt') descargar(new Blob([texto || ''], { type: 'text/plain;charset=utf-8' }), `${base(doc.nombre)}.txt`);
        if (a === 'copiar') navigator.clipboard.writeText(texto || '').then(() => aviso('Texto copiado'), () => aviso('No se pudo copiar', { error: true }));
        if (a === 'imagenes') tarea(e.target.closest('button'), $('.progreso', panel), async (prog) => {
          const formato = valorRadio(panel, 'formato');
          const imgs = await M.aImagenes(doc.bytes, { formato, ppp: Number($('[name=ppp]', panel).value), indices: indices(), nombre: base(doc.nombre), calidad: Number($('[name=calidad]', panel).value) / 100 }, prog);
          if (imgs.length === 1) return resultado(panel, { blob: new Blob([imgs[0].datos], { type: formato === 'png' ? 'image/png' : 'image/jpeg' }), nombre: imgs[0].nombre });
          const zip = crearZip(imgs);
          await resultado(panel, { blob: zip, nombre: `${base(doc.nombre)}-imagenes.zip`, detalle: `${imgs.length} imágenes · ${tamano(zip.size)}` });
        });
      });
    },
  },
  {
    id: 'comprimir', categoria: 'pdf', nombre: 'Comprimir PDF', icono: I.comprimir,
    desc: 'Reduce lo que ocupa: sin perder nada, o mucho más convirtiendo las páginas en imágenes.',
    montar(el) {
      let doc = null;
      unPdf(el, (it) => { doc = it; panel.hidden = false; act(); });
      const panel = html(el, `<div class="panel" hidden>
        <div class="campo">Modo ${radios('modo', [['ligera', 'Ligera, sin perder calidad'], ['fuerte', 'Fuerte (páginas a imagen)']], 'ligera')}</div>
        <div data-modo="ligera"><label class="check"><input type="checkbox" name="meta"> Quitar también los metadatos (autor, programa…)</label>
          <p class="ayuda">Reorganiza el archivo por dentro. Ayuda poco o nada en PDF ya optimizados; no cambia nada de lo que se ve.</p></div>
        <div data-modo="fuerte" hidden><div class="opciones-rejilla">
          <label class="campo">Resolución <select name="ppp"><option value="72">Baja (72 ppp)</option><option value="110" selected>Media (110 ppp)</option><option value="150">Alta (150 ppp)</option></select></label>
          <label class="campo">Calidad JPEG <span class="valor" data-v="calidad">60 %</span><input type="range" name="calidad" min="30" max="90" step="5" value="60"></label>
          </div><label class="check"><input type="checkbox" name="gris"> Blanco y negro (ocupa aún menos)</label>
          <p class="ayuda">Ideal para escaneos y documentos con fotos. Ojo: el texto deja de poder seleccionarse o buscarse.</p><div class="hueco-vista"></div></div>
        <button type="button" class="btn acento grande">Comprimir</button><div class="progreso"></div></div>`);
      const vista = new VistaPrevia($('.hueco-vista', panel), 'Vista previa (primera página)');
      const opFuerte = () => ({ ppp: Number($('[name=ppp]', panel).value), calidad: Number($('[name=calidad]', panel).value) / 100, gris: $('[name=gris]', panel).checked });
      const act = () => {
        const modo = valorRadio(panel, 'modo');
        $$('[data-modo]', panel).forEach((x) => { x.hidden = x.dataset.modo !== modo; });
        $('[data-v=calidad]', panel).textContent = `${$('[name=calidad]', panel).value} %`;
        if (modo === 'fuerte' && doc) vista.programar(async () => {
          const una = await M.rasterizar(doc.bytes, { ...opFuerte(), limite: 1 });
          const est = una.length * doc.paginas;
          return { blob: pdfBlob(una), nombre: 'previa.pdf', info: `Ahora ${tamano(doc.bytes.length)} → ≈ ${tamano(est)} (estimado)` };
        });
      };
      panel.addEventListener('input', act);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const bytes = valorRadio(panel, 'modo') === 'ligera'
          ? await M.optimizar(doc.bytes, $('[name=meta]', panel).checked)
          : await M.rasterizar(doc.bytes, { ppp: Number($('[name=ppp]', panel).value), calidad: Number($('[name=calidad]', panel).value) / 100, gris: $('[name=gris]', panel).checked }, prog);
        const antes = doc.bytes.length, despues = bytes.length;
        const ahorro = Math.round((1 - despues / antes) * 100);
        if (despues >= antes) {
          $('.resultado', panel)?.remove();
          aviso(`No se ha podido reducir: el resultado ocuparía ${tamano(despues)} (el original, ${tamano(antes)}). Prueba el modo fuerte o una calidad más baja.`, { error: true });
          return;
        }
        await resultado(panel, { blob: pdfBlob(bytes), nombre: `${base(doc.nombre)}-comprimido.pdf`, detalle: `${tamano(antes)} → ${tamano(despues)} (−${ahorro} %)` });
      }));
    },
  },
  {
    id: 'numerar', categoria: 'pdf', nombre: 'Numerar páginas', icono: I.numerar,
    desc: 'Añade el número de página donde quieras.',
    montar(el) {
      let doc = null, act = () => {};
      unPdf(el, (it) => { doc = it; panel.hidden = false; act(); });
      const panel = html(el, `<div class="panel" hidden><div class="opciones-rejilla">
        <label class="campo">Posición <select name="posicion">
          <option value="abajo-centro">Abajo, centro</option><option value="abajo-derecha">Abajo, derecha</option><option value="abajo-izquierda">Abajo, izquierda</option>
          <option value="arriba-centro">Arriba, centro</option><option value="arriba-derecha">Arriba, derecha</option><option value="arriba-izquierda">Arriba, izquierda</option></select></label>
        <label class="campo">Formato <select name="formato"><option value="{n}">1</option><option value="{n} / {t}">1 / 10</option><option value="Página {n} de {t}">Página 1 de 10</option><option value="- {n} -">- 1 -</option></select></label>
        <label class="campo">Empezar en <input type="number" name="inicio" value="1" min="0"></label>
        <label class="campo">Tamaño <span class="valor" data-v="tamano">11 pt</span><input type="range" name="tamano" min="7" max="24" value="11"></label>
        <label class="campo">Margen <select name="margen"><option value="18">Pequeño</option><option value="30" selected>Normal</option><option value="48">Grande</option></select></label>
        <label class="campo">Color <input type="color" name="color" value="#333333"></label>
        </div><label class="check"><input type="checkbox" name="saltar"> No numerar la primera página (portada)</label>
        <div class="hueco-vista"></div>
        <button type="button" class="btn acento grande">Numerar</button><div class="progreso"></div></div>`);
      const vista = new VistaPrevia($('.hueco-vista', panel));
      const op = () => ({ posicion: $('[name=posicion]', panel).value, formato: $('[name=formato]', panel).value, inicio: Number($('[name=inicio]', panel).value) || 1,
        tamano: Number($('[name=tamano]', panel).value), margen: Number($('[name=margen]', panel).value), color: $('[name=color]', panel).value, saltarPrimera: $('[name=saltar]', panel).checked });
      const pagina = () => ($('[name=saltar]', panel).checked && doc.paginas > 1 ? 2 : 1);
      act = () => {
        $('[data-v=tamano]', panel).textContent = `${$('[name=tamano]', panel).value} pt`;
        vista.programar(async () => ({ blob: pdfBlob(await M.numerar(doc.bytes, op())), nombre: 'previa.pdf', pagina: pagina(), info: 'Así quedará' }), 450);
      };
      panel.addEventListener('input', act);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async () => {
        const bytes = await M.numerar(doc.bytes, op());
        await resultado(panel, { ver: false, blob: pdfBlob(bytes), nombre: `${base(doc.nombre)}-numerado.pdf` });
      }));
    },
  },
  {
    id: 'marca', categoria: 'pdf', nombre: 'Marca de agua', icono: I.marca,
    desc: 'Un texto como «CONFIDENCIAL» o «COPIA» encima de cada página.',
    montar(el) {
      let doc = null, act = () => {};
      unPdf(el, (it) => { doc = it; panel.hidden = false; act(); });
      const panel = html(el, `<div class="panel" hidden>
        <label class="campo">Texto <input type="text" name="texto" value="CONFIDENCIAL" maxlength="80"></label>
        <div class="opciones-rejilla">
        <div class="campo">Colocación ${radios('modo', [['centro', 'En el centro'], ['mosaico', 'Repetida']], 'centro')}</div>
        <label class="campo">Tamaño <span class="valor" data-v="tamano">60 pt</span><input type="range" name="tamano" min="12" max="140" value="60"></label>
        <label class="campo">Opacidad <span class="valor" data-v="opacidad">20 %</span><input type="range" name="opacidad" min="5" max="100" step="5" value="20"></label>
        <label class="campo">Ángulo <select name="angulo"><option value="45" selected>Diagonal ↗</option><option value="-45">Diagonal ↘</option><option value="0">Horizontal</option><option value="90">Vertical</option></select></label>
        <label class="campo">Color <input type="color" name="color" value="#b23a33"></label>
        </div><label class="check"><input type="checkbox" name="negrita" checked> Negrita</label>
        <div class="hueco-vista"></div>
        <button type="button" class="btn acento grande">Poner marca de agua</button><div class="progreso"></div></div>`);
      const vista = new VistaPrevia($('.hueco-vista', panel));
      const op = () => {
        const texto = $('[name=texto]', panel).value.trim();
        if (!texto) throw new Error('Escribe el texto de la marca de agua');
        if (/[^\x20-\x7e -ÿ€]/.test(texto)) throw new Error('El texto solo puede llevar letras latinas (sin emojis ni otros alfabetos)');
        return { texto, modo: valorRadio(panel, 'modo'), tamano: Number($('[name=tamano]', panel).value), opacidad: Number($('[name=opacidad]', panel).value) / 100,
          angulo: Number($('[name=angulo]', panel).value), color: $('[name=color]', panel).value, negrita: $('[name=negrita]', panel).checked };
      };
      act = () => {
        $('[data-v=tamano]', panel).textContent = `${$('[name=tamano]', panel).value} pt`;
        $('[data-v=opacidad]', panel).textContent = `${$('[name=opacidad]', panel).value} %`;
        vista.programar(async () => ({ blob: pdfBlob(await M.marcaAgua(doc.bytes, op())), nombre: 'previa.pdf', info: 'Así quedará' }), 450);
      };
      panel.addEventListener('input', act);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async () => {
        const bytes = await M.marcaAgua(doc.bytes, op());
        await resultado(panel, { ver: false, blob: pdfBlob(bytes), nombre: `${base(doc.nombre)}-marca.pdf` });
      }));
    },
  },
  {
    id: 'firmar', categoria: 'pdf', nombre: 'Firmar PDF', icono: I.firmar,
    desc: 'Dibuja tu firma (o sube una imagen) y colócala en la página.',
    montar(el) {
      let doc = null, vista = null, firma = null, pagina = 0, rect = { fx: 0.55, fy: 0.78, fw: 0.3, fh: 0.08 };
      unPdf(el, async (it) => { doc = it; vista?.destroy(); vista = await M.abrirVista(it.bytes); pagina = Math.max(0, it.paginas - 1); paso1.hidden = false; paso2.hidden = false; await pintarPagina(); });
      const paso1 = html(el, `<div class="panel" hidden><h3>1. Tu firma</h3>
        ${radios('origen', [['dibujar', 'Dibujarla'], ['imagen', 'Subir una imagen']], 'dibujar')}
        <div data-o="dibujar" style="margin-top:10px"><canvas class="firma-lienzo"></canvas>
          <div class="fila" style="margin-top:8px">${radios('color', [['#1c1f26', 'Negra'], ['#1d3a8a', 'Azul']], '#1c1f26')}<span class="separador" style="flex:1"></span><button type="button" class="btn pequeno" data-a="limpiar">Borrar</button></div></div>
        <div data-o="imagen" hidden style="margin-top:10px"><div class="hueco-img"></div>
          <label class="check"><input type="checkbox" name="fondo" checked> Quitar el fondo blanco</label></div></div>`);
      const paso2 = html(el, `<div class="panel" hidden><h3>2. Colócala</h3>
        <p class="ayuda">Arrastra la firma para moverla; el círculo de la esquina cambia su tamaño.</p>
        <div class="nav-pag"><button type="button" class="btn-icono" data-a="ant" aria-label="Página anterior">${I.izquierda}</button><span></span><button type="button" class="btn-icono" data-a="sig" aria-label="Página siguiente">${I.derecha}</button></div>
        <div class="colocar"><canvas class="fondo"></canvas><div class="firma-pos" hidden><img alt=""><span class="tirador"></span></div></div>
        <label class="check"><input type="checkbox" name="todas"> Poner la firma en todas las páginas</label>
        <button type="button" class="btn acento grande">Firmar</button><div class="progreso"></div>
        <p class="ayuda">Puedes firmar varias veces: cada firma se añade sobre el último resultado.</p></div>`);
      const pad = new PanelFirma($('canvas', paso1));
      const zonaImg = zona({ acepta: 'image/png,image/jpeg,image/webp', multiple: false, titulo: 'Elige la imagen de tu firma', compacta: true, alElegir: async ([f]) => { imgFirma = { bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type }; await actualizarFirma(); } });
      $('.hueco-img', paso1).appendChild(zonaImg);
      let imgFirma = null;
      const pos = $('.firma-pos', paso2), fondo = $('canvas.fondo', paso2), caja = $('.colocar', paso2);

      async function actualizarFirma() {
        if (firma?.url) URL.revokeObjectURL(firma.url);
        firma = null;
        if (valorRadio(paso1, 'origen') === 'dibujar') {
          const f = await pad.png();
          if (f) firma = { ...f, url: URL.createObjectURL(new Blob([f.bytes], { type: 'image/png' })) };
        } else if (imgFirma) firma = await imagenAFirma(imgFirma.bytes, imgFirma.mime, $('[name=fondo]', paso1).checked);
        pos.hidden = !firma;
        if (firma) {
          $('img', pos).src = firma.url;
          // Mantener la proporción de la firma con el ancho actual
          const vp = fondo.width / fondo.height;
          rect.fh = rect.fw * vp * (firma.alto / firma.ancho);
          colocar();
        }
      }
      pad.alCambiar = actualizarFirma;
      paso1.addEventListener('change', (e) => {
        if (e.target.name === 'color') { pad.color = e.target.value; for (const t of pad.trazos) t.color = e.target.value; pad.repintar(); }
        $$('[data-o]', paso1).forEach((x) => { x.hidden = x.dataset.o !== valorRadio(paso1, 'origen'); });
        actualizarFirma();
      });
      paso1.addEventListener('click', (e) => { if (e.target.closest('[data-a=limpiar]')) pad.borrar(); });

      async function pintarPagina() {
        const p = await vista.getPage(pagina + 1);
        const vp = p.getViewport({ scale: 1 });
        const ancho = Math.min(caja.parentElement.clientWidth - 4, 760);
        caja.style.width = ancho + 'px';
        await M.dibujar(p, (ancho * Math.min(2, devicePixelRatio || 1)) / vp.width, fondo);
        p.cleanup();
        $('.nav-pag span', paso2).textContent = `Página ${pagina + 1} de ${vista.numPages}`;
        $('[data-a=ant]', paso2).disabled = pagina === 0;
        $('[data-a=sig]', paso2).disabled = pagina >= vista.numPages - 1;
        if (firma) actualizarFirma(); else colocar();
      }
      function colocar() {
        rect.fx = Math.min(Math.max(0, rect.fx), 1 - rect.fw); rect.fy = Math.min(Math.max(0, rect.fy), 1 - rect.fh);
        Object.assign(pos.style, { left: rect.fx * 100 + '%', top: rect.fy * 100 + '%', width: rect.fw * 100 + '%', height: rect.fh * 100 + '%' });
      }
      paso2.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'ant' && pagina > 0) { pagina--; pintarPagina(); }
        if (a === 'sig' && pagina < vista.numPages - 1) { pagina++; pintarPagina(); }
      });
      // Arrastrar y redimensionar con ratón o dedo
      let gesto = null;
      pos.addEventListener('pointerdown', (e) => {
        e.preventDefault(); pos.setPointerCapture(e.pointerId);
        const r = caja.getBoundingClientRect();
        gesto = { tipo: e.target.classList.contains('tirador') ? 'tam' : 'mover', x: e.clientX, y: e.clientY, r, inicio: { ...rect } };
      });
      pos.addEventListener('pointermove', (e) => {
        if (!gesto) return;
        const dx = (e.clientX - gesto.x) / gesto.r.width, dy = (e.clientY - gesto.y) / gesto.r.height;
        if (gesto.tipo === 'mover') { rect.fx = gesto.inicio.fx + dx; rect.fy = gesto.inicio.fy + dy; }
        else {
          const prop = gesto.inicio.fh / gesto.inicio.fw;
          rect.fw = Math.min(1 - rect.fx, Math.max(0.04, gesto.inicio.fw + dx));
          rect.fh = rect.fw * prop;
        }
        colocar();
      });
      const soltar = () => { gesto = null; };
      pos.addEventListener('pointerup', soltar); pos.addEventListener('pointercancel', soltar);

      $('button.acento', paso2).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', paso2), async () => {
        if (!firma) throw new Error(valorRadio(paso1, 'origen') === 'dibujar' ? 'Dibuja primero tu firma' : 'Elige primero la imagen de tu firma');
        const bytes = await M.estampar(doc.bytes, firma.bytes, pagina, rect, $('[name=todas]', paso2).checked);
        doc = { ...doc, bytes };
        vista.destroy(); vista = await M.abrirVista(bytes);
        await pintarPagina();
        await resultado(paso2, { blob: pdfBlob(bytes), nombre: `${base(doc.nombre)}-firmado.pdf`, auto: false });
      }));
      return () => { vista?.destroy(); if (firma?.url) URL.revokeObjectURL(firma.url); };
    },
  },
  {
    id: 'metadatos', categoria: 'pdf', nombre: 'Metadatos', icono: I.metadatos,
    desc: 'Ve o cambia el título y el autor, o borra los datos ocultos del archivo.',
    montar(el) {
      let doc = null;
      unPdf(el, async (it) => {
        doc = it;
        const m = await M.leerMetadatos(it.bytes);
        for (const [k, v] of Object.entries(m)) { const i = $(`[name=${k}]`, panel); if (i) i.value = v; }
        const f = (d) => (d ? d.toLocaleString('es-ES') : '—');
        $('.fechas', panel).textContent = `Creado: ${f(m.creado)} · Modificado: ${f(m.modificado)}`;
        panel.hidden = false;
      });
      const panel = html(el, `<div class="panel" hidden><div class="tabla-meta">
        <label class="campo">Título <input type="text" name="titulo"></label>
        <label class="campo">Autor <input type="text" name="autor"></label>
        <label class="campo">Asunto <input type="text" name="asunto"></label>
        <label class="campo">Palabras clave <input type="text" name="palabras"></label>
        <label class="campo">Programa que lo creó <input type="text" name="creador"></label>
        <label class="campo">Programa que lo generó <input type="text" name="productor"></label>
        </div><p class="ayuda fechas"></p>
        <div class="acciones-final"><button type="button" class="btn acento grande" data-a="guardar">Guardar cambios</button>
        <button type="button" class="btn grande peligro" data-a="limpiar">Borrar todos los metadatos</button></div><div class="progreso"></div></div>`);
      panel.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        tarea(e.target.closest('button'), $('.progreso', panel), async () => {
          const m = Object.fromEntries(['titulo', 'autor', 'asunto', 'palabras', 'creador', 'productor'].map((k) => [k, $(`[name=${k}]`, panel).value.trim()]));
          const bytes = await M.escribirMetadatos(doc.bytes, m, a === 'limpiar');
          if (a === 'limpiar') $$('input', panel).forEach((i) => { i.value = ''; });
          await resultado(panel, { blob: pdfBlob(bytes), nombre: `${base(doc.nombre)}${a === 'limpiar' ? '-limpio' : ''}.pdf` });
        });
      });
    },
  },
];
