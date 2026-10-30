// Herramientas de archivos ZIP.
import { $, $$, aviso, tamano, base, esc, descargar } from '../util.js';
import { I } from '../iconos.js';
import { zona, prepararArchivos, ListaArchivos, tarea, resultado } from '../ui.js';
import { html, unArchivo } from './comun.js';
import { crearZipComprimido, crearZip, leerZip } from '../zip.js';

export const ARCHIVOS = [
  {
    id: 'zip-crear', categoria: 'zip', nombre: 'Crear un ZIP', icono: I.zipCrear,
    desc: 'Junta varios archivos en un .zip comprimido para enviarlos de una vez.',
    palabras: 'comprimir zip juntar archivos enviar',
    montar(el) {
      el.appendChild(zona({ acepta: '*', titulo: 'Elige los archivos', alElegir: async (f) => lista.anadir(await prepararArchivos(f)) }));
      const lista = new ListaArchivos(el, (items) => {
        panel.hidden = !items.length;
        $('.info', panel).textContent = `${items.length} archivo${items.length === 1 ? '' : 's'} · ${tamano(items.reduce((s, x) => s + x.tam, 0))}`;
      }, { ordenable: false });
      const panel = html(el, `<div class="panel" hidden><p class="ayuda info"></p>
        <label class="campo">Nombre del ZIP <input type="text" name="nombre" value="archivos"></label>
        <label class="check"><input type="checkbox" name="comprimir" checked> Comprimir (las fotos, vídeos y PDF casi no se reducen; sin comprimir es más rápido)</label>
        <button type="button" class="btn acento grande">Crear ZIP</button><div class="progreso"></div></div>`);
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const archivos = lista.items.map((it) => ({ nombre: it.nombre, datos: it.bytes }));
        const zip = $('[name=comprimir]', panel).checked ? await crearZipComprimido(archivos, prog) : crearZip(archivos);
        const nombre = ($('[name=nombre]', panel).value.trim() || 'archivos').replace(/[\\/:*?"<>|]/g, '_').replace(/\.zip$/i, '');
        const antes = archivos.reduce((s, a) => s + a.datos.length, 0);
        await resultado(panel, { blob: zip, nombre: `${nombre}.zip`, detalle: `${tamano(antes)} → ${tamano(zip.size)}` });
      }));
    },
  },
  {
    id: 'zip-abrir', categoria: 'zip', nombre: 'Abrir un ZIP', icono: I.zipAbrir,
    desc: 'Mira lo que hay dentro de un .zip y saca solo lo que necesites.',
    palabras: 'descomprimir extraer unzip zip abrir',
    montar(el) {
      let entradas = [], it = null;
      unArchivo(el, { acepta: '.zip,application/zip,application/x-zip-compressed', titulo: 'Elige un archivo .zip', alCargar: (x) => {
        it = x;
        try { entradas = leerZip(x.bytes); } catch (e) { panel.hidden = true; return aviso(e.message, { error: true }); }
        const archivos = entradas.filter((e) => !e.carpeta);
        $('.info', panel).textContent = `${archivos.length} archivo${archivos.length === 1 ? '' : 's'} · ${tamano(archivos.reduce((s, e) => s + e.tam, 0))} sin comprimir`;
        $('ul', panel).innerHTML = entradas.map((e, k) => e.carpeta
          ? `<li><span>${I.carpeta}</span><span class="ruta carpeta">${esc(e.nombre)}</span><small></small><span></span></li>`
          : `<li><span>${I.archivo}</span><span class="ruta">${esc(e.nombre)}</span><small>${tamano(e.tam)}</small><button type="button" class="btn pequeno" data-k="${k}">${I.descargar}Sacar</button></li>`).join('');
        $('[data-a=carpeta]', panel).hidden = !('showDirectoryPicker' in window);
        panel.hidden = false;
      } });
      const panel = html(el, `<div class="panel" hidden><p class="ayuda info"></p>
        <div class="acciones-final"><button type="button" class="btn acento" data-a="carpeta">${I.carpeta}Extraer todo en una carpeta…</button></div>
        <ul class="entradas-zip"></ul><div class="progreso"></div></div>`);
      panel.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-k]');
        if (b) {
          const en = entradas[Number(b.dataset.k)];
          try { descargar(new Blob([await en.extraer()]), en.nombre.split('/').pop()); } catch (err) { aviso(err.message, { error: true }); }
          return;
        }
        if (e.target.closest('[data-a=carpeta]')) {
          let dir;
          try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch { return; }
          tarea(e.target.closest('button'), $('.progreso', panel), async (prog) => {
            const archivos = entradas.filter((x) => !x.carpeta);
            for (const [k, en] of archivos.entries()) {
              prog(`Extrayendo ${k + 1} de ${archivos.length}…`);
              const partes = en.nombre.split('/').filter((p) => p && p !== '.' && p !== '..');
              let d = dir;
              for (const p of partes.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
              const w = await (await d.getFileHandle(partes.at(-1), { create: true })).createWritable();
              await w.write(await en.extraer()); await w.close();
            }
            aviso(`${archivos.length} archivos extraídos en «${dir.name}»`);
          });
        }
      });
    },
  },
];
