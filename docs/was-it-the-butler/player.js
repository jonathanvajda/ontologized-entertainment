import { CARDS, SUSPECTS, cardImageUrl } from './game-config.js';
import { openHandCode } from './model/compact-hand-code.js';

const app = document.querySelector('#player-app');
const form = document.querySelector('#access-form');
const error = document.querySelector('#join-error');
const suspectSelect = document.querySelector('#suspect-id');
suspectSelect.innerHTML = SUSPECTS.map((suspect) => `<option value="${suspect.id}">${suspect.label}</option>`).join('');

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

function render(values, cards) {
  const suspect = SUSPECTS.find((item) => item.id === values.suspectId);
  const playerKey = `${values.tableCode}-${values.suspectId}`.toLocaleLowerCase();
  app.innerHTML = `<section class="player-hand"><p class="kicker">Table ${escapeText(values.tableCode.toUpperCase())}</p><h1>${suspect.label}’s private hand</h1><p class="privacy-note">Each card can be enlarged and shown directly to another player when it refutes a suggestion.</p><div class="card-grid"></div><section class="sleuth-sheet"><p class="kicker">Private deductions</p><h2>Sleuth sheet</h2><p>Your own cards are already marked. Check another item when you have ruled it out.</p><table><thead><tr><th scope="col">Person, weapon, or room</th><th scope="col">Ruled out</th></tr></thead><tbody></tbody></table></section><label class="notebook">Additional notes<textarea rows="6" placeholder="Record deductions and suspicions…"></textarea></label></section><dialog id="card-view"><button class="close-card" aria-label="Close card">×</button><img alt=""><h2></h2></dialog>`;
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
  const key = `butler-notes-${playerKey}`;
  note.value = localStorage.getItem(key) || '';
  note.oninput = () => localStorage.setItem(key, note.value);
  app.querySelector('.close-card').onclick = () => app.querySelector('#card-view').close();
}

function renderSleuthSheet(body, hand, playerKey) {
  const ownIds = new Set(hand.map((card) => card.id));
  const storageKey = `butler-sleuth-${playerKey}`;
  const marked = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  for (const category of ['suspect', 'weapon', 'room']) {
    const heading = document.createElement('tr');
    heading.className = 'sleuth-category';
    heading.innerHTML = `<th colspan="2">${category === 'suspect' ? 'People' : `${category[0].toUpperCase()}${category.slice(1)}s`}</th>`;
    body.append(heading);
    for (const card of CARDS.filter((item) => item.category === category)) {
      const own = ownIds.has(card.id);
      const row = document.createElement('tr');
      row.innerHTML = `<th scope="row">${card.label}${own ? '<small>In your hand</small>' : ''}</th><td><input type="checkbox" aria-label="Rule out ${card.label}" ${own || marked.has(card.id) ? 'checked' : ''} ${own ? 'disabled' : ''}></td>`;
      const checkbox = row.querySelector('input');
      if (!own) checkbox.onchange = () => {
        if (checkbox.checked) marked.add(card.id); else marked.delete(card.id);
        localStorage.setItem(storageKey, JSON.stringify([...marked]));
      };
      body.append(row);
    }
  }
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
