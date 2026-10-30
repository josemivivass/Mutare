// Herramientas de documentos y texto.
import { $, $$, aviso, tamano, base, esc, descargar } from '../util.js';
import { I } from '../iconos.js';
import { zona, prepararArchivos, ListaArchivos, tarea, resultado } from '../ui.js';
import { html, radios, valorRadio, unArchivo, entregar, conExtension } from './comun.js';
import * as D from '../motor-documentos.js';
import { codificacionDe, decodificar } from '../motor-datos.js';

const ACEPTA_TEXTO = 'text/*,.txt,.csv,.tsv,.srt,.vtt,.md,.json,.xml,.html,.htm,.ini,.log,.sql,.yml,.yaml,.toml';
const blob = (datos, mime) => new Blob([datos], { type: mime });

// Botones de salida comunes (PDF por impresión, HTML, etc.)
const botonesSalida = (extra = '') => `<div class="acciones-final">
  <button type="button" class="btn acento" data-s="pdf">${I.imprimir}Guardar como PDF</button>${extra}</div>
  <p class="ayuda">«Guardar como PDF» abre el cuadro de impresión del navegador: elige <b>Guardar como PDF</b> como impresora.</p>`;

export const DOCUMENTOS = [
  {
    id: 'doc-word', categoria: 'documentos', nombre: 'Word a PDF, HTML o texto', icono: I.word,
    desc: 'Abre un .docx y guárdalo como PDF, página web o texto, sin tener Office.',
    palabras: 'docx word office pdf html txt convertir documento',
    montar(el) {
      let it = null, cuerpo = '';
      unArchivo(el, { acepta: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', titulo: 'Elige un documento de Word (.docx)', alCargar: async (x) => {
        it = x; panel.hidden = false; $('.vista-doc', panel).textContent = 'Abriendo…';
        try {
          const r = await D.wordAHtml(x.bytes);
          cuerpo = await D.limpio(r.valor);
          $('.vista-doc', panel).innerHTML = cuerpo || '<p><i>El documento está vacío</i></p>';
          $('.avisos-doc', panel).textContent = r.avisos.length ? `Algunas cosas no se pueden copiar exactamente (${r.avisos.length}): estilos especiales, cuadros de texto, etc.` : '';
        } catch (e) { $('.vista-doc', panel).textContent = ''; aviso(`No se pudo abrir: ${e.message}`, { error: true }); panel.hidden = true; }
      } });
      const panel = html(el, `<div class="panel" hidden><div class="vista-doc"></div><p class="ayuda avisos-doc"></p>
        ${botonesSalida(`<button type="button" class="btn" data-s="html">${I.descargar}Página web (.html)</button><button type="button" class="btn" data-s="txt">${I.descargar}Texto (.txt)</button>`)}
        <p class="ayuda">Word no es HTML: tablas, listas, negritas e imágenes se conservan, pero el diseño exacto (márgenes, fuentes, columnas) puede cambiar.</p></div>`);
      panel.addEventListener('click', async (e) => {
        const s = e.target.closest('[data-s]')?.dataset.s; if (!s || !it) return;
        if (s === 'pdf') D.imprimir(cuerpo, base(it.nombre));
        if (s === 'html') descargar(blob(D.documentoHtml(cuerpo, base(it.nombre)), 'text/html;charset=utf-8'), conExtension(it.nombre, 'html'));
        if (s === 'txt') descargar(blob(await D.wordATexto(it.bytes), 'text/plain;charset=utf-8'), conExtension(it.nombre, 'txt'));
      });
    },
  },
  {
    id: 'doc-markdown', categoria: 'documentos', nombre: 'Markdown a Word, PDF o HTML', icono: I.markdown,
    desc: 'Escribe o abre un .md y conviértelo en un documento con formato.',
    palabras: 'md markdown readme notas word docx pdf html',
    montar(el) {
      let nombre = 'documento';
      el.appendChild(zona({ acepta: '.md,.markdown,.txt,text/markdown,text/plain', multiple: false, titulo: 'Abre un archivo .md', subtitulo: 'o escribe o pega el texto abajo', compacta: true, alElegir: async ([f]) => {
        nombre = base(f.name); $('textarea', panel).value = decodificar(new Uint8Array(await f.arrayBuffer())); previa();
      } }));
      const panel = html(el, `<div class="panel">
        <div class="disposicion-md" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
          <label class="campo">Markdown <textarea class="texto-entrada" spellcheck="false" placeholder="# Título&#10;&#10;Texto con **negrita**, *cursiva* y [enlaces](https://…).&#10;&#10;- Listas&#10;- de cosas"></textarea></label>
          <div class="campo">Vista previa <div class="vista-doc" style="margin:0;min-height:220px"></div></div>
        </div>
        ${botonesSalida(`<button type="button" class="btn" data-s="docx">${I.descargar}Word (.docx)</button><button type="button" class="btn" data-s="html">${I.descargar}Página web (.html)</button>`)}</div>`);
      let t = null;
      const previa = async () => { $('.vista-doc', panel).innerHTML = await D.markdownAHtml($('textarea', panel).value); };
      $('textarea', panel).addEventListener('input', () => { clearTimeout(t); t = setTimeout(previa, 250); });
      panel.addEventListener('click', async (e) => {
        const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return;
        const md = $('textarea', panel).value;
        if (!md.trim()) return aviso('Escribe o abre algo primero', { error: true });
        const titulo = /^#\s+(.+)$/m.exec(md)?.[1]?.trim() || nombre;
        const cuerpo = await D.markdownAHtml(md);
        if (s === 'pdf') D.imprimir(cuerpo, titulo);
        if (s === 'html') descargar(blob(D.documentoHtml(cuerpo, titulo), 'text/html;charset=utf-8'), `${nombre}.html`);
        if (s === 'docx') {
          try { descargar(blob(await D.markdownAWord(md, titulo), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), `${nombre}.docx`); }
          catch (err) { console.error(err); aviso(`No se pudo crear el Word: ${err.message}`, { error: true }); }
        }
      });
    },
  },
  {
    id: 'doc-codificacion', categoria: 'documentos', nombre: 'Arreglar acentos y codificación', icono: I.codificacion,
    desc: '¿Ves «Ã±» en vez de «ñ»? Cambia la codificación de textos, CSV o subtítulos.',
    palabras: 'utf-8 ansi windows-1252 latin1 iso bom acentos ñ caracteres raros csv excel subtitulos srt saltos de linea',
    montar(el) {
      el.appendChild(zona({ acepta: ACEPTA_TEXTO, titulo: 'Elige los archivos de texto', alElegir: async (f) => { lista.anadir(await prepararArchivos(f)); informe(); } }));
      const lista = new ListaArchivos(el, (items) => { panel.hidden = !items.length; informe(); }, { ordenable: false });
      const panel = html(el, `<div class="panel" hidden><div class="informe datos-ocultos"></div>
        <div class="opciones-rejilla">
          <label class="campo">Leer como <select name="origen"><option value="">Detectar sola</option><option value="utf-8">UTF-8</option><option value="windows-1252">Windows-1252 / ANSI</option><option value="iso-8859-15">ISO-8859-15</option><option value="utf-16le">UTF-16 LE</option><option value="ibm850">MS-DOS (850)</option><option value="macintosh">Mac antiguo</option></select></label>
          <label class="campo">Guardar como <select name="destino">${Object.entries(D.CODIFICACIONES).map(([k, v]) => `<option value="${k}" ${k === 'utf-8' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="campo">Saltos de línea <select name="saltos"><option value="">Como estén</option><option value="crlf">Windows (CRLF)</option><option value="lf">Linux / Mac (LF)</option></select></label>
        </div>
        <label class="check"><input type="checkbox" name="reparar"> Reparar texto ya estropeado («Ã±» → «ñ», «Ã©» → «é»)</label>
        <div class="campo">Vista previa del primero <pre class="texto-salida" style="max-height:180px;overflow:auto;white-space:pre-wrap"></pre></div>
        <button type="button" class="btn acento grande">Convertir</button><div class="progreso"></div></div>`);
      const texto = (it) => {
        let t = decodificar(it.bytes, $('[name=origen]', panel).value || codificacionDe(it.bytes));
        if ($('[name=reparar]', panel).checked) {
          try { const b = Uint8Array.from(t, (c) => { const n = c.charCodeAt(0); if (n > 255) { const m = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f }[c]; if (m === undefined) throw 0; return m; } return n; }); t = new TextDecoder('utf-8', { fatal: true }).decode(b); }
          catch { /* no estaba estropeado de esa forma */ }
        }
        const s = $('[name=saltos]', panel).value;
        if (s) t = t.replace(/\r\n|\r|\n/g, s === 'crlf' ? '\r\n' : '\n');
        return t;
      };
      function informe() {
        if (!lista.items.length) return;
        $('.informe', panel).innerHTML = lista.items.map((it) => `<div>${esc(it.nombre)}: parece <b>${esc(D.CODIFICACIONES[codificacionDe(it.bytes)] || codificacionDe(it.bytes))}</b>${/\r\n/.test(new TextDecoder('latin1').decode(it.bytes.subarray(0, 4096))) ? ', saltos de Windows' : ''}</div>`).join('');
        $('pre', panel).textContent = texto(lista.items[0]).slice(0, 1500);
      }
      panel.addEventListener('change', informe);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async () => {
        const destino = $('[name=destino]', panel).value;
        let perdidos = 0;
        const salida = lista.items.map((it) => { const r = D.codificar(texto(it), destino); perdidos += r.perdidos; return { nombre: it.nombre, datos: r.bytes, mime: 'text/plain' }; });
        if (perdidos) aviso(`${perdidos} carácter(es) no existen en esa codificación y se han cambiado por «?». Usa UTF-8 para conservarlos.`, { error: true });
        await entregar(panel, salida, 'textos.zip');
      }));
    },
  },
];
