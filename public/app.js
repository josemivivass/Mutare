// Arranque: tema, enrutado por #hash y pantalla de inicio.
import { $, esc } from './util.js';
import { I, ICONO_LUNA, ICONO_SOL } from './iconos.js';
import { PDF } from './herramientas/pdf.js';
import { IMAGENES } from './herramientas/imagenes.js';
import { MULTIMEDIA } from './herramientas/multimedia.js';
import { DOCUMENTOS } from './herramientas/documentos.js';
import { DATOS } from './herramientas/datos.js';
import { ARCHIVOS } from './herramientas/archivos.js';

const CATEGORIAS = [
  { id: 'pdf', nombre: 'PDF', desc: 'Juntar, separar, ordenar, convertir, numerar, firmar…' },
  { id: 'imagenes', nombre: 'Imágenes', desc: 'Cambiar de formato (también HEIC del iPhone), tamaño, peso y datos ocultos.' },
  { id: 'multimedia', nombre: 'Audio y vídeo', desc: 'Convertir, comprimir, recortar y sacar el sonido.' },
  { id: 'documentos', nombre: 'Documentos y texto', desc: 'Word, Markdown y textos con acentos estropeados.' },
  { id: 'datos', nombre: 'Datos y hojas de cálculo', desc: 'Excel, CSV, JSON, YAML, TOML y XML.' },
  { id: 'zip', nombre: 'Archivos ZIP', desc: 'Crear y abrir archivos comprimidos.' },
];
const HERRAMIENTAS = [...PDF, ...IMAGENES, ...MULTIMEDIA, ...DOCUMENTOS, ...DATOS, ...ARCHIVOS];
const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const contenido = $('#contenido'), miga = $('#miga');
let limpiar = null;

// ---- Tema claro / oscuro (tema.js ya lo aplicó antes de pintar)
const btnTema = $('#btn-tema');
function pintarBotonTema() {
  const oscuro = document.documentElement.dataset.theme === 'dark';
  btnTema.innerHTML = oscuro ? ICONO_SOL : ICONO_LUNA;
  btnTema.title = btnTema.ariaLabel = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
}
btnTema.addEventListener('click', () => {
  const nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('mutare.tema', nuevo); } catch {}
  pintarBotonTema();
});
pintarBotonTema();

// ---- Pantallas
let busqueda = '';
function inicio() {
  miga.hidden = true;
  document.title = 'Mutare';
  const tarjeta = (h) => `<a class="tarjeta-herr" href="#/${h.id}" data-buscar="${esc(normal(`${h.nombre} ${h.desc} ${h.palabras || ''}`))}"><span class="icono-herr">${h.icono}</span><b>${esc(h.nombre)}</b><span>${esc(h.desc)}</span></a>`;
  contenido.innerHTML = `
    <p class="privacidad">${I.candado}<span>Todo se hace en tu dispositivo: los archivos no se suben a ningún sitio, ni siquiera a este servidor. Puedes usarla sin conexión.</span></p>
    <div class="buscador"><input type="search" id="buscar" placeholder="Buscar: heic, mp3, excel, firmar…" aria-label="Buscar herramienta" value="${esc(busqueda)}" autocomplete="off">
      <nav class="saltos" aria-label="Categorías">${CATEGORIAS.map((c) => `<a href="#" data-ir="${c.id}">${esc(c.nombre)}</a>`).join('')}</nav></div>
    ${CATEGORIAS.map((c) => `<section class="categoria" id="cat-${c.id}"><h2 class="grupo-titulo">${esc(c.nombre)}</h2><p class="categoria-desc">${esc(c.desc)}</p>
      <div class="herramientas">${HERRAMIENTAS.filter((h) => h.categoria === c.id).map(tarjeta).join('')}</div></section>`).join('')}
    <p class="sin-resultados" hidden>No hay ninguna herramienta con ese nombre.</p>`;
  const caja = $('#buscar');
  const filtrar = () => {
    busqueda = caja.value;
    const q = normal(busqueda.trim()).split(/\s+/).filter(Boolean);
    let alguna = false;
    contenido.querySelectorAll('.categoria').forEach((sec) => {
      let n = 0;
      sec.querySelectorAll('.tarjeta-herr').forEach((t) => { const si = q.every((w) => t.dataset.buscar.includes(w)); t.hidden = !si; n += si; });
      sec.hidden = !n; alguna ||= !!n;
    });
    $('.sin-resultados', contenido).hidden = alguna;
  };
  caja.addEventListener('input', filtrar);
  filtrar();
  contenido.querySelector('.saltos').addEventListener('click', (e) => {
    const c = e.target.closest('[data-ir]'); if (!c) return;
    e.preventDefault();
    if (caja.value) { caja.value = ''; filtrar(); }
    document.getElementById(`cat-${c.dataset.ir}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function herramienta(h) {
  miga.hidden = false; miga.textContent = `${CATEGORIAS.find((c) => c.id === h.categoria).nombre} · ${h.nombre}`;
  document.title = `${h.nombre} · Mutare`;
  contenido.innerHTML = `<a class="volver" href="#">${I.volver}Todas las herramientas</a>
    <div class="cab-herr"><span class="icono-herr">${h.icono}</span><div><h2>${esc(h.nombre)}</h2><p>${esc(h.desc)}</p></div></div>
    <div class="cuerpo-herr"></div>`;
  limpiar = h.montar($('.cuerpo-herr', contenido)) || null;
}

function rutar() {
  try { limpiar?.(); } catch (e) { console.error(e); }
  limpiar = null;
  const id = location.hash.replace(/^#\/?/, '');
  const h = HERRAMIENTAS.find((x) => x.id === id);
  h ? herramienta(h) : inicio();
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rutar);
rutar();

// ---- Funcionar sin conexión (y poder instalarla como app)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
