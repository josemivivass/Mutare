// Motor de documentos: Word (lectura con mammoth, en la página aislada),
// Markdown (marked) a HTML y a Word (docx), PDF con el «Guardar como PDF» del
// navegador y cambio de codificación de textos.

import { aislado } from './aislado-cliente.js';

const lib = {};
const marked = () => (lib.marked ||= import('/vendor/marked-18.0.10/marked.mjs'));
const purificador = () => (lib.dp ||= import('/vendor/dompurify-3.4.14/dompurify.mjs').then((m) => m.default));
const docx = () => (lib.docx ||= import('/vendor/docx-9.8.1/docx.mjs'));

// HTML seguro (sin scripts ni eventos) para enseñarlo o guardarlo
export async function limpio(html) { return (await purificador()).sanitize(html, { USE_PROFILES: { html: true } }); }

export async function wordAHtml(bytes) { return aislado('word', { bytes, modo: 'html' }); }
export async function wordATexto(bytes) { return (await aislado('word', { bytes, modo: 'texto' })).valor; }

export async function markdownAHtml(md) { return limpio((await marked()).marked.parse(md, { gfm: true, breaks: false })); }

const CSS_DOC = `body{font-family:Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1d1b1a;max-width:46em;margin:2em auto;padding:0 1em}
h1,h2,h3,h4{font-family:Georgia,serif;line-height:1.25;margin:1.2em 0 .5em}img{max-width:100%;height:auto}
table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #999;padding:4px 8px;vertical-align:top}
pre,code{font-family:Consolas,monospace;font-size:.92em;background:#f3f1ee}pre{padding:.8em;overflow:auto}blockquote{border-left:3px solid #ccc;margin:1em 0;padding-left:1em;color:#555}
@page{margin:2cm}@media print{body{margin:0;max-width:none}}`;

export function documentoHtml(cuerpo, titulo = 'Documento') {
  const t = String(titulo).replace(/[<&]/g, '');
  return `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title><style>${CSS_DOC}</style></head><body>\n${cuerpo}\n</body></html>`;
}

// PDF: el propio navegador lo genera («Guardar como PDF» en el cuadro de
// impresión). Así el texto sigue siendo texto (se puede seleccionar y buscar).
export function imprimir(cuerpo, titulo) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  f.srcdoc = documentoHtml(cuerpo, titulo);
  f.onload = () => {
    const tituloAntes = document.title;
    document.title = titulo; // nombre que propone el navegador para el PDF
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => { document.title = tituloAntes; f.remove(); }, 1000);
  };
  document.body.appendChild(f);
}

// ---------------------------------------------------------------------------
// Markdown → Word (.docx)
// ---------------------------------------------------------------------------
export async function markdownAWord(md, titulo) {
  const D = await docx();
  const { Lexer } = await marked();
  const tokens = Lexer.lex(md, { gfm: true });
  const H = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4, D.HeadingLevel.HEADING_5, D.HeadingLevel.HEADING_6];

  // Texto con formato (negrita, cursiva, código, enlaces)
  const runs = (toks = [], estilo = {}) => toks.flatMap((t) => {
    if (t.type === 'strong') return runs(t.tokens, { ...estilo, bold: true });
    if (t.type === 'em') return runs(t.tokens, { ...estilo, italics: true });
    if (t.type === 'del') return runs(t.tokens, { ...estilo, strike: true });
    if (t.type === 'codespan') return [new D.TextRun({ text: decodificarEntidades(t.text), font: 'Consolas', ...estilo })];
    if (t.type === 'br') return [new D.TextRun({ text: '', break: 1 })];
    if (t.type === 'link') return [new D.ExternalHyperlink({ link: t.href, children: runs(t.tokens, { ...estilo, style: 'Hyperlink' }) })];
    if (t.type === 'image') return [new D.TextRun({ text: `[imagen: ${t.text || t.href}]`, italics: true })];
    if (t.tokens) return runs(t.tokens, estilo);
    return [new D.TextRun({ text: decodificarEntidades(t.text ?? t.raw ?? ''), ...estilo })];
  });

  let listas = 0;
  const bloques = (toks, nivelLista = 0) => toks.flatMap((t) => {
    switch (t.type) {
      case 'heading': return [new D.Paragraph({ heading: H[t.depth - 1], children: runs(t.tokens) })];
      case 'paragraph': return [new D.Paragraph({ children: runs(t.tokens), spacing: { after: 160 } })];
      case 'text': return [new D.Paragraph({ children: runs(t.tokens || [t]) })];
      case 'blockquote': return bloques(t.tokens, nivelLista);
      case 'code': return t.text.split('\n').map((l) => new D.Paragraph({ children: [new D.TextRun({ text: l || ' ', font: 'Consolas', size: 20 })], shading: { type: D.ShadingType.CLEAR, fill: 'F3F1EE' } }));
      case 'hr': return [new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } } })];
      case 'list': {
        const instancia = ++listas;
        return t.items.flatMap((it) => {
          const [primero, ...resto] = it.tokens;
          const enLinea = primero?.type === 'text' || primero?.type === 'paragraph';
          const marca = t.ordered ? { numbering: { reference: 'numerada', level: Math.min(nivelLista, 5), instance: instancia } } : { bullet: { level: Math.min(nivelLista, 5) } };
          return [
            new D.Paragraph({ ...marca, children: enLinea ? runs(primero.tokens || [primero]) : [] }),
            ...bloques(enLinea ? resto : it.tokens, nivelLista + 1),
          ];
        });
      }
      case 'table': {
        const fila = (celdas, cab) => new D.TableRow({ tableHeader: cab, children: celdas.map((c) => new D.TableCell({ children: [new D.Paragraph({ children: runs(c.tokens, cab ? { bold: true } : {}) })] })) });
        return [new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [fila(t.header, true), ...t.rows.map((r) => fila(r, false))] }), new D.Paragraph('')];
      }
      case 'space': return [];
      case 'html': return [new D.Paragraph({ children: [new D.TextRun({ text: t.text.replace(/<[^>]+>/g, '').trim() })] })];
      default: return t.tokens ? bloques(t.tokens, nivelLista) : [];
    }
  });

  const doc = new D.Document({
    creator: '', lastModifiedBy: '', title: titulo, description: '',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: { config: [{ reference: 'numerada', levels: [0, 1, 2, 3, 4, 5].map((l) => ({ level: l, format: [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN][l % 3], text: `%${l + 1}.`, alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } })) }] },
    sections: [{ children: bloques(tokens) }],
  });
  return new Uint8Array(await (await D.Packer.toBlob(doc)).arrayBuffer());
}
function decodificarEntidades(s) {
  return String(s).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
}

// ---------------------------------------------------------------------------
// Codificación de textos
// ---------------------------------------------------------------------------
export const CODIFICACIONES = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 con BOM',
  'windows-1252': 'Windows-1252 (ANSI)',
  'iso-8859-15': 'ISO-8859-15',
  'utf-16le': 'UTF-16 LE',
};

// Tabla inversa (carácter → byte) de las codificaciones de un byte
const tablas = {};
function tablaDe(cod) {
  if (tablas[cod]) return tablas[cod];
  const dec = new TextDecoder(cod);
  const t = new Map();
  for (let b = 0; b < 256; b++) { const c = dec.decode(new Uint8Array([b])); if (c !== '�' && !t.has(c)) t.set(c, b); }
  return (tablas[cod] = t);
}

// Devuelve { bytes, perdidos } (caracteres que no existen en la codificación de destino)
export function codificar(texto, cod) {
  if (cod === 'utf-8') return { bytes: new TextEncoder().encode(texto), perdidos: 0 };
  if (cod === 'utf-8-bom') return { bytes: new TextEncoder().encode('﻿' + texto), perdidos: 0 };
  if (cod === 'utf-16le') {
    const out = new Uint8Array(2 + texto.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); out[2 + i * 2] = c & 255; out[3 + i * 2] = c >> 8; }
    return { bytes: out, perdidos: 0 };
  }
  const t = tablaDe(cod);
  const out = [];
  let perdidos = 0;
  for (const c of texto) {
    const b = t.get(c);
    if (b === undefined) { perdidos++; out.push(0x3f); } else out.push(b);
  }
  return { bytes: new Uint8Array(out), perdidos };
}
