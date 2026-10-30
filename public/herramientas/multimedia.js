// Herramientas de audio y vídeo (ffmpeg en el navegador).
import { $, $$, aviso, tamano, base, esc } from '../util.js';
import { I } from '../iconos.js';
import { zona, prepararArchivos, ListaArchivos, tarea, resultado, VistaPrevia } from '../ui.js';
import { html, radios, valorRadio, unArchivo, entregar, conExtension } from './comun.js';
import { ffmpeg, ejecutar, analizar } from '../motor-ffmpeg.js';

const ACEPTA_AUDIO = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.wma,.aiff,.aif,.amr,.3gp';
const ACEPTA_VIDEO = 'video/*,.mp4,.m4v,.mov,.mkv,.webm,.avi,.wmv,.flv,.3gp,.mts,.m2ts,.ts,.mpg,.mpeg';
const AYUDA = '<p class="ayuda">La primera vez se descarga el conversor (32 MB) y queda guardado en el navegador. Se convierte en tu dispositivo: en el móvil, los vídeos largos tardan. Mejor archivos de menos de 1 GB.</p>';

const AUDIO = {
  mp3: { nombre: 'MP3', mime: 'audio/mpeg', args: (br) => ['-c:a', 'libmp3lame', '-b:a', `${br}k`] },
  m4a: { nombre: 'M4A (AAC)', mime: 'audio/mp4', args: (br) => ['-c:a', 'aac', '-b:a', `${br}k`, '-movflags', '+faststart'] },
  ogg: { nombre: 'OGG (Vorbis)', mime: 'audio/ogg', args: (br) => ['-c:a', 'libvorbis', '-b:a', `${br}k`] },
  opus: { nombre: 'Opus', mime: 'audio/ogg', args: (br) => ['-c:a', 'libopus', '-b:a', `${Math.min(br, 256)}k`] },
  wav: { nombre: 'WAV (sin comprimir)', mime: 'audio/wav', args: () => ['-c:a', 'pcm_s16le'], sinBitrate: true },
  flac: { nombre: 'FLAC (sin pérdida)', mime: 'audio/flac', args: () => ['-c:a', 'flac'], sinBitrate: true },
};
const CALIDAD_VIDEO = { alta: { crf: 20, vp8: '4M' }, media: { crf: 26, vp8: '2M' }, baja: { crf: 32, vp8: '800k' } };
const VIDEO = {
  mp4: { nombre: 'MP4 (H.264)', mime: 'video/mp4' },
  webm: { nombre: 'WebM (VP8)', mime: 'video/webm' },
  mov: { nombre: 'MOV (H.264)', mime: 'video/quicktime' },
  mkv: { nombre: 'MKV (H.264)', mime: 'video/x-matroska' },
  gif: { nombre: 'GIF animado', mime: 'image/gif' },
};
const extDe = (n) => (n.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

// Prepara ffmpeg enseñando el progreso de la descarga la primera vez
async function motor(prog) {
  await ffmpeg(({ cargando }) => prog(`Descargando el conversor (solo la primera vez)… ${Math.round(cargando * 100)} %`));
  prog('Preparando…');
}
const pct = (prog, texto) => (f) => prog(`${texto} ${Math.round(f * 100)} %`);
const entrada = (it) => ({ nombre: `entrada.${extDe(it.nombre) || 'bin'}`, bytes: it.bytes });

function argsVideo(formato, { calidad, altura, sinAudio, fps = 12 }) {
  const q = CALIDAD_VIDEO[calidad];
  const escala = altura ? `scale=-2:'min(ih,${altura})'` : null;
  if (formato === 'gif') {
    const ancho = altura ? Math.round(altura * 16 / 9) : 640;
    return ['-an', '-vf', `fps=${fps},scale='min(iw,${ancho})':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0'];
  }
  const v = formato === 'webm'
    ? ['-c:v', 'libvpx', '-b:v', q.vp8, '-crf', '10', '-deadline', 'realtime', '-cpu-used', '8']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(q.crf), '-pix_fmt', 'yuv420p'];
  const a = sinAudio ? ['-an'] : formato === 'webm' ? ['-c:a', 'libopus', '-b:a', '128k'] : ['-c:a', 'aac', '-b:a', '160k'];
  return [...(escala ? ['-vf', escala] : []), ...v, ...a, ...(formato === 'mp4' || formato === 'mov' ? ['-movflags', '+faststart'] : [])];
}

function selectorAudio(valor = 'mp3') {
  return `<label class="campo">Formato <select name="formato">${Object.entries(AUDIO).map(([k, f]) => `<option value="${k}" ${k === valor ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select></label>
    <label class="campo" data-si="br">Calidad <select name="br"><option value="96">96 kbps (voz)</option><option value="128">128 kbps</option><option value="192" selected>192 kbps (buena)</option><option value="256">256 kbps</option><option value="320">320 kbps (máxima)</option></select></label>`;
}
const enlazarBitrate = (panel) => { const a = () => { $('[data-si=br]', panel).hidden = !!AUDIO[$('[name=formato]', panel).value].sinBitrate; }; panel.addEventListener('change', a); a(); };

// "00:01:23.5", "1:23", "83" → segundos
function aSegundos(t) {
  const p = String(t).trim().replace(',', '.').split(':').map(Number);
  if (p.some(isNaN)) return NaN;
  return p.reduce((s, x) => s * 60 + x, 0);
}
function aTiempo(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(1).padStart(4, '0');
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${x}`;
}

// Muestra de unos segundos con los ajustes actuales, para oír/ver cómo queda
// y estimar el peso. Tras la primera, se rehace sola al cambiar una opción.
function muestra(panel, { segundos, generar }) {
  const caja = document.createElement('div');
  caja.innerHTML = `<button type="button" class="btn" data-a="muestra">Probar con una muestra de ${segundos} s</button>`;
  $('.hueco-vista', panel).appendChild(caja);
  const vista = new VistaPrevia($('.hueco-vista', panel), `Muestra (${segundos} s)`);
  vista.el.hidden = true;
  let activa = false;
  const duraciones = new Map();
  const duracionDe = async (it) => { if (!duraciones.has(it.id)) duraciones.set(it.id, (await analizar(`d.${extDe(it.nombre) || 'bin'}`, it.bytes)).duracion); return duraciones.get(it.id); };
  const lanzar = () => {
    activa = true; vista.el.hidden = false;
    vista.programar(async () => {
      await ffmpeg(({ cargando }) => { vista.info = `Descargando el conversor (solo la primera vez)… ${Math.round(cargando * 100)} %`; });
      return generar({ segundos, duracionDe });
    }, 600);
  };
  $('[data-a=muestra]', caja).addEventListener('click', lanzar);
  panel.addEventListener('change', () => { if (activa) lanzar(); });
  return { reiniciar: () => { activa = false; vista.el.hidden = true; } };
}
const estimado = (bytesMuestra, segMuestra, total) => (total ? ` · ≈ ${tamano(bytesMuestra * total / Math.min(segMuestra, total))} el archivo entero` : '');

export const MULTIMEDIA = [
  {
    id: 'av-audio', categoria: 'multimedia', nombre: 'Convertir audio', icono: I.audio,
    desc: 'MP3, M4A, OGG, Opus, WAV o FLAC, desde casi cualquier formato de audio.',
    palabras: 'mp3 wav m4a aac ogg opus flac wma aiff musica sonido nota de voz whatsapp',
    montar(el) {
      el.appendChild(zona({ acepta: `${ACEPTA_AUDIO},${ACEPTA_VIDEO}`, titulo: 'Elige los audios', alElegir: async (f) => lista.anadir(await prepararArchivos(f)) }));
      const lista = new ListaArchivos(el, (items) => { panel.hidden = !items.length; }, { ordenable: false });
      const panel = html(el, `<div class="panel" hidden><div class="opciones-rejilla">${selectorAudio('mp3')}
        <label class="campo">Canales <select name="canales"><option value="">Como el original</option><option value="1">Mono</option><option value="2">Estéreo</option></select></label></div>
        <div class="hueco-vista"></div>
        ${AYUDA}<button type="button" class="btn acento grande">Convertir</button><div class="progreso"></div></div>`);
      enlazarBitrate(panel);
      const argsAudio = () => { const f = $('[name=formato]', panel).value, c = $('[name=canales]', panel).value; return [...(c ? ['-ac', c] : []), ...AUDIO[f].args(Number($('[name=br]', panel).value))]; };
      muestra(panel, { segundos: 10, generar: async ({ segundos, duracionDe }) => {
        const it = lista.items[0], f = $('[name=formato]', panel).value, en = entrada(it);
        const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, '-t', String(segundos), '-vn', ...argsAudio()], salida: `muestra.${f}` });
        return { blob: new Blob([datos], { type: AUDIO[f].mime }), nombre: `muestra.${f}`, info: `${it.nombre}: ${tamano(datos.length)} en ${segundos} s${estimado(datos.length, segundos, await duracionDe(it))}` };
      } });
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        await motor(prog);
        const f = $('[name=formato]', panel).value, br = Number($('[name=br]', panel).value), canales = $('[name=canales]', panel).value;
        const salida = [];
        for (const [k, it] of lista.items.entries()) {
          const en = entrada(it);
          const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, '-vn', '-map_metadata', '0', ...argsAudio()], salida: `salida.${f}`, progreso: pct(prog, `${k + 1}/${lista.items.length} · ${it.nombre}:`) });
          salida.push({ nombre: conExtension(it.nombre, f), datos, mime: AUDIO[f].mime });
        }
        await entregar(panel, salida, `audios-${f}.zip`);
      }));
    },
  },
  {
    id: 'av-video', categoria: 'multimedia', nombre: 'Convertir o comprimir vídeo', icono: I.video,
    desc: 'A MP4, WebM, MOV, MKV o GIF animado. También para que ocupe menos o bajar la resolución.',
    palabras: 'mp4 mov mkv webm avi wmv gif comprimir reducir resolucion 720 1080 iphone',
    montar(el) {
      let it = null, info = null;
      unArchivo(el, { acepta: ACEPTA_VIDEO, titulo: 'Elige un vídeo', alCargar: (x) => { it = x; info = null; panel.hidden = false; } });
      const panel = html(el, `<div class="panel" hidden><div class="opciones-rejilla">
        <label class="campo">Formato <select name="formato">${Object.entries(VIDEO).map(([k, f]) => `<option value="${k}">${f.nombre}</option>`).join('')}</select></label>
        <label class="campo" data-no="gif">Calidad <select name="calidad"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select></label>
        <label class="campo">Resolución máxima <select name="altura"><option value="">Como el original</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option><option value="360">360p</option></select></label>
        <label class="campo" data-si="gif" hidden>Fotogramas por segundo <select name="fps"><option value="8">8</option><option value="12" selected>12</option><option value="15">15</option><option value="24">24</option></select></label>
        </div>
        <p class="ayuda" data-no="gif">Calidad media: casi igual y ocupa bastante menos. Baja: ocupa muy poco, para enviar por mensajería.</p>
        <label class="check" data-no="gif"><input type="checkbox" name="sinAudio"> Quitar el sonido</label>
        <label class="check" data-no="gif"><input type="checkbox" name="copiar"> Rápido: solo cambiar el formato, sin recomprimir (si los códecs lo permiten; ignora calidad y resolución)</label>
        <div class="hueco-vista"></div>
        ${AYUDA}<button type="button" class="btn acento grande">Convertir</button><div class="progreso"></div></div>`);
      const act = () => { const g = $('[name=formato]', panel).value === 'gif'; $$('[data-no=gif]', panel).forEach((x) => { x.hidden = g; }); $$('[data-si=gif]', panel).forEach((x) => { x.hidden = !g; }); };
      panel.addEventListener('change', act); act();
      const argsDe = (f) => {
        const copiar = f !== 'gif' && $('[name=copiar]', panel).checked;
        const args = copiar ? ['-c', 'copy', ...(f === 'mp4' || f === 'mov' ? ['-movflags', '+faststart'] : [])]
          : argsVideo(f, { calidad: $('[name=calidad]', panel).value, altura: Number($('[name=altura]', panel).value) || 0, sinAudio: $('[name=sinAudio]', panel).checked, fps: Number($('[name=fps]', panel).value) });
        return [...(copiar && $('[name=sinAudio]', panel).checked ? ['-an'] : []), ...args];
      };
      muestra(panel, { segundos: 5, generar: async ({ segundos, duracionDe }) => {
        const f = $('[name=formato]', panel).value, en = entrada(it);
        const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, '-t', String(segundos), ...argsDe(f)], salida: `muestra.${f}` });
        let dims = '';
        if (f === 'gif') { const b = await createImageBitmap(new Blob([datos], { type: 'image/gif' })); dims = `${b.width}×${b.height} · `; b.close(); }
        return { blob: new Blob([datos], { type: VIDEO[f].mime }), nombre: `muestra.${f}`, info: `${dims}${tamano(datos.length)} en ${segundos} s${estimado(datos.length, segundos, await duracionDe(it))}` };
      } });
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        await motor(prog);
        const f = $('[name=formato]', panel).value, en = entrada(it);
        const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, ...argsDe(f)], salida: `salida.${f}`, progreso: pct(prog, 'Convirtiendo…') });
        await resultado(panel, { blob: new Blob([datos], { type: VIDEO[f].mime }), nombre: conExtension(it.nombre, f), detalle: `${tamano(it.tam)} → ${tamano(datos.length)}` });
      }));
    },
  },
  {
    id: 'av-extraer', categoria: 'multimedia', nombre: 'Sacar el audio de un vídeo', icono: I.extraerAudio,
    desc: 'Guarda solo el sonido de un vídeo: en MP3, M4A o tal cual viene, sin perder calidad.',
    palabras: 'extraer audio musica de video mp3 youtube',
    montar(el) {
      let it = null;
      unArchivo(el, { acepta: ACEPTA_VIDEO, titulo: 'Elige un vídeo', alCargar: (x) => { it = x; panel.hidden = false; } });
      const panel = html(el, `<div class="panel" hidden><div class="opciones-rejilla">
        <label class="campo">Formato <select name="formato"><option value="original">Original, sin recomprimir</option>${Object.entries(AUDIO).map(([k, f]) => `<option value="${k}" ${k === 'mp3' ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select></label>
        <label class="campo" data-si="br">Calidad <select name="br"><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="320">320 kbps</option></select></label></div>
        <p class="ayuda">«Original» guarda el sonido tal como viene dentro del vídeo: es lo más rápido y no pierde nada de calidad.</p>
        <div class="hueco-vista"></div>
        ${AYUDA}<button type="button" class="btn acento grande">Sacar el audio</button><div class="progreso"></div></div>`);
      const act = () => { const f = $('[name=formato]', panel).value; $('[data-si=br]', panel).hidden = f === 'original' || !!AUDIO[f]?.sinBitrate; };
      panel.addEventListener('change', act); act();
      const preparar = async () => {
        let f = $('[name=formato]', panel).value;
        const en = entrada(it);
        let args;
        if (f === 'original') {
          const { audio } = await analizar(en.nombre, en.bytes);
          if (!audio) throw new Error('Este vídeo no tiene sonido');
          f = { aac: 'm4a', mp3: 'mp3', opus: 'opus', vorbis: 'ogg', flac: 'flac', alac: 'm4a' }[audio] || 'mka';
          args = ['-c:a', 'copy'];
        } else args = AUDIO[f].args(Number($('[name=br]', panel).value));
        return { f, en, args };
      };
      muestra(panel, { segundos: 10, generar: async ({ segundos, duracionDe }) => {
        const { f, en, args } = await preparar();
        const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, '-t', String(segundos), '-vn', ...args], salida: `muestra.${f}` });
        return { blob: new Blob([datos], { type: AUDIO[f]?.mime || 'audio/x-matroska' }), nombre: `muestra.${f}`, info: `${tamano(datos.length)} en ${segundos} s${estimado(datos.length, segundos, await duracionDe(it))}` };
      } });
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        await motor(prog);
        const { f, en, args } = await preparar();
        const datos = await ejecutar({ entradas: [en], args: ['-i', en.nombre, '-vn', ...args], salida: `salida.${f}`, progreso: pct(prog, 'Sacando el audio…') });
        await resultado(panel, { blob: new Blob([datos], { type: AUDIO[f]?.mime || 'audio/x-matroska' }), nombre: conExtension(it.nombre, f), detalle: tamano(datos.length) });
      }));
    },
  },
  {
    id: 'av-recortar', categoria: 'multimedia', nombre: 'Recortar audio o vídeo', icono: I.recortar,
    desc: 'Quédate solo con un trozo: elige dónde empieza y dónde acaba.',
    palabras: 'cortar trozo fragmento inicio fin tono llamada',
    montar(el) {
      let it = null, url = null;
      unArchivo(el, { acepta: `${ACEPTA_VIDEO},${ACEPTA_AUDIO}`, titulo: 'Elige un audio o un vídeo', alCargar: (x) => {
        it = x; panel.hidden = false;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(new Blob([x.bytes], { type: x.mime }));
        const esAudio = x.mime.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma|aiff?)$/i.test(x.nombre);
        const r = $('.hueco-rep', panel);
        r.innerHTML = `<${esAudio ? 'audio' : 'video'} class="reproductor" controls preload="metadata" playsinline></${esAudio ? 'audio' : 'video'}>`;
        const m = r.firstElementChild; m.src = url;
        m.addEventListener('loadedmetadata', () => { $('[name=ini]', panel).value = aTiempo(0); $('[name=fin]', panel).value = isFinite(m.duration) ? aTiempo(m.duration) : ''; });
      } });
      const panel = html(el, `<div class="panel" hidden><div class="hueco-rep"></div>
        <div class="opciones-rejilla">
          <label class="campo">Empieza en <input type="text" name="ini" inputmode="decimal" placeholder="0:00.0"></label>
          <label class="campo">Acaba en <input type="text" name="fin" inputmode="decimal" placeholder="1:30.0"></label>
        </div>
        <div class="fila"><button type="button" class="btn pequeno" data-a="ini">Empezar aquí</button><button type="button" class="btn pequeno" data-a="fin">Acabar aquí</button><button type="button" class="btn pequeno" data-a="escuchar">▶ Reproducir el trozo</button><span class="ayuda">(los dos primeros toman el punto donde está el reproductor)</span></div>
        <div class="campo" style="margin-top:12px">Modo ${radios('modo', [['rapido', 'Rápido, sin perder calidad'], ['exacto', 'Exacto al décimo de segundo']], 'rapido')}</div>
        <p class="ayuda">El modo rápido corta en el fotograma clave más cercano (puede desviarse un par de segundos en vídeo). El exacto vuelve a comprimir, así que tarda más.</p>
        ${AYUDA}<button type="button" class="btn acento grande">Recortar</button><div class="progreso"></div></div>`);
      let parar = null;
      panel.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const m = $('.hueco-rep .reproductor', panel); if (!m) return;
        if (a === 'ini' || a === 'fin') { $(`[name=${a}]`, panel).value = aTiempo(m.currentTime); return; }
        if (a === 'escuchar') {
          const ini = aSegundos($('[name=ini]', panel).value || 0), fin = aSegundos($('[name=fin]', panel).value);
          if (isNaN(ini) || isNaN(fin) || fin <= ini) return aviso('Revisa los tiempos: el final tiene que ir después del principio', { error: true });
          // Se vigila en cada fotograma (timeupdate solo avisa cada ~250 ms)
          const turno = (parar = {});
          const vigilar = () => { if (parar !== turno) return; if (m.currentTime >= fin) { m.pause(); return; } if (!m.paused) requestAnimationFrame(vigilar); };
          m.currentTime = ini; m.play().then(() => requestAnimationFrame(vigilar));
        }
      });
      $('button.acento', panel).addEventListener('click', (e) => tarea(e.currentTarget, $('.progreso', panel), async (prog) => {
        const ini = aSegundos($('[name=ini]', panel).value || 0), fin = aSegundos($('[name=fin]', panel).value);
        if (isNaN(ini) || isNaN(fin) || fin <= ini) throw new Error('Revisa los tiempos: el final tiene que ir después del principio (formato 1:23.5)');
        await motor(prog);
        const en = entrada(it), x = extDe(it.nombre);
        const esAudio = !!$('audio.reproductor', panel);
        let f = x, args;
        if (valorRadio(panel, 'modo') === 'rapido') args = ['-c', 'copy', '-avoid_negative_ts', 'make_zero'];
        else if (esAudio) { f = AUDIO[x] ? x : 'mp3'; args = AUDIO[f].args(192); }
        else { f = x === 'webm' ? 'webm' : 'mp4'; args = argsVideo(f, { calidad: 'alta' }); }
        const datos = await ejecutar({ entradas: [en], args: ['-ss', String(ini), '-to', String(fin), '-i', en.nombre, ...args], salida: `salida.${f}`, duracion: fin - ini, progreso: pct(prog, 'Recortando…') });
        await resultado(panel, { blob: new Blob([datos], { type: it.mime || 'application/octet-stream' }), nombre: conExtension(`${base(it.nombre)}-recorte`, f), detalle: `${aTiempo(fin - ini)} · ${tamano(datos.length)}` });
      }));
      return () => { if (url) URL.revokeObjectURL(url); };
    },
  },
];
