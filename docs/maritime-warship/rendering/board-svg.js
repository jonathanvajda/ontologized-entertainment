const NS = 'http://www.w3.org/2000/svg';
const node = (name, attributes = {}, text = '') => {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
};
export function renderBoard(holder, player, config, { title, showShips = false, interactive = false, selected = [], endpoints = [], preview = [], invalidPreview = false, onCell, onHover } = {}) {
  const unit = 32, padding = 23;
  const svg = node('svg', { viewBox: `0 0 ${config.columns * unit + padding} ${config.rows * unit + padding}`, role: 'group', 'aria-label': title });
  holder.style.setProperty('--columns', config.columns);
  const results = new Map(player.incoming.map(result => [result.coordinate, result]));
  const ships = new Map(showShips ? player.ships.flatMap(ship => ship.cells.map(coord => [coord, ship])) : []);
  const selectedSet = new Set(selected), previewSet = new Set(preview);
  for (let col = 0; col < config.columns; col++) svg.append(node('text', { x: padding + (col + .5) * unit, y: 13, 'text-anchor': 'middle', class: 'chart-label' }, String(col + 1)));
  for (let row = 0; row < config.rows; row++) svg.append(node('text', { x: 10, y: padding + (row + .62) * unit, 'text-anchor': 'middle', class: 'chart-label' }, String.fromCharCode(65 + row)));
  for (const cell of player.cells.values()) {
    const result = results.get(cell.coordinate), ship = ships.get(cell.coordinate);
    const type = result?.type, symbol = type === 'Hit' || type === 'Sunk' ? '×' : type === 'Miss' ? '•' : type ? '◆' : cell.obstacle ? (config.climate === 'ARCTIC' ? '❄' : '▲') : ship ? '━' : '';
    const isSunk = ship?.sunk || (result && ['Hit', 'Sunk'].includes(type) && player.incoming.some(other => other.type === 'Sunk' && other.cellIri === cell.iri));
    const classes = ['chart-cell', cell.obstacle ? 'obstacle' : cell.shallow ? 'shallow' : '', ship ? 'ship' : '',
      result ? (isSunk || type === 'Sunk' ? 'sunk' : type === 'Hit' ? 'hit' : type === 'Miss' ? 'miss' : 'blocked') : '', selectedSet.has(cell.coordinate) ? 'selected' : '', endpoints.includes(cell.coordinate) ? 'placement-end' : '', previewSet.has(cell.coordinate) ? invalidPreview ? 'invalid' : 'preview' : ''].filter(Boolean).join(' ');
    const enabled = interactive && !result;
    const group = node('g', { transform: `translate(${padding + cell.column * unit},${padding + cell.row * unit})`, class: classes,
      'data-coordinate': cell.coordinate, role: enabled ? 'button' : 'img', 'aria-label': `${cell.coordinate}: ${type || (cell.obstacle ? config.climate === 'ARCTIC' ? 'ice obstacle' : 'island obstacle' : ship ? ship.name : cell.shallow ? 'shallow water' : 'water')}${selectedSet.has(cell.coordinate) ? ', selected' : ''}${endpoints.includes(cell.coordinate) ? ', available ship endpoint' : ''}`,
      ...(enabled ? { tabindex: '0', 'aria-pressed': selectedSet.has(cell.coordinate) } : {}) });
    group.append(node('rect', { x: 1, y: 1, width: unit - 2, height: unit - 2, rx: 2 }));
    if (symbol) group.append(node('text', { x: unit / 2, y: unit / 2 + 5, 'text-anchor': 'middle', 'aria-hidden': 'true' }, symbol));
    if (selectedSet.has(cell.coordinate)) {
      group.append(node('path', { d: 'M16 4v6m0 12v6M4 16h6m12 0h6', stroke: '#d5fff0', 'stroke-width': 1.5, fill: 'none', 'aria-hidden': 'true' }));
    }
    if (enabled) {
      group.addEventListener('click', event => onCell?.(cell.coordinate, event));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCell?.(cell.coordinate, event); }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          const r = cell.row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0);
          const c = cell.column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
          svg.querySelector(`[data-coordinate="${String.fromCharCode(65 + r)}${c + 1}"][tabindex]`)?.focus();
        }
      });
      if (onHover) {
        group.addEventListener('pointerenter', () => onHover(cell.coordinate, svg));
        group.addEventListener('focus', () => onHover(cell.coordinate, svg));
      }
    }
    svg.append(group);
  }
  holder.replaceChildren(svg);
  if (onHover) svg.addEventListener('pointerleave', () => onHover(null, svg));
}

export function previewPlacement(svg, cells = []) {
  const preview = new Set(cells);
  for (const group of svg.querySelectorAll('.chart-cell')) group.classList.toggle('preview', preview.has(group.dataset.coordinate));
}
