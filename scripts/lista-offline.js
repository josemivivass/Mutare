// Regenera en public/sw.js la lista de archivos que la app guarda al instalarse
// para funcionar sin conexion: toda la interfaz, las tipografias, los iconos y
// todas las librerias, ffmpeg incluido (32 MB): asi audio y video tambien
// funcionan sin red desde el primer momento.
// Uso: node scripts/lista-offline.js   (despues de añadir o actualizar librerias)
'use strict';
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const SW = path.join(PUB, 'sw.js');
const FUERA = [/(^|\/)LICENSE[^/]*$/i, /\.(md|txt|map|d\.ts|d\.mts)$/i, /^sw\.js$/];

function recorrer(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    return e.isDirectory() ? recorrer(path.join(dir, e.name), rel) : [rel];
  });
}
const archivos = ['/', ...recorrer(PUB).filter((r) => !FUERA.some((x) => x.test(r))).sort().map((r) => '/' + r)];

const sw = fs.readFileSync(SW, 'utf8');
const ini = '// <lista-offline>', fin = '// </lista-offline>';
const a = sw.indexOf(ini), b = sw.indexOf(fin);
if (a < 0 || b < 0) throw new Error('No encuentro las marcas de la lista en sw.js');
const bloque = `${ini} (la genera scripts/lista-offline.js: no editar a mano)\nconst OFFLINE = ${JSON.stringify(archivos, null, 0).replace(/","/g, '",\n  "').replace('["', '[\n  "').replace('"]', '",\n]')};\n`;
fs.writeFileSync(SW, sw.slice(0, a) + bloque + sw.slice(b));
const bytes = archivos.slice(1).reduce((s, r) => s + fs.statSync(path.join(PUB, r)).size, 0);
console.log(`${archivos.length} archivos, ${(bytes / 1048576).toFixed(1)} MB sin comprimir`);
