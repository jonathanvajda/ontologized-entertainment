const CACHE = 'everything-is-sus-v26';
const ASSETS = [
  './', './index.html', './everything-is-sus.css', './game-config.js', './game-ui.js', './player.js',
  './manifest.webmanifest', './everything-is-sus-RULES.md', './pass-and-play/', './host/', './player/',
  './model/everything-is-sus-game.js', './model/compact-hand-code.js', './model/sleuth-sheet-state.js', './assets/manifest.json', './assets/board-topology.json', './assets/art/board-layout.png', './assets/art/board-layout-legend.png', './assets/art/board-layout-and-legend.png', './assets/art/estate-board-01.png', './assets/art/estate-board-02.png', './assets/art/estate-board-03.png', './assets/art/estate-board-04.png',
  './assets/art/person-mrs-eggshell.png', './assets/art/person-lt-marinara.png',
  './assets/art/person-ms-peach.png', './assets/art/person-mrs-mint-01.png', './assets/art/person-mrs-mint-02.png',
  './assets/art/person-professor-mulberry.png', './assets/art/person-mr-brown-01.png', './assets/art/person-mr-brown-02.png',
  './assets/art/weapon-shovel.png', './assets/art/weapon-baseball-bat.png',
  './assets/art/weapon-pistol.png', './assets/art/weapon-rope.png',
  './assets/art/weapon-knife.png', './assets/art/weapon-guitar-01.png', './assets/art/weapon-guitar-02.png',
  './assets/art/room-ballroom-01.png', './assets/art/room-ballroom-02.png', './assets/art/room-livingroom.png',
  './assets/art/room-diningroom.png', './assets/art/room-kitchen.png',
  './assets/art/room-library.png', './assets/art/room-study.png', './assets/art/room-gameroom-01.png', './assets/art/room-gameroom-02.png', './assets/art/room-gameroom-03.png',
  './assets/art/room-screened-in-porch.png', './assets/art/room-greenhouse.png',
  './assets/art/room-pool-room.png',
  './assets/art/room-ballroom-topdown-03.png', './assets/art/room-livingroom-topdown-02.png',
  './assets/art/room-diningroom-topdown-02.png', './assets/art/room-kitchen-topdown-02.png',
  './assets/art/room-study-topdown-02.png', './assets/art/room-gameroom-topdown-04.png',
  './assets/art/room-screened-in-porch-topdown-02.png', './assets/art/room-greenhouse-topdown-02.png',
  './assets/art/room-pool-room-topdown-02.png',
  './assets/art/foyer-topdown-01.png',
  './assets/art/room-ballroom-board-02.png', './assets/art/room-livingroom-board-02.png',
  './assets/art/room-diningroom-board-01.png', './assets/art/room-kitchen-board-03.png',
  './assets/art/room-study-board-02.png',
  './assets/art/room-gameroom-board-02.png', './assets/art/room-screened-in-porch-board-03.png',
  './assets/art/room-greenhouse-board-02.png', './assets/art/room-pool-room-board-01.png',
  './assets/art/foyer-board-02.png',
  '../styles/normalize.css', '../poker-dice/rendering/dice-svg.js', '../query-whom/vendor/qrcode.js', '../query-whom/vendor/jsQR.js', '../query-whom/js/protocol.js', '../query-whom/js/scanner.js', '../packages/game-mechanics/src/index.js',
  '../packages/game-mechanics/src/action-engine.js', '../packages/game-mechanics/src/engine.js',
  '../packages/game-mechanics/src/game-loader.js', '../packages/game-mechanics/src/logger.js',
  '../packages/game-mechanics/src/persistence.js', '../packages/game-mechanics/src/qr-code.js', '../packages/game-mechanics/src/random-engine.js',
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
