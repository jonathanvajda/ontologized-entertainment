import { RdfStore, namedNode as nn, literal, quad, quadKey } from '../../packages/game-mechanics/src/rdf-store.js';
import { createGameEngine } from '../../packages/game-mechanics/src/engine.js';
import { RuleRegistry } from '../../packages/game-mechanics/src/rule-registry.js';
import { Validator } from '../../packages/game-mechanics/src/validator.js';
import { RandomEngine } from '../../packages/game-mechanics/src/random-engine.js';
import { SHIPS, normalizeConfig, coordinate, parseCoordinate } from '../game-config.js';
import { arrangeFleet, generateBoardPair, legalPlacements, neighbors, placementEntropy } from '../rules/board.js';
import { MW, GAME, HI, BFO, CCO, XSD, V, SESSION, instance, playerIri, phaseIri } from './vocabulary.js';
import { projectMaritime, indexStore } from './projection.js';

const q = (s, p, o) => quad(nn(s), nn(p), typeof o === 'object' ? o : nn(o));
const text = value => literal(String(value));
const integer = value => literal(value, XSD + 'integer');
const policy = owner => instance(owner == null ? 'visibility-public' : `visibility-${owner + 1}`);

function initialState(config, random) {
  const pair = generateBoardPair(config, random), quads = [], add = (s, p, o) => quads.push(q(s, p, o));
  const type = (s, t, owner = null) => { add(s, V.type, t); add(policy(owner), V.governs, s); };
  for (const owner of [null, 0, 1]) {
    add(policy(owner), V.type, HI + 'VisibilityPolicy');
    add(policy(owner), owner == null ? V.visibilityMode : V.visibleTo, owner == null ? HI + 'Public' : playerIri(owner));
  }
  type(SESSION, MW + 'MaritimeSession'); add(SESSION, V.phase, phaseIri('placement')); add(SESSION, V.current, playerIri(0));
  for (const phase of ['placement', 'combat', 'complete', 'ended']) { type(phaseIri(phase), GAME + 'Phase'); add(phaseIri(phase), V.label, text(phase)); }
  const configuration = instance('configuration'); type(configuration, MW + 'MatchConfiguration'); add(SESSION, V.configuration, configuration);
  const param = (name, value, suffix = '') => {
    const id = instance('parameter-' + name + suffix); type(id, MW + name + 'Specification');
    add(configuration, V.parameter, id); add(id, V.value, Number.isInteger(value) ? integer(value) : text(value));
  };
  for (const [name, value] of Object.entries({ RowCount: config.rows, ColumnCount: config.columns, ClimateTheme: config.climate, ObstacleClusterCount: config.obstacles, SalvoLimit: config.salvo ? 5 : 1, PlayMode: config.mode, DraftBudget: config.budget })) param(name, value);
  config.fleet.forEach((type, i) => param('FleetComposition', type, '-' + i));
  for (let index = 0; index < 2; index++) {
    const player = playerIri(index), area = instance(`area-${index + 1}`), fleet = instance(`fleet-${index + 1}`);
    type(player, CCO + 'ont00001017'); add(player, V.label, text(config.names[index])); add(SESSION, V.player, player);
    const role = instance(`player-role-${index}`); type(role, GAME + 'PlayerRole'); add(player, V.bearer, role);
    type(area, V.region); add(area, V.label, text(config.names[index] + ' defended area')); add(area, V.controller, player); add(SESSION, V.area, area);
    type(fleet, MW + 'Fleet', index); add(fleet, V.controller, player);
    for (const gridType of ['PrimaryGrid', 'TargetingGrid']) {
      const grid = instance(`grid-${index + 1}-${gridType}`); type(grid, MW + gridType, index);
      add(player, V.grid, grid); add(grid, V.about, gridType === 'PrimaryGrid' ? area : instance(`area-${2 - index}`));
    }
    const obstacles = new Set(pair.obstacles[index]);
    for (let row = 0; row < config.rows; row++) for (let col = 0; col < config.columns; col++) {
      const coord = coordinate(row, col), cell = `${area}/${coord}`, terrain = cell + '/terrain', designator = cell + '/coordinate';
      type(cell, V.region); add(cell, V.label, text(config.names[index] + ' ' + coord)); add(cell, V.partOf, area);
      type(designator, MW + 'CoordinateDesignator'); add(designator, V.value, text(coord)); add(designator, V.designates, cell); add(cell, V.coordinate, designator);
      const obstacle = obstacles.has(coord), shallow = !obstacle && neighbors(row, col, config).some(n => obstacles.has(n));
      const terrainType = obstacle ? (config.climate === 'ARCTIC' ? 'IceField' : 'Island') : (shallow && config.climate === 'WARM_WATER' ? 'ShallowCoastalWater' : 'OpenWater');
      type(terrain, MW + terrainType); add(cell, V.boundary, terrain);
      if (obstacle) { const role = terrain + '/obstacle-role'; type(role, MW + 'ObstacleRole'); add(terrain, V.bearer, role); }
      for (const neighbor of neighbors(row, col, config)) add(cell, V.adjacent, `${area}/${neighbor}`);
    }
    config.fleet.forEach((shipType, shipIndex) => {
      const ship = instance(`ship-${index + 1}-${shipIndex + 1}`);
      type(ship, MW + 'Warship', index); add(ship, V.type, MW + shipType); add(ship, V.label, text(`${SHIPS[shipType].label} ${shipIndex + 1}`)); add(ship, V.member, fleet);
      for (let i = 0; i < SHIPS[shipType].length; i++) {
        const segment = ship + `/segment-${i + 1}`; type(segment, MW + 'ShipSegment', index); add(segment, V.partOf, ship);
      }
      const stasis = ship + '/stasis-initial'; type(stasis, MW + 'FullyCapableStasis', index);
      add(stasis, V.participant, ship); add(stasis, V.forMission, MW + 'DefendFleetMission'); add(ship, V.missionStasis, stasis);
    });
    const assessment = instance(`entropy-${index + 1}`); type(assessment, MW + 'PlacementEntropyAssessment');
    add(assessment, V.about, area); add(assessment, V.about, configuration); add(assessment, V.value, integer(pair.entropy));
  }
  return quads;
}

export function createMaritimeGame(input = {}, options = {}) {
  const config = normalizeConfig(input), localIndex = options.localIndex ?? 0;
  if (![0, 1].includes(localIndex)) throw new Error('Choose creator or joiner identity.');
  const boardRandom = new RandomEngine(options.boardSeed ?? options.seed);
  const full = new RdfStore(initialState(config, boardRandom));
  const allowed = new Set([policy(null), policy(localIndex)].flatMap(id => full.getQuads(nn(id), nn(V.governs), null, null).map(q => q.object.value)));
  // Opponent fleets, placements and random state never enter the device's dataset.
  const store = new RdfStore([...full].filter(q => allowed.has(q.subject.value)));
  store.addQuad(q(SESSION, V.label, text(options.name?.trim() || config.names.join(' vs '))));
  store.addQuad(q(SESSION, V.localPlayer, playerIri(localIndex)));
  return hydrateMaritimeGame({ quads: [...store], rngState: new RandomEngine(options.placementSeed).getState(), transactions: [] });
}
export function hydrateMaritimeGame(snapshot) {
  const store = new RdfStore(snapshot.quads), findings = validateMaritime(store);
  if (findings.length) throw new Error(findings[0].message);
  const rules = new RuleRegistry();
  for (const actionType of ['placeShip', 'autoPlace', 'clearPlacement', 'lockFleet', 'recordReport', 'endGame', 'renameGame']) rules.registerAction(actionType, { preconditions: [canAct], effects });
  const engine = createGameEngine({ store, rules, validator: new Validator([validateMaritime]), projection: projectMaritime });
  engine.random.setState(snapshot.rngState); engine.transactions.restore(snapshot.transactions || []);
  const sessionId = snapshot.sessionId || crypto.randomUUID(); let busy = false;
  return {
    engine, sessionId, state: () => projectMaritime(store),
    async act(actionType, parameters = {}, actorIri = projectMaritime(store).localPlayerIri) {
      if (busy) return fail('ACTION_PENDING', 'Wait for the current action.');
      busy = true;
      try {
        if (actionType === 'receiveAttack') {
          parameters = { direction: 'incoming', reports: incomingReports(projectMaritime(store), parameters.coordinates) };
          actionType = 'recordReport';
        }
        return await engine.actions.propose({ actionType, parameters, actorIri, actionIri: instance(`act-${engine.transactions.cursor + 1}`) });
      }
      catch (error) { return fail('INVALID_ACTION', error.message); }
      finally { busy = false; }
    },
    snapshot: () => ({ sessionId, quads: [...store], rngState: engine.random.getState(), transactions: engine.transactions.entries() })
  };
}
const fail = (code, message) => ({ ok: false, code, message });
// Only the local fleet can be resolved. A salvo is evaluated in the same stable
// order as its RDF effects, so the last newly damaged segment announces sinking.
export function incomingReports(state, coordinates) {
  if (state.phase !== 'combat' || state.currentPlayerIri === state.localPlayerIri) throw new Error('Confirm incoming coordinates only during the opponent\'s turn.');
  if (!Array.isArray(coordinates) || !coordinates.length || coordinates.length > (state.config.salvo ? 5 : 1) || new Set(coordinates).size !== coordinates.length) throw new Error('Choose distinct incoming coordinates within the shot limit.');
  const me = state.players.find(p => p.iri === state.localPlayerIri);
  const hits = new Set(me.ships.flatMap(ship => ship.segments.filter(s => s.damaged).map(s => s.iri)));
  return coordinates.map(coordinate => ({ coordinate })).sort(sortReports).map(({ coordinate }) => {
    const cell = me.cells.get(coordinate);
    if (!cell || me.incoming.some(r => r.coordinate === coordinate)) throw new Error('Choose an unresolved coordinate on your own grid.');
    const ship = me.ships.find(ship => ship.cells.includes(coordinate));
    if (!ship) return { coordinate, type: 'Miss' };
    hits.add(ship.segments.find(segment => segment.cellIri === cell.iri).iri);
    return { coordinate, type: ship.segments.every(segment => hits.has(segment.iri)) ? 'Sunk' : 'Hit' };
  });
}
function canAct({ action, store }) {
  const state = projectMaritime(store), me = state.players.find(p => p.iri === state.localPlayerIri), params = action.parameters || {};
  if (action.actorIri !== me.iri || state.complete) return fail('ACTION_NOT_ALLOWED', 'Only the local player can update an active journal.');
  if (action.actionType === 'endGame') return true;
  if (action.actionType === 'renameGame') return typeof params.name === 'string' && params.name.trim().length > 0 && params.name.trim().length <= 60 || fail('INVALID_NAME', 'Enter a game name of up to 60 characters.');
  if (action.actionType !== 'recordReport') {
    if (state.phase !== 'placement') return fail('PLACEMENT_LOCKED', 'Your fleet is locked for this engagement.');
    if (action.actionType === 'lockFleet') return me.ships.every(s => s.placed) || fail('INCOMPLETE_FLEET', 'Place every ship before locking your fleet.');
    if (action.actionType === 'placeShip') {
      const ship = me.ships.find(s => s.iri === params.shipIri); if (!ship) return fail('UNKNOWN_SHIP', 'Select one of your ships.');
      const occupied = new Set(me.ships.filter(s => s.iri !== ship.iri).flatMap(s => s.cells));
      return legalPlacements(ship.length, me.obstacles, state.config, occupied).some(p => p.start === params.start && p.orientation === params.orientation) || fail('ILLEGAL_PLACEMENT', 'Keep ships in bounds, clear of other ships, hazards and required coastal clearance.');
    }
    return true;
  }
  if (state.phase !== 'combat') return fail('WRONG_PHASE', 'Deploy your fleet before recording attacks.');
  const incoming = state.currentPlayerIri !== me.iri;
  if (params.direction !== (incoming ? 'incoming' : 'outgoing')) return fail('WRONG_TURN', incoming ? 'Record the incoming attack first.' : 'It is your firing turn.');
  const reports = params.reports, defender = state.players.find(p => p.iri === (incoming ? me.iri : state.players.find(p => p.iri !== me.iri).iri));
  if (!Array.isArray(reports) || reports.length < 1 || reports.length > (state.config.salvo ? 5 : 1) || new Set(reports.map(r => r?.coordinate)).size !== reports.length || reports.some(r => !r || !parseCoordinate(r.coordinate, state.config) || !['Miss', 'Hit', 'Sunk'].includes(r.type))) return fail('INVALID_REPORT', 'Select Miss, Hit, or Hit and sunk for each distinct coordinate.');
  if (reports.some(r => defender.incoming.some(old => old.coordinate === r.coordinate))) return fail('REPEAT_TARGET', 'A coordinate cannot be recorded twice.');
  const hit = new Set(me.ships.flatMap(ship => ship.segments.filter(seg => seg.damaged).map(seg => seg.iri)));
  let knownSunk = me.outgoing.filter(r => r.type === 'Sunk').length;
  let knownHits = me.outgoing.filter(r => ['Hit', 'Sunk'].includes(r.type)).length;
  for (const report of [...reports].sort(sortReports)) {
    const cell = defender.cells.get(report.coordinate);
    if (cell.obstacle) return fail('OBSTRUCTED_TARGET', 'Choose a water coordinate. Visible obstacles cannot be targeted.');
    if (incoming) {
      const ship = me.ships.find(s => s.cells.includes(report.coordinate)), segment = ship?.segments.find(s => s.cellIri === cell.iri);
      if (!cell.obstacle && segment) {
        hit.add(segment.iri); const final = ship.segments.every(seg => hit.has(seg.iri));
        if (report.type !== (final ? 'Sunk' : 'Hit')) return fail('INCONSISTENT_REPORT', 'Check your ship and its previous damage before reporting Hit or Sunk.');
      } else if (!cell.obstacle && report.type !== 'Miss') return fail('INCONSISTENT_REPORT', 'There is no vessel at this primary-grid coordinate.');
    } else {
      // The opposing placements are unknown. Record verbal claims, never resolve them.
      if (['Hit', 'Sunk'].includes(report.type)) knownHits++;
      if (knownHits > state.config.fleet.reduce((sum, type) => sum + SHIPS[type].length, 0)) return fail('INCONSISTENT_REPORT', 'Recorded hits exceed the opposing fleet’s segment inventory.');
      if (report.type === 'Sunk') {
        knownSunk++;
        const minimumSegments = state.config.fleet.map(type => SHIPS[type].length).sort((a,b) => a-b).slice(0, knownSunk).reduce((sum, n) => sum+n, 0);
        if (knownSunk > state.config.fleet.length || knownHits < minimumSegments) return fail('INCONSISTENT_REPORT', 'The recorded hits are insufficient for the number of vessels reported sunk.');
      }
    }
  }
  return true;
}
const sortReports = (a, b) => a.coordinate.localeCompare(b.coordinate, undefined, { numeric: true });
function effects({ action, store, random }) {
  const state = projectMaritime(store), me = state.players.find(p => p.iri === state.localPlayerIri), other = state.players.find(p => p.iri !== me.iri);
  const next = store.clone(), add = (s, p, o) => next.addQuad(q(s, p, o));
  const remove = (s, p) => next.removeQuads(next.getQuads(nn(s), nn(p), null, null));
  const set = (s, p, o) => { remove(s, p); add(s, p, o); };
  const type = (s, t) => add(s, V.type, t), act = action.actionIri;
  type(act, ['recordReport', 'endGame', 'renameGame'].includes(action.actionType) ? GAME + 'GameAct' : MW + 'PlacementAct'); add(act, V.agent, me.iri);
  if (action.actionType === 'renameGame') set(SESSION, V.label, text(action.parameters.name.trim()));
  if (action.actionType === 'endGame') { set(SESSION, V.phase, phaseIri('ended')); remove(SESSION, V.current); }
  const place = (ship, placement) => {
    const candidate = legalPlacements(ship.length, me.obstacles, state.config).find(p => p.start === placement.start && p.orientation === placement.orientation);
    ship.segments.forEach((seg, i) => set(seg.iri, V.location, me.cells.get(candidate.cells[i]).iri)); add(act, V.participant, ship.iri);
  };
  if (action.actionType === 'placeShip') place(me.ships.find(s => s.iri === action.parameters.shipIri), action.parameters);
  if (action.actionType === 'autoPlace') { const placements = arrangeFleet(me.ships, me.obstacles, state.config, random); me.ships.forEach(ship => place(ship, placements[ship.iri])); }
  if (action.actionType === 'clearPlacement') me.ships.forEach(ship => ship.segments.forEach(seg => remove(seg.iri, V.location)));
  if (action.actionType === 'lockFleet') set(SESSION, V.phase, phaseIri('combat'));
  if (action.actionType === 'recordReport') {
    const incoming = action.parameters.direction === 'incoming', attacker = incoming ? other : me, defender = incoming ? me : other;
    const order = act + '/order'; type(order, MW + 'AttackOrder'); add(order, V.agent, attacker.iri);
    const hit = new Set(me.ships.flatMap(s => s.segments.filter(seg => seg.damaged).map(seg => seg.iri)));
    const salvo = order + '/salvo'; if (state.config.salvo) type(salvo, MW + 'Salvo');
    const operator = order + '/operator', launcher = order + '/launcher'; type(operator, CCO + 'ont00001017'); type(launcher, CCO + 'ont00000445');
    for (const [i, report] of [...action.parameters.reports].sort(sortReports).entries()) {
      const cell = defender.cells.get(report.coordinate), shot = order + `/shot-${i}`, result = shot + '/result', munition = shot + '/torpedo';
      type(shot, V.shot); type(munition, V.torpedo); add(order, V.targets, cell.iri); add(order, V.resolves, shot);
      add(shot, V.occursIn, cell.iri); add(shot, V.agent, operator); add(shot, V.munition, munition); add(shot, V.participant, munition); add(shot, V.participant, launcher);
      if (state.config.salvo) add(shot, V.occurrentPartOf, salvo);
      const ship = incoming ? me.ships.find(s => s.cells.includes(report.coordinate)) : null;
      const segment = ship?.segments.find(s => s.cellIri === cell.iri);
      if (segment) {
        hit.add(segment.iri); add(shot, V.struckShip, ship.iri); add(shot, V.struckSegment, segment.iri); add(shot, V.participant, ship.iri); add(shot, V.participant, segment.iri);
        const damage = shot + '/damage'; type(damage, V.damage); add(damage, V.participant, segment.iri); add(damage, V.causedBy, shot); add(segment.iri, V.damageStasis, damage);
        const stasis = shot + '/mission-stasis'; type(stasis, MW + (report.type === 'Sunk' ? 'SunkStasis' : 'PartiallyCapableStasis'));
        add(stasis, V.participant, ship.iri); add(stasis, V.forMission, MW + 'DefendFleetMission'); add(stasis, V.causedBy, shot); set(ship.iri, V.missionStasis, stasis);
      } else if (cell.obstacle) add(shot, V.participant, cell.terrainIri);
      type(shot, MW + ({ Hit: 'HitShot', Sunk: 'SinkingShot', Miss: 'MissShot', Blocked: 'BlockedShot', GlancingMiss: 'GlancingMissShot' }[report.type]));
      type(result, MW + 'AttackResult'); type(result, MW + report.type + 'Result'); add(result, V.about, cell.iri); add(result, V.about, shot);
      if (!incoming && report.type === 'Sunk') {
        // A verbally reported vessel is individuated without inventing its class,
        // length, full footprint, or membership links to other earlier hit reports.
        const reportedShip = shot + '/reported-warship', stasis = shot + '/reported-non-mission-capable';
        type(reportedShip, MW + 'Warship'); add(reportedShip, V.controller, other.iri);
        add(shot, V.struckShip, reportedShip); add(shot, V.participant, reportedShip);
        type(stasis, MW + 'SunkStasis'); add(stasis, V.participant, reportedShip); add(stasis, V.causedBy, shot); add(stasis, V.forMission, MW + 'DefendFleetMission'); add(reportedShip, V.missionStasis, stasis);
      }
      add(instance(`grid-${me.index + 1}-${incoming ? 'PrimaryGrid' : 'TargetingGrid'}`), V.observation, result);
      const disclosure = result + '/disclosure'; type(disclosure, HI + 'DisclosureEvent'); add(disclosure, V.agent, defender.iri); add(disclosure, HI + 'discloses', result); add(disclosure, HI + 'hasRecipient', attacker.iri);
    }
    const projected = projectMaritime(next);
    const won = !incoming && projected.players.find(p => p.iri === me.iri).outgoing.filter(r => r.type === 'Sunk').length === state.config.fleet.length;
    const lost = incoming && me.ships.every(ship => ship.segments.every(seg => hit.has(seg.iri)));
    if (won || lost) { set(SESSION, V.phase, phaseIri('complete')); remove(SESSION, V.current); add(SESSION, V.winner, won ? me.iri : other.iri); }
    else set(SESSION, V.current, defender.iri);
  }
  return difference(store, next);
}
export function difference(before, after) {
  const old = new Map([...before].map(q => [quadKey(q), q])), current = new Map([...after].map(q => [quadKey(q), q]));
  return { additions: [...current].filter(([key]) => !old.has(key)).map(([, q]) => q), removals: [...old].filter(([key]) => !current.has(key)).map(([, q]) => q) };
}
export function validateMaritime(store) {
  const findings = [], report = message => findings.push({ message });
  try {
    const state = projectMaritime(store), ix = state.index, me = state.players.find(p => p.iri === state.localPlayerIri), other = state.players.find(p => p.iri !== state.localPlayerIri);
    normalizeConfig({ ...state.config, names: state.players.map(p => p.name) });
    if (!me || !other || state.players.length !== 2 || !['placement', 'combat', 'complete', 'ended'].includes(state.phase)) return [{ message: 'Invalid local player, match phase or player inventory.' }];
    if ([...store].some(q => q.graph?.termType !== 'DefaultGraph')) report('Only ordinary default-graph RDF is supported.');
    if (other.ships.length) report('A local journal must not contain the opponent fleet.');
    const localShips = new Set(me.ships.map(ship => ship.iri)), localSegments = new Set(me.ships.flatMap(ship => ship.segments.map(segment => segment.iri)));
    const disclosedSunkShips = new Set(me.outgoing.filter(result => result.type === 'Sunk').map(result => ix.one(result.shotIri, V.struckShip)));
    if (ix.ofType(MW + 'ShipSegment').some(id => !localSegments.has(id)) || ix.ofType(MW + 'Warship').some(id => !localShips.has(id) && (!disclosedSunkShips.has(id) || ix.values(id, V.location).length))) report('Undisclosed opposing segments or placements cannot be present in a local journal.');
    if (ix.values(SESSION, V.localPlayer).length !== 1 || ix.values(SESSION, V.phase).length !== 1) report('Exactly one local identity and phase are required.');
    if (!state.complete && (ix.values(SESSION, V.current).length !== 1 || !state.players.some(p => p.iri === state.currentPlayerIri))) report('A valid active attacker is required.');
    if (me.ships.map(s => s.type).sort().join(',') !== [...state.config.fleet].sort().join(',')) report('Local fleet inventory does not match the configuration.');
    const occupied = new Set();
    for (const ship of me.ships) {
      if (ship.length !== SHIPS[ship.type]?.length || ship.cells.length && !ship.placed) report('Ship segment inventory is invalid.');
      if (ship.placed) {
        if (!legalPlacements(ship.length, me.obstacles, state.config, occupied).some(p => p.cells.join(',') === ship.cells.join(','))) report('Ship placement violates topology, bounds, overlap or clearance.');
        ship.cells.forEach(c => occupied.add(c));
      }
      for (const segment of ship.segments) {
        if (ix.values(segment.iri, V.location).length > 1 || ix.values(segment.iri, V.partOf).length !== 1 || ix.values(segment.iri, V.damageStasis).length > 1) report('Invalid segment location, parthood or damage cardinality.');
        if (segment.damaged) { const damage = ix.one(segment.iri, V.damageStasis), cause = ix.one(damage, V.causedBy); if (!ix.values(damage, V.type).includes(V.damage) || ix.one(damage, V.participant) !== segment.iri || ix.one(cause, V.struckSegment) !== segment.iri) report('Damage needs a matching recorded incoming hit.'); }
      }
      const stases = ix.values(ship.iri, V.missionStasis), expected = MW + (ship.sunk ? 'SunkStasis' : ship.hits ? 'PartiallyCapableStasis' : 'FullyCapableStasis');
      if (stases.length !== 1 || !ix.values(stases[0], V.type).includes(expected)) report('Mission stasis disagrees with known local damage.');
    }
    if (['combat', 'complete'].includes(state.phase) && me.ships.some(s => !s.placed)) report('Deploy every local vessel before combat.');
    for (const player of state.players) {
      if (!player.areaIri || player.obstacles.length !== state.config.obstacles * 3) report('Terrain does not match the setup.');
      for (const cell of player.cells.values()) {
        const id = ix.one(cell.iri, V.coordinate);
        if (!ix.values(cell.iri, V.type).includes(V.region) || ix.values(cell.iri, V.boundary).length !== 1 || ix.one(id, V.value) !== cell.coordinate || ix.one(id, V.designates) !== cell.iri || ix.one(cell.iri, V.partOf) !== player.areaIri) report('Region, terrain or coordinate identity is invalid.');
      }
    }
    const entropy = state.players.map(p => placementEntropy(p.obstacles, state.config));
    if (!entropy.every(e => e > 0) || Math.abs(entropy[0] - entropy[1]) / Math.max(...entropy) > .03) report('Terrain is not fair.');
    if (new Set(state.results.map(r => r.cellIri)).size !== state.results.length) report('An attack coordinate was recorded twice.');
    for (const result of state.results) {
      const shot = result.shotIri, incoming = result.attackerIri !== me.iri, ship = ix.one(shot, V.struckShip), segment = ix.one(shot, V.struckSegment);
      if (!['Miss', 'Hit', 'Sunk', 'Blocked', 'GlancingMiss'].includes(result.type) || !ix.values(shot, V.type).includes(V.shot) || ix.one(shot, V.occursIn) !== result.cellIri || !ix.one(shot, V.munition)) report('Invalid report or represented weapon-use act.');
      if (incoming && ['Hit', 'Sunk'].includes(result.type) && (!ship || !segment || ix.one(segment, V.location) !== result.cellIri || ix.one(segment, V.partOf) !== ship)) report('Incoming hits must identify a local ship segment at the coordinate.');
      if (!incoming && (segment || (ship && result.type !== 'Sunk'))) report('Opponent segments or ship identity cannot be invented from verbal feedback.');
      if (!incoming && result.type === 'Sunk' && (!ship || !ix.values(ix.one(ship, V.missionStasis), V.type).includes(MW + 'SunkStasis'))) report('A reported sinking needs a participating warship in a non-mission capable stasis.');
      if (!['Hit', 'Sunk'].includes(result.type) && (ship || segment)) report('A miss cannot strike a ship segment.');
    }
    const sunk = me.outgoing.filter(r => r.type === 'Sunk');
    if (me.outgoing.filter(r => ['Hit', 'Sunk'].includes(r.type)).length > state.config.fleet.reduce((sum, type) => sum + SHIPS[type].length, 0)) report('Recorded hits exceed the opposing fleet inventory.');
    const minimumSegments = state.config.fleet.map(type => SHIPS[type].length).sort((a,b) => a-b).slice(0, sunk.length).reduce((sum, n) => sum+n, 0);
    if (sunk.length > state.config.fleet.length || minimumSegments > me.outgoing.filter(r => ['Hit', 'Sunk'].includes(r.type)).length) report('Reported sinking requires sufficient recorded hits and remaining vessels.');
    if (state.phase === 'complete' && (!state.winnerIri || ix.values(SESSION, V.current).length || (state.winnerIri === me.iri ? sunk.length !== state.config.fleet.length : me.intact !== 0))) report('The declared result is not supported by the local record.');
    if (state.ended && (state.winnerIri || ix.values(SESSION, V.current).length)) report('An ended engagement has no winner or current player.');
    if (!state.complete && state.winnerIri) report('An active journal cannot have a winner.');
  } catch (error) { report('Invalid Maritime state: ' + error.message); }
  return findings;
}
