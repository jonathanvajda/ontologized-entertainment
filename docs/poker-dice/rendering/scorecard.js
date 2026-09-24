import { CATEGORIES } from '../game-config.js';

export function renderScorecard(table, state, { onScore = () => {} } = {}) {
  const active = state.players[state.currentPlayerIndex];
  const head = document.createElement('thead'); const headRow = document.createElement('tr');
  headRow.append(cell('th', 'Category', { scope: 'col' }), ...state.players.map((player) => cell('th', player.name, { scope: 'col', className: player.iri === state.currentPlayerIri ? 'is-current-player' : '' })));
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const category of CATEGORIES) {
    const row = document.createElement('tr'); row.dataset.section = category.section;
    const label = cell('th', category.label, { scope: 'row' }); const hint = document.createElement('small'); hint.textContent = category.hint; label.append(hint); row.append(label);
    for (const player of state.players) {
      const committed = player.scores[category.id]; const actionable = player.iri === active.iri && committed === undefined && state.rollCount > 0 && !state.complete;
      const td = document.createElement('td');
      if (actionable) {
        const button = document.createElement('button'); const preview = state.previews[category.id];
        button.type = 'button'; button.className = `score-choice${preview === 0 ? ' is-zero' : ''}`; button.textContent = String(preview); button.setAttribute('aria-label', `Score ${preview} in ${category.label}`); button.addEventListener('click', () => onScore(category, preview)); td.append(button);
      } else { td.textContent = committed === undefined ? '—' : String(committed); if (committed !== undefined) td.className = 'is-committed'; }
      row.append(td);
    }
    body.append(row);
    if (category.id === 'sixes') body.append(summaryRow('Upper subtotal', state.players.map((player) => player.totals.upper)), summaryRow('Bonus (63+)', state.players.map((player) => player.totals.bonus)));
  }
  body.append(summaryRow('Grand total', state.players.map((player) => player.totals.grand), 'grand-total'));
  table.replaceChildren(head, body);
}

function summaryRow(label, values, className = '') { const row = document.createElement('tr'); row.className = `summary-row ${className}`; row.append(cell('th', label, { scope: 'row' }), ...values.map((value) => cell('td', String(value)))); return row; }
function cell(tag, value, attrs = {}) { const node = document.createElement(tag); node.append(document.createTextNode(value)); Object.entries(attrs).forEach(([key, val]) => key === 'className' ? node.className = val : node.setAttribute(key, val)); return node; }
