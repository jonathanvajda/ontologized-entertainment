/* Lightweight launcher cache. Each game owns its more-specific service-worker scope. */
const PREFIX = 'ontologized-entertainment-launcher-';
const CACHE = `${PREFIX}v1`;
const base = new URL('./', self.location.href);
const paths = [
  './', './index.html', './pwa.js', './manifest.webmanifest', './assets/icon.svg', './assets/icon-32.png',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png', './assets/ontologized-entertainment-games-hero-01.webp',
  './styles/normalize.css', './styles/skeleton.css', './styles/app-base.css', './styles/games-landing.css',
  './everything-is-sus/assets/art/estate-board-04.png',
  './query-whom/assets/portraits/person-01-320.webp', './query-whom/assets/portraits/person-25-320.webp',
  './maritime-warship/assets/icon.svg'
];
const assetUrls = new Set(paths.map(path => new URL(path, base).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...assetUrls])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.hash = '';
  url.search = '';
  if (url.href === base.href) url.pathname += 'index.html';
  if (!assetUrls.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(url.href, response.clone());
    return response;
  }));
});
