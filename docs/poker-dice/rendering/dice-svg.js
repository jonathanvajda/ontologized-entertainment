const SVG_NS = 'http://www.w3.org/2000/svg';
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const POSITIONS = [[28, 28], [60, 28], [92, 28], [28, 60], [60, 60], [92, 60], [28, 92], [60, 92], [92, 92]];

export function renderDice(container, dice, { enabled = false, rolling = false, onToggle = () => {} } = {}) {
  container.replaceChildren(...dice.map((die, index) => createDie(die, index, { enabled, rolling, onToggle })));
}

function createDie(die, index, { enabled, rolling, onToggle }) {
  const button = document.createElement('button'); button.type = 'button'; button.className = `die-button${die.held ? ' is-held' : ''}${rolling ? ' is-rolling' : ''}`;
  button.disabled = !enabled; button.dataset.dieIri = die.iri;
  button.setAttribute('aria-pressed', String(die.held)); button.setAttribute('aria-label', `Die ${index + 1}: ${die.value == null ? 'not rolled' : die.value}${die.held ? ', held' : ', not held'}`);
  const svg = document.createElementNS(SVG_NS, 'svg'); svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(SVG_NS, 'rect'); body.setAttribute('x', '5'); body.setAttribute('y', '5'); body.setAttribute('width', '110'); body.setAttribute('height', '110'); body.setAttribute('rx', '22'); body.setAttribute('class', 'die-face'); svg.append(body);
  for (const pipIndex of PIPS[die.value] || []) { const [cx, cy] = POSITIONS[pipIndex]; const pip = document.createElementNS(SVG_NS, 'circle'); pip.setAttribute('cx', cx); pip.setAttribute('cy', cy); pip.setAttribute('r', '9'); pip.setAttribute('class', 'die-pip'); svg.append(pip); }
  const marker = document.createElement('span'); marker.className = 'held-marker'; marker.textContent = die.held ? 'Held' : 'Hold';
  button.append(svg, marker); button.addEventListener('click', () => onToggle(die.iri)); return button;
}
