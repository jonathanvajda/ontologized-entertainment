import { loadKnowledgeGraph } from './graph-loader.js';
import { QueryWhomSession } from './session.js';
import { openStorage } from './storage.js';
import { decodeGame, newGameCode, formatCode } from './protocol.js';
import { sortedCards } from './catalog.js';
import { Q } from './vocabulary.js';
import { QrScanner } from './scanner.js';
import { importSaveJson, exportSaveJson } from '../../packages/game-mechanics/src/save-package.js';

const $ = id => document.getElementById(id);
let graph, storage, session, revision = 0, busy = false, stopped = false, ownVisible = false;
let preferences = { sortMode: 'shuffle', hideEliminated: false }, registration, returnFromShare = false;
let lastFocus;
const notice = message => { $('notice').textContent = message; $('notice').hidden = !message; };
const message = error => error instanceof Error ? error.message : String(error);
const people = () => new Map(graph.catalog.map(person => [person.id, person]));

function view(name) {
  for (const key of ['home', 'share', 'reveal', 'board']) $(key + '-view').hidden = key !== name;
  $('home-button').hidden = name === 'home';
  $('update-app').hidden = !registration?.waiting || Boolean(session);
  $('main').focus({ preventScroll: true }); window.scrollTo(0, 0);
}
function uiPreferences(value) {
  return { sortMode: ['shuffle', 'name', 'hairColor', 'eyeColor', 'ethnicity', 'sex'].includes(value?.sortMode) ? value.sortMode : 'shuffle', hideEliminated: value?.hideEliminated === true };
}
async function task(operation) {
  if (busy) return;
  busy = true;
  const enabled = [...document.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
  enabled.forEach(element => element.disabled = true);
  try { notice(''); await operation(); }
  catch (error) { notice(message(error)); }
  finally { enabled.forEach(element => element.disabled = false); busy = false; if (stopped) lockGame(); }
}
function lockGame() {
  $('board-view').querySelectorAll('button,input,select').forEach(element => element.disabled = true);
  $('reveal-button').disabled = true; $('start-board').disabled = true;
  $('home-button').disabled = false;
}
async function persist() {
  const save = await session.save(preferences);
  try { revision = await storage.save(session.sessionIri, save, revision); }
  catch (error) { stopped = true; throw new Error(`${message(error)} Your last completed save is retained. Reload before continuing.`); }
}
async function act(type, parameters) {
  if (stopped) throw new Error('Reload before continuing this game.');
  await session.propose(type, parameters);
  await persist();
  renderBoard();
}
function image(person, large = false) {
  const img = document.createElement('img'); img.src = large ? person.portrait : person.thumbnail; img.alt = person.name;
  img.width = large ? 960 : 320; img.height = large ? 960 : 320;
  if (!large) { img.loading = 'lazy'; img.decoding = 'async'; }
  return img;
}
function openDialog(id) {
  lastFocus = document.activeElement;
  const dialog = $(id); if (!dialog.open) dialog.showModal();
}
function inspect(person, own = false) {
  $('inspect-image').src = person.portrait; $('inspect-image').alt = person.name;
  $('inspect-name').textContent = person.name; $('inspect-context').textContent = own ? 'YOUR SECRET PERSON · FOR YOUR EYES ONLY' : 'A CLOSER LOOK';
  openDialog('inspect-dialog');
}
function renderDock() {
  const person = people().get(session.project().ownTargetId);
  $('show-own').hidden = ownVisible; $('dock-portrait').hidden = !ownVisible; $('hide-own').hidden = !ownVisible;
  if (ownVisible) $('dock-image').src = person.thumbnail; else $('dock-image').removeAttribute('src');
  $('dock-image').alt = ownVisible ? person.name : '';
  $('dock-name').textContent = ownVisible ? person.name : '';
}
function renderBoard() {
  const projected = session.engine.getOperationalState(), catalog = people();
  $('sort-mode').value = preferences.sortMode; $('hide-eliminated').checked = preferences.hideEliminated;
  const cards = sortedCards(projected.cards, preferences.sortMode, graph.catalog);
  const visible = cards.filter(card => !preferences.hideEliminated || card.active);
  $('candidate-count').textContent = `${cards.filter(card => card.active).length} / ${cards.length - 1} left`;
  const previous = document.activeElement?.dataset.focusKey;
  const fragment = document.createDocumentFragment();
  for (const card of visible) {
    const person = catalog.get(card.id), tile = document.createElement('article');
    tile.className = `person-card${card.active ? '' : ' eliminated'}${card.own ? ' own' : ''}`;
    tile.dataset.personId = card.id;
    const portrait = document.createElement('button'); portrait.className = 'portrait-button'; portrait.dataset.focusKey = `inspect-${card.id}`;
    portrait.setAttribute('aria-label', `Inspect ${person.name}${card.own ? ', your person' : card.active ? '' : ', eliminated'}`);
    portrait.append(image(person));
    const label = document.createElement('span'); label.className = 'person-name'; label.textContent = person.name; portrait.append(label);
    portrait.addEventListener('click', () => inspect(person, card.own)); tile.append(portrait);
    if (card.own) {
      const tag = document.createElement('span'); tag.className = 'you-tag'; tag.textContent = 'YOU'; tile.append(tag);
    } else {
      const toggle = document.createElement('button'); toggle.className = 'card-toggle'; toggle.textContent = card.active ? '×' : '↶';
      toggle.dataset.focusKey = `toggle-${card.id}`;
      toggle.setAttribute('aria-label', `${card.active ? 'Eliminate' : 'Restore'} ${person.name}`);
      toggle.addEventListener('click', () => task(() => act(card.active ? 'eliminateCandidate' : 'restoreCandidate', { personId: card.id })));
      tile.append(toggle);
      if (!card.active) { const mark = document.createElement('span'); mark.className = 'elimination-mark'; mark.textContent = '×'; mark.setAttribute('aria-hidden', 'true'); tile.append(mark); }
    }
    fragment.append(tile);
  }
  $('board-grid').replaceChildren(fragment); $('empty-board').hidden = visible.length !== 0;
  if (previous) {
    const next = [...$('board-grid').querySelectorAll('button')].find(button => button.dataset.focusKey === previous);
    (next || $('eliminated-button')).focus({ preventScroll: true });
  }
  renderDock();
}
function renderEliminated() {
  const fragment = document.createDocumentFragment(), catalog = people();
  const eliminated = session.project().cards.filter(card => !card.active);
  for (const card of eliminated) {
    const person = catalog.get(card.id), row = document.createElement('div'); row.className = 'eliminated-row'; row.append(image(person));
    const name = document.createElement('span'); name.textContent = person.name; row.append(name);
    if (card.own) { const locked = document.createElement('small'); locked.textContent = 'Your person · locked'; row.append(locked); }
    else { const restore = document.createElement('button'); restore.textContent = 'Restore'; restore.setAttribute('aria-label', `Restore ${person.name}`);
      restore.addEventListener('click', () => task(async () => { await act('restoreCandidate', { personId: card.id }); renderEliminated(); $('eliminated-dialog').querySelector('button[data-close]').focus(); })); row.append(restore); }
    fragment.append(row);
  }
  $('eliminated-list').replaceChildren(fragment);
}
function qrCanvas(code, pixels = 280) {
  const qr = globalThis.qrcode(0, 'M'); qr.addData(code, 'Alphanumeric'); qr.make();
  const count = qr.getModuleCount(), moduleSize = Math.max(4, Math.floor(pixels / (count + 8))), size = moduleSize * (count + 8);
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Game QR code. The same invitation is available as text below.');
  const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#000';
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) ctx.fillRect((c + 4) * moduleSize, (r + 4) * moduleSize, moduleSize, moduleSize);
  return canvas;
}
function showShare(fromBoard = false) {
  returnFromShare = fromBoard;
  const code = session.definition.code; $('share-code').textContent = formatCode(code);
  $('share-qr').replaceChildren(qrCanvas(code)); $('share-continue').textContent = fromBoard ? 'Back to my board →' : 'Continue to my person →'; view('share');
}
function showSession() {
  ownVisible = false;
  if (session.project().revealed) { renderBoard(); view('board'); }
  else { $('revealed-person').hidden = true; $('reveal-button').hidden = false; view('reveal'); }
}
async function resume(record) {
  const restored = await QueryWhomSession.restore({ N3: globalThis.N3, baseStore: graph.store, manifest: graph.manifest, save: record.value });
  const nextRevision = await storage.save(restored.sessionIri, record.value, record.revision);
  session = restored; revision = nextRevision; preferences = uiPreferences(record.value.uiState); stopped = false; showSession();
}
async function start(code, playerRole) {
  const definition = await decodeGame(code);
  // Rejoining the same role resumes its existing private draw instead of drawing again.
  for (const record of await storage.list()) {
    const candidate = record.value;
    if (!candidate.state.includes(definition.code)) continue;
    const restored = await QueryWhomSession.restore({ N3: globalThis.N3, baseStore: graph.store, manifest: graph.manifest, save: candidate });
    if (restored.definition.code === definition.code && restored.project().playerRole === playerRole) { await resume(record); notice('Your existing game was resumed.'); return; }
  }
  const created = await QueryWhomSession.create({ N3: globalThis.N3, baseStore: graph.store, manifest: graph.manifest, code: definition.code, playerRole });
  const previous = { session, revision, preferences };
  session = created; revision = 0; preferences = { sortMode: 'shuffle', hideEliminated: false }; ownVisible = false;
  try { await persist(); } catch (error) { session = previous.session; revision = previous.revision; preferences = previous.preferences; throw error; }
  if (playerRole === 'creator') showShare(); else showSession();
}
async function showHome() {
  scanner.stop(); session = null; stopped = false; ownVisible = false; view('home');
  const records = await storage.list(); $('saved-games').hidden = !records.length;
  const fragment = document.createDocumentFragment();
  for (const record of records) {
    const button = document.createElement('button');
    button.dataset.sessionId = record.id;
    let summary = 'Saved table';
    try {
      const saved = new globalThis.N3.Store(new globalThis.N3.Parser().parse(record.value.state));
      const role = saved.getQuads(record.id, Q('playerRole'), null, null)[0]?.object.value;
      const count = saved.getQuads(record.id, Q('boardIncludes'), null, null).length;
      summary = `${role === 'creator' ? 'Created' : 'Joined'} table · ${count} people`;
    } catch { summary = 'Saved table · needs review'; }
    button.textContent = `Resume ${summary.toLowerCase()} · ${new Date(record.updatedAt).toLocaleDateString()} ${new Date(record.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    button.addEventListener('click', () => task(() => resume(record))); fragment.append(button);
  }
  $('saved-list').replaceChildren(fragment);
}

const scanner = new QrScanner({ video: $('scan-video'), onMessage: text => $('scan-message').textContent = text,
  onCode: code => { $('scan-dialog').close(); $('join-code').value = formatCode(code); task(() => start(code, 'joiner')); } });
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => {
    if (dialog.id === 'scan-dialog') scanner.stop();
    if (dialog.id === 'inspect-dialog') { $('inspect-image').removeAttribute('src'); $('inspect-name').textContent = ''; }
    if (lastFocus?.isConnected) lastFocus.focus();
  });
}
$('board-size').addEventListener('input', () => $('size-output').value = $('board-size').value);
$('create-form').addEventListener('submit', event => { event.preventDefault(); task(async () => start(await newGameCode(Number($('board-size').value)), 'creator')); });
$('join-form').addEventListener('submit', event => { event.preventDefault(); task(() => start($('join-code').value, 'joiner')); });
$('scan-button').addEventListener('click', async () => {
  if (busy) return;
  $('scan-message').textContent = 'Allow camera access, then point at the game QR.'; openDialog('scan-dialog');
  try { await scanner.start(); } catch (error) { scanner.stop(); $('scan-message').textContent = message(error); }
});
$('scan-cancel').addEventListener('click', () => { $('scan-dialog').close(); $('join-code').focus(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  scanner.stop(); if ($('scan-dialog').open) $('scan-dialog').close();
  if ($('inspect-dialog').open) $('inspect-dialog').close();
  ownVisible = false;
  if (session?.project().revealed) {
    renderDock();
    if (!$('reveal-view').hidden && !$('revealed-person').hidden) {
      $('reveal-image').removeAttribute('src'); $('reveal-name').textContent = '';
      showSession();
    }
  }
});
window.addEventListener('pagehide', () => scanner.stop());
$('home-button').addEventListener('click', () => task(showHome));
$('copy-code').addEventListener('click', () => task(async () => { if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable. Select and copy the displayed code.'); await navigator.clipboard.writeText(formatCode(session.definition.code)); notice('Invitation copied.'); }));
$('fullscreen-qr').addEventListener('click', () => { $('large-qr').replaceChildren(qrCanvas(session.definition.code, 450)); openDialog('qr-dialog'); });
$('share-continue').addEventListener('click', () => { if (returnFromShare) { view('board'); renderBoard(); } else showSession(); });
$('reveal-button').addEventListener('click', () => task(async () => {
  await act('revealTarget'); const person = people().get(session.project().ownTargetId);
  $('reveal-image').src = person.portrait; $('reveal-image').alt = person.name; $('reveal-name').textContent = person.name;
  $('revealed-person').hidden = false; $('reveal-button').hidden = true; $('start-board').focus();
}));
$('start-board').addEventListener('click', () => { ownVisible = true; renderBoard(); view('board'); $('reveal-image').removeAttribute('src'); });
$('share-again').addEventListener('click', () => { ownVisible = false; renderDock(); showShare(true); });
$('restart-button').addEventListener('click', () => { if (confirm('Start a new game? This table will remain saved under My games.')) task(showHome); });
$('show-own').addEventListener('click', () => { ownVisible = true; renderDock(); $('hide-own').focus(); });
$('hide-own').addEventListener('click', () => { ownVisible = false; renderDock(); $('show-own').focus(); });
$('dock-portrait').addEventListener('click', () => inspect(people().get(session.project().ownTargetId), true));
$('sort-mode').addEventListener('change', () => task(async () => { preferences.sortMode = $('sort-mode').value; await persist(); renderBoard(); }));
$('hide-eliminated').addEventListener('change', () => task(async () => { preferences.hideEliminated = $('hide-eliminated').checked; await persist(); renderBoard(); }));
$('eliminated-button').addEventListener('click', () => { renderEliminated(); openDialog('eliminated-dialog'); });
$('export-button').addEventListener('click', () => task(async () => {
  const json = exportSaveJson(await session.save(preferences)), url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'query-whom-private-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Save exported. This private file includes your secret person; keep it on your own device.');
}));
$('import-button').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', () => task(async () => {
  const file = $('import-file').files[0]; $('import-file').value = ''; if (!file) return;
  if (file.size > 5_000_000) throw new Error('The save file is too large.');
  const parsed = importSaveJson(await file.text(), { gameId: 'query-whom' }); if (!parsed.ok) throw new Error(parsed.message);
  const restored = await QueryWhomSession.restore({ N3: globalThis.N3, baseStore: graph.store, manifest: graph.manifest, save: parsed.value });
  const existing = await storage.read('sessions', restored.sessionIri);
  if (existing && !confirm('Replace this table’s existing local save with the imported save?')) return;
  const nextRevision = await storage.save(restored.sessionIri, parsed.value, existing?.revision || 0);
  session = restored; revision = nextRevision; preferences = uiPreferences(parsed.value.uiState); stopped = false; showSession();
}));

async function offline() {
  if (!('serviceWorker' in navigator) || !isSecureContext) { $('offline-status').textContent = 'Offline caching unavailable'; return; }
  registration = await navigator.serviceWorker.register('./service-worker.js');
  navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'OFFLINE_READY') $('offline-status').textContent = '● Ready to play offline'; });
  const checkWaiting = () => { $('update-app').hidden = !registration.waiting || Boolean(session); };
  registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', checkWaiting); });
  const ready = await navigator.serviceWorker.ready;
  ready.active?.postMessage({ type: 'CHECK_READY' }); checkWaiting();
}
$('update-app').addEventListener('click', () => {
  if (session || !registration?.waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
});

async function init() {
  // Deferred classic libraries finish before DOMContentLoaded; do not race module execution.
  if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  if (!globalThis.N3 || !globalThis.crypto?.subtle) throw new Error('This game needs a modern browser on HTTPS or localhost.');
  graph = await loadKnowledgeGraph(globalThis.N3); storage = await openStorage();
  await storage.cacheArtifacts(graph.manifest, graph.resources);
  document.querySelectorAll('#create-form button,#join-form button,#scan-button').forEach(button => button.disabled = false);
  // Keep decorative names aligned with the same canonical catalog as the board.
  document.querySelectorAll('.portrait-wall figure').forEach(figure => { const id = Number(/person-(\d+)/.exec(figure.querySelector('img').src)[1]); figure.querySelector('figcaption').textContent = people().get(id).name; });
  $('offline-status').textContent = 'Preparing offline play…';
  offline().catch(() => $('offline-status').textContent = 'Offline caching unavailable');
  const active = await storage.read('settings', 'active');
  if (active) {
    const record = await storage.read('sessions', active.value);
    if (record) { try { await resume(record); return; } catch (error) { notice(`Saved game could not be resumed: ${message(error)} It has been retained.`); } }
  }
  await showHome();
}
init().catch(error => { notice(`Unable to start: ${message(error)} No existing saves were changed.`); $('offline-status').textContent = 'Setup unavailable'; document.querySelectorAll('#create-form button,#join-form button,#scan-button,#import-button').forEach(button => button.disabled = true); });
