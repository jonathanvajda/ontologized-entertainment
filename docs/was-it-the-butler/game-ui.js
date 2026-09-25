import { createButlerGame, restoreButlerGame, serializeHostGame } from './model/butler-game.js';
import { ROOM_GRID, ROOMS, SUSPECTS, WEAPONS, cardById } from './game-config.js';

const mode = document.body.dataset.mode;
let game = null;
const app = document.querySelector('#app');
app.innerHTML = `<header class="bar"><a href="../">Was It the Butler?</a><nav><button id="rules">Rules</button><button id="load">Load</button><input id="load-file" hidden type="file" accept="application/json"><button id="save" disabled>Save</button><button id="new">New game</button></nav></header><main class="game-shell"><section class="board-panel"><div class="turn-card"><p class="kicker">Current detective</p><h1 id="current">Set the table</h1><p id="phase">Choose players to begin.</p></div><div class="estate-board" id="board"></div></section><aside class="case-panel"><div><p class="kicker">Case controls</p><h2 id="table-code">The sealed envelope</h2></div><div id="actions" class="actions"></div><div id="log" class="case-log" aria-live="polite"></div><div id="invitations"></div></aside></main><dialog id="setup"><form id="setup-form"><p class="kicker">New investigation</p><h2>Who is at the table?</h2><label>Players<select id="count">${[3, 4, 5, 6].map((n) => `<option>${n}</option>`).join('')}</select></label><div id="names"></div><button>Deal the case</button></form></dialog><dialog id="choice"><form id="choice-form"><h2 id="choice-title"></h2><div id="choice-fields"></div><menu><button type="button" id="cancel-choice">Cancel</button><button>Confirm</button></menu></form></dialog><dialog id="private"><div id="private-content"></div></dialog>`;

const $ = (selector) => document.querySelector(selector);
const setup = $('#setup');
$('#count').onchange = renderNames;
renderNames();
setup.showModal();
$('#new').onclick = () => setup.showModal();
$('#load').onclick = () => $('#load-file').click();
$('#load-file').onchange = async (event) => {
  try {
    game = restoreButlerGame(await event.target.files[0].text());
    setup.close();
    $('#save').disabled = false;
    render();
    if (mode === 'host') await showInvites();
    note('Saved investigation restored.');
  } catch { note('That save file could not be restored.', true); }
};
$('#rules').onclick = () => location.href = '../was-it-the-butler-RULES.md';
$('#cancel-choice').onclick = () => $('#choice').close();

function renderNames() {
  const count = Number($('#count').value);
  $('#names').innerHTML = Array.from({ length: count }, (_, index) => `<label>Detective ${index + 1}<input required maxlength="24" value="Player ${index + 1}"></label>`).join('');
}

$('#setup-form').onsubmit = async (event) => {
  event.preventDefault();
  const names = [...$('#names').querySelectorAll('input')].map((input) => input.value);
  game = await createButlerGame({ names, mode });
  setup.close();
  $('#save').disabled = false;
  render();
  if (mode === 'host') await showInvites();
  note(`The solution is sealed. ${names[0]} begins.`);
};

$('#save').onclick = () => {
  const blob = new Blob([serializeHostGame(game)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'butler-host-save.json';
  anchor.click();
  URL.revokeObjectURL(url);
};

function render() {
  const state = game.state();
  const active = state.players[state.currentPlayerIndex];
  $('#current').textContent = state.complete
    ? (state.winnerIri ? `${state.players.find((player) => player.iri === state.winnerIri)?.name} solved it` : 'The mystery won')
    : active.name;
  $('#phase').textContent = phaseText(state);
  $('#table-code').textContent = mode === 'host' ? `Table ${state.code}` : 'The sealed envelope';
  renderBoard(state);
  renderActions(state);
}

function renderBoard(state) {
  const board = $('#board');
  board.innerHTML = '';
  ROOM_GRID.flat().forEach((id) => {
    const room = ROOMS.find((item) => item.id === id);
    const button = document.createElement('button');
    button.className = 'room';
    button.style.setProperty('--cell', room.atlas);
    button.innerHTML = `<span>${room.label}</span><b class="tokens"></b>`;
    for (const suspect of SUSPECTS.filter((item) => state.locations[item.id] === id)) {
      const token = document.createElement('i');
      token.className = 'token-chip';
      token.title = suspect.label;
      token.style.backgroundPosition = `${(suspect.atlas % 3) * 50}% ${Math.floor(suspect.atlas / 3) * (100 / 6)}%`;
      button.querySelector('.tokens').append(token);
    }
    button.disabled = state.phase !== 'movement';
    button.onclick = () => act('move', { roomId: id });
    board.append(button);
  });
}

function renderActions(state) {
  const box = $('#actions');
  box.innerHTML = '';
  if (state.complete) {
    const labels = game.solution.map((id) => cardById(id).label).join(' · ');
    box.innerHTML = `<p class="solution"><strong>Solution</strong><br>${labels}</p><button class="primary" id="verify">Verify sealed solution</button>`;
    $('#verify').onclick = async () => note(await game.verifySolution() ? 'Commitment verified. The solution was not changed.' : 'Verification failed.');
    return;
  }
  const active = state.players[state.currentPlayerIndex];
  if (mode === 'pass-and-play') add('Review my hand', () => privateHand(active));
  if (state.phase === 'turn-start') {
    add('Roll two dice', () => act('roll'), 'primary');
    const room = state.locations[active.tokenId];
    if (['kitchen', 'library', 'screened-porch', 'pool-room'].includes(room)) add('Use secret passage', () => act('secretPassage'));
    add('Suggest from this room', () => suggest());
    add('Make accusation', () => accuse(), 'danger');
  }
  if (state.phase === 'movement') {
    box.insertAdjacentHTML('beforeend', `<p class="roll-result">Rolled <strong>${state.die1}+${state.die2}</strong> · choose a reachable room</p>`);
    add('End movement', () => act('endTurn'));
  }
  if (state.phase === 'suggestion') add('Make a suggestion', () => suggest(), 'primary');
  if (state.phase === 'refutation') resolveRefutation();
  if (state.phase === 'notebook') add('End turn', () => act('endTurn'), 'primary');
}

function add(label, handler, className = '') {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.onclick = handler;
  $('#actions').append(button);
}

function act(type, params = {}) {
  const result = game.act(type, params);
  if (!result.ok) return note(result.message, true);
  note(actionText(type, result.value));
  render();
}

function suggest() {
  choose('Make a suggestion', [select('Suspect', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS)], (value) => act('suggest', value));
}

function accuse() {
  choose('Make an accusation', [select('Suspect', 'suspectId', SUSPECTS), select('Weapon', 'weaponId', WEAPONS), select('Room', 'roomId', ROOMS)], (value) => {
    if (!confirm('An incorrect accusation eliminates you from taking turns. Continue?')) return;
    const result = game.act('accuse', value);
    note(result.ok ? (result.value ? 'The accusation is correct!' : 'The accusation was wrong.') : result.message, !result.ok);
    render();
  });
}

function resolveRefutation() {
  const refutation = game.refutation();
  if (!refutation) return add('No one can refute', () => act('resolveRefutation', {}), 'primary');
  if (mode === 'host') {
    const message = document.createElement('p');
    message.textContent = `Ask ${refutation.player.name} to check their device.`;
    $('#actions').append(message);
    add(`${refutation.player.name} showed a card`, () => act('resolveRefutation', { refuterIri: refutation.player.iri }), 'primary');
  } else add(`Pass to ${refutation.player.name}`, () => privateReveal(refutation), 'primary');
}

function privateReveal(refutation) {
  const dialog = $('#private');
  const content = $('#private-content');
  content.innerHTML = `<p class="kicker">Private refutation</p><h2>Pass to ${refutation.player.name}</h2><p>Only ${refutation.player.name} should continue.</p><button class="primary" id="confirm-refuter">I am ${refutation.player.name}</button><div class="private-cards" hidden></div>`;
  content.querySelector('#confirm-refuter').onclick = (event) => { event.currentTarget.remove(); content.querySelector('.private-cards').hidden = false; };
  refutation.matches.forEach((card) => {
    const button = document.createElement('button');
    button.textContent = card.label;
    button.onclick = () => { dialog.close(); act('resolveRefutation', { refuterIri: refutation.player.iri, cardId: card.id }); };
    content.querySelector('.private-cards').append(button);
  });
  dialog.showModal();
}

function privateHand(player) {
  const dialog = $('#private');
  const content = $('#private-content');
  content.innerHTML = `<p class="kicker">Private hand</p><h2>Pass to ${player.name}</h2><p>Only ${player.name} should continue.</p><button class="primary" id="confirm-hand">I am ${player.name}</button><section id="hand-details" hidden><div class="private-cards"></div><label class="notebook">Detective notebook<textarea rows="7" placeholder="Record deductions…"></textarea></label><button class="primary" id="close-hand">Hide my hand</button></section>`;
  for (const card of player.hand) {
    const item = document.createElement('span');
    item.textContent = card.label;
    content.querySelector('.private-cards').append(item);
  }
  const notes = content.querySelector('textarea');
  const notesKey = `butler-pass-notes-${player.iri}`;
  notes.value = localStorage.getItem(notesKey) || '';
  notes.oninput = () => localStorage.setItem(notesKey, notes.value);
  content.querySelector('#confirm-hand').onclick = (event) => { event.currentTarget.remove(); content.querySelector('#hand-details').hidden = false; };
  content.querySelector('#close-hand').onclick = () => dialog.close();
  dialog.showModal();
}

function choose(title, fields, done) {
  $('#choice-title').textContent = title;
  const form = $('#choice-form');
  $('#choice-fields').innerHTML = fields.join('');
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    $('#choice').close();
    done(data);
  };
  $('#choice').showModal();
}

function select(label, name, items) {
  return `<label>${label}<select name="${name}">${items.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>`;
}

async function showInvites() {
  const base = new URL('../player/', location.href).href;
  const invites = await game.invitations(base);
  const box = $('#invitations');
  box.innerHTML = '<h3>Private invitations</h3><p>Send each complete link only to the named player.</p>';
  invites.forEach((invite) => {
    const details = document.createElement('details');
    details.innerHTML = `<summary>${invite.name}</summary><textarea readonly>${invite.url}</textarea><button>Copy invitation</button>`;
    details.querySelector('button').onclick = () => navigator.clipboard.writeText(invite.url);
    box.append(details);
  });
}

function note(text, error = false) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  paragraph.className = error ? 'error' : '';
  $('#log').prepend(paragraph);
}

function phaseText(state) {
  return {
    'turn-start': 'Roll, suggest from your room, use a passage, or accuse.',
    movement: `Move up to ${state.moves} room connections.`,
    suggestion: 'Choose a suspect and weapon.',
    refutation: 'Players check the suggestion clockwise.',
    notebook: 'Update your notes, then end the turn.',
    complete: 'The sealed solution may now be verified.'
  }[state.phase] || state.phase;
}

function actionText(type, value) {
  return {
    roll: `Rolled ${value[0]} and ${value[1]}.`,
    move: `Entered ${cardById(value)?.label || value}.`,
    secretPassage: 'Used a secret passage.',
    suggest: 'Suggestion announced.',
    resolveRefutation: value ? 'A card was shown privately.' : 'No one could refute.',
    endTurn: 'The next detective begins.'
  }[type] || 'Action complete.';
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
window.addEventListener('blur', () => { if ($('#private')?.open) $('#private').close(); });
