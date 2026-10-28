import { createEverythingsSusGame, restoreEverythingsSusGame, serializeHostGame } from './model/everything-is-sus-game.js';
import { BOARD_REGIONS, ENTRANCE_MARKERS, FOYER_SITES, ROOMS, SECRET_PASSAGES, SECRET_PASSAGE_CORNERS, SUSPECTS, WALKABLE_SITES, WEAPONS, boardCellStyle, boardImageUrl, boardRegionStyle, cardById, cardImageUrl, entranceMarkerStyle, isRoom } from './game-config.js';
import { renderDice } from '../poker-dice/rendering/dice-svg.js';
import { createInvitationUrl, renderQrCode } from '../packages/game-mechanics/src/index.js';
import { renderSleuthSheet } from './sleuth-sheet-ui.js';
import { openEverythingsSusStorage } from './storage.js';

const mode = document.body.dataset.mode;
let game = null;
let storage = null;
let saveChain = Promise.resolve();
let selectedSuspectIds = [];
const app = document.querySelector('#app');
app.innerHTML = `<header class="bar"><a href="../">Everything's Sus</a><nav><button id="rules">Rules</button><button id="load">Load</button><input id="load-file" hidden type="file" accept="application/json"><button id="save" disabled>Save</button><button id="new">New game</button></nav></header><main class="game-shell"><section class="board-panel"><div class="turn-card"><p><span class="kicker">Current detective</span><img id="current-portrait" alt=""><strong id="current">Set the table</strong></p></div><div class="estate-frame"><div class="estate-board" id="board" aria-label="Estate board"></div></div></section><aside class="case-panel"><div><p class="kicker">Case controls</p><h2 id="table-code">The sealed envelope</h2></div><div id="actions" class="actions"></div><div id="log" class="case-log" aria-live="polite"></div><div id="invitations"></div></aside></main><dialog id="setup"><form id="setup-form"><p class="kicker">New investigation</p><h2>Choose 3–6 suspects</h2><p>Select the detectives who are playing. Turn order will be randomized when the case is dealt.</p><div id="suspect-setup" class="suspect-setup"></div><button id="deal-case" disabled>Choose at least 3 suspects</button></form></dialog><dialog id="choice"><form id="choice-form"><h2 id="choice-title"></h2><div id="choice-fields"></div><menu><button type="button" id="cancel-choice">Cancel</button><button>Confirm</button></menu></form></dialog><dialog id="private"><div id="private-content"></div></dialog><dialog id="token-view" class="token-view"><button type="button" class="dialog-close" aria-label="Close token portrait">×</button><img alt=""><h2></h2></dialog><div id="token-preview" class="token-preview" hidden><img alt=""><strong></strong></div><dialog id="invite-view" class="invite-view"><button type="button" class="dialog-close" aria-label="Close player invitation">×</button><img class="invite-portrait" alt=""><p class="kicker">Private player invitation</p><h2></h2><div class="invite-qr"></div><p class="invite-codes"></p><p class="privacy-note">Let only this player scan the QR. It opens their private hand directly on their device.</p></dialog><dialog id="solution-reveal" class="solution-reveal"><div class="envelope-reveal" aria-hidden="true"><span></span></div><p class="kicker">The sealed solution</p><h2>Case closed</h2><div class="solution-cards"></div><button type="button" class="primary close-reveal">Continue</button></dialog>`;

const $ = (selector) => document.querySelector(selector);
const setup = $('#setup');
$('#load').textContent = 'Import'; $('#save').textContent = 'Export';
renderSuspectSetup();
$('#new').onclick = async () => {
  if (game && !confirm('Start a new investigation? The current game will be removed from this device. Export it first if you want a backup.')) return;
  await saveChain;
  if (storage) await storage.clearActiveGame(mode);
  game = null; $('#save').disabled = true; selectedSuspectIds = []; renderSuspectSetup(); setup.showModal();
};
$('#load').onclick = () => $('#load-file').click();
$('#rules').onclick = () => location.href = '../everything-is-sus-RULES.md';
$('#cancel-choice').onclick = () => $('#choice').close();
$('#token-view .dialog-close').onclick = () => $('#token-view').close();
$('#invite-view .dialog-close').onclick = () => $('#invite-view').close();
$('#solution-reveal .close-reveal').onclick = () => $('#solution-reveal').close();
$('#private').addEventListener('cancel', (event) => event.preventDefault());
$('#load-file').onchange = async (event) => {
  try {
    game = restoreEverythingsSusGame(await event.target.files[0].text());
    await persistGame();
    setup.close(); $('#save').disabled = false; render();
    if (mode === 'host') await showInvites();
    note('Saved investigation restored.');
  } catch { note('That save file could not be restored.', true); }
};

function renderSuspectSetup() {
  const grid = $('#suspect-setup');
  grid.innerHTML = SUSPECTS.map((suspect) => {
    const active = selectedSuspectIds.includes(suspect.id);
    return `<button type="button" class="suspect-toggle ${active ? 'active' : ''}" data-suspect="${suspect.id}" aria-pressed="${active}"><img src="${cardImageUrl(suspect)}" alt=""><span>${suspect.label}</span><i aria-hidden="true">${active ? '✓' : ''}</i></button>`;
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
  await persistGame();
  setup.close(); $('#save').disabled = false; render();
  if (mode === 'host') await showInvites();
  note(`The solution is sealed. ${game.state().players[0].name} won the turn-order draw and begins.`);
};

$('#save').onclick = () => {
  const url = URL.createObjectURL(new Blob([serializeHostGame(game)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'everything-is-sus-host-save.json'; anchor.click(); URL.revokeObjectURL(url);
};

function render() {
  const state = game.state(); const active = state.players[state.currentPlayerIndex];
  const displayed = state.winnerIri ? state.players.find((player) => player.iri === state.winnerIri) : active;
  $('#current').textContent = state.complete ? (state.winnerIri ? `${displayed?.name} solved it` : 'The mystery won') : active.name;
  const portrait = SUSPECTS.find((suspect) => suspect.id === displayed?.tokenId);
  $('#current-portrait').src = portrait ? cardImageUrl(portrait) : '';
  $('#current-portrait').alt = portrait ? `${portrait.label} portrait` : '';
  $('#current-portrait').hidden = !portrait;
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
    const element = document.createElement('section');
    element.dataset.room = room.id;
    element.className = `room-card${option?.available ? ' is-available' : ''}${currentLocation === room.id ? ' is-current' : ''}`;
    element.style.cssText = boardRegionStyle(room.id);
    element.style.setProperty('--room-art', `url("${boardImageUrl(room)}")`);
    element.style.setProperty('--board-clip', BOARD_REGIONS[room.id].clip || 'inset(0)');
    const passage = SECRET_PASSAGE_CORNERS[room.id];
    const passageAvailable = room.id === currentLocation && SECRET_PASSAGES[room.id] && ['turn-start', 'movement'].includes(state.phase);
    element.innerHTML = `${option?.available ? `<button type="button" class="room-move-target" aria-label="${option.label}, ${option.cost} paces"></button>` : ''}<span class="room-label">${room.label}</span><div class="tokens"></div>${passage ? `<${passageAvailable ? 'button' : 'span'} class="secret-passage ${passage.corner}${passageAvailable ? ' is-available' : ''}" ${passageAvailable ? 'type="button"' : 'role="img"'} aria-label="Secret passage to ${cardById(SECRET_PASSAGES[room.id]).label}" title="Secret passage to ${cardById(SECRET_PASSAGES[room.id]).label}">${passage.symbol}</${passageAvailable ? 'button' : 'span'}>` : ''}${option?.available ? `<small class="entry-cost">${option.cost} paces</small>` : ''}`;
    element.querySelector('.room-move-target')?.addEventListener('click', () => act('moveStep', { destination: room.id }));
    element.querySelector('.secret-passage.is-available')?.addEventListener('click', () => act('secretPassage'));
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
    const cell = document.createElement('div');
    cell.className = `board-space${FOYER_SITES.includes(siteId) ? ' foyer-site' : ''}${option?.available ? ' is-available' : ''}${currentLocation === siteId ? ' is-current' : ''}`;
    cell.style.cssText = boardCellStyle(siteId);
    cell.setAttribute('role', 'group');
    cell.setAttribute('aria-label', `Board space ${siteId}`);
    if (option?.available) {
      const target = document.createElement('button'); target.type = 'button'; target.className = 'space-move-target';
      target.setAttribute('aria-label', `${option.label} to board space ${siteId}, ${option.cost} ${option.cost === 1 ? 'pace' : 'paces'}`);
      target.onclick = () => act('moveStep', { destination: siteId }); cell.append(target);
      cell.insertAdjacentHTML('beforeend', `<small class="move-cost">${option.cost}</small>`);
    }
    addTokens(cell, state, siteId);
    board.append(cell);
  }

  renderEntranceMarks(board);
}

function addTokens(container, state, location) {
  for (const suspect of SUSPECTS.filter((item) => state.locations[item.id] === location)) {
    const token = document.createElement('button'); token.type = 'button'; token.className = 'token-piece'; token.dataset.label = suspect.label; token.setAttribute('aria-label', `Inspect ${suspect.label}`);
    token.innerHTML = `<i class="token-chip"></i><span>${suspect.label}</span>`; token.querySelector('i').style.backgroundImage = `url("${cardImageUrl(suspect)}")`;
    token.onmouseenter = token.onfocus = () => showTokenPreview(suspect, token);
    token.onmouseleave = token.onblur = hideTokenPreview;
    token.onclick = (event) => { event.stopPropagation(); showTokenDialog(suspect); };
    container.append(token);
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
    if (isRoom(location)) add(`Make room accusation in ${cardById(location).label}`, roomAccuse);
    addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'movement') {
    const summary = document.createElement('p'); summary.className = 'roll-result'; summary.innerHTML = `Rolled <strong>${state.die}</strong> · <strong>${state.moves}</strong> paces remain`; box.append(summary);
    const options = game.movementOptions(); const guidance = document.createElement('p'); guidance.className = 'movement-guidance'; guidance.textContent = options.some((option) => option.available) ? 'Choose a highlighted destination on the board. Cost badges show the paces required.' : 'No legal board move is available. You may stop moving or end the turn.'; box.append(guidance);
    add('Stop moving', () => act('stopMovement')); addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'room-decision') {
    if (isRoom(location)) add(`Make room accusation in ${cardById(location).label}`, roomAccuse, 'primary');
    addFinalAccusation(location); add('End turn', () => act('endTurn'));
  } else if (state.phase === 'refutation') { resolveRefutation(); add('End turn without a shown card', () => act('endTurn')); }
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

function act(type, params = {}) { const before = game.state(); const result = game.act(type, params); if (!result.ok) { const canEnd = ['turn-start', 'movement', 'room-decision', 'refutation'].includes(before.phase); note(`${result.message}${canEnd ? ' You may still end your turn.' : ''}`, true); render(); return result; } void persistGame(); note(actionText(type, result.value, params, before)); render(); return result; }
function roomAccuse() { const state = game.state(); const active = state.players[state.currentPlayerIndex]; const room = cardById(state.locations[active.tokenId]); choose('Make a room accusation', [select('Person', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS), `<div class="fixed-choice"><span>Room</span><strong>${room?.label || 'Current room'}</strong></div>`], (value) => act('roomAccuse', value)); }
function finalAccuse() {
  choose('Make a final accusation', [select('Suspect', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS), select('Room', 'roomId', ROOMS)], (value) => {
    if (!confirm('An incorrect final accusation removes you from future turns. Continue?')) return;
    const result = game.act('accuse', value); if (result.ok) void persistGame(); note(result.ok ? finalAccusationText(value, result.value) : result.message, !result.ok); render(); if (result.ok && (result.value || game.state().complete)) showSolutionReveal();
  });
}

function resolveRefutation() {
  const refutation = game.refutation();
  if (!refutation) { const message = document.createElement('p'); message.textContent = 'No other players could provide evidence against this accusation.'; $('#actions').append(message); return; }
  if (mode === 'host') {
    const message = document.createElement('p'); message.textContent = `Ask ${refutation.player.name} to choose one matching card on their device.`; $('#actions').append(message);
    add(`${refutation.player.name} showed a card — end turn`, () => act('resolveRefutation', { refuterIri: refutation.player.iri }), 'primary');
  } else add(`Pass to ${refutation.player.name}`, () => privateReveal(refutation), 'primary');
}

function privateReveal(refutation) {
  const dialog = $('#private'); const content = $('#private-content');
  const state = game.state(); const accuser = state.players[state.currentPlayerIndex];

  const showHandoff = () => {
    content.innerHTML = `<div class="private-handoff"><p class="kicker">Private refutation</p><h2>Pass to ${refutation.player.name}</h2><p>The matching cards stay concealed until ${refutation.player.name} confirms.</p><button class="primary" id="confirm-refuter">I am ${refutation.player.name}</button></div>`;
    content.querySelector('#confirm-refuter').onclick = showChoices;
  };

  const showChoices = () => {
    content.innerHTML = `<p class="kicker">Private evidence</p><h2>Choose one card</h2><p>Only ${refutation.player.name} should see these choices.</p><div class="private-cards refutation-choices"></div>`;
    for (const card of refutation.matches) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'show-card';
      button.innerHTML = `<img src="${cardImageUrl(card)}" alt=""><span>${card.label}</span>`;
      button.onclick = () => showSelection(card);
      content.querySelector('.private-cards').append(button);
    }
  };

  const showSelection = (card) => {
    content.innerHTML = `<p class="kicker">Selected evidence</p><h2>${card.label}</h2><article class="private-card-focus"><img src="${cardImageUrl(card)}" alt="${card.label}"><span>${card.category}</span><strong>${card.label}</strong></article><div class="private-reveal-actions"><button type="button" id="choose-another">Choose a different card</button><button type="button" class="primary" id="pass-back">Hide my cards and pass back</button></div>`;
    content.querySelector('#choose-another').onclick = showChoices;
    content.querySelector('#pass-back').onclick = () => showPassBack(card);
  };

  const showPassBack = (card) => {
    content.innerHTML = `<div class="private-handoff"><p class="kicker">Cards concealed</p><h2>Pass back to ${accuser.name}</h2><p>The selected evidence will remain hidden until ${accuser.name} confirms.</p><button class="primary" id="confirm-accuser">I am ${accuser.name}</button></div>`;
    content.querySelector('#confirm-accuser').onclick = () => showAccuserCard(card);
  };

  const showAccuserCard = (card) => {
    content.innerHTML = `<p class="kicker">Private evidence for ${accuser.name}</p><h2>${card.label}</h2><article class="private-card-focus"><img src="${cardImageUrl(card)}" alt="${card.label}"><span>${card.category}</span><strong>${card.label}</strong></article><button type="button" class="primary private-finish" id="finish-refutation">Hide card and end turn</button>`;
    content.querySelector('#finish-refutation').onclick = () => { dialog.close(); act('resolveRefutation', { refuterIri: refutation.player.iri, cardId: card.id }); };
  };

  showHandoff();
  dialog.showModal();
}

async function privateHand(player) {
  const dialog = $('#private'); const content = $('#private-content');
  content.innerHTML = `<p class="kicker">Private hand</p><h2>Pass to ${player.name}</h2><p>Only ${player.name} should continue.</p><button class="primary" id="confirm-hand">I am ${player.name}</button><section id="hand-details" hidden><div class="private-cards"></div><section class="sleuth-sheet pass-sleuth-sheet"><p class="kicker">Private deductions</p><h3>Sleuth sheet</h3><p>Your own cards are already marked. The final possibility in each category is protected.</p><table><thead><tr><th scope="col">Person, weapon, or room</th><th scope="col">Ruled out</th></tr></thead><tbody></tbody></table></section><label class="notebook">Additional notes<textarea rows="7" placeholder="Record deductions…"></textarea></label><button class="primary" id="close-hand">Hide my hand</button></section>`;
  for (const card of player.hand) { const item = document.createElement('article'); item.className = 'private-evidence-card'; item.innerHTML = `<img src="${cardImageUrl(card)}" alt="${card.label}"><span>${card.category}</span><strong>${card.label}</strong>`; content.querySelector('.private-cards').append(item); }
  const legacyMarksKey = `everything-is-sus-pass-sleuth-${player.iri}`;
  const legacyNotesKey = `everything-is-sus-pass-notes-${player.iri}`;
  const saved = await storage?.loadPrivateState(game.code, player.tokenId);
  let markedCardIds = saved?.markedCardIds || readLegacyArray(legacyMarksKey);
  let privateNotes = saved?.notes ?? localStorage.getItem(legacyNotesKey) ?? '';
  let privateSaveChain = Promise.resolve();
  const persistPrivate = () => {
    const snapshot = { tableCode: game.code, suspectId: player.tokenId, cardIds: player.hand.map((card) => card.id), markedCardIds: [...markedCardIds], notes: privateNotes, makeActive: false };
    privateSaveChain = privateSaveChain.then(() => storage?.savePrivateState(snapshot)).catch(() => note('Private notes could not be saved on this device.', true));
    return privateSaveChain;
  };
  renderSleuthSheet(content.querySelector('.sleuth-sheet tbody'), player.hand, { markedCardIds, onChange: (next) => { markedCardIds = next; void persistPrivate(); } });
  const notes = content.querySelector('textarea'); notes.value = privateNotes; notes.oninput = () => { privateNotes = notes.value; void persistPrivate(); };
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
  box.innerHTML = '<h3>Turn order &amp; player codes</h3><p>Select a player to show their portrait and private invitation QR.</p><div class="player-code-list"></div>';
  for (const invite of invites) { const suspect = SUSPECTS.find((item) => item.id === invite.suspectId); const row = document.createElement('button'); row.type = 'button'; row.className = 'player-code-row'; row.innerHTML = `<img src="${cardImageUrl(suspect)}" alt=""><span><small>Turn ${invite.turnOrder}</small><strong>${invite.name}</strong></span><b aria-label="Private code ${invite.handCode}">${invite.handCode}</b>`; row.onclick = () => showInvite(invite, suspect); box.querySelector('.player-code-list').append(row); }
}

function note(text, error = false) { const paragraph = document.createElement('p'); paragraph.textContent = text; paragraph.className = error ? 'error' : ''; $('#log').prepend(paragraph); }
function actionText(type, value, params, before) {
  if (type === 'roll') return `Rolled ${value}.`;
  if (type === 'moveStep') return `Moved to ${isRoom(value.destination) ? cardById(value.destination)?.label : 'a new space'} for ${value.cost} ${value.cost === 1 ? 'pace' : 'paces'}.`;
  if (type === 'stopMovement') return 'Movement stopped.';
  if (type === 'secretPassage') return `Used the secret passage to ${cardById(value)?.label}.`;
  if (type === 'roomAccuse') {
    const active = before.players[before.currentPlayerIndex];
    return `${active.name} announced: ${cardById(params.suspectId).label}, with the ${cardById(params.weaponId).label}, in the ${cardById(before.locations[active.tokenId]).label}.`;
  }
  if (type === 'resolveRefutation') return value ? 'A card was shown privately. The next detective begins.' : 'No other players could provide evidence against this accusation. The next detective begins.';
  if (type === 'endTurn') return 'The next detective begins.';
  return 'Action complete.';
}

function finalAccusationText(value, correct) { return `Final accusation: ${cardById(value.suspectId).label}, with the ${cardById(value.weaponId).label}, in the ${cardById(value.roomId).label}. ${correct ? 'Correct!' : 'Incorrect; the next detective begins.'}`; }
function showTokenPreview(suspect, token) {
  const preview = $('#token-preview'); const tokenBox = token.getBoundingClientRect();
  preview.querySelector('img').src = cardImageUrl(suspect); preview.querySelector('img').alt = ''; preview.querySelector('strong').textContent = suspect.label; preview.hidden = false;
  const previewBox = preview.getBoundingClientRect();
  const left = Math.min(innerWidth - previewBox.width - 8, Math.max(8, tokenBox.right + 10));
  const top = Math.min(innerHeight - previewBox.height - 8, Math.max(8, tokenBox.top + tokenBox.height / 2 - previewBox.height / 2));
  preview.style.left = `${left}px`; preview.style.top = `${top}px`;
}
function hideTokenPreview() { $('#token-preview').hidden = true; }
function showTokenDialog(suspect) { hideTokenPreview(); const dialog = $('#token-view'); dialog.querySelector('img').src = cardImageUrl(suspect); dialog.querySelector('img').alt = suspect.label; dialog.querySelector('h2').textContent = suspect.label; dialog.showModal(); }

function showInvite(invite, suspect) {
  const dialog = $('#invite-view');
  const playerUrl = new URL('./player/', new URL('../', location.href));
  const url = createInvitationUrl(playerUrl.href, { tableCode: invite.tableCode, suspectId: invite.suspectId, handCode: invite.handCode });
  dialog.querySelector('.invite-portrait').src = cardImageUrl(suspect); dialog.querySelector('.invite-portrait').alt = suspect.label; dialog.querySelector('h2').textContent = invite.name;
  dialog.querySelector('.invite-codes').textContent = `Table ${invite.tableCode} · Private code ${invite.handCode}`;
  renderQrCode(dialog.querySelector('.invite-qr'), url, { label: `Private invitation QR for ${invite.name}` }); dialog.showModal();
}

function showSolutionReveal() {
  const dialog = $('#solution-reveal'); const cards = dialog.querySelector('.solution-cards');
  cards.replaceChildren(...game.solution.map((id, index) => { const card = cardById(id); const article = document.createElement('article'); article.style.setProperty('--reveal-order', index); article.innerHTML = `<img src="${cardImageUrl(card)}" alt=""><span>${card.category}</span><strong>${card.label}</strong>`; return article; }));
  dialog.showModal();
}

async function persistGame() {
  if (!game || !storage) return;
  const snapshot = game.snapshot();
  saveChain = saveChain.then(() => storage.saveGame(mode, snapshot)).catch((error) => { note(`Automatic saving failed: ${error.message}`, true); });
  return saveChain;
}

function readLegacyArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

async function initialize() {
  try {
    storage = await openEverythingsSusStorage();
    const saved = await storage.loadActiveGame(mode);
    if (saved?.snapshot) {
      game = restoreEverythingsSusGame(saved.snapshot);
      $('#save').disabled = false; render();
      if (mode === 'host') await showInvites();
      note('Investigation restored from this device. Changes are saved automatically.');
      return;
    }
  } catch (error) {
    note(`Local recovery is unavailable: ${error.message}`, true);
  }
  setup.showModal();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
void initialize();
