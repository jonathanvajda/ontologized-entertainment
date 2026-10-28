import { CARDS, SUSPECTS, cardImageUrl } from './game-config.js';
import { openHandCode } from './model/compact-hand-code.js';
import { renderSleuthSheet } from './sleuth-sheet-ui.js';
import { readInvitationUrl } from '../packages/game-mechanics/src/index.js';
import { QrScanner } from '../query-whom/js/scanner.js';
import { openEverythingsSusStorage } from './storage.js';

let storage = null;
let privateSaveChain = Promise.resolve();

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
    await render(values, cards);
  } catch (reason) {
    error.textContent = reason.message || 'That access code could not be opened.';
  }
};

function applyInvitation(decoded, clearFragment = false) {
  form.elements.tableCode.value = decoded.tableCode;
  form.elements.suspectId.value = decoded.suspectId;
  form.elements.handCode.value = decoded.handCode;
  if (clearFragment) history.replaceState(null, '', `${location.pathname}${location.search}`);
  queueMicrotask(() => form.requestSubmit());
}

async function render(values, cards, restored = null) {
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
  const saved = restored || await storage?.loadPrivateState(values.tableCode, values.suspectId);
  let markedCardIds = saved?.markedCardIds || readLegacyArray(`everything-is-sus-sleuth-${playerKey}`);
  let privateNotes = saved?.notes ?? localStorage.getItem(`everything-is-sus-notes-${playerKey}`) ?? '';
  const persist = () => {
    const snapshot = { tableCode: values.tableCode, suspectId: values.suspectId, cardIds: cards.map((card) => card.id), markedCardIds: [...markedCardIds], notes: privateNotes };
    privateSaveChain = privateSaveChain.then(() => storage?.savePrivateState(snapshot)).catch((reason) => { error.textContent = `Automatic saving failed: ${reason.message}`; });
    return privateSaveChain;
  };
  renderSleuthSheet(app.querySelector('.sleuth-sheet tbody'), cards, { markedCardIds, onChange: (next) => { markedCardIds = next; void persist(); } });
  const note = app.querySelector('textarea');
  note.value = privateNotes;
  note.oninput = () => { privateNotes = note.value; void persist(); };
  const changeHand = document.createElement('button'); changeHand.type = 'button'; changeHand.className = 'change-hand'; changeHand.textContent = 'Open a different hand';
  changeHand.onclick = async () => { await privateSaveChain; await storage?.clearActivePrivateState(); location.reload(); };
  app.querySelector('.player-hand').prepend(changeHand);
  app.querySelector('.close-card').onclick = () => app.querySelector('#card-view').close();
  await persist();
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

function readLegacyArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

async function initialize() {
  try { storage = await openEverythingsSusStorage(); } catch (reason) { error.textContent = `Local recovery is unavailable: ${reason.message}`; }
  const invitation = readInvitationUrl(location.href);
  if (invitation?.tableCode && invitation?.suspectId && invitation?.handCode) { applyInvitation(invitation, true); return; }
  const saved = await storage?.loadActivePrivateState();
  if (!saved) return;
  const cards = saved.cardIds.map((id) => CARDS.find((card) => card.id === id)).filter(Boolean);
  if (cards.length) await render({ tableCode: saved.tableCode, suspectId: saved.suspectId }, cards, saved);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
window.addEventListener('pagehide', () => scanner.stop());
void initialize();
