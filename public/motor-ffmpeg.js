// ffmpeg en el navegador (ffmpeg.wasm, un solo hilo). Pesa 32 MB: se descarga
// solo la primera vez que se usa una herramienta de audio o vídeo y luego se
// queda guardado en el navegador. Nada sale del dispositivo.

const BASE = '/vendor/ffmpeg-core-0.12.6/';
const CORE = BASE + 'ffmpeg-core.js', WASM = BASE + 'ffmpeg-core.wasm';
let instancia = null;

// Descarga previa del .wasm con barra de progreso (lo deja en la caché, y
// ffmpeg lo coge de ahí al cargarse)
async function precargar(progreso) {
  const r = await fetch(WASM);
  if (!r.ok) throw new Error('No se pudo descargar el conversor de audio y vídeo');
  const total = Number(r.headers.get('content-length')) || 32129114;
  const lector = r.body.getReader();
  let leido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    leido += value.length;
    progreso?.({ cargando: Math.min(1, leido / total) });
  }
}

export async function ffmpeg(progreso) {
  if (instancia) return instancia;
  return (instancia = (async () => {
    await precargar(progreso);
    const { FFmpeg } = await import('/vendor/ffmpeg-0.12.10/index.js');
    const ff = new FFmpeg();
    await ff.load({ coreURL: CORE, wasmURL: WASM });
    return ff;
  })().catch((e) => { instancia = null; throw e; }));
}

let cola = Promise.resolve();
const segundos = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);

// Ejecuta ffmpeg. entradas: [{ nombre, bytes }]; args usa esos nombres.
// progreso(fracción 0..1). Devuelve los bytes del archivo «salida».
export function ejecutar({ entradas, args, salida, duracion = 0, progreso = () => {} }) {
  const tarea = cola.then(async () => {
    const ff = await ffmpeg();
    const registro = [];
    let total = duracion;
    const alLog = ({ message }) => {
      registro.push(message); if (registro.length > 60) registro.shift();
      const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(message);
      if (d && !total) total = segundos(d[1], d[2], d[3]);
      const t = /time=(\d+):(\d+):([\d.]+)/.exec(message);
      if (t && total) progreso(Math.min(1, segundos(t[1], t[2], t[3]) / total));
    };
    ff.on('log', alLog);
    try {
      // Copia: ffmpeg se queda con el búfer que recibe y el original quedaría vacío
      for (const e of entradas) await ff.writeFile(e.nombre, e.bytes.slice());
      const codigo = await ff.exec(['-hide_banner', '-nostdin', '-y', ...args, salida]);
      let datos = null;
      try { datos = await ff.readFile(salida); } catch {}
      if (codigo !== 0 || !datos?.length) {
        const motivo = registro.filter((l) => /error|invalid|not|unsupported|could/i.test(l)).slice(-2).join(' · ');
        throw new Error('No se pudo convertir' + (motivo ? `: ${motivo}` : ''));
      }
      return datos;
    } finally {
      ff.off('log', alLog);
      for (const n of [...entradas.map((e) => e.nombre), salida]) { try { await ff.deleteFile(n); } catch {} }
    }
  });
  cola = tarea.catch(() => {});
  return tarea;
}

// Duración y pistas de un archivo (lee la cabecera con ffmpeg)
export async function analizar(nombre, bytes) {
  const ff = await ffmpeg();
  const lineas = [];
  const alLog = ({ message }) => lineas.push(message);
  ff.on('log', alLog);
  try { await ff.writeFile(nombre, bytes.slice()); await ff.exec(['-hide_banner', '-i', nombre]); }
  finally { ff.off('log', alLog); try { await ff.deleteFile(nombre); } catch {} }
  const txt = lineas.join('\n');
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(txt);
  const v = /Stream .*Video: ([^,\s]+).*?, (\d{2,5})x(\d{2,5})/.exec(txt);
  return { duracion: d ? segundos(d[1], d[2], d[3]) : 0, video: v ? { codec: v[1], ancho: +v[2], alto: +v[3] } : null, audio: /Stream .*Audio: ([^,\s]+)/.exec(txt)?.[1] || null };
}
