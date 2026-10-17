import { MW, V, SESSION, playerIri, instance } from './vocabulary.js';
import { SHIPS, coordinate } from '../game-config.js';

/** Index one RDF snapshot; the resulting maps are disposable, never authoritative. */
export function indexStore(store) {
  const subjects = new Map(), types = new Map();
  for (const q of store) {
    if (!subjects.has(q.subject.value)) subjects.set(q.subject.value, new Map());
    const predicates = subjects.get(q.subject.value);
    if (!predicates.has(q.predicate.value)) predicates.set(q.predicate.value, []);
    predicates.get(q.predicate.value).push(q.object.value);
    if (q.predicate.value === V.type) {
      if (!types.has(q.object.value)) types.set(q.object.value, []);
      types.get(q.object.value).push(q.subject.value);
    }
  }
  const values = (subject, predicate) => subjects.get(subject)?.get(predicate) || [];
  const one = (subject, predicate, fallback = '') => values(subject, predicate)[0] ?? fallback;
  const ofType = type => types.get(type) || [];
  return { subjects, types, values, one, ofType };
}

export function projectMaritime(store) {
  const ix = indexStore(store), { one, values, ofType } = ix;
  const parameters = values(one(SESSION, V.configuration), V.parameter);
  const parameter = (name, fallback) => {
    const node = parameters.find(id => values(id, V.type).includes(MW + name + 'Specification'));
    return node ? one(node, V.value) : fallback;
  };
  const config = {
    rows: Number(parameter('RowCount', 10)), columns: Number(parameter('ColumnCount', 10)),
    climate: parameter('ClimateTheme', 'WARM_WATER'), obstacles: Number(parameter('ObstacleClusterCount', 0)),
    salvo: Number(parameter('SalvoLimit', 1)) === 5, mode: parameter('PlayMode', 'TWO_DEVICE'),
    fleet: parameters.filter(id => values(id, V.type).includes(MW + 'FleetCompositionSpecification')).map(id => one(id, V.value)),
    budget: Number(parameter('DraftBudget', 35))
  };
  const phase = one(SESSION, V.phase).split('phase-').at(-1);
  const currentPlayerIri = one(SESSION, V.current), winnerIri = one(SESSION, V.winner);
  const allSegments = ofType(MW + 'ShipSegment');
  const segmentsByShip = new Map();
  for (const id of allSegments) {
    const parent = one(id, V.partOf);
    if (!segmentsByShip.has(parent)) segmentsByShip.set(parent, []);
    segmentsByShip.get(parent).push({ iri: id, cellIri: one(id, V.location), damaged: values(id, V.damageStasis).length > 0 });
  }
  const results = ofType(MW + 'AttackResult').map(id => {
    const type = values(id, V.type).find(type => type !== MW + 'AttackResult')?.slice(MW.length).replace('Result', '') || 'Miss';
    const cellIri = one(id, V.about), cellCoord = one(one(cellIri, V.coordinate), V.value);
    const defender = one(one(cellIri, V.partOf), V.controller);
    return { iri: id, type, cellIri, coordinate: cellCoord, attackerIri: defender === playerIri(0) ? playerIri(1) : playerIri(0), shotIri: values(id, V.about)[1] };
  });
  const players = values(SESSION, V.player).map(id => {
    const areaIri = values(SESSION, V.area).find(area => one(area, V.controller) === id);
    const fleetIri = ofType(MW + 'Fleet').find(fleet => one(fleet, V.controller) === id);
    const ships = ofType(MW + 'Warship').filter(ship => one(ship, V.member) === fleetIri && fleetIri).map(ship => {
      const type = values(ship, V.type).map(t => t.slice(MW.length)).find(t => Object.hasOwn(SHIPS, t));
      const segments = (segmentsByShip.get(ship) || []).sort((a, b) => a.iri.localeCompare(b.iri));
      const cells = segments.map(seg => one(one(seg.cellIri, V.coordinate), V.value)).filter(Boolean);
      return { iri: ship, type, name: one(ship, V.label), length: segments.length, segments, cells,
        hits: segments.filter(s => s.damaged).length, sunk: segments.length > 0 && segments.every(s => s.damaged), placed: cells.length === segments.length };
    });
    const cells = new Map();
    for (let row = 0; row < config.rows; row++) for (let column = 0; column < config.columns; column++) {
      const coord = coordinate(row, column), iri = `${areaIri}/${coord}`;
      const terrainIri = one(iri, V.boundary), terrainTypes = values(terrainIri, V.type);
      const obstacle = terrainTypes.includes(MW + 'Island') || terrainTypes.includes(MW + 'IceField');
      cells.set(coord, { iri, coordinate: coord, row, column, terrainIri, obstacle, shallow: terrainTypes.includes(MW + 'ShallowCoastalWater') });
    }
    const incoming = results.filter(result => result.cellIri.startsWith(areaIri + '/'));
    return { iri: id, index: id === playerIri(0) ? 0 : 1, name: one(id, V.label), areaIri, fleetIri, ships, cells,
      obstacles: [...cells.values()].filter(c => c.obstacle).map(c => c.coordinate), incoming,
      outgoing: results.filter(result => result.attackerIri === id), intact: ships.reduce((sum, ship) => sum + ship.length - ship.hits, 0) };
  });
  return { config, phase, currentPlayerIri, winnerIri, localPlayerIri: one(SESSION, V.localPlayer), complete: phase === 'complete', players, results,
    turnNumber: ofType(MW + 'AttackOrder').length + 1,
    entropy: Number(one(instance('entropy-1'), V.value)),
    revision: values(SESSION, V.current).length ? ofType(MW + 'AttackOrder').length : results.length,
    index: ix };
}
