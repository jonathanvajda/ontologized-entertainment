import { createEverythingsSusGame, restoreEverythingsSusGame, serializeHostGame } from './model/everything-is-sus-game.js';
import { BOARD_REGIONS, ENTRANCE_MARKERS, FOYER_SITES, ROOMS, SECRET_PASSAGES, SECRET_PASSAGE_CORNERS, SUSPECTS, WALKABLE_SITES, WEAPONS, boardCellStyle, boardImageUrl, boardRegionStyle, cardById, cardImageUrl, entranceMarkerStyle, isRoom } from './game-config.js';
import { renderDice } from '../poker-dice/rendering/dice-svg.js';

const mode = document.body.dataset.mode;
let game = null;
let selectedSuspectIds = [];
const app = document.querySelector('#app');
app.innerHTML = `<header class="bar"><a href="../">Everything's Sus</a><nav><button id="rules">Rules</button><button id="load">Load</button><input id="load-file" hidden type="file" accept="application/json"><button id="save" disabled>Save</button><button id="new">New game</button></nav></header><main class="game-shell"><section class="board-panel"><div class="turn-card"><div><p class="kicker">Current detective</p><h1 id="current">Set the table</h1></div><p id="phase">Choose players to begin.</p></div><div class="estate-frame"><div class="estate-board" id="board" aria-label="Estate board"></div></div><p class="board-help">Select a gold-highlighted space to move. Room art represents the whole room; tokens inside a room may share it.</p></section><aside class="case-panel"><div><p class="kicker">Case controls</p><h2 id="table-code">The sealed envelope</h2></div><div id="actions" class="actions"></div><div id="log" class="case-log" aria-live="polite"></div><div id="invitations"></div></aside></main><dialog id="setup"><form id="setup-form"><p class="kicker">New investigation</p><h2>Choose 3–6 suspects</h2><p>Select portraits in the order they will take turns.</p><div id="suspect-setup" class="suspect-setup"></div><button id="deal-case" disabled>Choose at least 3 suspects</button></form></dialog><dialog id="choice"><form id="choice-form"><h2 id="choice-title"></h2><div id="choice-fields"></div><menu><button type="button" id="cancel-choice">Cancel</button><button>Confirm</button></menu></form></dialog><dialog id="private"><div id="private-content"></div></dialog>`;

const $ = (selector) => document.querySelector(selector);
const setup = $('#setup');
renderSuspectSetup();
setup.showModal();
$('#new').onclick = () => { selectedSuspectIds = []; renderSuspectSetup(); setup.showModal(); };
$('#load').onclick = () => $('#load-file').click();
$('#rules').onclick = () => location.href = '../everything-is-sus-RULES.md';
$('#cancel-choice').onclick = () => $('#choice').close();
$('#load-file').onchange = async (event) => {
  try {
    game = restoreEverythingsSusGame(await event.target.files[0].text());
    setup.close(); $('#save').disabled = false; render();
    if (mode === 'host') await showInvites();
    note('Saved investigation restored.');
  } catch { note('That save file could not be restored.', true); }
};

function renderSuspectSetup() {
  const grid = $('#suspect-setup');
  grid.innerHTML = SUSPECTS.map((suspect) => {
    const order = selectedSuspectIds.indexOf(suspect.id); const active = order >= 0;
    return `<button type="button" class="suspect-toggle ${active ? 'active' : ''}" data-suspect="${suspect.id}" aria-pressed="${active}"><img src="${cardImageUrl(suspect)}" alt=""><span>${suspect.label}</span><i aria-hidden="true">${active ? '✓' : ''}</i>${active ? `<b>Turn ${order + 1}</b>` : ''}</button>`;
  }).join('');
  grid.querySelectorAll('.suspect-toggle').forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.suspect;
      if (selectedSuspectIds.includes(id)) selectedSuspectIds = selectedSuspectIds.filter((item) => item !== id);
      else if (selectedSuspectIds.length < 6) selectedSuspectIds.push(id);
      renderSuspectSetup();
    };
  });
  const deal = $('#deal-case');
  deal.disabled = selectedSuspectIds.length < 3;
  deal.textContent = selectedSuspectIds.length < 3 ? `Choose ${3 - selectedSuspectIds.length} more` : `Deal for ${selectedSuspectIds.length} players`;
}

$('#setup-form').onsubmit = async (event) => {
  event.preventDefault(); const tokenIds = [...selectedSuspectIds];
  if (tokenIds.length < 3 || tokenIds.length > 6) return;
  const names = tokenIds.map((id) => SUSPECTS.find((suspect) => suspect.id === id).label);
  game = await createEverythingsSusGame({ names, tokenIds, mode });
  setup.close(); $('#save').disabled = false; render();
  if (mode === 'host') await showInvites();
  note(`The solution is sealed. ${names[0]} begins.`);
};

$('#save').onclick = () => {
  const url = URL.createObjectURL(new Blob([serializeHostGame(game)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'everything-is-sus-host-save.json'; anchor.click(); URL.revokeObjectURL(url);
};

function render() {
  const state = game.state(); const active = state.players[state.currentPlayerIndex];
  $('#current').textContent = state.complete ? (state.winnerIri ? `${state.players.find((player) => player.iri === state.winnerIri)?.name} solved it` : 'The mystery won') : active.name;
  $('#phase').textContent = phaseText(state);
  $('#table-code').textContent = mode === 'host' ? `Table ${state.code}` : 'The sealed envelope';
  renderBoard(state); renderActions(state);
}

function renderBoard(state) {
  const board = $('#board'); board.replaceChildren();
  const active = state.players[state.currentPlayerIndex];
  const currentLocation = active ? state.locations[active.tokenId] : '';
  const options = state.phase === 'movement' ? game.movementOptions() : [];
  const optionByDestination = new Map(options.map((option) => [option.destination, option]));

  for (const room of ROOMS) {
    const option = optionByDestination.get(room.id);
    const element = document.createElement(option?.available ? 'button' : 'section');
    element.dataset.room = room.id;
    element.className = `room-card${option?.available ? ' is-available' : ''}${currentLocation === room.id ? ' is-current' : ''}`;
    element.style.cssText = boardRegionStyle(room.id);
    element.style.setProperty('--room-art', `url("${boardImageUrl(room)}")`);
    element.style.setProperty('--board-clip', BOARD_REGIONS[room.id].clip || 'inset(0)');
    const passage = SECRET_PASSAGE_CORNERS[room.id];
    element.innerHTML = `<span class="room-label">${room.label}</span><b class="tokens"></b>${passage ? `<span class="secret-passage ${passage.corner}" role="img" aria-label="Secret passage to ${cardById(SECRET_PASSAGES[room.id]).label}" title="Secret passage to ${cardById(SECRET_PASSAGES[room.id]).label}">${passage.symbol}</span>` : ''}${option?.available ? `<small class="entry-cost">${option.cost} paces</small>` : ''}`;
    if (option?.available) { element.type = 'button'; element.setAttribute('aria-label', `${option.label}, ${option.cost} paces`); element.onclick = () => act('moveStep', { destination: room.id }); }
    addTokens(element.querySelector('.tokens'), state, room.id);
    board.append(element);
  }

  const foyer = document.createElement('section');
  foyer.className = 'foyer-art'; foyer.style.cssText = boardRegionStyle('foyer');
  foyer.style.setProperty('--room-art', 'url("./assets/art/foyer-board-02.png")');
  foyer.innerHTML = '<span class="room-label">Foyer</span><small>Starting area</small>';
  board.append(foyer);

  for (const side of ['left', 'right']) { const stairs = document.createElement('div'); stairs.className = `stairs stairs-${side}`; stairs.setAttribute('aria-hidden', 'true'); board.append(stairs); }

  for (const siteId of WALKABLE_SITES) {
    const option = optionByDestination.get(siteId);
    const cell = document.createElement('button'); cell.type = 'button';
    cell.className = `board-space${FOYER_SITES.includes(siteId) ? ' foyer-site' : ''}${option?.available ? ' is-available' : ''}${currentLocation === siteId ? ' is-current' : ''}`;
    cell.style.cssText = boardCellStyle(siteId);
    cell.disabled = !option?.available;
    cell.setAttribute('aria-label', option?.available ? `${option.label} to board space ${siteId}, ${option.cost} pace` : `Board space ${siteId}`);
    if (option?.available) cell.onclick = () => act('moveStep', { destination: siteId });
    addTokens(cell, state, siteId);
    board.append(cell);
  }

  renderEntranceMarks(board);
}

function addTokens(container, state, location) {
  for (const suspect of SUSPECTS.filter((item) => state.locations[item.id] === location)) {
    const token = document.createElement('i'); token.className = 'token-chip'; token.title = suspect.label;
    token.style.backgroundImage = `url("${cardImageUrl(suspect)}")`; container.append(token);
  }
}

function renderEntranceMarks(board) {
  for (const entrance of ENTRANCE_MARKERS) { const mark = document.createElement('i'); const orientation = entrance.width < 1 ? 'vertical' : 'horizontal'; mark.className = `entrance-mark ${entrance.kind} ${orientation}`; mark.style.cssText = entranceMarkerStyle(entrance); mark.setAttribute('aria-hidden', 'true'); board.append(mark); }
}

function renderActions(state) {
  const box = $('#actions'); box.replaceChildren();
  if (state.complete) {
    const labels = game.solution.map((id) => cardById(id).label).join(' · ');
    box.innerHTML = `<p class="solution"><strong>Solution</strong><br>${labels}</p><button class="primary" id="verify">Verify sealed solution</button>`;
    $('#verify').onclick = async () => note(await game.verifySolution() ? 'Commitment verified. The solution was not changed.' : 'Verification failed.'); return;
  }
  const active = state.players[state.currentPlayerIndex]; const location = state.locations[active.tokenId];
  const die = document.createElement('div'); die.className = 'movement-die'; box.append(die);
  renderDice(die, [{ iri: 'movement-die', value: state.die || null, held: false }], { showHold: false, labelPrefix: 'Movement die' });
  if (mode === 'pass-and-play') add('Review my hand', () => privateHand(active));

  if (state.phase === 'turn-start') {
    add('Roll one die', () => act('roll'), 'primary');
    if (SECRET_PASSAGES[location]) add(`Use passage to ${cardById(SECRET_PASSAGES[location]).label}`, () => act('secretPassage'));
    if (isRoom(location)) add(`Make room accusation in ${cardById(location).label}`, roomAccuse);
    addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'movement') {
    const summary = document.createElement('p'); summary.className = 'roll-result'; summary.innerHTML = `Rolled <strong>${state.die}</strong> · <strong>${state.moves}</strong> paces remain`; box.append(summary);
    const options = game.movementOptions(); const controls = document.createElement('div'); controls.className = 'movement-controls'; box.append(controls);
    for (const option of options) {
      const label = option.kind === 'step' ? option.label : `${option.label} · ${option.cost} paces`;
      add(label, () => act('moveStep', { destination: option.destination }), option.kind === 'step' ? 'direction' : 'entry', controls, !option.available, option.reason);
    }
    if (!options.length) controls.innerHTML = '<p>No adjacent move is available.</p>';
    add('Stop moving', () => act('stopMovement')); addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'room-decision') {
    if (isRoom(location)) add(`Make room accusation in ${cardById(location).label}`, roomAccuse, 'primary');
    addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'refutation') resolveRefutation();
}

function add(label, handler, className = '', parent = $('#actions'), disabled = false, reason = '') {
  const wrap = document.createElement('div'); wrap.className = 'action-option';
  const button = document.createElement('button'); button.textContent = label; button.className = className; button.disabled = disabled; button.onclick = handler; wrap.append(button);
  if (reason) { const small = document.createElement('small'); small.textContent = reason; wrap.append(small); }
  parent.append(wrap); return button;
}

function addFinalAccusation(location) {
  const allowed = FOYER_SITES.includes(location);
  add('Make final accusation', finalAccuse, 'danger', $('#actions'), !allowed, allowed ? '' : 'Return to the Foyer');
}

function act(type, params = {}) { const result = game.act(type, params); if (!result.ok) return note(result.message, true); note(actionText(type, result.value)); render(); }
function roomAccuse() { choose('Make a room accusation', [select('Suspect', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS)], (value) => act('roomAccuse', value)); }
function finalAccuse() {
  choose('Make a final accusation', [select('Suspect', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS), select('Room', 'roomId', ROOMS)], (value) => {
    if (!confirm('An incorrect final accusation removes you from future turns. Continue?')) return;
    const result = game.act('accuse', value); note(result.ok ? (result.value ? 'The final accusation is correct!' : 'The final accusation was wrong. The next detective begins.') : result.message, !result.ok); render();
  });
}

function resolveRefutation() {
  const refutation = game.refutation();
  if (!refutation) return add('No one can refute — end turn', () => act('resolveRefutation', {}), 'primary');
  if (mode === 'host') {
    const message = document.createElement('p'); message.textContent = `Ask ${refutation.player.name} to choose one matching card on their device.`; $('#actions').append(message);
    add(`${refutation.player.name} showed a card — end turn`, () => act('resolveRefutation', { refuterIri: refutation.player.iri }), 'primary');
  } else add(`Pass to ${refutation.player.name}`, () => privateReveal(refutation), 'primary');
}

function privateReveal(refutation) {
  const dialog = $('#private'); const content = $('#private-content');
  content.innerHTML = `<p class="kicker">Private refutation</p><h2>Pass to ${refutation.player.name}</h2><p>Only ${refutation.player.name} should continue.</p><button class="primary" id="confirm-refuter">I am ${refutation.player.name}</button><div class="private-cards" hidden></div>`;
  content.querySelector('#confirm-refuter').onclick = (event) => { event.currentTarget.remove(); content.querySelector('.private-cards').hidden = false; };
  for (const card of refutation.matches) { const button = document.createElement('button'); button.className = 'show-card'; button.innerHTML = `<img src="${cardImageUrl(card)}" alt=""><span>${card.label}</span>`; button.onclick = () => { dialog.close(); act('resolveRefutation', { refuterIri: refutation.player.iri, cardId: card.id }); }; content.querySelector('.private-cards').append(button); }
  dialog.showModal();
}

function privateHand(player) {
  const dialog = $('#private'); const content = $('#private-content');
  content.innerHTML = `<p class="kicker">Private hand</p><h2>Pass to ${player.name}</h2><p>Only ${player.name} should continue.</p><button class="primary" id="confirm-hand">I am ${player.name}</button><section id="hand-details" hidden><div class="private-cards"></div><label class="notebook">Detective notebook<textarea rows="7" placeholder="Record deductions…"></textarea></label><button class="primary" id="close-hand">Hide my hand</button></section>`;
  for (const card of player.hand) { const item = document.createElement('article'); item.className = 'private-evidence-card'; item.innerHTML = `<img src="${cardImageUrl(card)}" alt="${card.label}"><span>${card.category}</span><strong>${card.label}</strong>`; content.querySelector('.private-cards').append(item); }
  const notes = content.querySelector('textarea'); const notesKey = `everything-is-sus-pass-notes-${player.iri}`; notes.value = localStorage.getItem(notesKey) || ''; notes.oninput = () => localStorage.setItem(notesKey, notes.value);
  content.querySelector('#confirm-hand').onclick = (event) => { event.currentTarget.remove(); content.querySelector('#hand-details').hidden = false; };
  content.querySelector('#close-hand').onclick = () => dialog.close(); dialog.showModal();
}

function choose(title, fields, done) {
  $('#choice-title').textContent = title; const form = $('#choice-form'); $('#choice-fields').innerHTML = fields.join('');
  form.onsubmit = (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); $('#choice').close(); done(data); }; $('#choice').showModal();
}
const select = (label, name, items) => `<label>${label}<select name="${name}">${items.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>`;

async function showInvites() {
  const invites = await game.playerAccessCodes(); const box = $('#invitations');
  box.innerHTML = '<h3>Turn order &amp; player codes</h3><p>Each player enters the table code shown above, their suspect, and their private code.</p><div class="player-code-list"></div>';
  for (const invite of invites) { const suspect = SUSPECTS.find((item) => item.id === invite.suspectId); const row = document.createElement('div'); row.className = 'player-code-row'; row.innerHTML = `<img src="${cardImageUrl(suspect)}" alt=""><span><small>Turn ${invite.turnOrder}</small><strong>${invite.name}</strong></span><b aria-label="Private code ${invite.handCode}">${invite.handCode}</b>`; box.querySelector('.player-code-list').append(row); }
}

function note(text, error = false) { const paragraph = document.createElement('p'); paragraph.textContent = text; paragraph.className = error ? 'error' : ''; $('#log').prepend(paragraph); }
function phaseText(state) { return { 'turn-start': 'Roll, take a room action, make a final accusation, or end the turn.', movement: `Choose each step. ${state.moves} paces remain.`, 'room-decision': 'You may make an accusation or end the turn.', refutation: 'The first eligible player clockwise may show one card.', complete: 'The sealed solution may now be verified.' }[state.phase] || state.phase; }
function actionText(type, value) { return { roll: `Rolled ${value}.`, moveStep: `Moved to ${isRoom(value.destination) ? cardById(value.destination)?.label : 'a new space'} for ${value.cost} ${value.cost === 1 ? 'pace' : 'paces'}.`, stopMovement: 'Movement stopped.', secretPassage: 'Used a secret passage.', roomAccuse: 'Room accusation announced.', resolveRefutation: value ? 'A card was shown privately. The next detective begins.' : 'No one could refute. The next detective begins.', endTurn: 'The next detective begins.' }[type] || 'Action complete.'; }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
window.addEventListener('blur', () => { if ($('#private')?.open) $('#private').close(); });
