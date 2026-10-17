// Service worker: l'app si apre anche senza rete.
// Quando modifichi i file dell'app, aumenta il numero di versione qui sotto.
const CACHE = 'lavagna-v24';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './config.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png', './logo.png'
];

self.addEventListener('install', e => {
  // ogni file viene salvato singolarmente: se uno manca, l'aggiornamento non si blocca
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => console.warn('SW: file mancante', a)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Libreria Firebase (versionata): prima la cache
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  // File dell'app: prima la rete (così gli aggiornamenti arrivano subito), poi la cache
  if (url.origin === self.location.origin) {
    // "no-cache": chiede sempre al sito se il file è cambiato
    e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
  }
});
