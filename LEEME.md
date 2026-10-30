# PDF Converter

Herramientas básicas de PDF que trabajan **en tu propio navegador**: los archivos
nunca se suben a ningún sitio, ni siquiera a este servidor. El servidor solo
entrega la página (HTML, CSS, JS y las librerías), así que apenas gasta recursos.

## Herramientas

| Grupo     | Herramienta     | Qué hace |
|-----------|-----------------|----------|
| Organizar | Juntar PDF      | Une varios PDF (y fotos) en el orden que quieras |
|           | Ordenar páginas | Mover, girar, quitar, añadir en blanco, mezclar varios PDF, sacar solo algunas |
|           | Separar PDF     | Cada página, cada N páginas, por rangos o sacar unas páginas |
|           | Rotar PDF       | Todas las páginas o solo las elegidas |
| Convertir | Imágenes a PDF  | JPG, PNG, WebP… (respeta la orientación de las fotos del móvil) |
|           | PDF a imágenes  | PNG o JPG a 72, 150 o 300 ppp (varias → ZIP) |
|           | Comprimir PDF   | Ligera (sin pérdida) o fuerte (páginas a imagen, ideal para escaneos) |
|           | PDF a texto     | Copiar o descargar como .txt |
| Editar    | Numerar páginas | Posición, formato («Página 1 de 10»…), saltar portada |
|           | Marca de agua   | Texto en el centro o repetido, con opacidad, ángulo y color |
|           | Firmar PDF      | Dibujada con el dedo/ratón o desde una imagen; se arrastra y redimensiona |
|           | Metadatos       | Ver/cambiar título, autor… o borrarlos todos |

Funciona sin conexión una vez abierta (service worker) y se puede instalar como app
en el móvil o el ordenador.

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

## Cómo está hecho

- `server.js`: servidor estático mínimo (solo GET/HEAD). Comprime en memoria,
  usa ETag y caché larga para lo que no cambia, y envía una política de seguridad
  (CSP) que impide a la página conectarse a cualquier otro sitio.
- `public/`: la web.
  - `app.js` (inicio y navegación), `herramientas.js` (las pantallas),
    `ui.js` (componentes), `motor.js` (operaciones con PDF), `util.js`, `zip.js`.
  - `vendor/pdf-lib-1.17.1/`: crea y modifica PDF (licencia MIT).
  - `vendor/pdfjs-6.2.108/`: lee y dibuja PDF, versión *legacy* para navegadores
    no tan recientes (licencia Apache 2.0).
  - `fuentes/`: tipografías Newsreader e Instrument Sans (ver abajo).

Todo está en el repositorio: la web no descarga nada de internet.

## Fuentes

Las tipografías no van incluidas todavía; mientras falten se usan las del sistema.
Para descargarlas a `public/fuentes/` (PowerShell, desde la carpeta del proyecto):

```powershell
$base = "https://cdn.jsdelivr.net/npm/@fontsource"
$archivos = @(
  "newsreader/files/newsreader-latin-400-normal.woff2",
  "newsreader/files/newsreader-latin-400-italic.woff2",
  "newsreader/files/newsreader-latin-500-normal.woff2",
  "newsreader/files/newsreader-latin-500-italic.woff2",
  "instrument-sans/files/instrument-sans-latin-400-normal.woff2",
  "instrument-sans/files/instrument-sans-latin-500-normal.woff2",
  "instrument-sans/files/instrument-sans-latin-600-normal.woff2"
)
New-Item -ItemType Directory -Force public\fuentes | Out-Null
foreach ($a in $archivos) { Invoke-WebRequest "$base/$a" -OutFile ("public\fuentes\" + (Split-Path $a -Leaf)) }
```

Ambas tienen licencia SIL Open Font License.
