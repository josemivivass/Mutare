// Arranque: tema, enrutado por #hash y pantalla de inicio.
import { $, esc } from './util.js';
import { I, ICONO_LUNA, ICONO_SOL } from './iconos.js';
import { HERRAMIENTAS } from './herramientas.js';

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
  try { localStorage.setItem('pdfconverter.tema', nuevo); } catch {}
  pintarBotonTema();
});
pintarBotonTema();

// ---- Pantallas
function inicio() {
  miga.hidden = true;
  document.title = 'PDF Converter';
  const grupos = [...new Set(HERRAMIENTAS.map((h) => h.grupo))];
  contenido.innerHTML = `
    <p class="privacidad">${I.candado}<span>Todo se hace en tu dispositivo: los archivos no se suben a ningún sitio, ni siquiera a este servidor. Puedes usarla sin conexión.</span></p>
    ${grupos.map((g) => `<h2 class="grupo-titulo">${esc(g)}</h2><div class="herramientas">
      ${HERRAMIENTAS.filter((h) => h.grupo === g).map((h) => `
        <a class="tarjeta-herr" href="#/${h.id}"><span class="icono-herr">${h.icono}</span><b>${esc(h.nombre)}</b><span>${esc(h.desc)}</span></a>`).join('')}
    </div>`).join('')}`;
}

function herramienta(h) {
  miga.hidden = false; miga.textContent = h.nombre;
  document.title = `${h.nombre} · PDF Converter`;
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
