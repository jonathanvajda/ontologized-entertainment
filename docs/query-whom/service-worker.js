/* Cache only this game's packaged resources. Updates activate deliberately from My games. */
const PREFIX = 'query-whom-';
const cacheName = PREFIX + 'd93a1b577bd2497119c6a5e6';
const base = new URL('./', self.location.href);
async function config() {
  const response = await fetch(new URL('assets/precache.json', base), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Offline manifest unavailable');
  const manifest = await response.clone().json();
  if (cacheName !== PREFIX + manifest.version) throw new Error('Offline cache version mismatch');
  return { response, manifest };
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const { response, manifest } = await config();
  const cache = await caches.open(cacheName);
  try {
    await cache.addAll(manifest.files.map(file => new Request(new URL(file.path, base), {
      integrity: 'sha256-' + btoa(file.sha256.match(/../g).map(hex => String.fromCharCode(parseInt(hex, 16))).join(''))
    })));
    await cache.put(new URL('assets/precache.json', base), response);
    await cache.put(new URL('__ready__', base), new Response('ready'));
  } catch (error) { await caches.delete(cacheName); throw error; }
  // The first installation may activate immediately; updates remain waiting.
  if (!self.registration.active) await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Do not delete old caches while another tab may still use the old catalog.
  await self.clients.claim();
  for (const client of await self.clients.matchAll()) client.postMessage({ type: 'OFFLINE_READY' });
})()));
async function currentCache() {
  // The compiled version belongs to this worker, including after an offline restart.
  return caches.open(cacheName);
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== base.origin) return;
  event.respondWith((async () => {
    const cache = await currentCache();
    const url = new URL(event.request.url);
    if (url.pathname === base.pathname) url.pathname += 'index.html';
    const cached = await cache?.match(url.href);
    return cached || fetch(event.request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'CHECK_READY') event.waitUntil((async () => {
    const cache = await currentCache();
    if (await cache?.match(new URL('__ready__', base))) event.source?.postMessage({ type: 'OFFLINE_READY' });
  })());
});
