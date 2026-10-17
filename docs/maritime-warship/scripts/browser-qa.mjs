import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../../query-whom/package.json', import.meta.url));
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const results = fileURLToPath(new URL('../test-results/', import.meta.url));
await mkdir(results, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const absolute = resolve(root, '.' + path);
    if (!absolute.startsWith(root + sep)) throw new Error('Outside test root');
    const data = await readFile(absolute);
    response.writeHead(200, { 'content-type': mime[extname(absolute)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/docs/maritime-warship/`;
const browser = await chromium.launch({ headless: true });
const errors = [], external = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
async function pageIn(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto(url); await page.locator('#setup-form').waitFor(); return page;
}
async function reveal(page) {
  await page.bringToFront();
  if (await page.locator('#handoff-dialog').isVisible()) await page.locator('#reveal-button').click();
  else if (!await page.locator('.command-strip').count()) { await page.getByRole('button', { name: 'Return to my command deck' }).click(); await page.locator('#reveal-button').click(); }
  await page.locator('.command-strip').waitFor();
}
async function start(page) {
  await page.selectOption('[name=fleet]', '4'); await page.locator('.advanced summary').click(); await page.locator('[name=seed]').fill('browser-qa');
  await page.locator('#setup-form [type=submit]').click(); await page.locator('#transfer-dialog').waitFor();
  const code = await page.locator('#transfer-text').inputValue();
  await page.locator('#transfer-dialog [data-close]').click(); await page.locator('#handoff-dialog').waitFor(); await reveal(page); return code;
}
async function deploy(page) {
  await page.getByRole('button', { name:'Auto-deploy',exact:true }).click();
  await page.getByRole('button', { name:'Lock my fleet',exact:true }).waitFor({state:'visible'});
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.action-dock button')).find(b=>b.textContent==='Lock my fleet')?.disabled);
  await page.getByRole('button',{name:'Lock my fleet',exact:true}).click(); await page.locator('.command-strip h2').filter({hasText:/Your attack|Incoming attack/}).waitFor();
}
async function mark(page, board, coordinate, type) {
  await page.locator('.board-panel').nth(board).locator(`[data-coordinate="${coordinate}"]`).click();
  const input = page.locator(`[data-report-coordinate="${coordinate}"]`);
  assert.equal(await input.inputValue(),'','Outcomes must not be prefilled');
  assert.equal(await page.getByRole('button',{name:'Record reported results',exact:true}).isDisabled(),true);
  await input.selectOption(type);
  await page.getByRole('button',{name:'Record reported results',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-report-coordinate]').length===0);
}
async function a11y(page, name) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(report.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], name);
}
async function persisted(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('maritime-warship-local-v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const value = await new Promise((resolve, reject) => { const request = db.transaction('saveStates').objectStore('saveStates').get('local-player'); request.onsuccess = () => resolve(request.result?.value); request.onerror = () => reject(request.error); });
    db.close(); return value;
  });
}
try {
  const page=await pageIn(context); await a11y(page,'setup'); await page.screenshot({path:resolve(results,'setup-desktop.png'),fullPage:true});
  assert.equal(await page.locator('[name=mode]').count(),0,'Pass-and-play is not selectable');
  const code=await start(page); await a11y(page,'placement');
  await page.locator('.board-panel').first().locator('[data-coordinate=A1]').click();
  assert.match(await page.locator('.action-dock h3').textContent(),/0\/4/,'First click must only stage a starting cell');
  const primary=page.locator('.board-panel').first();
  assert.ok(await primary.locator('[data-coordinate=A4]').evaluate(el=>el.classList.contains('placement-end')));
  await primary.locator('[data-coordinate=A4]').hover();
  assert.equal(await primary.locator('.chart-cell.preview').count(),4,'Endpoint hover previews the whole ship');
  await primary.locator('[data-coordinate=B2]').click();
  assert.match(await page.locator('.action-dock h3').textContent(),/0\/4/,'Invalid diagonal endpoint must not place a ship');
  await primary.locator('[data-coordinate=A4]').click();
  await page.waitForFunction(()=>document.querySelector('.action-dock h3').textContent.startsWith('1/4'));
  // The next three-cell vessel can be placed right-to-left without rotation controls.
  await primary.locator('[data-coordinate=C3]').focus();await page.keyboard.press('Enter');
  await primary.locator('[data-coordinate=C1]').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.action-dock h3').textContent.startsWith('2/4'));
  assert.equal(await primary.locator('.chart-cell.ship').count(),7);
  await page.screenshot({path:resolve(results,'placement-endpoints.png'),fullPage:true});
  await deploy(page); await a11y(page,'outgoing turn');
  await page.locator('.board-panel').nth(1).locator('[data-coordinate=A1]').click();
  assert.equal(await page.locator('[data-report-coordinate=A1]').inputValue(),'');
  assert.equal(await page.locator('.action-dock').count(),0,'Combat must not reserve a permanent action panel');
  const bounds=await page.locator('.target-popover').boundingBox();
  assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=1440 && bounds.y+bounds.height<=1000,'Reporting menu stays in the viewport');
  await a11y(page,'floating report menu');
  await page.screenshot({path:resolve(results,'floating-report.png'),fullPage:true});
  await page.getByRole('button',{name:'Cancel selection',exact:true}).click(); assert.equal(await page.locator('[data-report-coordinate]').count(),0);
  await mark(page,1,'A1','Hit');
  assert.match(await page.locator('.command-strip h2').textContent(),/Incoming attack/);
  assert.match(await page.locator('.log-entry').first().textContent(),/OUT \/ A1 \/ Hit/);
  const empty=await page.locator('.board-panel').first().locator('.chart-cell:not(.ship):not(.obstacle)').first().getAttribute('data-coordinate');
  await mark(page,0,empty,'Miss');
  assert.match(await page.locator('.command-strip h2').textContent(),/Your attack/);
  await a11y(page,'manual reports'); await page.screenshot({path:resolve(results,'combat-desktop.png'),fullPage:true});
  await page.setViewportSize({width:844,height:390}); await a11y(page,'landscape');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(results,'combat-landscape.png'),fullPage:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); assert.equal(await page.locator('.chart-scroll svg').count(),0); await reveal(page);
  await page.locator('#save-button').click(); const saved=await persisted(page); assert.equal(saved.audience,'local-player'); assert.equal(saved.transactions.filter(tx=>tx.action.actionType==='recordReport').length,2);
  await page.reload(); await page.locator('#resume-button:not([disabled])').waitFor(); await page.locator('#resume-button').click(); await page.locator('#handoff-dialog').waitFor(); await reveal(page);
  assert.equal(await page.locator('.log-entry').count(),2);
  console.log('PASS: placement, explicit outgoing/incoming reports, cancellation, privacy, save/resume and desktop/mobile accessibility');
  await page.locator('#menu-button').click(); await page.locator('#network-button').click();
  assert.equal(await page.locator('#transfer-text').inputValue(),code,'Re-sharing exports only original setup');
  await a11y(page,'sharing');
  const invitation=await page.evaluate(async()=>{
    const svg=document.querySelector('#qr-output svg'); const xml=new XMLSerializer().serializeToString(svg);
    const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));await image.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,600);ctx.drawImage(image,0,0,600,600);
    const pixels=ctx.getImageData(0,0,600,600);return window.jsQR(pixels.data,600,600)?.data;
  });
  assert.ok(invitation?.includes('#invite='),'Generated QR must decode to the setup invitation');
  const joinContext=await browser.newContext({viewport:{width:1440,height:1000}}), joiner=await pageIn(joinContext);
  await joiner.locator('#join-button').click();await joiner.locator('#transfer-text').fill(code.toLowerCase());await joiner.locator('#receive-button').click();await joiner.locator('#handoff-dialog').waitFor();await reveal(joiner);await deploy(joiner);
  assert.match(await joiner.locator('.command-strip h2').textContent(),/Incoming attack/);
  assert.equal(await joiner.locator('.log-entry').count(),0,'Creator reports do not propagate to joiner');
  await a11y(joiner,'joiner');await joiner.screenshot({path:resolve(results,'two-device-player.png'),fullPage:true});
  const linkContext=await browser.newContext(),linked=await linkContext.newPage();await linked.goto(invitation);await linked.locator('#handoff-dialog').waitFor();assert.equal(new URL(linked.url()).hash,'');await reveal(linked);
  const cameraContext=await browser.newContext(),camera=await pageIn(cameraContext);await camera.locator('#join-button').click();await camera.locator('#scan-button').click();await camera.waitForFunction(()=>/denied|unavailable/.test(document.querySelector('#scan-status').textContent));await camera.locator('#scan-cancel').click();
  await page.bringToFront();await page.locator('#transfer-dialog [data-close]').click();await reveal(page);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('#resume-button:not([disabled])').waitFor();await context.setOffline(true);await page.reload();await page.locator('#resume-button:not([disabled])').waitFor();await page.locator('#resume-button').click();await page.locator('#handoff-dialog').waitFor();await reveal(page);
  // Both devices remain offline while independent local changes are recorded.
  await joinContext.setOffline(true);await joiner.bringToFront();await reveal(joiner);
  const incoming=await joiner.locator('.board-panel').first().locator('.chart-cell:not(.ship):not(.obstacle)').first().getAttribute('data-coordinate');await mark(joiner,0,incoming,'Miss');
  assert.equal((await persisted(joiner)).transactions.filter(tx=>tx.action.actionType==='recordReport').length,1);
  await page.bringToFront();await reveal(page);assert.equal(await page.locator('.log-entry').count(),2,'Joiner changes remain local');await mark(page,1,'A2','Sunk');
  assert.equal(await page.locator('[data-sunk-coordinate]').count(),0,'Sunk does not require class disclosure');
  assert.match(await page.locator('.log-entry').first().textContent(),/Sunk/);
  await context.setOffline(false); await joinContext.setOffline(false);
  const largeContext=await browser.newContext({viewport:{width:1440,height:1000}}),large=await pageIn(largeContext);
  await large.locator('.advanced summary').click();await large.locator('[name=rows]').fill('26');await large.locator('[name=columns]').fill('26');
  await large.locator('#setup-form [type=submit]').click();await large.locator('#transfer-dialog').waitFor();await large.locator('#transfer-dialog [data-close]').click();await large.locator('#handoff-dialog').waitFor();await reveal(large);
  const largeWidth=await large.locator('.chart-scroll svg').first().evaluate(svg=>svg.getBoundingClientRect().width);
  assert.ok(largeWidth<750 && largeWidth>700,'26-column grid uses a 25 percent smaller minimum cell size');
  assert.ok(await large.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await large.locator('.chart-scroll').first().evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=el.scrollHeight;});
  await a11y(large,'26 by 26 chart');await large.screenshot({path:resolve(results,'large-grid.png'),fullPage:true});
  const salvoContext=await browser.newContext({viewport:{width:844,height:390}}),salvo=await pageIn(salvoContext);
  await salvo.selectOption('[name=salvo]','salvo');await start(salvo);await deploy(salvo);
  const salvoChart=salvo.locator('.board-panel').nth(1);
  await salvoChart.locator('[data-coordinate=A1]').click();await salvo.locator('[data-report-coordinate=A1]').selectOption('Hit');
  await salvo.getByRole('button',{name:'Add another target',exact:true}).click();
  await salvoChart.locator('[data-coordinate=A2]').click();
  assert.equal(await salvo.locator('[data-report-coordinate=A1]').inputValue(),'Hit','Staged salvo outcomes survive closing and reopening the local menu');
  assert.equal(await salvo.locator('[data-report-coordinate=A2]').inputValue(),'');
  await a11y(salvo,'mobile salvo popup');
  const salvoBounds=await salvo.locator('.target-popover').boundingBox();assert.ok(salvoBounds.x>=0 && salvoBounds.y>=0 && salvoBounds.x+salvoBounds.width<=844 && salvoBounds.y+salvoBounds.height<=390);
  await salvo.screenshot({path:resolve(results,'salvo-floating-landscape.png'),fullPage:true});
  await salvo.locator('[data-report-coordinate=A2]').selectOption('Sunk');await salvo.getByRole('button',{name:'Record reported results',exact:true}).click();
  await salvo.waitForFunction(()=>document.querySelectorAll('.log-entry').length===2);
  assert.deepEqual(errors,[],'No runtime errors');assert.deepEqual(external,[],'No external requests');
  console.log('PASS: setup code, decoded QR, invitation link, denied-camera fallback, offline reload and independent offline devices.');
  console.log('Screenshots: docs/maritime-warship/test-results/');
} catch (error) {
  for (const ctx of browser.contexts()) for (const page of ctx.pages()) console.error('Browser status:', await page.locator('#error').textContent().catch(() => ''), await page.locator('#transfer-status').textContent().catch(() => ''));
  console.error('Runtime errors:', errors); throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
