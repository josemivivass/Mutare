// Iconos de línea (24×24, del color del texto)
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const I = {
  convertirImg: svg('<rect x="2.5" y="3" width="11" height="9" rx="1.5"/><path d="m13.5 10-3-3-6 5"/><rect x="10.5" y="12" width="11" height="9" rx="1.5"/><path d="M16 9.5h3.5V6M8 14.5H4.5V18"/>'),
  redimensionar: svg('<rect x="3" y="9" width="12" height="12" rx="1.5"/><path d="M13 3h8v8M21 3l-8 8"/>'),
  limpiar: svg('<path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 1.3-.4 2.6-.9 3.8"/><circle cx="12" cy="10" r="2.3"/><path d="m15.5 16.5 5 5m0-5-5 5"/>'),
  girarImg: svg('<rect x="8" y="9" width="12" height="12" rx="1.5"/><path d="M4 13V7a3 3 0 0 1 3-3h6"/><path d="m10.5 1.5 2.5 2.5-2.5 2.5"/>'),
  audio: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  video: svg('<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="m16.5 10 5-3v10l-5-3"/>'),
  extraerAudio: svg('<rect x="2.5" y="4" width="11" height="9" rx="1.5"/><path d="m13.5 7 3-2v7l-3-2"/><path d="M13 21v-5.5l7-1.5v5"/><circle cx="11" cy="21" r="1.6"/><circle cx="18.4" cy="19" r="1.6"/>'),
  recortar: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>'),
  word: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="m8.5 11 1.3 6 2.2-4.5 2.2 4.5 1.3-6"/>'),
  markdown: svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 15V9l2.5 3L11 9v6M15.5 9v6m0 0-2-2m2 2 2-2"/>'),
  codificacion: svg('<path d="M4 7V5h9v2M8.5 5v12M6.5 17h4"/><path d="M14 13h6m-6 4h6M17 11l-2-2m2 2 2-2"/>'),
  hoja: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  datos: svg('<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2.5 3 1.5.5 2.5 1.5 2.5 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2.5 3-1.5.5-2.5 1.5-2.5 3v2c0 2-1 3-3 3"/>'),
  zipCrear: svg('<path d="M4 7h16v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M3 3h18v4H3zM10 11h4"/><path d="M12 14v5m0-5-2 2m2-2 2 2"/>'),
  zipAbrir: svg('<path d="M4 7h16v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M3 3h18v4H3zM10 11h4"/><path d="M12 19v-5m0 5-2-2m2 2 2-2"/>'),
  carpeta: svg('<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  archivo: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  buscar: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>'),
  imprimir: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  juntar: svg('<path d="M5 3h7l3 3v7H5z"/><path d="M9 11h7l3 3v7H9z" fill="var(--superficie)"/><path d="M12 3v3h3M16 11v3h3"/>'),
  organizar: svg('<rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="8" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M18 14.5l3 3-3 3"/>'),
  separar: svg('<path d="M6 3h8l4 4v4H6z"/><path d="M6 15h12v6H6z"/><path d="M3 13h2M8 13h2M13 13h2M18 13h3" stroke-dasharray="0"/>'),
  rotar: svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  imagenes: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-8 9"/>'),
  aimagenes: svg('<path d="M6 3h8l4 4v6"/><path d="M6 3v10"/><rect x="9" y="13" width="12" height="8" rx="1.5"/><path d="m21 19-3-3-5 5"/>'),
  texto: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>'),
  comprimir: svg('<path d="M12 3v6m0 0 3-3m-3 3L9 6M12 21v-6m0 0 3 3m-3-3-3 3M4 12h16"/>'),
  numerar: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M11 15.5l1.5-1v4.5"/>'),
  marca: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="m8.5 17 7-7"/>'),
  firmar: svg('<path d="M3 17c2.5 0 3-6 5-6s1 5 3 5 2-3 3.5-3S16 16 18 16h3"/><path d="M3 21h18"/>'),
  metadatos: svg('<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),

  subir: svg('<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>'),
  descargar: svg('<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 19h16"/>'),
  arriba: svg('<path d="m6 15 6-6 6 6"/>'),
  abajo: svg('<path d="m6 9 6 6 6-6"/>'),
  izquierda: svg('<path d="m15 6-6 6 6 6"/>'),
  derecha: svg('<path d="m9 6 6 6-6 6"/>'),
  quitar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  borrar: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  girarIzq: svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/>'),
  girarDer: svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  blanca: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M12 10v6M9 13h6"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>', ' stroke-width="3"'),
  ok: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', ' class="ok"'),
  candado: svg('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  volver: svg('<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>'),
  copiar: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
};

export const ICONO_LUNA = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
  <circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="2"/><circle cx="15" cy="14.5" r="2.6"/><circle cx="9.2" cy="16" r="1"/></svg>`;
export const ICONO_SOL = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
  <circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>`;
