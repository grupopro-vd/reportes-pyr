// Guarda la app y los formularios en el teléfono para que abran rápido y funcionen sin señal.
const CACHE = 'pro-ehs-v8';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'gp-app.js', 'logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png',
  'rapido.html', 'declaracion.html', 'detallado.html',
  'check_list_equipos.html', 'permiso_trabajo.html', 'entrega_epp.html',
  'hallazgos.html', 'charlas.html', 'comite.html', 'auditoria.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Red primero (para recibir actualizaciones); si no hay señal o tarda más de 4 s, usa la copia guardada.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  const fromCache = () => caches.match(key, { ignoreSearch: true }).then(m => m || caches.match(e.request, { ignoreSearch: true })).then(m => m || caches.match('index.html'));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => fromCache().then(m => { if (m && !done) { done = true; resolve(m); } }), 4000);
    // cache:'no-cache' obliga a revisar con GitHub y no usar una copia vieja del navegador
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      if (!done) { done = true; clearTimeout(timer); resolve(r); }
    }).catch(() => fromCache().then(m => { if (!done) { done = true; clearTimeout(timer); resolve(m || Response.error()); } }));
  }));
});
