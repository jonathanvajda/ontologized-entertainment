import { RandomEngine } from '../../packages/game-mechanics/src/random-engine.js';
import { SHIPS, coordinate, parseCoordinate } from '../game-config.js';

export function neighbors(row, column, config) {
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([r, c]) => r >= 0 && r < config.rows && c >= 0 && c < config.columns).map(([r, c]) => coordinate(r, c));
}
export function footprint(start, orientation, length, config) {
  const at = parseCoordinate(start, config);
  if (!at || !['H', 'V'].includes(orientation)) return null;
  const cells = Array.from({ length }, (_, i) => coordinate(at.row + (orientation === 'V' ? i : 0), at.column + (orientation === 'H' ? i : 0)));
  return cells.every(cell => parseCoordinate(cell, config)) ? cells : null;
}
export function legalPlacements(length, obstacles, config, occupied = new Set()) {
  const blocked = obstacles instanceof Set ? obstacles : new Set(obstacles);
  const exclusions = new Set(blocked);
  if (config.climate === 'WARM_WATER' && length >= 4) for (const cell of blocked) {
    const { row, column } = parseCoordinate(cell, config);
    neighbors(row, column, config).forEach(value => exclusions.add(value));
  }
  const placements = [];
  for (let row = 0; row < config.rows; row++) for (let column = 0; column < config.columns; column++) for (const orientation of ['H', 'V']) {
    const start = coordinate(row, column), cells = footprint(start, orientation, length, config);
    if (cells && cells.every(cell => !exclusions.has(cell) && !occupied.has(cell))) placements.push({ start, orientation, cells });
  }
  return placements;
}
export function placementEntropy(obstacles, config) {
  const counts = new Map();
  return config.fleet.reduce((sum, type) => {
    const length = SHIPS[type].length;
    if (!counts.has(length)) counts.set(length, legalPlacements(length, obstacles, config).length);
    return sum + counts.get(length);
  }, 0);
}
export function arrangeFleet(ships, obstacles, config, random = new RandomEngine()) {
  const ordered = [...ships].sort((a, b) => b.length - a.length), occupied = new Set(), placements = new Map();
  let visits = 0;
  function place(index) {
    if (index === ordered.length) return true;
    if (++visits > 20_000) return false;
    const ship = ordered[index];
    for (const candidate of random.shuffle(legalPlacements(ship.length, obstacles, config, occupied))) {
      candidate.cells.forEach(cell => occupied.add(cell)); placements.set(ship.iri, candidate);
      if (place(index + 1)) return true;
      candidate.cells.forEach(cell => occupied.delete(cell)); placements.delete(ship.iri);
    }
    return false;
  }
  if (!place(0)) throw new Error('No legal full fleet placement was found for this board.');
  return Object.fromEntries(placements);
}
export function generateBoardPair(config, random) {
  // Disjoint connected clusters, each of three cells; a point rotation preserves
  // displacement and every legal placement count for either climate and fleet.
  for (let attempt = 0; attempt < 100; attempt++) {
    const blocked = new Set(); let built = true;
    for (let cluster = 0; cluster < config.obstacles; cluster++) {
      const starts = [];
      for (let r = 0; r < config.rows; r++) for (let c = 0; c < config.columns; c++) {
        const cell = coordinate(r, c);
        if (!blocked.has(cell) && neighbors(r, c, config).every(n => !blocked.has(n))) starts.push(cell);
      }
      if (!starts.length) { built = false; break; }
      const group = new Set([random.drawOne(starts)]);
      while (group.size < 3) {
        const options = [...new Set([...group].flatMap(cell => {
          const { row, column } = parseCoordinate(cell, config); return neighbors(row, column, config);
        }))].filter(cell => {
          const at = parseCoordinate(cell, config);
          return !group.has(cell) && !blocked.has(cell) && neighbors(at.row, at.column, config).every(n => !blocked.has(n));
        });
        if (!options.length) { built = false; break; }
        group.add(random.drawOne(options));
      }
      group.forEach(cell => blocked.add(cell));
      if (!built) break;
    }
    if (!built) continue;
    const mirrored = [...blocked].map(cell => {
      const at = parseCoordinate(cell, config); return coordinate(config.rows - 1 - at.row, config.columns - 1 - at.column);
    });
    try {
      arrangeFleet(config.fleet.map((type, i) => ({ iri: String(i), length: SHIPS[type].length })), blocked, config, new RandomEngine(0));
      const entropy = placementEntropy(blocked, config);
      if (entropy > 0 && entropy === placementEntropy(mirrored, config)) return { obstacles: [[...blocked], mirrored], entropy, delta: 0 };
    } catch { /* Try another deterministic cluster layout. */ }
  }
  throw new Error('Unable to generate a playable fair board pair. Try fewer obstacles.');
}
