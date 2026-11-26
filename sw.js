/* Service worker de Centro Kairós.
   Hace que la web se pueda instalar como app y que, sin internet, muestre la última
   versión guardada o un aviso amable en vez de una pantalla de error.

   Siempre busca primero en internet: los cambios de la web (por ejemplo el artículo
   de los viernes) se ven enseguida. Solo usa lo guardado cuando no hay conexión.
   Nunca guarda los datos de los pacientes: las consultas a Supabase pasan de largo.

   Si alguna vez la app queda "trabada" en una versión vieja, subí el número de VERSION. */
const VERSION = 'kairos-v2';
const BASICOS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png', '/images/img1.png'];

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

/* ===== Avisos de turnos =====
   Los manda Supabase (función portal-avisos) 1 hora antes de cada turno. Llegan aunque la app esté cerrada. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Centro Kairós', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: 'es-AR',
    data: { url: d.url || '/portal.html' }
  }));
});

/* Al tocar el aviso se abre el portal (o se trae al frente si ya estaba abierto) */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/portal.html', self.location.origin).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const v = ventanas.find(c => c.url.startsWith(self.location.origin));
    if (v) {
      try { await v.focus(); if (!v.url.startsWith(url)) await v.navigate(url); return; } catch (err) {}
    }
    await self.clients.openWindow(url);
  })());
});

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
