# Mutare

Conversor de archivos que trabaja **en tu propio navegador**: los archivos
nunca se suben a ningún sitio, ni siquiera a este servidor. El servidor solo
entrega la página (HTML, CSS, JS y las librerías), así que apenas gasta recursos.

## Herramientas

| Categoría | Herramienta | Qué hace |
|-----------|-------------|----------|
| PDF | Juntar PDF | Une varios PDF (y fotos) en el orden que quieras |
| | Ordenar y girar páginas | Mover, girar, quitar, añadir en blanco, mezclar varios PDF, sacar solo algunas |
| | Separar PDF | Cada página, cada N páginas, por rangos o sacar unas páginas |
| | Convertir PDF | A imágenes (JPG o PNG, 72/150/300 ppp) o a texto |
| | Comprimir PDF | Ligera (sin pérdida) o fuerte (páginas a imagen, ideal para escaneos) |
| | Numerar páginas | Posición, formato («Página 1 de 10»…), saltar portada |
| | Marca de agua | Texto en el centro o repetido, con opacidad, ángulo y color |
| | Firmar PDF | Dibujada o desde una imagen; se arrastra y redimensiona |
| | Metadatos | Ver/cambiar título, autor… o borrarlos todos |
| Imágenes | Convertir imágenes | JPG, PNG, WebP, GIF, BMP, ICO (multitamaño), TIFF o PDF (todas en uno). Abre también HEIC/HEIF, AVIF y SVG |
| | Cambiar tamaño | Por porcentaje, por medida máxima o exacta |
| | Comprimir imágenes | JPG o WebP con calidad y medida máxima |
| | Quitar datos ocultos | GPS, cámara, fecha… En JPG y PNG sin recomprimir |
| | Girar y voltear | 90/180/270° y espejo |
| Audio y vídeo | Convertir audio | MP3, M4A (AAC), OGG, Opus, WAV, FLAC |
| | Convertir vídeo | MP4, WebM, MOV, MKV o GIF; calidad, resolución, quitar sonido, cambio rápido de formato |
| | Sacar el audio | Tal cual (sin recomprimir) o en MP3, M4A… |
| | Recortar audio o vídeo | Rápido (sin recomprimir) o exacto |
| Documentos y texto | Convertir Word | Abre .docx sin Office |
| | Convertir Markdown | A Word, PDF o HTML, con vista previa en directo |
| | Arreglar acentos | UTF-8, UTF-8 con BOM, Windows-1252, ISO-8859-15, UTF-16; saltos de línea; repara «Ã±» |
| Datos | Convertir hojas de cálculo | XLSX, XLS, ODS, CSV (con «;» y decimales con coma), JSON, HTML |
| | Convertir datos | JSON, YAML, TOML, XML y CSV entre sí, con validación |
| ZIP | Crear un ZIP | Con o sin compresión |
| | Abrir un ZIP | Ver el contenido, sacar archivos sueltos o extraerlo todo en una carpeta |

Todas las herramientas enseñan el resultado antes de descargarlo. Las que tienen
opciones lo hacen además en directo: la imagen con sus medidas y su peso reales, la
página del PDF con el número o la marca de agua, la lista de archivos que saldrán…
En audio y vídeo, «Probar con una muestra» convierte unos segundos con los ajustes
elegidos y estima lo que ocupará el archivo entero.

Funciona sin conexión una vez abierta (service worker) y se puede instalar como app
en el móvil o el ordenador. En ordenador y portátil, la portada enseña todas las
herramientas de un vistazo, sin desplazarse. Hay un buscador en la cabecera
(«heic», «mp3», «excel»…).

Los PDF de «Convertir Word» y «Convertir Markdown» los genera el propio navegador desde el
cuadro de impresión («Guardar como PDF»), así el texto sigue siendo texto.

## Arrancar

```bash
node server.js            # http://localhost:9996
PORT=8080 node server.js  # otro puerto
```

No tiene dependencias: no hace falta `npm install`.

Con Docker:

```bash
docker compose up -d --build
```

El contenedor es de solo lectura y está limitado a 96 MB de RAM (usa unos 50, casi todo es el propio Node).
La conversión la hace el navegador de quien la usa: el servidor no hace ningún trabajo pesado.

## Cómo está hecho

- `server.js`: servidor estático mínimo (solo GET/HEAD). Comprime en memoria los
  archivos pequeños y en flujo los grandes (ffmpeg pesa 32 MB y nunca se carga
  entero), usa ETag y caché larga para lo que no cambia, y envía una política de
  seguridad (CSP) que impide a la página conectarse a cualquier otro sitio.
- `public/`: la web.
  - `app.js` (portada, buscador y navegación), `herramientas/*.js` (las pantallas,
    una por categoría), `ui.js` (componentes), `util.js`, `zip.js`.
  - Motores: `motor.js` (PDF), `motor-imagen.js`, `motor-ffmpeg.js`,
    `motor-datos.js`, `motor-documentos.js`.
  - `aislado.html`: página invisible para las dos librerías que necesitan evaluar
    código (heic2any y mammoth). Tiene su propia CSP: puede evaluar código pero no
    conectarse a nada. Así el resto de la app mantiene la política estricta.
  - Cada librería se descarga solo cuando una herramienta la necesita.

## Librerías (todas dentro de `public/vendor/`)

| Librería | Versión | Para qué | Licencia |
|----------|---------|----------|----------|
| pdf-lib | 1.17.1 | Crear y modificar PDF | MIT |
| pdf.js (legacy) | 6.2.108 | Leer y dibujar PDF | Apache 2.0 |
| ffmpeg.wasm (@ffmpeg/ffmpeg + core) | 0.12.10 / 0.12.6 | Audio, vídeo, GIF y TIFF | MIT (envoltorio); el núcleo de FFmpeg incluye x264/x265, así que es GPL |
| SheetJS (xlsx) | 0.20.3 | Hojas de cálculo | Apache 2.0 |
| mammoth | 1.8.0 | Leer Word (.docx) | BSD-2 |
| heic2any | 0.0.4 | Fotos HEIC del iPhone | MIT (incluye libheif, LGPL) |
| docx | 9.8.1 | Crear Word | MIT |
| marked | 18.0.10 | Markdown | MIT |
| DOMPurify | 3.4.14 | Limpiar HTML antes de enseñarlo | MPL 2.0 / Apache 2.0 |
| yaml | 2.9.0 | YAML | ISC |
| smol-toml | 1.6.1 | TOML | BSD-3 |

docx, marked, DOMPurify, yaml y smol-toml están empaquetadas como módulos ES con
esbuild; el resto son los archivos originales de cada paquete.

## Fuentes

`public/fuentes/` lleva Newsreader e Instrument Sans (de Fontsource), ambas con
licencia SIL Open Font License.
