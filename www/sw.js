// Mis alquileres — permite abrir la versión web sin conexión. Los datos nunca pasan por aquí.
const CACHE = 'misalquileres-v1.8.0';
const ASSETS = ['./', 'index.html', 'estilos.css', 'idioma.js', 'i18n/en.js', 'i18n/de.js', 'i18n/fr.js', 'i18n/it.js', 'nucleo.js', 'extras.js', 'tablas.js', 'exportar.js', 'pdf.js', 'documentos.js', 'plataforma.js', 'fonts/ahn-400.woff2', 'fonts/ahn-600.woff2', 'fonts/ahn-700.woff2', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
