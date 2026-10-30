// Motor de datos: hojas de cálculo (Excel, OpenDocument, CSV) y formatos de
// datos (JSON, YAML, TOML, XML). Las librerías se cargan al usarlas.

const XLSX_URL = '/vendor/xlsx-0.20.3/xlsx.mjs';
const lib = {};
const cargar = (n, url) => (lib[n] ||= import(url));
export const xlsx = () => cargar('xlsx', XLSX_URL);
const yaml = () => cargar('yaml', '/vendor/yaml-2.9.0/yaml.mjs');
const toml = () => cargar('toml', '/vendor/smol-toml-1.6.1/toml.mjs');

// ---------------------------------------------------------------------------
// Hojas de cálculo
// ---------------------------------------------------------------------------
export const SALIDAS_HOJA = {
  xlsx: { nombre: 'Excel (.xlsx)', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { nombre: 'Excel antiguo (.xls)', ext: 'xls', mime: 'application/vnd.ms-excel', bookType: 'biff8' },
  ods: { nombre: 'OpenDocument (.ods)', ext: 'ods', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  csv: { nombre: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8', unaHoja: true },
  json: { nombre: 'JSON', ext: 'json', mime: 'application/json', unaHoja: true },
  html: { nombre: 'Tabla HTML', ext: 'html', mime: 'text/html;charset=utf-8', unaHoja: true },
};
export const ACEPTA_HOJA = '.xlsx,.xlsm,.xlsb,.xls,.ods,.fods,.csv,.tsv,.txt,.numbers,.json';

// Abre un libro. Los CSV se leen como texto (UTF-8, o Windows-1252 si no lo es)
export async function abrirLibro(it) {
  const X = await xlsx();
  const e = (it.nombre.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  if (e === 'json') {
    const datos = JSON.parse(decodificar(it.bytes));
    const wb = X.utils.book_new();
    const filas = Array.isArray(datos) ? datos : Object.values(datos).find(Array.isArray) || [datos];
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filas.map((x) => aplanar(x))), 'Datos');
    return wb;
  }
  if (e === 'csv' || e === 'tsv' || e === 'txt') {
    const texto = decodificar(it.bytes);
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(leerCsv(texto, e === 'tsv' ? '\t' : null)), 'Hoja1');
    return wb;
  }
  return X.read(it.bytes, { type: 'array', cellDates: true, dense: true });
}

export async function guardarLibro(wb, formato, { hoja, separador = ';', bom = true } = {}) {
  const X = await xlsx();
  const S = SALIDAS_HOJA[formato];
  if (S.unaHoja) {
    const h = wb.Sheets[hoja || wb.SheetNames[0]];
    if (formato === 'csv') return new TextEncoder().encode((bom ? '﻿' : '') + X.utils.sheet_to_csv(h, { FS: separador, blankrows: false }));
    if (formato === 'json') return new TextEncoder().encode(JSON.stringify(X.utils.sheet_to_json(h, { defval: null }), null, 2));
    if (formato === 'html') return new TextEncoder().encode(`<!doctype html><meta charset="utf-8"><title>${hoja || ''}</title>${X.utils.sheet_to_html(h, { header: '', footer: '' })}`);
  }
  return new Uint8Array(X.write(wb, { type: 'array', bookType: S.bookType || formato, compression: true }));
}

// Primeras filas para enseñarlas en pantalla
export async function vistaPrevia(wb, hoja, max = 40) {
  const X = await xlsx();
  const filas = X.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: '', raw: true, blankrows: false })
    .map((f) => f.map((v) => (typeof v === 'number' ? v.toLocaleString('es-ES', { maximumFractionDigits: 10 }) : v instanceof Date ? v.toLocaleString('es-ES') : v)));
  return { filas: filas.slice(0, max), total: filas.length };
}

// ---------------------------------------------------------------------------
// Formatos de datos: JSON, YAML, TOML, XML, CSV
// ---------------------------------------------------------------------------
export const FORMATOS_DATOS = { json: 'JSON', yaml: 'YAML', toml: 'TOML', xml: 'XML', csv: 'CSV' };

export function detectar(texto, nombre = '') {
  const e = (nombre.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  if (e === 'yml') return 'yaml';
  if (FORMATOS_DATOS[e]) return e;
  const t = texto.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith('<')) return 'xml';
  if (/^\[[\w.\- "]+\]\s*$/m.test(t) && /^\s*[\w"-]+\s*=/m.test(t)) return 'toml';
  if (/^[^,;\n]+([,;][^,;\n]+)+\n/.test(t)) return 'csv';
  return 'yaml';
}

export async function leerDatos(texto, formato) {
  try {
    if (formato === 'json') return JSON.parse(texto);
    if (formato === 'yaml') return (await yaml()).parse(texto);
    if (formato === 'toml') return (await toml()).parse(texto);
    if (formato === 'xml') return xmlAObjeto(texto);
    if (formato === 'csv') {
      const [cab, ...filas] = leerCsv(texto);
      return filas.map((f) => Object.fromEntries(cab.map((c, k) => [c, f[k] ?? null])));
    }
  } catch (e) {
    throw new Error(`El ${FORMATOS_DATOS[formato]} no es válido: ${e.message}`);
  }
}

export async function escribirDatos(dato, formato, { compacto = false, separador = ';' } = {}) {
  if (formato === 'json') return JSON.stringify(dato, null, compacto ? 0 : 2);
  if (formato === 'yaml') return (await yaml()).stringify(dato);
  if (formato === 'toml') {
    if (dato === null || typeof dato !== 'object' || Array.isArray(dato)) dato = { elementos: Array.isArray(dato) ? dato : [dato] };
    return (await toml()).stringify(limpiarNulos(dato));
  }
  if (formato === 'xml') return objetoAXml(dato);
  if (formato === 'csv') {
    const X = await xlsx();
    const filas = (Array.isArray(dato) ? dato : Object.values(dato || {}).find(Array.isArray) || [dato]).map((x) => aplanar(x));
    return X.utils.sheet_to_csv(X.utils.json_to_sheet(filas), { FS: separador });
  }
}

// { a: { b: 1 } }  →  { 'a.b': 1 }  (para pasar datos anidados a una tabla)
function aplanar(o, prefijo = '', out = {}) {
  if (o === null || typeof o !== 'object') { out[prefijo || 'valor'] = o; return out; }
  for (const [k, v] of Object.entries(o)) {
    const clave = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === 'object' && !(v instanceof Date)) aplanar(v, clave, out);
    else out[clave] = v;
  }
  return out;
}
// TOML no tiene «null»
function limpiarNulos(o) {
  if (Array.isArray(o)) return o.filter((v) => v !== null).map(limpiarNulos);
  if (o && typeof o === 'object' && !(o instanceof Date)) return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, limpiarNulos(v)]));
  return o;
}

// XML ⇄ objeto. Atributos como «@nombre», texto como «#texto» cuando hay mezcla,
// y elementos repetidos como lista.
function xmlAObjeto(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(err.textContent.split('\n')[0]);
  const conv = (el) => {
    const o = {};
    for (const a of el.attributes) o['@' + a.name] = a.value;
    const hijos = [...el.children];
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3 || n.nodeType === 4).map((n) => n.nodeValue).join('').trim();
    if (!hijos.length && !el.attributes.length) return tipar(txt);
    for (const h of hijos) {
      const v = conv(h);
      if (h.tagName in o) { if (!Array.isArray(o[h.tagName])) o[h.tagName] = [o[h.tagName]]; o[h.tagName].push(v); }
      else o[h.tagName] = v;
    }
    if (txt) o['#texto'] = tipar(txt);
    return o;
  };
  return { [doc.documentElement.tagName]: conv(doc.documentElement) };
}
const tipar = (s) => (s === '' ? '' : /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 && !/^0\d/.test(s) ? Number(s) : s === 'true' ? true : s === 'false' ? false : s);

function objetoAXml(dato) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nombreValido = (n) => (/^[A-Za-z_][\w.\-]*$/.test(n) ? n : `_${String(n).replace(/[^\w.\-]/g, '_')}`);
  const el = (nombre, v, sangria) => {
    nombre = nombreValido(nombre);
    if (Array.isArray(v)) return v.map((x) => el(nombre, x, sangria)).join('');
    if (v === null || v === undefined) return `${sangria}<${nombre}/>\n`;
    if (typeof v !== 'object' || v instanceof Date) return `${sangria}<${nombre}>${esc(v instanceof Date ? v.toISOString() : v)}</${nombre}>\n`;
    const attrs = Object.entries(v).filter(([k]) => k.startsWith('@')).map(([k, x]) => ` ${nombreValido(k.slice(1))}="${esc(x)}"`).join('');
    const resto = Object.entries(v).filter(([k]) => !k.startsWith('@'));
    const texto = v['#texto'];
    const hijos = resto.filter(([k]) => k !== '#texto');
    if (!hijos.length) return texto === undefined ? `${sangria}<${nombre}${attrs}/>\n` : `${sangria}<${nombre}${attrs}>${esc(texto)}</${nombre}>\n`;
    return `${sangria}<${nombre}${attrs}>\n${texto !== undefined ? `${sangria}  ${esc(texto)}\n` : ''}${hijos.map(([k, x]) => el(k, x, sangria + '  ')).join('')}${sangria}</${nombre}>\n`;
  };
  let raiz = dato;
  if (!(dato && typeof dato === 'object' && !Array.isArray(dato) && Object.keys(dato).length === 1 && !Array.isArray(Object.values(dato)[0]))) raiz = { datos: Array.isArray(dato) ? { elemento: dato } : dato };
  const [[n, v]] = Object.entries(raiz);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${el(n, v, '')}`;
}

// ---------------------------------------------------------------------------
// CSV: comillas, saltos de línea dentro de celdas y números «a la española».
// Con «;» de separador (Excel en español) la coma es la de los decimales:
// «12,5» es 12.5 y «1.234,5» es 1234.5. Con «,» de separador, al revés.
// ---------------------------------------------------------------------------
export function leerCsv(texto, sep = null) {
  texto = texto.replace(/^\ufeff/, '');
  if (!sep) {
    const primera = texto.split(/\r?\n/, 1)[0];
    sep = [';', ',', '\t', '|'].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  }
  const decimalComa = sep !== ',';
  const filas = [];
  let fila = [], celda = '', comillas = false, citada = false;
  const numero = (v) => {
    if (citada) return v;
    const t = v.trim();
    if (decimalComa ? /^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+(,\d+)?$/.test(t) : /^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t)) {
      if (/^-?0\d/.test(t)) return v; // 007, códigos postales: texto
      const n = Number(decimalComa ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
      return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : v;
    }
    return v;
  };
  const cerrarCelda = () => { fila.push(numero(celda)); celda = ''; citada = false; };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { celda += '"'; i++; } else comillas = false; }
      else celda += c;
    } else if (c === '"' && celda === '') { comillas = true; citada = true; }
    else if (c === sep) cerrarCelda();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarCelda();
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  if (celda !== '' || fila.length) { cerrarCelda(); if (fila.some((x) => x !== '')) filas.push(fila); }
  return filas;
}

// ---------------------------------------------------------------------------
// Texto: UTF-8 si lo es; si no, Windows-1252 (lo típico de Excel en Windows)
// ---------------------------------------------------------------------------
export function codificacionDe(b) {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); return 'utf-8'; } catch { return 'windows-1252'; }
}
export function decodificar(b, cod = codificacionDe(b)) {
  return new TextDecoder(cod).decode(b).replace(/^﻿/, '');
}
