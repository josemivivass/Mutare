// Iconos de línea (24×24, del color del texto)
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const I = {
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
  compartir: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>'),
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
