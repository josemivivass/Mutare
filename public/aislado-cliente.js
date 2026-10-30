// Habla con aislado.html: una página invisible, sin acceso a la red, donde
// corren las librerías que necesitan evaluar código (heic2any, mammoth).
let marco = null;
function abrir() {
  return (marco ||= new Promise((ok, mal) => {
    const f = document.createElement('iframe');
    f.src = '/aislado.html'; f.hidden = true; f.title = 'Conversor aislado';
    const t = setTimeout(() => mal(new Error('No se pudo preparar el conversor')), 20000);
    addEventListener('message', function h(e) {
      if (e.source === f.contentWindow && e.data?.listo) { clearTimeout(t); removeEventListener('message', h); ok(f); }
    });
    document.body.appendChild(f);
  }).catch((e) => { marco = null; throw e; }));
}
export async function aislado(op, datos) {
  const f = await abrir();
  const id = crypto.randomUUID();
  return new Promise((ok, mal) => {
    addEventListener('message', function h(e) {
      if (e.source !== f.contentWindow || e.data?.id !== id) return;
      removeEventListener('message', h);
      e.data.ok ? ok(e.data.resultado) : mal(new Error(e.data.error));
    });
    f.contentWindow.postMessage({ id, op, datos }, location.origin);
  });
}
