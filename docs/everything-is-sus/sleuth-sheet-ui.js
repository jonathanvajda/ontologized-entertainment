import { CARDS } from './game-config.js';
import { normalizeSleuthMarks, remainingSleuthCandidates } from './model/sleuth-sheet-state.js';

export function renderSleuthSheet(body, hand, { markedCardIds = [], onChange = () => {} } = {}) {
  const ownIds = new Set(hand.map((card) => card.id));
  const marked = normalizeSleuthMarks(CARDS, ownIds, markedCardIds);
  onChange([...marked]);

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
        onChange([...marked]);
        updateCategory(entries, ownIds, marked, category);
      };
      body.append(row);
    }
    updateCategory(entries, ownIds, marked, category);
  }
}

function updateCategory(entries, ownIds, marked, category) {
  const remaining = remainingSleuthCandidates(CARDS, ownIds, marked, category);
  const last = remaining.length === 1 ? remaining[0] : null;
  for (const entry of entries) {
    if (entry.own) continue;
    const protectedCandidate = entry.card.id === last?.id;
    entry.checkbox.disabled = protectedCandidate;
    entry.row.classList.toggle('last-candidate', protectedCandidate);
    entry.row.querySelector('.candidate-note').hidden = !protectedCandidate;
    entry.checkbox.title = protectedCandidate ? 'Keep at least one possibility in this category.' : '';
  }
}
