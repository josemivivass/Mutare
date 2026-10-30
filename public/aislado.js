'use strict';
// Operaciones que necesitan eval, ejecutadas en esta página aislada.
// Las librerías se cargan solo cuando hacen falta.
(function () {
  const cargadas = {};
  function cargar(src) {
    return (cargadas[src] ||= new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    }));
  }
  const OPS = {
    async heic({ bytes, tipo, calidad }) {
      await cargar('/vendor/heic2any-0.0.4/heic2any.min.js');
      let r = await self.heic2any({ blob: new Blob([bytes]), toType: tipo, quality: calidad });
      if (Array.isArray(r)) r = r[0];
      return new Uint8Array(await r.arrayBuffer());
    },
    async word({ bytes, modo }) {
      await cargar('/vendor/mammoth-1.8.0/mammoth.browser.min.js');
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const r = modo === 'texto' ? await self.mammoth.extractRawText({ arrayBuffer }) : await self.mammoth.convertToHtml({ arrayBuffer });
      return { valor: r.value, avisos: r.messages.map((m) => m.message) };
    },
  };
  addEventListener('message', async (e) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const { id, op, datos } = e.data || {};
    try { parent.postMessage({ id, ok: true, resultado: await OPS[op](datos) }, location.origin); }
    catch (err) { parent.postMessage({ id, ok: false, error: String((err && err.message) || err) }, location.origin); }
  });
  parent.postMessage({ listo: true }, location.origin);
})();
