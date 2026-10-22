// Service worker: l'app funziona anche senza rete.
// Prima prova la rete (così gli aggiornamenti arrivano subito), se non c'è usa la copia salvata.
const VERSIONE = '0.42.38';
const CACHE = 'gi-demo-' + VERSIONE;
const FILES = ['./', 'index.html', 'manifest.json', 'css/style.css',
  'js/config.js', 'js/backend.js', 'js/ui.js', 'js/tocchi.js', 'js/qrcode.js', 'js/illustrazioni.js',
  'js/utenti.js', 'js/home.js', 'js/clienti.js', 'js/allegati.js', 'js/mezzi.js', 'js/impianti.js', 'js/impianti-scheda.js', 'js/controlli.js', 'js/controlli-stampa.js', 'js/rapportini.js', 'js/cablaggio.js', 'js/pdf.js', 'js/invio.js', 'js/conflitti.js', 'js/azzera.js', 'js/importa.js', 'js/layout.js', 'js/configuratore-gru.js', 'js/sottoganci.js', 'js/sottoganci-stampa.js', 'js/approfonditi-modelli.js', 'js/approfonditi-stampa.js', 'js/approfonditi.js', 'js/gho.js', 'js/sviluppo.js', 'img/approfonditi/carrucole.png', 'img/gho-logo.png', 'img/approfonditi/tamburo.png', 'js/app.js', 'img/favicon-64.png', 'img/apple-touch-icon.png', 'img/icon-192.png', 'img/icon-512.png', 'img/maskable-192.png', 'img/maskable-512.png', 'img/logo-grande.png', 'img/logo-30.png', 'img/cablaggio/monotrave.jpg', 'img/cablaggio/bitrave.jpg', 'img/cablaggio/misia.jpg', 'img/cablaggio/donati.jpg', 'img/cablaggio/cilindrico.jpg', 'img/cablaggio/conico.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'no-cache' })))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // librerie di Firebase: le tengo in copia per poter aprire l'app anche senza rete
  if (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return n; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    // "no-cache": chiedo sempre a GitHub se il file è cambiato (così gli aggiornamenti arrivano subito)
    fetch(e.request.url, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request.url, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
