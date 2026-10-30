// Componentes de la interfaz que comparten las herramientas.

import { $, $$, esc, aviso, tamano, leer, descargar, puedeCompartir, compartir } from './util.js';
import { I } from './iconos.js';
import { abrirVista, dibujar, esPdf } from './motor.js';

export const ACEPTA_PDF = 'application/pdf,.pdf';
export const ACEPTA_IMG = 'image/*';
export const ACEPTA_TODO = 'application/pdf,.pdf,image/*';

// ---------------------------------------------------------------------------
// Zona para elegir o soltar archivos
// ---------------------------------------------------------------------------

export function zona({ acepta, multiple = true, titulo, subtitulo = 'o arrástralos aquí', compacta = false, alElegir }) {
  const el = document.createElement('label');
  el.className = 'zona' + (compacta ? ' compacta' : '');
  el.innerHTML = `${I.subir}<b>${esc(titulo)}</b><span>${esc(subtitulo)}</span>
    <input type="file" accept="${acepta}" ${multiple ? 'multiple' : ''}>`;
  const input = $('input', el);
  const valido = (f) => (acepta.includes('pdf') && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)))
    || (acepta.includes('image') && f.type.startsWith('image/'));
  const recibir = (lista) => {
    const todos = [...lista];
    const buenos = todos.filter(valido);
    if (buenos.length < todos.length) aviso(`${todos.length - buenos.length} archivo(s) no son del tipo esperado y se han ignorado`, { error: true });
    if (buenos.length) alElegir(multiple ? buenos : buenos.slice(0, 1));
  };
  input.addEventListener('change', () => { recibir(input.files); input.value = ''; });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('encima'); });
  el.addEventListener('dragleave', () => el.classList.remove('encima'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('encima'); recibir(e.dataTransfer.files); });
  return el;
}

// Lee archivos a memoria y averigua lo básico de cada uno
export async function prepararArchivos(files) {
  const salida = [];
  for (const f of files) {
    const bytes = await leer(f);
    const it = { id: crypto.randomUUID(), nombre: f.name, mime: f.type, bytes, tam: f.size, pdf: esPdf(bytes) };
    if (it.pdf) {
      try { const v = await abrirVista(bytes); it.paginas = v.numPages; v.destroy(); }
      catch (e) { aviso(`No se pudo abrir «${f.name}»: ${/password/i.test(e.name + e.message) ? 'tiene contraseña' : e.message}`, { error: true }); continue; }
    }
    salida.push(it);
  }
  return salida;
}

// Miniatura de la primera página de un PDF, o de una imagen
async function miniatura(it, caja) {
  if (it.pdf) {
    const v = await abrirVista(it.bytes);
    try {
      const p = await v.getPage(1);
      const vp = p.getViewport({ scale: 1 });
      caja.appendChild(await dibujar(p, Math.min(120 / vp.width, 150 / vp.height)));
    } finally { v.destroy(); }
  } else {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([it.bytes], { type: it.mime }));
    img.onload = () => URL.revokeObjectURL(img.src);
    img.alt = '';
    caja.appendChild(img);
  }
}

// ---------------------------------------------------------------------------
// Lista de archivos ordenable (juntar, imágenes a PDF)
// ---------------------------------------------------------------------------

export class ListaArchivos {
  constructor(contenedor, alCambiar = () => {}) {
    this.el = document.createElement('div');
    this.el.className = 'lista-arch';
    contenedor.appendChild(this.el);
    this.items = [];
    this.alCambiar = alCambiar;
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acc]'); if (!b) return;
      const k = this.items.findIndex((x) => x.id === b.closest('.arch').dataset.id);
      if (b.dataset.acc === 'quitar') this.items.splice(k, 1);
      else this.mover(k, k + Number(b.dataset.acc));
      this.pintar();
    });
    // Arrastrar para ordenar (ratón)
    let origen = null;
    this.el.addEventListener('dragstart', (e) => { origen = e.target.closest('.arch'); origen?.classList.add('arrastrando'); });
    this.el.addEventListener('dragend', () => { origen?.classList.remove('arrastrando'); $$('.destino', this.el).forEach((x) => x.classList.remove('destino')); origen = null; });
    this.el.addEventListener('dragover', (e) => {
      const d = e.target.closest('.arch'); if (!origen || !d) return;
      e.preventDefault(); $$('.destino', this.el).forEach((x) => x.classList.remove('destino')); d.classList.add('destino');
    });
    this.el.addEventListener('drop', (e) => {
      const d = e.target.closest('.arch'); if (!origen || !d) return;
      e.preventDefault();
      this.mover(this.items.findIndex((x) => x.id === origen.dataset.id), this.items.findIndex((x) => x.id === d.dataset.id));
      this.pintar();
    });
  }
  mover(de, a) {
    if (a < 0 || a >= this.items.length || de === a) return;
    const [x] = this.items.splice(de, 1); this.items.splice(a, 0, x);
  }
  anadir(items) { this.items.push(...items); this.pintar(); }
  pintar() {
    const viejas = new Map($$('.arch', this.el).map((n) => [n.dataset.id, n]));
    this.el.replaceChildren(...this.items.map((it, k) => {
      let n = viejas.get(it.id);
      if (!n) {
        n = document.createElement('div');
        n.className = 'arch'; n.draggable = true; n.dataset.id = it.id;
        n.innerHTML = `<div class="arch-mini"></div>
          <div><div class="arch-nombre">${esc(it.nombre)}</div><div class="arch-info">${it.pdf ? `${it.paginas} página${it.paginas === 1 ? '' : 's'} · ` : ''}${tamano(it.tam)}</div></div>
          <div class="arch-acciones">
            <button type="button" class="btn-icono" data-acc="-1" title="Subir" aria-label="Subir">${I.arriba}</button>
            <button type="button" class="btn-icono" data-acc="1" title="Bajar" aria-label="Bajar">${I.abajo}</button>
            <button type="button" class="btn-icono" data-acc="quitar" title="Quitar" aria-label="Quitar">${I.quitar}</button>
          </div>`;
        miniatura(it, $('.arch-mini', n)).catch(() => {});
      }
      $('[data-acc="-1"]', n).disabled = k === 0;
      $('[data-acc="1"]', n).disabled = k === this.items.length - 1;
      return n;
    }));
    this.alCambiar(this.items);
  }
}

// ---------------------------------------------------------------------------
// Rejilla de páginas: miniaturas que se dibujan al verse en pantalla.
// fuentes: [{ nombre, bytes, vista (pdf.js) }]
// paginas: [{ id, f, i, giro, blanca?: [w, h] }]
// ---------------------------------------------------------------------------

let contador = 0;
export class RejillaPaginas {
  constructor(contenedor, { seleccionable = true, ordenable = false, acciones = [], alCambiar = () => {} } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'paginas';
    contenedor.appendChild(this.el);
    Object.assign(this, { seleccionable, ordenable, acciones, alCambiar });
    this.fuentes = []; this.paginas = []; this.sel = new Set();
    this.observador = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { this.observador.unobserve(e.target); this.dibujar(e.target); }
    }, { rootMargin: '300px' });

    this.el.addEventListener('click', (e) => {
      const n = e.target.closest('.pag'); if (!n) return;
      const b = e.target.closest('[data-acc]');
      const p = this.paginas.find((x) => x.id === n.dataset.id);
      if (b) {
        if (b.dataset.acc === 'girar') { p.giro = (p.giro + 90) % 360; this.aplicarGiro(n, p); }
        if (b.dataset.acc === 'borrar') { this.paginas = this.paginas.filter((x) => x !== p); this.sel.delete(p.id); n.remove(); this.numerar(); }
        this.alCambiar(); return;
      }
      if (!this.seleccionable) return;
      this.sel.has(p.id) ? this.sel.delete(p.id) : this.sel.add(p.id);
      n.classList.toggle('sel', this.sel.has(p.id));
      this.alCambiar();
    });

    if (ordenable) {
      let origen = null;
      this.el.addEventListener('dragstart', (e) => { origen = e.target.closest('.pag'); origen.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; });
      this.el.addEventListener('dragend', () => { origen?.classList.remove('arrastrando'); this.limpiarDestino(); origen = null; });
      this.el.addEventListener('dragover', (e) => {
        const d = e.target.closest('.pag'); if (!origen || !d || d === origen) return;
        e.preventDefault(); this.limpiarDestino();
        const r = d.getBoundingClientRect();
        d.classList.add(e.clientX < r.left + r.width / 2 ? 'destino-antes' : 'destino-despues');
      });
      this.el.addEventListener('drop', (e) => {
        const d = e.target.closest('.pag'); if (!origen || !d || d === origen) return;
        e.preventDefault();
        const antes = d.classList.contains('destino-antes');
        const p = this.paginas.find((x) => x.id === origen.dataset.id);
        this.paginas.splice(this.paginas.indexOf(p), 1);
        const k = this.paginas.findIndex((x) => x.id === d.dataset.id);
        this.paginas.splice(antes ? k : k + 1, 0, p);
        antes ? d.before(origen) : d.after(origen);
        this.limpiarDestino(); this.numerar(); this.alCambiar();
      });
    }
  }
  limpiarDestino() { $$('.destino-antes, .destino-despues', this.el).forEach((x) => x.classList.remove('destino-antes', 'destino-despues')); }

  async anadirPdf(nombre, bytes) {
    const vista = await abrirVista(bytes);
    const f = this.fuentes.push({ nombre, bytes, vista }) - 1;
    for (let i = 0; i < vista.numPages; i++) this.paginas.push({ id: 'p' + ++contador, f, i, giro: 0 });
    this.pintar();
    return vista.numPages;
  }
  anadirBlanca(tras = null) {
    // Mismo tamaño que la página anterior, o A4
    const ref = tras || this.paginas[this.paginas.length - 1];
    const p = { id: 'p' + ++contador, blanca: ref?.tam || [595.28, 841.89], giro: 0 };
    const k = tras ? this.paginas.indexOf(tras) + 1 : this.paginas.length;
    this.paginas.splice(k, 0, p);
    this.pintar();
  }

  pintar() {
    const viejas = new Map($$('.pag', this.el).map((n) => [n.dataset.id, n]));
    const varias = this.fuentes.length > 1;
    this.el.replaceChildren(...this.paginas.map((p) => {
      let n = viejas.get(p.id);
      if (!n) {
        n = document.createElement('div');
        n.className = 'pag'; n.dataset.id = p.id; n.draggable = this.ordenable;
        n.innerHTML = `<span class="pag-marca">${I.check}</span>
          ${varias && !p.blanca ? `<span class="pag-origen" title="${esc(this.fuentes[p.f].nombre)}">${String.fromCharCode(65 + (p.f % 26))}</span>` : ''}
          <div class="pag-lienzo">${p.blanca ? '<div class="pag-blanca"></div>' : ''}</div>
          <div class="pag-pie"><span class="pag-num"></span><span class="pag-acc">
            ${this.acciones.includes('girar') ? `<button type="button" class="btn-icono" data-acc="girar" title="Girar" aria-label="Girar">${I.girarDer}</button>` : ''}
            ${this.acciones.includes('borrar') ? `<button type="button" class="btn-icono" data-acc="borrar" title="Quitar página" aria-label="Quitar página">${I.borrar}</button>` : ''}
          </span></div>`;
        if (!p.blanca) this.observador.observe(n);
      }
      // Si se ha añadido otro PDF después, las páginas ya pintadas también llevan su letra
      if (varias && !p.blanca && !$('.pag-origen', n)) n.insertAdjacentHTML('afterbegin', `<span class="pag-origen" title="${esc(this.fuentes[p.f].nombre)}">${String.fromCharCode(65 + (p.f % 26))}</span>`);
      n.classList.toggle('sel', this.sel.has(p.id));
      return n;
    }));
    this.numerar();
    this.alCambiar();
  }
  numerar() {
    $$('.pag', this.el).forEach((n, k) => {
      const p = this.paginas[k];
      $('.pag-num', n).textContent = p.blanca ? `${k + 1} · en blanco` : (this.fuentes.length > 1 ? `${k + 1} · ${String.fromCharCode(65 + (p.f % 26))}${p.i + 1}` : `${k + 1}`);
    });
  }

  async dibujar(n) {
    const p = this.paginas.find((x) => x.id === n.dataset.id); if (!p) return;
    try {
      const pag = await this.fuentes[p.f].vista.getPage(p.i + 1);
      const vp = pag.getViewport({ scale: 1 });
      p.tam = [vp.width, vp.height];
      const ppx = Math.min(2, devicePixelRatio || 1);
      const c = await dibujar(pag, (150 * ppx) / Math.max(vp.width, vp.height));
      pag.cleanup();
      $('.pag-lienzo', n).replaceChildren(c);
      this.aplicarGiro(n, p);
    } catch (e) { $('.pag-lienzo', n).textContent = '⚠'; }
  }
  aplicarGiro(n, p) {
    const c = $('.pag-lienzo canvas, .pag-lienzo .pag-blanca', n); if (!c) return;
    const caja = $('.pag-lienzo', n);
    let escala = 1;
    if (p.giro % 180) escala = Math.min(1, caja.clientWidth / c.offsetHeight, caja.clientHeight / c.offsetWidth);
    c.style.transform = p.giro ? `rotate(${p.giro}deg) scale(${escala})` : '';
  }

  seleccionadas() { return this.paginas.filter((p) => this.sel.has(p.id)); }
  seleccionarTodo(si) { this.sel = new Set(si ? this.paginas.map((p) => p.id) : []); this.pintar(); }
  girar(grados, lista) {
    for (const p of lista) p.giro = (((p.giro + grados) % 360) + 360) % 360;
    $$('.pag', this.el).forEach((n, k) => this.aplicarGiro(n, this.paginas[k]));
    this.alCambiar();
  }
  borrar(lista) { const s = new Set(lista); this.paginas = this.paginas.filter((p) => !s.has(p)); for (const p of lista) this.sel.delete(p.id); this.pintar(); }
  // Mueve las seleccionadas un puesto (para móvil, donde no se puede arrastrar)
  mover(paso) {
    const sel = this.seleccionadas(); if (!sel.length) return;
    const orden = paso < 0 ? sel : [...sel].reverse();
    for (const p of orden) {
      const k = this.paginas.indexOf(p), d = k + paso;
      if (d < 0 || d >= this.paginas.length || this.sel.has(this.paginas[d].id)) continue;
      [this.paginas[k], this.paginas[d]] = [this.paginas[d], this.paginas[k]];
    }
    this.pintar();
  }
  // Lo que necesita motor.componer()
  plan(lista = this.paginas) { return lista.map((p) => (p.blanca ? { blanca: p.blanca } : { f: p.f, i: p.i, giro: p.giro })); }
  destruir() { this.observador.disconnect(); for (const f of this.fuentes) f.vista.destroy(); this.fuentes = []; }
}

// ---------------------------------------------------------------------------
// Resultado: descarga, compartir y vista previa opcional de una página
// ---------------------------------------------------------------------------

export async function resultado(contenedor, { blob, nombre, detalle = '', auto = true, previa = null }) {
  $('.resultado', contenedor)?.remove();
  const div = document.createElement('div');
  div.className = 'resultado';
  div.innerHTML = `${I.ok}<div class="res-texto"><b>${esc(nombre)}</b><small>${esc(detalle || tamano(blob.size))}</small></div>
    <div class="acciones-final">
      <button type="button" class="btn acento" data-r="bajar">${I.descargar}Descargar</button>
      ${puedeCompartir(blob, nombre) ? `<button type="button" class="btn" data-r="compartir">${I.compartir}Compartir</button>` : ''}
    </div>`;
  div.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    b.dataset.r === 'bajar' ? descargar(blob, nombre) : compartir(blob, nombre);
  });
  contenedor.appendChild(div);
  if (auto) descargar(blob, nombre);
  if (previa) {
    const caja = document.createElement('div');
    caja.style.cssText = 'flex-basis:100%;display:flex;justify-content:center;padding-top:6px';
    div.appendChild(caja);
    const v = await abrirVista(new Uint8Array(await blob.arrayBuffer()));
    try {
      const p = await v.getPage(Math.min(previa.pagina || 1, v.numPages));
      const vp = p.getViewport({ scale: 1 });
      const c = await dibujar(p, Math.min(2, devicePixelRatio || 1) * Math.min(1, 420 / vp.width));
      c.style.cssText = 'max-width:100%;height:auto;box-shadow:0 1px 4px rgba(0,0,0,.2)';
      c.style.width = Math.min(420, vp.width) + 'px';
      caja.appendChild(c);
    } finally { v.destroy(); }
  }
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Botón ocupado mientras dura una tarea, con mensajes de progreso
export async function tarea(boton, progresoEl, fn) {
  const texto = boton.innerHTML;
  boton.disabled = true; boton.textContent = 'Procesando…';
  const progreso = (m) => { progresoEl.textContent = m; };
  try { await fn(progreso); progreso(''); }
  catch (e) { console.error(e); progreso(''); aviso(e.message || String(e), { error: true }); }
  finally { boton.disabled = false; boton.innerHTML = texto; }
}

// ---------------------------------------------------------------------------
// Firma: se dibuja con el dedo o el ratón y sale como PNG recortado
// ---------------------------------------------------------------------------

export class PanelFirma {
  constructor(canvas) {
    this.c = canvas; this.color = '#1c1f26'; this.trazos = [];
    const ppx = Math.min(3, devicePixelRatio || 1);
    const ajustar = () => {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      canvas.width = Math.round(r.width * ppx); canvas.height = Math.round(r.height * ppx); this.repintar();
    };
    this.ajustar = ajustar;
    new ResizeObserver(ajustar).observe(canvas);
    let trazo = null;
    const punto = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * ppx, (e.clientY - r.top) * ppx]; };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); trazo = { color: this.color, puntos: [punto(e)] }; this.trazos.push(trazo); });
    canvas.addEventListener('pointermove', (e) => { if (!trazo) return; trazo.puntos.push(punto(e)); this.repintar(); });
    const fin = () => { trazo = null; this.alCambiar?.(); };
    canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
    this.ppx = ppx;
  }
  repintar() {
    const ctx = this.c.getContext('2d');
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.6 * this.ppx;
    for (const t of this.trazos) {
      ctx.strokeStyle = t.color; ctx.beginPath();
      const p = t.puntos;
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.1, p[0][1]);
      for (let k = 1; k < p.length - 1; k++) {
        const mx = (p[k][0] + p[k + 1][0]) / 2, my = (p[k][1] + p[k + 1][1]) / 2;
        ctx.quadraticCurveTo(p[k][0], p[k][1], mx, my);
      }
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    }
  }
  vacia() { return !this.trazos.length; }
  borrar() { this.trazos = []; this.repintar(); this.alCambiar?.(); }
  // PNG con fondo transparente, recortado a lo dibujado
  async png() {
    const { width: w, height: h } = this.c;
    const datos = this.c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (datos[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const m = Math.round(4 * this.ppx);
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    const r = document.createElement('canvas'); r.width = x1 - x0 + 1; r.height = y1 - y0 + 1;
    r.getContext('2d').drawImage(this.c, x0, y0, r.width, r.height, 0, 0, r.width, r.height);
    const blob = await new Promise((ok) => r.toBlob(ok, 'image/png'));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), ancho: r.width, alto: r.height };
  }
}

// Imagen subida como firma: a PNG, con el fondo blanco vuelto transparente si se pide
export async function imagenAFirma(bytes, mime, quitarFondo) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime }), { imageOrientation: 'from-image' });
  const lado = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * lado); c.height = Math.round(bmp.height * lado);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  if (quitarFondo) {
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let k = 0; k < d.length; k += 4) {
      const claro = Math.min(d[k], d[k + 1], d[k + 2]);
      if (claro > 200) d[k + 3] = Math.max(0, Math.round(255 * (255 - claro) / 55));
    }
    ctx.putImageData(img, 0, 0);
  }
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ancho: c.width, alto: c.height, url: URL.createObjectURL(blob) };
}
