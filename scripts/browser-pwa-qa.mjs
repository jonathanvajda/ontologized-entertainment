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

  for (const modePath of ['/everything-is-sus/host/', '/everything-is-sus/pass-and-play/']) {
    await page.goto(origin + modePath, { waitUntil: 'domcontentloaded' });
    await page.locator('.suspect-toggle').first().waitFor();
    const suspects = page.locator('.suspect-toggle');
    await suspects.nth(0).click(); await suspects.nth(1).click(); await suspects.nth(2).click();
    await page.locator('#deal-case').click();
    await page.locator('#setup').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Roll one die' }).click();
    const beforeReload = await page.evaluate(() => ({ current: document.querySelector('#current').textContent, actions: document.querySelector('#actions').textContent, currentSites: [...document.querySelectorAll('.is-current')].map((node) => node.dataset.room || node.getAttribute('aria-label')) }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Investigation restored from this device. Changes are saved automatically.').waitFor();
    const afterReload = await page.evaluate(() => ({ current: document.querySelector('#current').textContent, actions: document.querySelector('#actions').textContent, currentSites: [...document.querySelectorAll('.is-current')].map((node) => node.dataset.room || node.getAttribute('aria-label')) }));
    assert.deepEqual(afterReload, beforeReload, `${modePath}: automatic RDF state recovery changed the current game`);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'End game' }).click();
    await page.waitForURL(`${origin}/everything-is-sus/`);
    await page.goto(origin + modePath, { waitUntil: 'domcontentloaded' });
    await page.locator('#setup').waitFor({ state: 'visible' });
    assert.equal(await page.getByText('Investigation restored from this device. Changes are saved automatically.').count(), 0, `${modePath}: ended game returned after reopening the mode`);
  }

  const invitationToken = Buffer.from(JSON.stringify({ h: 'ABCDE', s: 'mint', t: 'QA1234' })).toString('base64url');
  await page.goto(`${origin}/everything-is-sus/player/#invite=${invitationToken}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Welcome, Mrs. Mint!' }).waitFor();
  assert.equal(await page.locator('.evidence-card').count(), 0, 'QR invitation exposed private cards before confirmation');
  assert.equal(await page.getByRole('button', { name: 'Reveal hand' }).count(), 1, 'QR invitation did not require explicit hand reveal');

  await page.goto(origin + '/everything-is-sus/player/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { openEverythingsSusStorage } = await import('../storage.js');
    const storage = await openEverythingsSusStorage();
    await storage.savePrivateState({ tableCode: 'QA1234', suspectId: 'mint', cardIds: ['mint', 'rope', 'kitchen'], markedCardIds: ['brown'], notes: 'Reload-safe notes' });
    storage.close();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /private hand/i }).waitFor();
  assert.equal(await page.locator('textarea').inputValue(), 'Reload-safe notes', 'player: private RDF notes did not restore');
  assert.equal(await page.locator('.evidence-card').count(), 3, 'player: private RDF hand did not restore');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'End game' }).click();
  await page.getByRole('heading', { name: 'Open your hand' }).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Open your hand' }).waitFor();
  assert.equal(await page.locator('.evidence-card').count(), 0, 'player: ended private game returned after reload');

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
