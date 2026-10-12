import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const results = new URL('../test-results/', import.meta.url); await mkdir(results, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.ttl':'text/turtle', '.md':'text/plain' };
const overrides = new Map();
const server = createServer(async (request,response) => {
  try {
    let name = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (!name.startsWith('/project/')) { response.writeHead(404); response.end(); return; }
    name = name.slice('/project/'.length); if (name.endsWith('/')) name += 'index.html';
    const path = resolve(repo,name);
    if (!path.startsWith(resolve(repo)+sep)) throw new Error('Invalid path');
    const data = overrides.get(name) || await readFile(path); response.writeHead(200,{'content-type':mime[extname(path)] || 'application/octet-stream','cache-control':'no-cache'}); response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const url = `http://127.0.0.1:${server.address().port}/project/docs/query-whom/`;
const browser = await chromium.launch({ headless:true });
const errors = [], external = [];
async function pageFor(context) {
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{ if(!request.url().startsWith('http://127.0.0.1:') && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) external.push(request.url()); });
  await page.goto(url); await page.locator('#create-form button').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#create-form button').disabled || !document.querySelector('#notice').hidden);
  assert.equal(await page.locator('#notice').isVisible(),false,await page.locator('#notice').textContent());
  return page;
}
async function saveRecord(page) {
  return page.evaluate(async()=> {
    const db = await new Promise((resolve,reject)=>{const req=indexedDB.open('query-whom-v1'); req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const get = (store,id)=>new Promise((resolve,reject)=>{const req=db.transaction(store).objectStore(store).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const active=await get('settings','active'), record=await get('sessions',active.value);db.close(); return record;
  });
}
async function checkA11y(page,name) {
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(result.violations.map(v=>({id:v.id,help:v.help,nodes:v.nodes.map(n=>n.target)})),[],`Accessibility: ${name}`);
}
try {
  const hostContext=await browser.newContext({viewport:{width:1280,height:900}}), guestContext=await browser.newContext({viewport:{width:390,height:844}});
  const host=await pageFor(hostContext); await checkA11y(host,'home'); await host.screenshot({path:fileURLToPath(new URL('home.png',results)),fullPage:true});
  await host.addScriptTag({url:new URL('../vendor/mermaid.min.js',url).href});
  await host.evaluate(async()=>{mermaid.initialize({startOnLoad:false});const text=await (await fetch('./ontology/oliver-example.md')).text();await mermaid.parse(text.split('```mermaid\n')[1].split('\n```')[0]);});
  console.log('Passed home accessibility and protocol browser vector.');
  const vector=await host.evaluate(async()=>{const p=await import('./js/protocol.js');const code=await p.encodeGame({size:24,seed:Uint8Array.from({length:16},(_,i)=>i)});return {code,board:await p.reconstructBoard(await p.decodeGame(code))};});
  assert.equal(vector.code,'26224822263283272S5JJ4AC3E82U5JHE59RY'); assert.deepEqual(vector.board,[9,40,38,1,15,26,5,25,21,4,7,32,39,37,34,18,33,36,14,16,24,17,27,22]);
  await host.locator('#create-form button').click(); await host.locator('#share-view').waitFor({state:'visible'});
  const code=(await host.locator('#share-code').textContent()).replaceAll('-','');
  const qr=await host.evaluate(()=>{const canvas=document.querySelector('#share-qr canvas'),ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height);return jsQR(data.data,data.width,data.height).data;});
  assert.equal(qr,code); await checkA11y(host,'share');
  console.log('Passed local QR generation and decoding.');
  await host.locator('#share-continue').click(); await host.locator('#reveal-view').waitFor({state:'visible'});
  assert.equal(await host.locator('#revealed-person').isVisible(),false);
  const guest=await pageFor(guestContext); await guest.locator('#join-code').fill('2'.repeat(37)); await guest.locator('#join-form button').click();
  await guest.locator('#notice').waitFor({state:'visible'}); assert.match(await guest.locator('#notice').textContent(),/checksum/);
  await guest.locator('#join-code').fill(code); await guest.locator('#join-form button').click(); await guest.locator('#reveal-view').waitFor({state:'visible'});
  await host.locator('#reveal-button').click(); await host.locator('#revealed-person').waitFor({state:'visible'});
  await guest.locator('#reveal-button').click(); await guest.locator('#revealed-person').waitFor({state:'visible'});
  assert.notEqual(await host.locator('#reveal-name').textContent(),await guest.locator('#reveal-name').textContent());
  await host.locator('#start-board').click(); await guest.locator('#start-board').click();
  assert.equal(await host.locator('.person-card').count(),24); assert.equal(await guest.locator('.person-card').count(),24);
  assert.deepEqual(await host.locator('.person-card').evaluateAll(cards=>cards.map(c=>c.dataset.personId)),await guest.locator('.person-card').evaluateAll(cards=>cards.map(c=>c.dataset.personId)));
  assert.equal(await host.locator('.person-card.own .card-toggle').count(),0);
  await checkA11y(host,'board'); await checkA11y(guest,'mobile board');
  console.log('Passed matching boards, different private draws and board accessibility.');
  await host.locator('.person-card:not(.own) .portrait-button').first().click(); await host.locator('#inspect-dialog').waitFor({state:'visible'});
  const inspected=await host.locator('#inspect-name').textContent(); assert(inspected); assert.match(await host.locator('#candidate-count').textContent(),/^23/);
  await checkA11y(host,'inspection'); await host.keyboard.press('Escape');
  const id=await host.locator('.person-card:not(.own)').first().getAttribute('data-person-id');
  await host.locator(`.person-card[data-person-id="${id}"] .card-toggle`).click();
  await host.waitForFunction(()=>document.querySelector('#candidate-count').textContent.startsWith('22'));
  assert.match(await guest.locator('#candidate-count').textContent(),/^23/);
  await host.locator('#hide-eliminated').check(); await host.waitForFunction(()=>document.querySelectorAll('.person-card').length===22);
  await host.locator('#eliminated-button').click(); await host.getByRole('button',{name:new RegExp('^Restore ')}).click();
  await host.waitForFunction(()=>document.querySelector('#candidate-count').textContent.startsWith('23')); await host.locator('#eliminated-dialog [data-close]').click();
  const savedBefore=await saveRecord(host); await host.locator('#sort-mode').selectOption('name');
  await host.waitForFunction(()=>!document.querySelector('#sort-mode').disabled);
  await host.reload(); await host.locator('#board-view').waitFor({state:'visible'});
  assert.equal(await host.locator('#sort-mode').inputValue(),'name'); assert.equal(await host.locator('#hide-eliminated').isChecked(),true);
  assert.equal(await host.locator('#dock-portrait').isVisible(),false); assert.equal(await host.locator('#show-own').isVisible(),true);
  assert.equal((await saveRecord(host)).id,savedBefore.id);
  console.log('Passed elimination, hidden-card restoration and refresh persistence.');
  try { await host.locator('#offline-status').filter({hasText:'Ready to play offline'}).waitFor({timeout:30000}); }
  catch(error) { console.log('Offline diagnosis:',await host.evaluate(async()=>({status:document.querySelector('#offline-status').textContent,caches:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state}))}))); throw error; }
  await hostContext.setOffline(true); await host.reload(); await host.locator('#board-view').waitFor({state:'visible'});
  await host.locator('#show-own').click(); assert.equal(await host.locator('#dock-portrait').isVisible(),true);
  await host.locator('.person-card .portrait-button').first().click(); await host.locator('#inspect-dialog').waitFor({state:'visible'});
  assert(await host.locator('#inspect-image').evaluate(img=>img.complete&&img.naturalWidth===960)); await host.keyboard.press('Escape');
  await host.locator('.person-card .card-toggle').first().click(); await host.waitForFunction(()=>document.querySelector('#candidate-count').textContent.startsWith('22'));
  await host.reload(); await host.locator('#board-view').waitFor({state:'visible'}); assert.match(await host.locator('#candidate-count').textContent(),/^22/);
  await hostContext.setOffline(false);
  console.log('Passed offline reload, portrait inspection, elimination and save restoration.');
  const snapshot=await saveRecord(host);
  const [download]=await Promise.all([host.waitForEvent('download'),host.locator('#export-button').click()]);
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.manifest.gameId,'query-whom'); assert.equal(exported.state,snapshot.value.state);
  const importContext=await browser.newContext(),importPage=await pageFor(importContext);
  await importPage.locator('#import-file').setInputFiles({name:'private-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await importPage.locator('#board-view').waitFor({state:'visible'}); assert.equal((await saveRecord(importPage)).id,snapshot.id);
  assert.match(await importPage.locator('#candidate-count').textContent(),/^22/); await importContext.close();
  await host.locator('#home-button').click(); await host.locator('#home-view').waitFor({state:'visible'});
  await host.locator('#join-code').fill(code); await host.locator('#join-form button').click(); await host.locator('#reveal-view').waitFor({state:'visible'});
  // Host joining its own code draws in the opposite role and preserves the creator table.
  await host.locator('#home-button').click(); await host.locator('#home-view').waitFor({state:'visible'});
  await host.locator(`#saved-list button[data-session-id="${snapshot.id}"]`).click(); await host.locator('#board-view').waitFor({state:'visible'});
  assert.equal((await saveRecord(host)).id,snapshot.id);
  // Malformed import must not replace an active pointer or any saved table.
  await host.locator('#home-button').click(); await host.locator('#home-view').waitFor({state:'visible'});
  await host.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"manifest":{"saveFormatVersion":99}}')});
  await host.locator('#notice').waitFor({state:'visible'}); assert.match(await host.locator('#notice').textContent(),/version/);
  assert.equal((await saveRecord(host)).id,snapshot.id);
  // Camera failure path retains manual input.
  await host.locator('#scan-button').click(); await host.locator('#scan-dialog').waitFor({state:'visible'});
  await host.locator('#scan-message').filter({hasText:'unavailable'}).waitFor({timeout:15000}); await host.locator('#scan-cancel').click();
  assert.equal(await host.locator('#join-code').isVisible(),true);
  // Dedicated 20/40-card layouts and narrow landscape touch targets.
  for (const size of [20,40]) {
    const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true}); const page=await pageFor(context);
    await page.locator('#board-size').fill(String(size)); await page.locator('#board-size').dispatchEvent('input'); await page.locator('#create-form button').click();
    await page.locator('#share-continue').click(); await page.locator('#reveal-button').click(); await page.locator('#start-board').click();
    assert.equal(await page.locator('.person-card').count(),size);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('.portrait-button img').evaluateAll(images=>images.every(image=>{const rect=image.getBoundingClientRect();return Math.abs(rect.width-rect.height)<1;})),'Portrait cards must remain square');
    const targets=await page.locator('.card-toggle').evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;})); assert(targets);
    await checkA11y(page,`${size}-card landscape`); await page.screenshot({path:fileURLToPath(new URL(`board-${size}.png`,results)),fullPage:true});
    await context.close();
  }
  await guest.setViewportSize({width:390,height:844}); assert(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await guest.screenshot({path:fileURLToPath(new URL('mobile.png',results)),fullPage:true});
  // Simulate a release in the HTTP server, without mutating repository files.
  await host.locator(`#saved-list button[data-session-id="${snapshot.id}"]`).click(); await host.locator('#board-view').waitFor({state:'visible'});
  const oldSave=await saveRecord(host),precache=JSON.parse(await readFile(new URL('../assets/precache.json',import.meta.url),'utf8'));
  const nextVersion='qa-'+precache.version;
  const worker=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
  overrides.set('docs/query-whom/service-worker.js',Buffer.from(worker.replace(/const cacheName = PREFIX \+ '[a-f0-9]+';/,`const cacheName = PREFIX + '${nextVersion}';`)));
  overrides.set('docs/query-whom/assets/precache.json',Buffer.from(JSON.stringify({...precache,version:nextVersion})));
  await host.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await host.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting));
  assert.equal(await host.locator('#update-app').isVisible(),false,'Update cannot replace an active game');
  await host.locator('#home-button').click(); await host.locator('#update-app').waitFor({state:'visible'});
  await Promise.all([host.waitForNavigation(),host.locator('#update-app').click()]); await host.locator('#board-view').waitFor({state:'visible'});
  assert.equal((await saveRecord(host)).id,oldSave.id); assert.match(await host.locator('#candidate-count').textContent(),/^22/);
  console.log('Passed private export/import, Mermaid syntax and deliberate service-worker updates.');
  assert.deepEqual(errors,[],'Uncaught browser errors'); assert.deepEqual(external,[],'External runtime requests');
  console.log('Browser QA passed: shared QR/boards, distinct secrets, transitions, resume, offline reload/play, imports, camera fallback, accessibility and 20/24/40-card layouts.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
