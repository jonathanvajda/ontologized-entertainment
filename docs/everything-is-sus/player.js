import { CARDS, SUSPECTS, cardImageUrl } from './game-config.js';
import { openHandCode } from './model/compact-hand-code.js';
import { normalizeSleuthMarks, remainingSleuthCandidates } from './model/sleuth-sheet-state.js';
import { readInvitationUrl } from '../packages/game-mechanics/src/index.js';
import { QrScanner } from '../query-whom/js/scanner.js';

const app = document.querySelector('#player-app');
const form = document.querySelector('#access-form');
const error = document.querySelector('#join-error');
const suspectSelect = document.querySelector('#suspect-id');
suspectSelect.innerHTML = SUSPECTS.map((suspect) => `<option value="${suspect.id}">${suspect.label}</option>`).join('');
const scanDialog = document.querySelector('#scan-invitation-dialog');
const scanner = new QrScanner({
  video: document.querySelector('#scan-video'),
  decodeCode: async (value) => {
    const decoded = readInvitationUrl(value);
    if (!decoded?.tableCode || !decoded?.suspectId || !decoded?.handCode) throw new Error('Not an Everything’s Sus invitation.');
    return { code: decoded };
  },
  invalidMessage: 'That is not an Everything’s Sus player invitation. Scan the private QR shown by the host.',
  onCode: (decoded) => { scanDialog.close(); applyInvitation(decoded); },
  onMessage: (message) => { document.querySelector('#scan-status').textContent = message; }
});

document.querySelector('#scan-invitation').onclick = async () => {
  document.querySelector('#scan-status').textContent = 'Allow camera access, then point at your invitation QR.';
  scanDialog.showModal();
  try { await scanner.start(); } catch (reason) { scanner.stop(); document.querySelector('#scan-status').textContent = reason.message; }
};
document.querySelector('#cancel-scan').onclick = () => scanDialog.close();
document.querySelector('#manual-entry').onclick = () => { scanDialog.close(); form.elements.tableCode.focus(); };
scanDialog.addEventListener('close', () => scanner.stop());

form.onsubmit = async (event) => {
  event.preventDefault();
  error.textContent = '';
  const values = Object.fromEntries(new FormData(form));
  try {
    const cards = await openHandCode({
      code: values.handCode,
      tableCode: values.tableCode,
      suspectId: values.suspectId
    });
    render(values, cards);
  } catch (reason) {
    error.textContent = reason.message || 'That access code could not be opened.';
  }
};

const invitation = readInvitationUrl(location.href);
if (invitation?.tableCode && invitation?.suspectId && invitation?.handCode) applyInvitation(invitation, true);

function applyInvitation(decoded, clearFragment = false) {
  form.elements.tableCode.value = decoded.tableCode;
  form.elements.suspectId.value = decoded.suspectId;
  form.elements.handCode.value = decoded.handCode;
  if (clearFragment) history.replaceState(null, '', `${location.pathname}${location.search}`);
  queueMicrotask(() => form.requestSubmit());
}

function render(values, cards) {
  const suspect = SUSPECTS.find((item) => item.id === values.suspectId);
  const playerKey = `${values.tableCode}-${values.suspectId}`.toLocaleLowerCase();
  app.innerHTML = `<section class="player-hand"><p class="kicker">Table ${escapeText(values.tableCode.toUpperCase())}</p><h1>${suspect.label}’s private hand</h1><p class="privacy-note">Each card can be enlarged and shown directly to another player when it refutes a suggestion.</p><div class="card-grid"></div><section class="sleuth-sheet"><p class="kicker">Private deductions</p><h2>Sleuth sheet</h2><p>Your own cards are already marked. Check another item when you have ruled it out. The last remaining possibility in each category is protected and highlighted.</p><table><thead><tr><th scope="col">Person, weapon, or room</th><th scope="col">Ruled out</th></tr></thead><tbody></tbody></table></section><label class="notebook">Additional notes<textarea rows="6" placeholder="Record deductions and suspicions…"></textarea></label></section><dialog id="card-view"><button class="close-card" aria-label="Close card">×</button><img alt=""><h2></h2></dialog>`;
  const grid = app.querySelector('.card-grid');
  cards.forEach((card) => {
    const button = document.createElement('button');
    button.className = 'evidence-card';
    button.innerHTML = `<img src="${cardImageUrl(card)}" alt=""><span>${card.category}</span><strong>${card.label}</strong><small>Tap to show</small>`;
    button.onclick = () => showCard(card);
    grid.append(button);
  });
  renderSleuthSheet(app.querySelector('.sleuth-sheet tbody'), cards, playerKey);
  const note = app.querySelector('textarea');
  const key = `everything-is-sus-notes-${playerKey}`;
  note.value = localStorage.getItem(key) || '';
  note.oninput = () => localStorage.setItem(key, note.value);
  app.querySelector('.close-card').onclick = () => app.querySelector('#card-view').close();
}

function renderSleuthSheet(body, hand, playerKey) {
  const ownIds = new Set(hand.map((card) => card.id));
  const storageKey = `everything-is-sus-sleuth-${playerKey}`;
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { stored = []; }
  const marked = normalizeSleuthMarks(CARDS, ownIds, stored);
  persistSleuthMarks(storageKey, marked);
  for (const category of ['suspect', 'weapon', 'room']) {
    const entries = [];
    const heading = document.createElement('tr');
    heading.className = 'sleuth-category';
    heading.innerHTML = `<th colspan="2">${category === 'suspect' ? 'People' : `${category[0].toUpperCase()}${category.slice(1)}s`}</th>`;
    body.append(heading);
    for (const card of CARDS.filter((item) => item.category === category)) {
      const own = ownIds.has(card.id);
      const row = document.createElement('tr');
      row.innerHTML = `<th scope="row">${card.label}${own ? '<small>In your hand</small>' : ''}<small class="candidate-note" hidden>Last remaining possibility</small></th><td><input type="checkbox" aria-label="Rule out ${card.label}" ${own || marked.has(card.id) ? 'checked' : ''} ${own ? 'disabled' : ''}></td>`;
      const checkbox = row.querySelector('input');
      entries.push({ card, own, row, checkbox });
      if (!own) checkbox.onchange = () => {
        if (checkbox.checked) marked.add(card.id); else marked.delete(card.id);
        persistSleuthMarks(storageKey, marked);
        updateSleuthCategory(entries, ownIds, marked, category);
      };
      body.append(row);
    }
    updateSleuthCategory(entries, ownIds, marked, category);
  }
}

function updateSleuthCategory(entries, ownIds, marked, category) {
  const [last] = remainingSleuthCandidates(CARDS, ownIds, marked, category);
  const remainingCount = remainingSleuthCandidates(CARDS, ownIds, marked, category).length;
  for (const entry of entries) {
    if (entry.own) continue;
    const protectedCandidate = remainingCount === 1 && entry.card.id === last.id;
    entry.checkbox.disabled = protectedCandidate;
    entry.row.classList.toggle('last-candidate', protectedCandidate);
    entry.row.querySelector('.candidate-note').hidden = !protectedCandidate;
    entry.checkbox.title = protectedCandidate ? 'Keep at least one possibility in this category.' : '';
  }
}

function persistSleuthMarks(storageKey, marked) {
  localStorage.setItem(storageKey, JSON.stringify([...marked]));
}

function showCard(card) {
  const dialog = app.querySelector('#card-view');
  dialog.querySelector('img').src = cardImageUrl(card);
  dialog.querySelector('img').alt = card.label;
  dialog.querySelector('h2').textContent = card.label;
  dialog.showModal();
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
window.addEventListener('pagehide', () => scanner.stop());
