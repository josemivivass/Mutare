// Herramientas de datos y hojas de cálculo.
import { $, $$, aviso, tamano, base, esc, descargar } from '../util.js';
import { I } from '../iconos.js';
import { zona, tarea, resultado } from '../ui.js';
import { html, radios, valorRadio, unArchivo, conExtension } from './comun.js';
import * as DA from '../motor-datos.js';
import { crearZip } from '../zip.js';

export const DATOS = [
  {
    id: 'datos-hojas', categoria: 'datos', nombre: 'Convertir hojas de cálculo', icono: I.hoja,
    desc: 'Excel, OpenDocument (LibreOffice), CSV o JSON, entre sí. Con vista previa.',
    palabras: 'excel xlsx xls ods libreoffice numbers csv json tabla hoja calculo separador punto y coma',
    montar(el) {
      let it = null, wb = null;
      unArchivo(el, { acepta: DA.ACEPTA_HOJA, titulo: 'Elige una hoja de cálculo', alCargar: async (x) => {
        it = x; wb = await DA.abrirLibro(x);
        const sel = $('[name=hoja]', panel);
        sel.innerHTML = wb.SheetNames.map((n) => `<option>${esc(n)}</option>`).join('');
        $('[data-si=hojas]', panel).hidden = wb.SheetNames.length < 2;
        panel.hidden = false; act(); await previa();
      } });
      const panel = html(el, `<div class="panel" hidden><div class="opciones-rejilla">
          <label class="campo" data-si="hojas">Hoja <select name="hoja"></select></label>
          <label class="campo">Guardar como <select name="formato">${Object.entries(DA.SALIDAS_HOJA).map(([k, f]) => `<option value="${k}">${f.nombre}</option>`).join('')}</select></label>
          <label class="campo" data-si="csv">Separador <select name="sep"><option value=";">Punto y coma (;)</option><option value=",">Coma (,)</option><option value="&#9;">Tabulador</option></select></label>
        </div>
        <p class="ayuda" data-si="csv">Excel en español usa punto y coma y la coma para los decimales; en inglés, coma y punto.</p>
        <label class="check" data-si="csv"><input type="checkbox" name="bom" checked> Que Excel reconozca los acentos (UTF-8 con BOM)</label>
        <label class="check" data-si="todas"><input type="checkbox" name="todas"> Todas las hojas (un archivo por hoja, en un ZIP)</label>
        <div class="tabla-previa"></div><p class="ayuda info"></p>
        <button type="button" class="btn acento grande">Convertir</button><div class="progreso"></div></div>`);
      const act = () => {
        const f = $('[name=formato]', panel).value, una = DA.SALIDAS_HOJA[f].unaHoja;
        $$('[data-si=csv]', panel).forEach((x) => { x.hidden = f !== 'csv'; });
        $('[data-si=todas]', panel).hidden = !una || !wb || wb.SheetNames.length < 2;
      };
      async function previa() {
        const hoja = $('[name=hoja]', panel).value;
        const { filas, total } = await DA.vistaPrevia(wb, hoja);
        const ancho = Math.max(0, ...filas.map((f) => f.length));
        $('.tabla-previa', panel).innerHTML = filas.length ? `<table>${filas.map((f, k) => `<tr>${Array.from({ length: ancho }, (_, c) => `<${k ? 'td' : 'th'}>${esc(f[c] ?? '')}</${k ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>` : '<p class="ayuda" style="padding:10px">La hoja está vacía</p>';
        $('.info', panel).textContent = `${total} fila${total === 1 ? '' : 's'}${total > filas.length ? ` (se ven las ${filas.length} primeras)` : ''}`;
      }
      panel.addEventListener('change', (e) => { act(); if (e.target.name === 'hoja') previa(); });
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async () => {
        const f = $('[name=formato]', panel).value, S = DA.SALIDAS_HOJA[f];
        const op = { hoja: $('[name=hoja]', panel).value, separador: $('[name=sep]', panel).value, bom: $('[name=bom]', panel).checked };
        if (S.unaHoja && $('[name=todas]', panel).checked && wb.SheetNames.length > 1) {
          const archivos = [];
          for (const h of wb.SheetNames) archivos.push({ nombre: `${base(it.nombre)} - ${h.replace(/[\\/:*?"<>|]/g, '_')}.${S.ext}`, datos: await DA.guardarLibro(wb, f, { ...op, hoja: h }) });
          const zip = crearZip(archivos);
          return resultado(panel, { blob: zip, nombre: `${base(it.nombre)}-${f}.zip`, detalle: `${archivos.length} hojas · ${tamano(zip.size)}` });
        }
        const datos = await DA.guardarLibro(wb, f, op);
        const nombre = S.unaHoja && wb.SheetNames.length > 1 ? `${base(it.nombre)} - ${op.hoja}.${S.ext}` : conExtension(it.nombre, S.ext);
        await resultado(panel, { blob: new Blob([datos], { type: S.mime }), nombre, detalle: tamano(datos.length) });
      }));
    },
  },
  {
    id: 'datos-formatos', categoria: 'datos', nombre: 'JSON, YAML, TOML, XML y CSV', icono: I.datos,
    desc: 'Pasa datos de un formato a otro, o pon bonito (o compacta) un JSON.',
    palabras: 'json yaml yml toml xml csv formatear validar bonito minificar configuracion',
    montar(el) {
      let nombre = 'datos';
      el.appendChild(zona({ acepta: '.json,.yaml,.yml,.toml,.xml,.csv,.txt', multiple: false, titulo: 'Abre un archivo', subtitulo: 'o pega el texto abajo', compacta: true, alElegir: async ([f]) => {
        nombre = base(f.name);
        const t = DA.decodificar(new Uint8Array(await f.arrayBuffer()));
        $('[name=entrada]', panel).value = t;
        $('[name=de]', panel).value = DA.detectar(t, f.name);
        convertir();
      } }));
      const opciones = Object.entries(DA.FORMATOS_DATOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
      const panel = html(el, `<div class="panel">
        <div class="opciones-rejilla">
          <label class="campo">De <select name="de"><option value="auto">Detectar</option>${opciones}</select></label>
          <label class="campo">A <select name="a">${opciones.replace('value="yaml"', 'value="yaml" selected')}</select></label>
        </div>
        <label class="check" data-si="json"><input type="checkbox" name="compacto"> JSON compacto (en una línea)</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
          <label class="campo">Entrada <textarea name="entrada" class="texto-entrada" spellcheck="false"></textarea></label>
          <label class="campo">Resultado <textarea name="salida" class="texto-entrada" readonly spellcheck="false"></textarea></label>
        </div>
        <p class="ayuda error-datos"></p>
        <div class="acciones-final"><button type="button" class="btn acento" data-a="bajar">${I.descargar}Descargar</button><button type="button" class="btn" data-a="copiar">${I.copiar}Copiar</button></div>
        <p class="ayuda">De XML se pasan los atributos como «@nombre». A CSV solo se pueden pasar listas de elementos (se aplanan: «direccion.ciudad»).</p></div>`);
      let t = null;
      async function convertir() {
        const entrada = $('[name=entrada]', panel).value;
        const a = $('[name=a]', panel).value;
        $('[data-si=json]', panel).hidden = a !== 'json';
        if (!entrada.trim()) { $('[name=salida]', panel).value = ''; $('.error-datos', panel).textContent = ''; return; }
        let de = $('[name=de]', panel).value;
        if (de === 'auto') de = DA.detectar(entrada);
        try {
          const dato = await DA.leerDatos(entrada, de);
          $('[name=salida]', panel).value = await DA.escribirDatos(dato, a, { compacto: $('[name=compacto]', panel).checked });
          $('.error-datos', panel).textContent = `Leído como ${DA.FORMATOS_DATOS[de]}.`;
          $('.error-datos', panel).classList.remove('error');
        } catch (e) {
          $('[name=salida]', panel).value = '';
          $('.error-datos', panel).textContent = e.message;
          $('.error-datos', panel).classList.add('error');
        }
      }
      panel.addEventListener('input', (e) => {
        if (e.target.name === 'salida') return;
        if (e.target.name === 'entrada') $('[name=de]', panel).value = 'auto'; // texto nuevo: detectar otra vez
        clearTimeout(t); t = setTimeout(convertir, 300);
      });
      panel.addEventListener('change', convertir);
      panel.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const v = $('[name=salida]', panel).value;
        if (!v) return aviso('No hay nada que guardar todavía', { error: true });
        const f = $('[name=a]', panel).value;
        if (a === 'bajar') descargar(new Blob([v], { type: 'text/plain;charset=utf-8' }), `${nombre}.${f}`);
        else navigator.clipboard.writeText(v).then(() => aviso('Copiado'), () => aviso('No se pudo copiar', { error: true }));
      });
    },
  },
];
