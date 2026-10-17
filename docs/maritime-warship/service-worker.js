const CACHE = 'maritime-warship-v5';
const base = new URL('./', self.location.href);
const paths = [
  './', './index.html', './app.js', './theme.css', './game-config.js', './storage.js', './network.js', './manifest.webmanifest', './assets/icon.svg',
  './rules/board.js', './model/game.js', './model/projection.js', './model/vocabulary.js', './model/visibility.js', './rendering/board-svg.js',
  '../styles/normalize.css', '../query-whom/vendor/qrcode.js', '../query-whom/vendor/jsQR.js', '../query-whom/js/protocol.js', '../query-whom/js/scanner.js',
  ...['rdf-store', 'engine', 'action-engine', 'random-engine', 'rule-registry', 'validator', 'transaction-log', 'state-projector', 'result', 'persistence'].map(name => `../packages/game-mechanics/src/${name}.js`),
  ...['crypto-engine', 'encoding', 'rdf-capsule', 'rdf-visibility', 'transport', 'privacy-screen'].map(name => `../packages/game-mechanics/src/hidden-information/${name}.js`)
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(paths.map(path => new URL(path, base).href))).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('maritime-warship-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== base.origin) return;
  const url = new URL(event.request.url); url.hash = ''; url.search = '';
  if (!paths.some(path => new URL(path, base).href === url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href); if (cached) return cached;
    const response = await fetch(event.request); if (response.ok) await cache.put(url.href, response.clone()); return response;
  }));
});
