// Service worker: l'app funziona anche senza rete.
// Prima prova la rete (così gli aggiornamenti arrivano subito), se non c'è usa la copia salvata.
const VERSIONE = '0.11.0';
const CACHE = 'gi-demo-' + VERSIONE;
const FILES = ['./', 'index.html', 'manifest.json', 'css/style.css',
  'js/config.js', 'js/backend.js', 'js/ui.js', 'js/illustrazioni.js',
  'js/utenti.js', 'js/home.js', 'js/clienti.js', 'js/allegati.js', 'js/mezzi.js', 'js/impianti.js', 'js/impianti-scheda.js', 'js/controlli.js', 'js/controlli-stampa.js', 'js/sottoganci.js', 'js/sottoganci-stampa.js', 'js/app.js', 'img/icon-192.png', 'img/icon-512.png', 'img/logo.png', 'img/logo-30.png', 'img/logo-scheda.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
