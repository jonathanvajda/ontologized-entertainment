const CACHE = 'was-it-the-butler-v11';
const ASSETS = [
  './', './index.html', './butler.css', './game-config.js', './game-ui.js', './player.js',
  './manifest.webmanifest', './was-it-the-butler-RULES.md', './pass-and-play/', './host/', './player/',
  './model/butler-game.js', './model/compact-hand-code.js', './assets/manifest.json', './assets/art/estate-board-01.png', './assets/art/estate-board-02.png', './assets/art/estate-board-03.png', './assets/art/estate-board-04.png',
  './assets/art/person-mrs-eggshell.png', './assets/art/person-lt-marinara.png',
  './assets/art/person-ms-peach.png', './assets/art/person-mrs-mint-01.png', './assets/art/person-mrs-mint-02.png',
  './assets/art/person-professor-mulberry.png', './assets/art/person-mr-brown-01.png', './assets/art/person-mr-brown-02.png',
  './assets/art/weapon-shovel.png', './assets/art/weapon-baseball-bat.png',
  './assets/art/weapon-pistol.png', './assets/art/weapon-rope.png',
  './assets/art/weapon-knife.png', './assets/art/weapon-guitar-01.png', './assets/art/weapon-guitar-02.png',
  './assets/art/room-ballroom-01.png', './assets/art/room-ballroom-02.png', './assets/art/room-livingroom.png',
  './assets/art/room-diningroom.png', './assets/art/room-kitchen.png',
  './assets/art/room-library.png', './assets/art/room-gameroom-01.png', './assets/art/room-gameroom-02.png', './assets/art/room-gameroom-03.png',
  './assets/art/room-screened-in-porch.png', './assets/art/room-greenhouse.png',
  './assets/art/room-pool-room.png',
  '../styles/normalize.css', '../packages/game-mechanics/src/index.js',
  '../packages/game-mechanics/src/action-engine.js', '../packages/game-mechanics/src/engine.js',
  '../packages/game-mechanics/src/game-loader.js', '../packages/game-mechanics/src/logger.js',
  '../packages/game-mechanics/src/persistence.js', '../packages/game-mechanics/src/random-engine.js',
  '../packages/game-mechanics/src/rdf-store.js', '../packages/game-mechanics/src/render-adapter.js',
  '../packages/game-mechanics/src/result.js', '../packages/game-mechanics/src/rule-registry.js',
  '../packages/game-mechanics/src/save-package.js', '../packages/game-mechanics/src/score-engine.js',
  '../packages/game-mechanics/src/state-projector.js', '../packages/game-mechanics/src/transaction-log.js',
  '../packages/game-mechanics/src/turn-engine.js', '../packages/game-mechanics/src/ui-state.js',
  '../packages/game-mechanics/src/validator.js',
  '../packages/game-mechanics/src/hidden-information/index.js',
  '../packages/game-mechanics/src/hidden-information/crypto-engine.js',
  '../packages/game-mechanics/src/hidden-information/disclosure.js',
  '../packages/game-mechanics/src/hidden-information/encoding.js',
  '../packages/game-mechanics/src/hidden-information/privacy-screen.js',
  '../packages/game-mechanics/src/hidden-information/rdf-capsule.js',
  '../packages/game-mechanics/src/hidden-information/rdf-visibility.js',
  '../packages/game-mechanics/src/hidden-information/transport.js'
];
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
