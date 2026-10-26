import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../docs/query-whom/node_modules/playwright/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
const types = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttl': 'text/turtle', '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp'
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('outside root');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const apps = [
  ['launcher', '/'],
  ['poker-dice', '/poker-dice/'],
  ['everything-is-sus', '/everything-is-sus/'],
  ['query-whom', '/query-whom/'],
  ['maritime-warship', '/maritime-warship/']
];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const [name, path] of apps) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => navigator.serviceWorker.getRegistrations().then(registrations =>
      registrations.some(registration => new URL(registration.scope).pathname === expected && registration.active)
    ), path, { timeout: 30_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => new URL(navigator.serviceWorker.controller?.scriptURL || location.href).pathname === `${expected}service-worker.js`, path, { timeout: 30_000 });
    const metadata = await page.evaluate(() => ({
      manifest: document.querySelector('link[rel="manifest"]')?.href,
      favicon: document.querySelector('link[rel="icon"]')?.href,
      appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href
    }));
    assert(metadata.manifest && metadata.favicon && metadata.appleIcon, `${name}: incomplete install metadata`);
  }

  const cacheNames = await page.evaluate(() => caches.keys());
  for (const prefix of ['ontologized-entertainment-launcher-', 'poker-dice-', 'everything-is-sus-', 'query-whom-', 'maritime-warship-']) {
    assert(cacheNames.some(name => name.startsWith(prefix)), `Missing cache owned by ${prefix}`);
  }

  await context.setOffline(true);
  for (const [name, path] of apps) {
    const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    assert(response?.ok(), `${name}: launch page was unavailable offline`);
  }
  console.log(`Browser-validated ${apps.length} scoped PWAs, coexisting caches, and offline launch pages.`);
} finally {
  await browser.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
}
