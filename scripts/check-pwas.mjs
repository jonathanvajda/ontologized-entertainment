import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apps = [
  { name: 'Ontologized Entertainment', directory: 'docs', pages: ['index.html'], registration: 'pwa.js' },
  { name: 'Poker Dice', directory: 'docs/poker-dice', pages: ['index.html'], registration: 'app.js' },
  { name: "Everything's Sus", directory: 'docs/everything-is-sus', pages: ['index.html', 'host/index.html', 'pass-and-play/index.html', 'player/index.html'], registration: 'game-ui.js' },
  { name: 'Query Whom!', directory: 'docs/query-whom', pages: ['index.html'], registration: 'js/app.js' },
  { name: 'Maritime Warship', directory: 'docs/maritime-warship', pages: ['index.html'], registration: 'app.js' }
];

const exists = async path => { await access(path); return path; };
const pngSize = async path => {
  const data = await readFile(path);
  assert.equal(data.subarray(1, 4).toString(), 'PNG', `${path} is not a PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

for (const app of apps) {
  const directory = resolve(root, app.directory);
  const manifestPath = resolve(directory, 'manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(manifest.name && manifest.short_name, `${app.name}: manifest names are required`);
  assert(manifest.id && manifest.start_url && manifest.scope, `${app.name}: id, start_url, and scope are required`);
  assert(['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].includes(manifest.display), `${app.name}: installable display mode is required`);
  assert(Array.isArray(manifest.icons), `${app.name}: icons are required`);
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.type === 'image/png' && item.sizes?.split(/\s+/).includes(`${size}x${size}`) && item.purpose !== 'maskable');
    assert(icon, `${app.name}: ${size}x${size} PNG icon is required`);
    const iconPath = resolve(directory, icon.src);
    assert.deepEqual(await pngSize(iconPath), [size, size], `${app.name}: ${icon.src} has the wrong dimensions`);
  }
  const maskable = manifest.icons.find(item => item.purpose?.split(/\s+/).includes('maskable'));
  assert(maskable, `${app.name}: a maskable icon is required`);
  await exists(resolve(directory, maskable.src));
  assert.deepEqual(await pngSize(resolve(directory, 'assets/icon-32.png')), [32, 32], `${app.name}: 32x32 favicon fallback is required`);

  for (const page of app.pages) {
    const pagePath = resolve(directory, page);
    const html = await readFile(pagePath, 'utf8');
    assert(/rel=["']manifest["']/.test(html), `${app.name}: ${page} does not link its manifest`);
    assert(/rel=["']icon["']/.test(html), `${app.name}: ${page} does not link its favicon`);
    assert(/rel=["']apple-touch-icon["']/.test(html), `${app.name}: ${page} does not link its Apple touch icon`);
  }

  const registration = await readFile(resolve(directory, app.registration), 'utf8');
  assert(registration.includes('serviceWorker') && registration.includes('register('), `${app.name}: service worker is not registered`);
  const workerPath = resolve(directory, 'service-worker.js');
  const worker = await readFile(workerPath, 'utf8');
  assert(!/filter\s*\(\s*\(?\s*key\s*\)?\s*=>\s*key\s*!==\s*CACHE/.test(worker), `${app.name}: service worker may delete caches owned by other apps`);
  assert(!/\bcaches\.match\s*\(/.test(worker), `${app.name}: service worker reads outside its owned cache`);
  for (const [, relative] of worker.matchAll(/['"](\.\.?\/[^'"]+)['"]/g)) {
    if (relative.includes('${') || relative === './') continue;
    const candidate = resolve(directory, relative);
    const info = await stat(candidate).catch(() => null);
    assert(info, `${app.name}: service-worker asset is missing: ${relative}`);
  }
}

console.log(`Validated ${apps.length} independently installable PWAs and isolated cache ownership.`);
