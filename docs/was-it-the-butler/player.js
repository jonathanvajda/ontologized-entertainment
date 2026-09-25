import {
  readInvitationUrl,
  decodeTransportToken,
  importSymmetricKey,
  openEncryptedRdfCapsule
} from '../packages/game-mechanics/src/index.js';
import { CARDS, NS } from './game-config.js';

const app = document.querySelector('#player-app');
const input = document.querySelector('#invite-input');
const error = document.querySelector('#join-error');

document.querySelector('#open-invite').onclick = () => open(input.value);
document.querySelector('#invite-file').onchange = async (event) => open(await event.target.files[0]?.text());

const fromUrl = readInvitationUrl(location.href);
if (fromUrl) {
  openPayload(fromUrl);
  history.replaceState(null, '', location.pathname);
}

async function open(value) {
  try {
    let payload;
    if (String(value).includes('#invite=')) payload = readInvitationUrl(value);
    else {
      try { payload = JSON.parse(value); }
      catch { payload = decodeTransportToken(value); }
    }
    await openPayload(payload);
  } catch {
    error.textContent = 'That invitation could not be opened.';
  }
}

async function openPayload(payload) {
  const key = await importSymmetricKey(payload.key);
  const opened = await openEncryptedRdfCapsule(payload.capsule, key);
  const rows = opened.privateQuads;
  const cardIris = [...new Set(rows.filter((row) => row.predicate.value.endsWith('memberOf')).map((row) => row.subject.value))];
  const cards = cardIris.map((iri) => CARDS.find((card) => NS + 'card-' + card.id === iri)).filter(Boolean);
  render(opened.playerIri, cards, opened.gameCode);
}

function render(playerIri, cards, code) {
  app.innerHTML = `<section class="player-hand"><p class="kicker">Table ${code}</p><h1>Your private hand</h1><p class="privacy-note">Only show a card when the host asks you to refute.</p><div class="card-grid"></div><label class="notebook">Detective notebook<textarea rows="12" placeholder="Record cards, deductions, and suspicions…"></textarea></label></section>`;
  const grid = app.querySelector('.card-grid');
  cards.forEach((card) => {
    const article = document.createElement('article');
    const col = card.atlas % 3;
    const row = Math.floor(card.atlas / 3);
    article.className = 'evidence-card';
    article.innerHTML = `<i></i><span>${card.category}</span><h2>${card.label}</h2>`;
    article.querySelector('i').style.backgroundPosition = `${col * 50}% ${row * (100 / 6)}%`;
    grid.append(article);
  });
  const note = app.querySelector('textarea');
  const key = 'butler-notes-' + playerIri;
  note.value = localStorage.getItem(key) || '';
  note.oninput = () => localStorage.setItem(key, note.value);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js', { scope: '../' });
