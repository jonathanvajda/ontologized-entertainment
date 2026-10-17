import { createMaritimeGame } from './model/game.js';
import { SHIPS, presetFleet } from './game-config.js';
import { createSetup, decodeSetup, boardSeed, inviteUrl, formatCode } from './network.js';
import { localSave, parseLocalSave, saveActive, loadActive, parseFile, downloadJson, archiveMatch, listHistory, loadSettings, saveSettings, MAX_SAVE_BYTES } from './storage.js';
import { legalPlacements } from './rules/board.js';
import { renderBoard, previewPlacement } from './rendering/board-svg.js';
import { createPrivacyScreen } from '../packages/game-mechanics/src/hidden-information/privacy-screen.js';
import { QrScanner } from '../query-whom/js/scanner.js';
const $ = selector => document.querySelector(selector);
const make = (tag, className = '', text = '') => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
const form = $('#setup-form'), screen = $('#private-content');
let game = null, setup = null, selectedShip = null, placementStart = null, targets = [], drafts = {}, busy = false, archived = false;
let settings = { animations: true, sound: false, zoom: 27, zoomVersion: 2 };
const privacy = createPrivacyScreen({ maxRevealMs: 300_000 });
function error(message) {
  $('#error').textContent = message;
  const dialog = document.querySelector('.target-popover') || [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) { let node = dialog.querySelector('.dialog-error'); if (!node) { node = make('p', 'error dialog-error'); node.setAttribute('role', 'alert'); dialog.append(node); } node.textContent = message; }
}
const safe = fn => async (...args) => { try { await fn(...args); } catch (err) { error(err.message || 'That action could not be completed.'); } };
function clearMessages() { $('#error').textContent = ''; $('#notice').textContent = ''; $('#setup-error').textContent = ''; document.querySelectorAll('.dialog-error').forEach(el => el.remove()); }
function resetSelection() { targets = []; drafts = {}; placementStart = null; }
for (const [type, ship] of Object.entries(SHIPS)) {
  const label = make('label', '', ship.label + ` (${ship.length})`), input = document.createElement('input');
  input.type = 'number'; input.min = 0; input.max = 7; input.value = 1; input.name = 'count-' + type; label.append(input); $('#custom-counts').append(label);
}
form.elements.fleet.addEventListener('change', () => $('#custom-fleet').hidden = form.elements.fleet.value !== 'custom');
for (const input of [form.elements.rows, form.elements.columns, form.elements.obstacles]) input.addEventListener('input', () => $('.advanced summary span').textContent = `${form.elements.rows.value} × ${form.elements.columns.value} · ${form.elements.obstacles.value === '0' ? 'open ocean' : form.elements.obstacles.value + ' hazard clusters'}`);
form.addEventListener('submit', safe(async event => {
  event.preventDefault(); if (busy) return; busy = true; clearMessages(); const button = form.querySelector('[type=submit]'); button.disabled = true;
  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fleet = form.elements.fleet.value === 'custom' ? Object.keys(SHIPS).flatMap(type => Array(Number(form.elements['count-' + type].value)).fill(type)) : presetFleet(Number(form.elements.fleet.value));
    const config = { names: [form.elements.first.value, form.elements.second.value], rows: Number(form.elements.rows.value), columns: Number(form.elements.columns.value), climate: form.elements.climate.value, obstacles: Number(form.elements.obstacles.value), salvo: form.elements.salvo.value === 'salvo', fleet, budget: form.elements.fleet.value === 'custom' ? Number(form.elements.budget.value) : 35 };
    const nextSetup = await createSetup(config, form.elements.seed.value);
    const nextGame = createMaritimeGame(config, { boardSeed: boardSeed(nextSetup), localIndex: 0 });
    setup = nextSetup; game = nextGame; archived = false; selectedShip = null; resetSelection(); enterGame(); await persist(); openSharing(false);
  } catch (err) { $('#setup-error').textContent = err.message; }
  finally { busy = false; button.disabled = false; render(); }
}));
function enterGame() {
  $('#setup-screen').hidden = true; $('#game-screen').hidden = false; clearMessages();
  document.body.classList.toggle('arctic', game.state().config.climate === 'ARCTIC'); requestReveal();
}
function requestReveal() {
  privacy.conceal(); if (!game) return;
  const state = game.state(), me = state.players.find(p => p.iri === state.localPlayerIri);
  $('#handoff-title').textContent = `${me.name}, your command.`;
  $('#handoff-description').textContent = 'Keep your screen to yourself. Only your fleet and local observations are stored on this device.';
  if (!$('#handoff-dialog').open) $('#handoff-dialog').showModal();
}
$('#handoff-dialog').addEventListener('cancel', event => event.preventDefault());
$('#reveal-button').addEventListener('click', () => { $('#handoff-dialog').close(); privacy.reveal(game.state().localPlayerIri, { userConfirmed: true }); });
privacy.subscribe(state => {
  screen.replaceChildren(); resetSelection(); clearMessages();
  if (state.status === 'revealed') render();
  else if (game && !$('#game-screen').hidden && !$('#handoff-dialog').open) { const button = actionButton('Return to my command deck', requestReveal); screen.append(button); }
});
window.addEventListener('blur', () => privacy.handleVisibilityChange(true));
document.addEventListener('visibilitychange', () => privacy.handleVisibilityChange(document.hidden));
window.addEventListener('pagehide', () => { privacy.conceal(); scanner.stop(); });
function actionButton(text, handler, disabled = false, primary = false) { const el = make('button', primary ? 'primary' : '', text); el.disabled = disabled || busy; el.addEventListener('click', safe(handler)); return el; }
function boardPanel(title, description, active) {
  const panel = make('section', 'board-panel' + (active ? ' active' : '')), heading = make('div', 'board-heading'), copy = make('div');
  copy.append(make('h3', '', title), make('p', '', description)); heading.append(copy);
  const chart = make('div', 'chart-scroll'); chart.tabIndex = 0; chart.setAttribute('role', 'region'); chart.setAttribute('aria-label', title + ' scrollable chart');
  const legend = make('div', 'chart-legend'); for (const [symbol, label] of [['━', 'vessel'], ['×', 'hit'], ['•', 'miss'], ['◆', 'blocked']]) { const entry = make('span'); entry.append(make('b', '', symbol), document.createTextNode(label)); legend.append(entry); }
  panel.append(heading, chart, legend); return { panel, chart };
}
function render(focusCoordinate = null) {
  if (!game || privacy.getState().status !== 'revealed') return;
  const state = game.state(), me = state.players.find(p => p.iri === state.localPlayerIri), other = state.players.find(p => p.iri !== me.iri);
  const placement = state.phase === 'placement', outgoing = state.currentPlayerIri === me.iri;
  $('#engagement-meta').textContent = `${state.config.climate === 'ARCTIC' ? 'ARCTIC' : 'TROPICAL'} / ${state.config.rows} × ${state.config.columns} / ${state.config.salvo ? 'SALVO' : 'STANDARD'} / ${me.index === 0 ? 'CREATOR' : 'JOINER'}`;
  const strip = make('section', 'command-strip'), copy = make('div');
  copy.append(make('h2', '', state.complete ? `${state.players.find(p => p.iri === state.winnerIri).name} wins` : placement ? (placementStart ? 'Choose a highlighted end cell' : 'Deploy your fleet') : outgoing ? 'Your attack' : 'Incoming attack'));
  strip.append(copy, make('span', 'phase-tag', state.complete ? 'COMPLETE' : placement ? 'START + END' : outgoing ? 'CALL A COORDINATE' : 'RECORD THEIR COORDINATE'));
  const own = boardPanel('Primary grid', `${me.name} · ${placement ? 'your secret fleet' : me.ships.filter(s => !s.sunk).length + '/' + me.ships.length + ' vessels afloat'}`, placement || !outgoing);
  const enemy = boardPanel('Targeting grid', `${other.name} · verbal reports only · ${me.outgoing.filter(r => r.type === 'Sunk').length}/${state.config.fleet.length} sunk`, !placement && outgoing);
  if (!selectedShip || !me.ships.some(s => s.iri === selectedShip)) selectedShip = (me.ships.find(s => !s.placed) || me.ships[0])?.iri;
  const selectTarget = (coordinate, event) => {
    if (targets.includes(coordinate)) { targets = targets.filter(c => c !== coordinate); delete drafts[coordinate]; }
    else if (targets.length < (state.config.salvo ? 5 : 1)) targets.push(coordinate);
    else if (!state.config.salvo) { targets = [coordinate]; drafts = {}; }
    else { $('#notice').textContent = 'Five coordinates are already selected. Deselect one to change the volley.'; return; }
    render(coordinate);
    if (event?.type === 'keydown' || event?.detail === 0) screen.querySelector('.target-popover select')?.focus({ preventScroll: true });
  };
  const candidates = placement && placementStart ? placementCandidates(state, me) : [];
  const endpoint = candidate => candidate.cells[0] === placementStart ? candidate.cells.at(-1) : candidate.cells[0];
  renderBoard(own.chart, me, state.config, { title: 'Primary grid', showShips: true, interactive: !state.complete && (placement || !outgoing), selected: placement && placementStart ? [placementStart] : !outgoing ? targets : [], endpoints: candidates.map(endpoint),
    onHover: placement && placementStart ? (coordinate, svg) => previewPlacement(svg, candidates.find(candidate => endpoint(candidate) === coordinate)?.cells || []) : null,
    onCell: placement ? safe(placeShip) : selectTarget });
  renderBoard(enemy.chart, other, state.config, { title: 'Targeting grid', showShips: false, interactive: !state.complete && !placement && outgoing, selected: outgoing ? targets : [], onCell: selectTarget });
  const boards = make('div', 'boards'); boards.append(own.panel, enemy.panel);
  let popup = null;
  const dock = make('section', 'action-dock placement-dock'), dockCopy = make('div'), controls = make('div', 'dock-buttons');
  if (placement) {
    dockCopy.append(make('h3', '', `${me.ships.filter(s => s.placed).length}/${me.ships.length} vessels positioned`));
    const list = make('div', 'ship-list');
    for (const ship of me.ships) {
      const button = actionButton(SHIPS[ship.type].label, () => { selectedShip = ship.iri; placementStart = null; render(); });
      button.classList.add('ship-choice'); button.classList.toggle('placed', ship.placed); button.setAttribute('aria-pressed', selectedShip === ship.iri);
      const icon = make('span', 'ship-glyph'); icon.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < ship.length; i++) icon.append(make('i'));
      button.append(icon, make('small', '', `${ship.length} cells`)); list.append(button);
    }
    dockCopy.append(list, make('p', 'placement-hint', placementStart ? `${placementStart}: select the other end of your ${me.ships.find(ship => ship.iri === selectedShip).length}-cell ship. Click the start again to cancel.` : 'Choose a ship, then its first and last cells.'));
    controls.append(actionButton('Auto-deploy', () => { placementStart = null; return execute('autoPlace'); }), actionButton('Clear', () => { placementStart = null; return execute('clearPlacement'); }), actionButton('Lock my fleet', () => execute('lockFleet'), !me.ships.every(s => s.placed), true));
  } else if (!state.complete) {
    if (targets.length) {
      popup = make('section', 'target-popover'); popup.setAttribute('popover', 'manual'); popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Report selected coordinates');
      popup.dataset.anchor = targets.includes(focusCoordinate) ? focusCoordinate : targets.at(-1);
      const title = make('div', 'popover-heading'); title.append(make('h3', '', targets.length === 1 ? `Report ${targets[0]}` : `Report volley (${targets.length}/5)`)); popup.append(title);
      const fields = make('div', 'report-fields');
      const confirm = actionButton(targets.length === 1 ? 'Record result' : 'Record volley', submitReport, targets.some(c => !drafts[c]?.type), true);
      confirm.setAttribute('aria-label', 'Record reported results');
      for (const coord of targets) {
        const label = make('label', '', coord), select = document.createElement('select'); select.dataset.reportCoordinate = coord;
        for (const [value, title] of [['', 'Choose result...'], ['Miss', 'Miss'], ['Hit', 'Hit'], ['Sunk', 'Sunk'], [state.config.climate === 'ARCTIC' ? 'GlancingMiss' : 'Blocked', state.config.climate === 'ARCTIC' ? 'Glancing miss' : 'Blocked']]) { const option = document.createElement('option'); option.value = value; option.textContent = title; select.append(option); }
        select.value = drafts[coord]?.type || '';
        select.addEventListener('change', () => { drafts[coord] = { ...drafts[coord], type: select.value }; confirm.disabled = busy || targets.some(c => !drafts[c]?.type); });
        label.append(select); fields.append(label);
      }
      const cancel = actionButton('Cancel', () => { resetSelection(); render(); }); cancel.setAttribute('aria-label', 'Cancel selection');
      const actions = make('div', 'popover-actions'); actions.append(cancel, confirm); popup.append(fields, actions);
      if (state.config.salvo && targets.length < 5) {
        const addTarget = actionButton('Add another target', () => {
          if (popup.hidePopover) popup.hidePopover(); else popup.hidden = true;
          (outgoing ? enemy : own).chart.querySelector(`[data-coordinate="${popup.dataset.anchor}"]`)?.focus({ preventScroll: true });
        });
        actions.prepend(addTarget);
      }
      if (state.config.salvo) {
        const reopen = actionButton(`Report ${targets.length} selected`, () => { popup.hidden = false; if (popup.showPopover && !popup.matches(':popover-open')) popup.showPopover(); positionTargetMenu(); });
        reopen.classList.add('reopen-report'); (outgoing ? enemy : own).panel.querySelector('.board-heading').append(reopen);
      }
      popup.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); const coordinate = popup.dataset.anchor; resetSelection(); render(coordinate); } });
    }
  } else { dockCopy.append(make('h3', '', state.winnerIri === me.iri ? 'Victory. All enemy vessels reported sunk.' : 'Defeat. Your fleet was destroyed.'), make('p', '', 'No opponent placements are stored here. Compare boards in person if you wish.')); controls.append(actionButton('Export journal', exportSave), actionButton('New engagement', returnToSetup, false, true)); }
  dock.append(dockCopy, controls);
  const log = make('section', 'battle-log'), entries = make('div', 'log-entries'); log.append(make('h3', '', 'Your local firing reports'));
  for (const result of state.results.slice(-12).reverse()) entries.append(make('span', 'log-entry ' + result.type.toLowerCase(), `${result.attackerIri === me.iri ? 'OUT' : 'IN'} / ${result.coordinate} / ${result.type}`));
  if (!state.results.length) entries.append(make('p', 'fine-print', 'No reports recorded. Your opponent’s journal stays independent.')); log.append(entries);
  screen.replaceChildren(strip, ...((placement || state.complete) ? [dock] : []), boards, log);
  if (popup) { screen.append(popup); popup.showPopover?.(); positionTargetMenu(); }
  if (focusCoordinate) (outgoing ? enemy : own).chart.querySelector(`[data-coordinate="${focusCoordinate}"]`)?.focus();
}
async function execute(actionType, parameters = {}) {
  if (busy) return false; busy = true; clearMessages();
  try { const result = await game.act(actionType, parameters); if (!result.ok) throw new Error(result.message); await persist(); return true; }
  finally { busy = false; render(); }
}
function placementCandidates(state, me) {
  const ship = me.ships.find(ship => ship.iri === selectedShip);
  const occupied = new Set(me.ships.filter(other => other.iri !== selectedShip).flatMap(other => other.cells));
  return legalPlacements(ship.length, me.obstacles, state.config, occupied).filter(candidate => candidate.cells[0] === placementStart || candidate.cells.at(-1) === placementStart);
}
async function placeShip(coordinate) {
  const state = game.state(), me = state.players.find(player => player.iri === state.localPlayerIri);
  if (!placementStart) {
    placementStart = coordinate;
    if (!placementCandidates(state, me).length) { placementStart = null; throw new Error('No legal ship can start or end here. Choose another cell.'); }
    clearMessages(); render(); screen.querySelector(`.board-panel:first-child [data-coordinate="${coordinate}"]`)?.focus({ preventScroll: true }); return;
  }
  if (placementStart === coordinate) { placementStart = null; render(); return; }
  const candidate = placementCandidates(state, me).find(candidate => candidate.cells[0] === coordinate || candidate.cells.at(-1) === coordinate);
  if (!candidate) { error('Choose a highlighted end cell at the selected ship length.'); return; }
  if (await execute('placeShip', { shipIri: selectedShip, start: candidate.start, orientation: candidate.orientation })) {
    placementStart = null;
    selectedShip = game.state().players.find(player => player.iri === state.localPlayerIri).ships.find(ship => !ship.placed)?.iri || selectedShip;
    render();
  }
}
function positionTargetMenu() {
  const menu = screen.querySelector('.target-popover'); if (!menu) return;
  const cell = screen.querySelector(`.board-panel.active [data-coordinate="${menu.dataset.anchor}"]`); if (!cell) return;
  const anchor = cell.getBoundingClientRect(), box = menu.getBoundingClientRect(), gap = 10;
  let left = anchor.right + gap;
  if (left + box.width > innerWidth - gap) left = anchor.left - box.width - gap;
  left = Math.max(gap, Math.min(left, innerWidth - box.width - gap));
  let top = anchor.top;
  top = Math.max(gap, Math.min(top, innerHeight - box.height - gap));
  menu.style.left = `${left}px`; menu.style.top = `${top}px`;
}
window.addEventListener('resize', positionTargetMenu);
window.addEventListener('scroll', positionTargetMenu, true);
async function submitReport() {
  const state = game.state(), outgoing = state.currentPlayerIri === state.localPlayerIri;
  const reports = targets.map(coordinate => ({ coordinate, ...drafts[coordinate] }));
  if (await execute('recordReport', { direction: outgoing ? 'outgoing' : 'incoming', reports })) { resetSelection(); render(); $('#notice').textContent = 'Report recorded locally. Continue the conversation with your opponent.'; effects(reports.some(r => ['Hit', 'Sunk'].includes(r.type))); }
}
async function persist() {
  if (!game) return false;
  try { const record = localSave(game, setup); await saveActive(record); const state = game.state(); if (state.complete && !archived) { await archiveMatch(record, { winner: state.players.find(p => p.iri === state.winnerIri).name, names: state.players.map(p => p.name), shots: state.results.length, climate: state.config.climate }); archived = true; } return true; }
  catch { error('Local saving is unavailable. Export your journal before leaving.'); return false; }
}
async function resume(record) { const restored = await parseLocalSave(record); game = restored.game; setup = restored.setup; selectedShip = null; archived = false; resetSelection(); for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); enterGame(); }
function exportSave() { if (game) downloadJson(localSave(game, setup), 'maritime-warship-private-local-save.json'); }
async function returnToSetup() { await persist(); privacy.conceal(); game = null; setup = null; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); $('#game-screen').hidden = true; $('#setup-screen').hidden = false; screen.replaceChildren(); document.body.classList.remove('arctic'); await refreshSaves(); }
function openSharing(join = false) {
  clearMessages(); $('#transfer-title').textContent = join ? 'Join a game' : 'Share the setup once';
  $('#transfer-description').textContent = join ? 'Scan the creator’s QR, paste an invitation, or type the complete setup code. No server lookup is needed.' : 'The code contains public rules and terrain only. Your opponent joins on their device. After setup, communicate all attacks and results verbally.';
  for (const id of ['receive-button', 'scan-button']) $('#' + id).hidden = !join;
  for (const id of ['copy-button', 'copy-link-button']) $('#' + id).hidden = join;
  $('#transfer-text').readOnly = !join; $('#transfer-text').value = !join && setup ? formatCode(setup.code) : '';
  $('#qr-output').replaceChildren();
  if (!join && setup) { const qr = window.qrcode(0, 'M'); qr.addData(inviteUrl(setup.code, new URL('./', location.href).href)); qr.make(); $('#qr-output').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); $('#qr-output svg')?.setAttribute('aria-label', 'Public setup invitation QR'); }
  $('#transfer-status').textContent = join ? 'The creator fires first. Your fleet will be placed privately on this device.' : 'No fleets, hits, misses, private random state, or saved progress are included.';
  if (!$('#transfer-dialog').open) $('#transfer-dialog').showModal();
}
async function joinCode(code) {
  const nextSetup = await decodeSetup(code), nextGame = createMaritimeGame(nextSetup.config, { boardSeed: boardSeed(nextSetup), localIndex: 1 });
  setup = nextSetup; game = nextGame; archived = false; selectedShip = null; resetSelection(); scanner.stop();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); enterGame(); await persist();
}
const scanner = new QrScanner({ video: $('#scan-video'), decodeCode: decodeSetup, onCode: safe(joinCode), onMessage: message => $('#scan-status').textContent = message });
$('#scan-button').addEventListener('click', safe(async () => { $('#scan-dialog').showModal(); try { await scanner.start(); } catch (err) { $('#scan-status').textContent = err.message; } }));
$('#scan-dialog').addEventListener('close', () => scanner.stop()); $('#scan-cancel').addEventListener('click', () => $('#scan-dialog').close());
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#menu-button').addEventListener('click', () => $('#menu-dialog').showModal());
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
$('#join-button').addEventListener('click', () => openSharing(true));
$('#network-button').addEventListener('click', () => { $('#menu-dialog').close(); openSharing(false); });
$('#receive-button').addEventListener('click', safe(() => joinCode($('#transfer-text').value)));
for (const [id, isLink] of [['copy-button', false], ['copy-link-button', true]]) $('#' + id).addEventListener('click', safe(async () => { const text = isLink ? inviteUrl(setup.code, new URL('./', location.href).href) : formatCode(setup.code); try { await navigator.clipboard.writeText(text); $('#transfer-status').textContent = 'Copied. Share only this setup; play continues verbally.'; } catch { $('#transfer-text').value = text; $('#transfer-text').select(); $('#transfer-status').textContent = 'Select and copy the text using your browser’s copy command.'; } }));
$('#save-button').addEventListener('click', safe(async () => { if (await persist()) $('#notice').textContent = 'Local journal saved on this device.'; }));
$('#resume-button').addEventListener('click', safe(async () => { const record = await loadActive(); if (!record) throw new Error('No local journal found.'); await resume(record); }));
$('#conceal-button').addEventListener('click', requestReveal); $('#new-button').addEventListener('click', safe(returnToSetup)); $('#export-button').addEventListener('click', exportSave);
$('#import-button').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', safe(async event => { const file = event.target.files[0]; event.target.value = ''; if (!file) return; if (file.size > MAX_SAVE_BYTES) throw new Error('File exceeds the 96 MB limit.'); await resume(parseFile(await file.text())); await persist(); }));
for (const key of ['animations', 'sound', 'zoom']) $('#' + key).addEventListener('input', safe(async event => { settings[key] = key === 'zoom' ? Number(event.target.value) : event.target.checked; document.documentElement.style.setProperty('--cell', settings.zoom + 'px'); await saveSettings(settings); }));
function effects(hit) {
  if (settings.animations && !matchMedia('(prefers-reduced-motion: reduce)').matches) { document.body.classList.remove('hit-flash', 'splash-effect'); void document.body.offsetWidth; document.body.classList.add(hit ? 'hit-flash' : 'splash-effect'); if (hit) navigator.vibrate?.([100, 50, 100]); }
  if (settings.sound) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; const context = new Audio(), oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = hit ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(hit ? 100 : 700, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(hit ? 35 : 240, context.currentTime + .25); gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .3); oscillator.onended = () => context.close(); }
}
async function refreshSaves() { try { $('#resume-button').disabled = !await loadActive(); const history = await listHistory(); $('#history-section').hidden = !history.length; $('#history-list').replaceChildren(...history.map(entry => make('p', 'history-entry', `${entry.names.join(' vs ')} · ${entry.winner} won · ${entry.shots} reports · ${new Date(entry.savedAt).toLocaleDateString()}`))); } catch { $('#resume-button').disabled = true; } }
async function initialize() {
  try { const saved = await loadSettings(); if (saved) settings = { ...settings, ...saved, zoom: saved.zoomVersion === 2 ? saved.zoom : Math.max(20, Math.round((saved.zoom || 36) * .75)), zoomVersion: 2 }; } catch { /* Export remains available without persistence. */ }
  for (const key of ['animations', 'sound']) $('#' + key).checked = settings[key]; $('#zoom').value = settings.zoom; document.documentElement.style.setProperty('--cell', settings.zoom + 'px');
  await refreshSaves();
  if (location.hash.startsWith('#invite=')) { const code = location.href; history.replaceState(null, '', location.pathname + location.search); try { await joinCode(code); } catch (err) { error(err.message); } }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
await initialize();
