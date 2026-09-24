const CACHE = 'ontoeagle-game-engine-v1';
const ASSETS = [
  './', './index.html', './app.js', './manifest.webmanifest',
  '../styles/normalize.css', '../styles/skeleton.css', '../styles/app-base.css', '../styles/game-shell.css',
  '../packages/game-mechanics/src/index.js', '../packages/game-mechanics/src/action-engine.js',
  '../packages/game-mechanics/src/engine.js', '../packages/game-mechanics/src/game-loader.js',
  '../packages/game-mechanics/src/logger.js', '../packages/game-mechanics/src/persistence.js',
  '../packages/game-mechanics/src/random-engine.js', '../packages/game-mechanics/src/rdf-store.js',
  '../packages/game-mechanics/src/render-adapter.js', '../packages/game-mechanics/src/result.js',
  '../packages/game-mechanics/src/rule-registry.js', '../packages/game-mechanics/src/save-package.js',
  '../packages/game-mechanics/src/score-engine.js', '../packages/game-mechanics/src/state-projector.js',
  '../packages/game-mechanics/src/transaction-log.js', '../packages/game-mechanics/src/turn-engine.js',
  '../packages/game-mechanics/src/ui-state.js', '../packages/game-mechanics/src/validator.js',
  '../src/ontologies/GameOntology.ttl', '../src/ontologies/GameShapes.ttl', '../vendor/n3.min.js'
];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
