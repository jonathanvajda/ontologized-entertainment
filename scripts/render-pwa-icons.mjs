import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../docs/query-whom/node_modules/playwright/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icons = [
  ['docs/assets/icon.svg', 'docs/assets', '#0b2e25'],
  ['docs/poker-dice/assets/icon.svg', 'docs/poker-dice/assets', '#123f32'],
  ['docs/everything-is-sus/assets/icon.svg', 'docs/everything-is-sus/assets', '#15251f'],
  ['docs/query-whom/assets/icon.svg', 'docs/query-whom/assets', '#143c38'],
  ['docs/maritime-warship/assets/icon.svg', 'docs/maritime-warship/assets', '#071f2b']
];
const outputs = [
  ['icon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512]
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [source, outputDirectory, background] of icons) {
    const svg = await readFile(resolve(root, source), 'utf8');
    await mkdir(resolve(root, outputDirectory), { recursive: true });
    for (const [filename, size] of outputs) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({ path: resolve(root, outputDirectory, filename), type: 'png' });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
