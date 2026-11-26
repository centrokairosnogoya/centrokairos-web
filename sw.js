/* Service worker de Centro Kairós.
   Hace que la web se pueda instalar como app y que, sin internet, muestre la última
   versión guardada o un aviso amable en vez de una pantalla de error.

   Siempre busca primero en internet: los cambios de la web (por ejemplo el artículo
   de los viernes) se ven enseguida. Solo usa lo guardado cuando no hay conexión.
   Nunca guarda los datos de los pacientes: las consultas a Supabase pasan de largo.

   Si alguna vez la app queda "trabada" en una versión vieja, subí el número de VERSION. */
const VERSION = 'kairos-v1';
const BASICOS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/images/img1.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Safari no acepta respuestas guardadas que vinieron de una redirección: se copian limpias */
async function limpia(resp) {
  if (!resp || !resp.redirected) return resp;
  const body = await resp.blob();
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  /* Solo archivos de este mismo sitio. Supabase, Google Fonts, WhatsApp, etc. no se tocan. */
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const resp = await fetch(req);
      if (resp.ok && resp.type === 'basic') e.waitUntil(limpia(resp.clone()).then(r => cache.put(req, r)).catch(() => {}));
      return resp;
    } catch (err) {
      const guardada = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (guardada) return limpia(guardada);
      if (req.mode === 'navigate') return cache.match('/offline.html');
      throw err;
    }
  })());
});
