import { createMaritimeGame } from './model/game.js';
import { SHIPS, presetFleet } from './game-config.js';
import { createSetup, decodeSetup, boardSeed, inviteUrl, formatCode, withPlayerNames } from './network.js';
import { localSave, parseLocalSave, saveActive, loadActive, parseFile, downloadJson, loadMatch, removeMatch, listMatches, loadSettings, saveSettings, MAX_SAVE_BYTES } from './storage.js';
import { legalPlacements } from './rules/board.js';
import { renderBoard, previewPlacement } from './rendering/board-svg.js';
import { createPrivacyScreen } from '../packages/game-mechanics/src/hidden-information/privacy-screen.js';
import { QrScanner } from '../query-whom/js/scanner.js';
const $ = selector => document.querySelector(selector);
const make = (tag, className = '', text = '') => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
const form = $('#setup-form'), screen = $('#private-content');
let game = null, setup = null, selectedShip = null, placementStart = null, targets = [], drafts = {}, editing = null, busy = false, initialSharing = false, removalId = null;
let settings = { animations: true, sound: false, zoom: 27, zoomVersion: 2 };
const privacy = createPrivacyScreen({ maxRevealMs: 300_000 });
function error(message) {
  $('#error').textContent = message;
  const dialog = document.querySelector('.target-popover') || [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) { let node = dialog.querySelector('.dialog-error'); if (!node) { node = make('p', 'error dialog-error'); node.setAttribute('role', 'alert'); dialog.append(node); } node.textContent = message; }
}
const safe = fn => async (...args) => { try { await fn(...args); } catch (err) { error(err.message || 'That action could not be completed.'); } };
function clearMessages() { $('#error').textContent = ''; $('#notice').textContent = ''; $('#setup-error').textContent = ''; document.querySelectorAll('.dialog-error').forEach(el => el.remove()); }
function resetSelection() { targets = []; drafts = {}; editing = null; placementStart = null; }
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
    const nextGame = createMaritimeGame(config, { boardSeed: boardSeed(nextSetup), localIndex: 0, name: form.elements.matchName.value });
    setup = nextSetup; game = nextGame; selectedShip = null; resetSelection(); enterGame(false); await persist(); await openSharing(false, true);
  } catch (err) { $('#setup-error').textContent = err.message; }
  finally { busy = false; button.disabled = false; render(); }
}));
function enterGame(revealPrompt = true) {
  $('#setup-screen').hidden = true; $('#game-screen').hidden = false; clearMessages();
  document.body.classList.toggle('arctic', game.state().config.climate === 'ARCTIC'); if (revealPrompt) requestReveal();
}
function requestReveal() {
  privacy.conceal(); showRevealPrompt();
}
function showRevealPrompt() {
  if (!game || $('#game-screen').hidden || document.querySelector('dialog[open]:not(#handoff-dialog)')) return;
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
  else showRevealPrompt();
});
window.addEventListener('blur', () => privacy.handleVisibilityChange(true));
document.addEventListener('visibilitychange', () => privacy.handleVisibilityChange(document.hidden));
window.addEventListener('pagehide', () => { privacy.conceal(); scanner.stop(); });
function actionButton(text, handler, disabled = false, primary = false) { const el = make('button', primary ? 'primary' : '', text); el.disabled = disabled || busy; el.addEventListener('click', safe(handler)); return el; }
function boardPanel(title, description, active) {
  const panel = make('section', 'board-panel' + (active ? ' active' : '')), heading = make('div', 'board-heading'), copy = make('div');
  copy.append(make('h3', '', title), make('p', '', description)); heading.append(copy);
  const chart = make('div', 'chart-scroll'); chart.tabIndex = 0; chart.setAttribute('role', 'region'); chart.setAttribute('aria-label', title + ' chart');
  const legend = make('div', 'chart-legend'); for (const [symbol, label] of [['━', 'vessel'], ['×', 'hit'], ['•', 'miss'], ['⚓', 'hit and sunk']]) { const entry = make('span'); entry.append(make('b', '', symbol), document.createTextNode(label)); legend.append(entry); }
  panel.append(heading, chart, legend); return { panel, chart };
}
function render(focusCoordinate = null) {
  if (!game || privacy.getState().status !== 'revealed') return;
  const state = game.state(), me = state.players.find(p => p.iri === state.localPlayerIri), other = state.players.find(p => p.iri !== me.iri);
  const placement = state.phase === 'placement', outgoing = state.currentPlayerIri === me.iri;
  const reportingOutgoing = Boolean(editing) || outgoing, shotLimit = state.config.salvo ? 5 - state.volleyCount : 1;
  $('#match-name').textContent = state.name;
  $('#engagement-meta').textContent = `${state.config.climate === 'ARCTIC' ? 'ARCTIC' : 'TROPICAL'} / ${state.config.rows} × ${state.config.columns} / ${state.config.salvo ? 'SALVO' : 'STANDARD'} / ${me.index === 0 ? 'CREATOR' : 'JOINER'}`;
  const strip = make('section', 'command-strip'), copy = make('div');
  copy.append(make('h2', '', state.ended ? 'Engagement ended' : state.complete ? `${state.players.find(p => p.iri === state.winnerIri).name} wins` : placement ? (placementStart ? 'Choose a highlighted end cell' : 'Deploy your fleet') : outgoing ? 'Your attack' : 'Incoming attack'));
  strip.append(copy, make('span', 'phase-tag', state.ended ? 'ENDED' : state.complete ? 'COMPLETE' : placement ? 'START + END' : outgoing ? 'CALL A COORDINATE' : 'CONFIRM THEIR COORDINATE'));
  const own = boardPanel('Primary grid', `${me.name} · ${placement ? 'your secret fleet' : me.ships.filter(s => !s.sunk).length + '/' + me.ships.length + ' vessels afloat'}`, placement || !outgoing);
  const enemy = boardPanel('Targeting grid', `${other.name} · verbal reports only · ${me.outgoing.filter(r => r.type === 'Sunk').length}/${state.config.fleet.length} sunk`, !placement && outgoing);
  if (!selectedShip || !me.ships.some(s => s.iri === selectedShip)) selectedShip = (me.ships.find(s => !s.placed) || me.ships[0])?.iri;
  const selectTarget = (coordinate, event) => {
    if (editing) resetSelection();
    if (targets.includes(coordinate)) { targets = targets.filter(c => c !== coordinate); delete drafts[coordinate]; }
    else if (targets.length < shotLimit) targets.push(coordinate);
    else if (!state.config.salvo) { targets = [coordinate]; drafts = {}; }
    else { $('#notice').textContent = `${shotLimit} coordinates are already selected. Record them or deselect one.`; return; }
    render(coordinate);
    if (event?.type === 'keydown' || event?.detail === 0) screen.querySelector('.target-popover input, .target-popover button')?.focus({ preventScroll: true });
  };
  const editResult = result => { resetSelection(); editing = result; targets = [result.coordinate]; drafts[result.coordinate] = { type: result.type }; render(result.coordinate); };
  const candidates = placement && placementStart ? placementCandidates(state, me) : [];
  const endpoint = candidate => candidate.cells[0] === placementStart ? candidate.cells.at(-1) : candidate.cells[0];
  renderBoard(own.chart, me, state.config, { title: 'Primary grid', showShips: true, interactive: !state.complete && (placement || !outgoing), selected: placement && placementStart ? [placementStart] : !outgoing && !editing ? targets : [], endpoints: candidates.map(endpoint),
    onHover: placement && placementStart ? (coordinate, svg) => previewPlacement(svg, candidates.find(candidate => endpoint(candidate) === coordinate)?.cells || []) : null,
    onCell: placement ? safe(placeShip) : selectTarget });
  renderBoard(enemy.chart, other, state.config, { title: 'Targeting grid', showShips: false, interactive: !state.complete && !placement && outgoing, editableResults: !placement && !state.ended, selected: reportingOutgoing ? targets : [], onCell: selectTarget, onRecordedCell: editResult });
  const boards = make('div', 'boards'); boards.style.setProperty('--columns', state.config.columns); own.panel.dataset.board = 'own'; enemy.panel.dataset.board = 'targeting'; if (!placement) boards.append(enemy.panel); boards.append(own.panel);
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
  } else if (!state.complete || editing) {
    if (targets.length) {
      popup = make('section', 'target-popover'); popup.setAttribute('popover', 'manual'); popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Report selected coordinates');
      popup.dataset.anchor = targets.includes(focusCoordinate) ? focusCoordinate : targets.at(-1);
      const title = make('div', 'popover-heading'); title.append(make('h3', '', editing ? `Correct ${targets[0]}` : reportingOutgoing ? targets.length === 1 ? `Report ${targets[0]}` : `Report volley (${targets.length}/5)` : 'Confirm incoming coordinates')); popup.append(title);
      const fields = make('div', 'report-fields');
      const confirm = actionButton(editing ? 'Save correction' : reportingOutgoing ? targets.length === 1 ? 'Record result' : 'Record volley' : 'Confirm incoming shot' + (targets.length > 1 ? 's' : ''), submitReport, reportingOutgoing && targets.some(c => !drafts[c]?.type), true);
      confirm.setAttribute('aria-label', editing ? 'Save shot correction' : reportingOutgoing ? 'Record reported results' : 'Confirm incoming coordinates');
      for (const coord of targets) {
        if (!reportingOutgoing) { fields.append(make('p', 'incoming-coordinate', coord)); continue; }
        const group = make('fieldset', 'result-choices'); group.dataset.reportCoordinate = coord;
        group.append(make('legend', '', coord));
        for (const [value, symbol, title] of [['Miss', '\u2022', 'Miss'], ['Hit', '\u00d7', 'Hit'], ['Sunk', '\u2693', 'Hit and sunk']]) {
          const label = make('label', 'result-choice'), radio = document.createElement('input');
          radio.type = 'radio'; radio.name = 'result-' + coord; radio.value = value; radio.checked = drafts[coord]?.type === value;
          const icon = make('span', 'result-icon', symbol); icon.setAttribute('aria-hidden', 'true');
          radio.addEventListener('change', () => { drafts[coord] = { type: value }; confirm.disabled = busy || targets.some(c => !drafts[c]?.type); });
          label.append(radio, icon, document.createTextNode(title)); group.append(label);
        }
        fields.append(group);
      }
      if (!reportingOutgoing) popup.append(make('p', 'fine-print', 'Is this where your opponent fired? Confirm to reveal the result to announce.'));
      const cancel = actionButton('Cancel', () => { resetSelection(); render(); }); cancel.setAttribute('aria-label', 'Cancel selection');
      const actions = make('div', 'popover-actions'); actions.append(cancel, confirm); popup.append(fields, actions);
      if (!editing && state.config.salvo && targets.length < shotLimit) {
        const addTarget = actionButton('Add another target', () => {
          if (popup.hidePopover) popup.hidePopover(); else popup.hidden = true;
          (reportingOutgoing ? enemy : own).chart.querySelector(`[data-coordinate="${popup.dataset.anchor}"]`)?.focus({ preventScroll: true });
        });
        actions.prepend(addTarget);
      }
      if (!editing && state.config.salvo) {
        const reopen = actionButton(`Report ${targets.length} selected`, () => { popup.hidden = false; if (popup.showPopover && !popup.matches(':popover-open')) popup.showPopover(); positionTargetMenu(); });
        reopen.classList.add('reopen-report'); (reportingOutgoing ? enemy : own).panel.querySelector('.board-heading').append(reopen);
      }
      popup.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); const coordinate = popup.dataset.anchor; resetSelection(); render(coordinate); } });
    }
  } else { dockCopy.append(make('h3', '', state.ended ? 'This engagement has ended without a winner.' : state.winnerIri === me.iri ? 'Victory. All enemy vessels reported sunk.' : 'Defeat. Your fleet was destroyed.'), make('p', '', 'No opponent placements are stored here. Compare boards in person if you wish.')); controls.append(actionButton('Export journal', exportSave), actionButton('Finish game', askFinish, false, true)); }
  dock.append(dockCopy, controls);
  if (!placement && !state.complete && state.config.salvo) {
    const volley = make('div', 'volley-controls');
    volley.append(make('span', '', `${outgoing ? 'Your' : 'Their'} volley: ${state.volleyCount}/5 recorded`));
    if (state.openOrder) (outgoing ? enemy : own).panel.querySelector('.board-heading').append(actionButton('Finish volley', async () => { resetSelection(); await execute('finishVolley'); }, targets.length > 0, true));
    strip.append(volley);
  }
  const log = make('section', 'battle-log'); log.append(make('h3', '', 'Shot history'));
  const columns = make('div', 'shot-history');
  for (const [player, results, label] of [[me, me.outgoing, 'Your shots'], [other, me.incoming, 'Their shots']]) {
    const column = make('section', 'shot-column'), entries = make('div', 'log-entries');
    column.append(make('h3', '', `${label} \u00b7 ${player.name}`));
    for (const result of [...results].reverse()) {
      const entry = player.iri === me.iri && !state.ended ? actionButton(`${result.coordinate} / ${resultLabel(result.type)}`, () => editResult(result)) : make('span', '', `${result.coordinate} / ${resultLabel(result.type)}`);
      entry.classList.add('log-entry', result.type.toLowerCase());
      if (player.iri === me.iri && !state.ended) entry.setAttribute('aria-label', `Correct ${result.coordinate}: ${resultLabel(result.type)}`);
      entries.append(entry);
    }
    if (!results.length) entries.append(make('p', 'fine-print', 'No shots yet.'));
    column.append(entries); columns.append(column);
  }
  log.append(columns);
  screen.replaceChildren(strip, ...((placement || state.complete) ? [dock] : []), boards, log);
  if (popup) { screen.append(popup); popup.showPopover?.(); positionTargetMenu(); }
  if (focusCoordinate) (reportingOutgoing ? enemy : own).chart.querySelector(`[data-coordinate="${focusCoordinate}"]`)?.focus();
}
async function execute(actionType, parameters = {}) {
  if (busy) return false; busy = true; clearMessages();
  try { const result = await game.act(actionType, parameters); if (!result.ok) throw new Error(result.details?.findings?.[0]?.message || result.message); await persist(); return true; }
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
    clearMessages(); render(); screen.querySelector(`[data-board="own"] [data-coordinate="${coordinate}"]`)?.focus({ preventScroll: true }); return;
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
  const cell = screen.querySelector(`${editing ? '[data-board=targeting]' : '.board-panel.active'} [data-coordinate="${menu.dataset.anchor}"]`); if (!cell) return;
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
const resultLabel = type => type === 'Sunk' ? 'Hit and sunk' : ['Blocked', 'GlancingMiss'].includes(type) ? 'Miss' : type;
async function submitReport() {
  const state = game.state(), outgoing = state.currentPlayerIri === state.localPlayerIri;
  if (editing) {
    const result = editing;
    if (await execute('correctReport', { updates: [{ resultIri: result.iri, type: drafts[result.coordinate].type }] })) { resetSelection(); render(); $('#notice').textContent = `${result.coordinate} corrected. Totals recalculated and saved. No turn or shot was consumed.`; if (game.state().complete) askFinish(); }
    return;
  }
  const coordinates = [...targets];
  const reports = targets.map(coordinate => ({ coordinate, ...drafts[coordinate] }));
  if (await execute(outgoing ? 'recordReport' : 'receiveAttack', outgoing ? { direction: 'outgoing', reports, continueVolley: state.config.salvo } : { coordinates, continueVolley: state.config.salvo })) {
    const accepted = game.state().results.filter(r => coordinates.includes(r.coordinate) && (r.attackerIri === state.localPlayerIri) === outgoing);
    resetSelection(); render();
    $('#notice').textContent = (outgoing ? 'Recorded: ' : 'Tell your opponent: ') + accepted.map(r => `${r.coordinate}: ${resultLabel(r.type)}`).join('; ') + (game.state().openOrder ? '. Saved. Add the next shot or finish the volley.' : '. Saved automatically.');
    effects(accepted.some(r => ['Hit', 'Sunk'].includes(r.type)));
    if (game.state().complete) askFinish();
  }
}
async function persist(options = {}) {
  if (!game) return false;
  try { await saveActive(localSave(game, setup), options); return true; }
  catch { error('Local saving is unavailable. Export your journal before leaving.'); return false; }
}
async function resume(record, options = {}) { const restored = await parseLocalSave(record); game = restored.game; setup = restored.setup; selectedShip = null; resetSelection(); for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); enterGame(); await persist(options); }
function exportSave() { if (game) downloadJson(localSave(game, setup), 'maritime-warship-private-local-save.json'); }
async function returnToSetup({ save = true } = {}) { if (save) await persist(); game = null; setup = null; privacy.conceal(); for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); $('#game-screen').hidden = true; $('#setup-screen').hidden = false; screen.replaceChildren(); document.body.classList.remove('arctic'); await refreshSaves(); }
async function openSharing(join = false, initial = false) {
  if (!join && game && setup.protocol < 3) {
    setup = await withPlayerNames(setup, game.state().players.map(player => player.name));
    await persist();
  }
  initialSharing = initial;
  $('#transfer-continue').hidden = join; $('#transfer-back').hidden = !initial; $('#transfer-close').hidden = !join;
  $('#transfer-continue').textContent = initial ? 'Continue to fleet placement' : 'Continue';
  clearMessages(); $('#transfer-title').textContent = join ? 'Join a game' : 'Share the setup once';
  $('#transfer-description').textContent = join ? 'Scan the creator’s QR, paste an invitation, or type the complete setup code. No server lookup is needed.' : 'Share a code, link, or QR. Your opponent joins once; then call shots and results aloud.';
  $('#join-actions').hidden = !join; $('#invite-field').hidden = join;
  $('#transfer-code-label').textContent = join ? 'Setup code or invitation' : 'Setup code';
  $('#invite-text').value = !join && setup ? inviteUrl(setup.code, new URL('./', location.href).href) : '';
  for (const id of ['receive-button', 'scan-button']) $('#' + id).hidden = !join;
  for (const id of ['copy-button', 'copy-link-button']) $('#' + id).hidden = join;
  $('#transfer-text').readOnly = !join; $('#transfer-text').value = !join && setup ? formatCode(setup.code) : '';
  $('#qr-output').replaceChildren();
  if (!join && setup) { const qr = window.qrcode(0, 'M'); qr.addData(inviteUrl(setup.code, new URL('./', location.href).href)); qr.make(); $('#qr-output').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); $('#qr-output svg')?.setAttribute('aria-label', 'Public setup invitation QR'); }
  $('#transfer-status').textContent = join ? 'The creator fires first. Your fleet will be placed privately on this device.' : 'Public setup only. Your fleet and progress stay private.';
  if (!$('#transfer-dialog').open) $('#transfer-dialog').showModal();
}
async function joinCode(code) {
  const nextSetup = await decodeSetup(code), nextGame = createMaritimeGame(nextSetup.config, { boardSeed: boardSeed(nextSetup), localIndex: 1 });
  setup = nextSetup; game = nextGame; selectedShip = null; resetSelection(); scanner.stop();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); enterGame(); await persist();
}
const scanner = new QrScanner({ video: $('#scan-video'), decodeCode: decodeSetup, onCode: safe(joinCode), onMessage: message => $('#scan-status').textContent = message });
$('#scan-button').addEventListener('click', safe(async () => { $('#scan-dialog').showModal(); try { await scanner.start(); } catch (err) { $('#scan-status').textContent = err.message; } }));
$('#scan-dialog').addEventListener('close', () => scanner.stop()); $('#scan-cancel').addEventListener('click', () => $('#scan-dialog').close());
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#menu-button').addEventListener('click', () => { $('#game-name').value = game.state().name; $('#end-button').hidden = false; $('#end-button').textContent = game.state().complete ? 'Finish game' : 'End game'; $('#rename-button').hidden = game.state().complete; $('#menu-dialog').showModal(); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog:not(#handoff-dialog)')) dialog.addEventListener('close', () => { if (privacy.getState().status !== 'revealed') showRevealPrompt(); });
$('#transfer-dialog').addEventListener('cancel', event => { if (!$('#transfer-continue').hidden) event.preventDefault(); });
$('#transfer-continue').addEventListener('click', () => { $('#transfer-dialog').close(); if (privacy.getState().status !== 'revealed') showRevealPrompt(); });
$('#transfer-back').addEventListener('click', safe(async () => { if (initialSharing) { await removeMatch(game.sessionId); await returnToSetup({ save: false }); } }));
$('#join-button').addEventListener('click', safe(() => openSharing(true)));
$('#network-button').addEventListener('click', safe(async () => { $('#menu-dialog').close(); await openSharing(false); }));
$('#receive-button').addEventListener('click', safe(() => joinCode($('#transfer-text').value)));
for (const [id, isLink] of [['copy-button', false], ['copy-link-button', true]]) $('#' + id).addEventListener('click', safe(async () => { const field = $(isLink ? '#invite-text' : '#transfer-text'), text = field.value; try { await navigator.clipboard.writeText(text); $('#transfer-status').textContent = 'Copied. Share only this setup; play continues verbally.'; } catch { field.focus(); field.select(); $('#transfer-status').textContent = 'Select and copy the text using your browser’s copy command.'; } }));
$('#resume-button').addEventListener('click', safe(async () => { const record = await loadActive(); if (!record) throw new Error('No local journal found.'); await resume(record); }));
function askFinish() {
  $('#menu-dialog').close();
  $('#end-title').textContent = game.state().complete ? 'Finish this game?' : 'End this game?';
  $('#end-dialog input[value=remove]').checked = true;
  $('#cancel-end').textContent = game.state().complete ? 'Return to board' : 'Keep playing';
  $('#confirm-end').textContent = game.state().complete ? 'Finish game' : 'End game';
  $('#end-dialog').showModal();
}
$('#end-button').addEventListener('click', askFinish);
$('#confirm-end').addEventListener('click', safe(async () => {
  if (busy) return;
  const keep = $('#end-dialog input[name=end-save]:checked').value === 'history';
  if (!game.state().complete && !await execute('endGame')) return;
  if (keep) { if (!await persist()) return; }
  else await removeMatch(game.sessionId);
  await returnToSetup({ save: false });
  $('#notice').textContent = keep ? 'Game ended. Its record is in Your games.' : 'Game ended and its local save was removed.';
}));
$('#confirm-remove').addEventListener('click', safe(async () => {
  await removeMatch(removalId); removalId = null; $('#remove-dialog').close(); await refreshSaves();
  $('#notice').textContent = 'Saved game removed from this device.';
}));
$('#rename-button').addEventListener('click', safe(async () => { if (await execute('renameGame', { name: $('#game-name').value })) { $('#menu-dialog').close(); $('#notice').textContent = 'Game name saved.'; } }));
$('#conceal-button').addEventListener('click', requestReveal); $('#new-button').addEventListener('click', safe(async () => { if (game.state().complete) askFinish(); else await returnToSetup(); })); $('#export-button').addEventListener('click', exportSave);
$('#import-button').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', safe(async event => { const file = event.target.files[0]; event.target.value = ''; if (!file) return; if (file.size > MAX_SAVE_BYTES) throw new Error('File exceeds the 96 MB limit.'); await resume(parseFile(await file.text()), { allowReopen: true }); }));
for (const key of ['animations', 'sound', 'zoom']) $('#' + key).addEventListener('input', safe(async event => { settings[key] = key === 'zoom' ? Number(event.target.value) : event.target.checked; document.documentElement.style.setProperty('--cell', settings.zoom + 'px'); await saveSettings(settings); }));
function effects(hit) {
  if (settings.animations && !matchMedia('(prefers-reduced-motion: reduce)').matches) { document.body.classList.remove('hit-flash', 'splash-effect'); void document.body.offsetWidth; document.body.classList.add(hit ? 'hit-flash' : 'splash-effect'); if (hit) navigator.vibrate?.([100, 50, 100]); }
  if (settings.sound) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; const context = new Audio(), oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = hit ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(hit ? 100 : 700, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(hit ? 35 : 240, context.currentTime + .25); gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .3); oscillator.onended = () => context.close(); }
}
async function refreshSaves() {
  try {
    const matches = await listMatches(); $('#resume-button').disabled = !await loadActive();
    $('#history-section').hidden = !matches.length;
    $('#history-list').replaceChildren(...matches.map(entry => {
      const row = make('article', 'history-entry'), copy = make('div');
      copy.append(make('h3', '', entry.name || entry.names?.join(' vs ') || 'Engagement'), make('p', '', `${entry.names?.join(' vs ') || ''} \u00b7 ${entry.status || 'complete'} \u00b7 ${entry.turns ?? 0} turns \u00b7 ${entry.shots} shots \u00b7 Updated ${new Date(entry.savedAt).toLocaleString()}`));
      row.append(copy);
      if (entry.status) row.append(actionButton(entry.status === 'active' ? 'Resume' : 'Review', async () => { const record = await loadMatch(entry.id); if (!record) throw new Error('Saved journal unavailable.'); await resume(record); }));
      row.append(actionButton('Remove', () => {
        removalId = entry.id; $('#remove-name').textContent = entry.name || entry.names?.join(' vs ') || 'this game'; $('#remove-dialog').showModal();
      }));
      return row;
    }));
  } catch { $('#resume-button').disabled = true; }
}
async function initialize() {
  try { const saved = await loadSettings(); if (saved) settings = { ...settings, ...saved, zoom: saved.zoomVersion === 2 ? saved.zoom : Math.max(20, Math.round((saved.zoom || 36) * .75)), zoomVersion: 2 }; } catch { /* Export remains available without persistence. */ }
  for (const key of ['animations', 'sound']) $('#' + key).checked = settings[key]; $('#zoom').value = settings.zoom; document.documentElement.style.setProperty('--cell', settings.zoom + 'px');
  await refreshSaves();
  if (location.hash.startsWith('#invite=')) { const code = location.href; history.replaceState(null, '', location.pathname + location.search); try { await joinCode(code); } catch (err) { error(err.message); } }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
await initialize();
