import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaritimeGame, validateMaritime } from '../model/game.js';
import { SHIPS, normalizeConfig, coordinate } from '../game-config.js';
import { createSetup, decodeSetup, boardSeed, inviteUrl, formatCode } from '../network.js';
import { generateBoardPair, legalPlacements, placementEntropy } from '../rules/board.js';
import { RandomEngine } from '../../packages/game-mechanics/src/random-engine.js';
import { localSave, parseLocalSave } from '../storage.js';
import { MW, V, playerIri } from '../model/vocabulary.js';
import { canonicalizeQuads } from '../../packages/game-mechanics/src/hidden-information/rdf-capsule.js';
const fleet = ['Battleship', 'Cruiser', 'Submarine', 'Destroyer'];
async function fixture(input = {}, index = 0) {
  const setup = await createSetup({ fleet, ...input }, 'atlantic');
  const game = createMaritimeGame(setup.config, { boardSeed: boardSeed(setup), localIndex: index, placementSeed: 'private-' + index });
  return { setup, game };
}
const me = game => game.state().players.find(p => p.iri === game.state().localPlayerIri);
const other = game => game.state().players.find(p => p.iri !== game.state().localPlayerIri);
async function deploy(game) { assert.equal((await game.act('autoPlace')).ok, true); assert.equal((await game.act('lockFleet')).ok, true); }
const record = (game, direction, reports) => game.act('recordReport', { direction, reports });
function truthfulReport(defender, targets) {
  const state = defender.state(), own = me(defender), hit = new Set(own.ships.flatMap(s => s.segments.filter(s => s.damaged).map(s => s.iri)));
  return [...targets].sort((a,b) => a.localeCompare(b, undefined, {numeric:true})).map(coordinate => {
    const cell = own.cells.get(coordinate), ship = own.ships.find(s => s.cells.includes(coordinate));
    let type = cell.obstacle ? state.config.climate === 'ARCTIC' ? 'GlancingMiss' : 'Blocked' : ship ? 'Hit' : 'Miss';
    if (ship) { hit.add(ship.segments.find(s => s.cellIri === cell.iri).iri); if (ship.segments.every(s => hit.has(s.iri))) type = 'Sunk'; }
    return { coordinate, type };
  });
}
test('setup code reconstructs public rules and terrain through manual code or invitation', async () => {
  const { setup } = await fixture({ rows: 8, columns: 9, climate: 'ARCTIC', obstacles: 4, salvo: true });
  for (const input of [formatCode(setup.code).toLowerCase(), inviteUrl(setup.code, 'https://example.test/subpath/warship/')]) {
    const decoded = await decodeSetup(input); assert.deepEqual(decoded, setup);
  }
  const changed = setup.code.slice(0, 9) + (setup.code[9] === '2' ? '3' : '2') + setup.code.slice(10);
  await assert.rejects(decodeSetup(changed)); await assert.rejects(decodeSetup('ABC123'));
  assert.ok(setup.code.length <= 53);
});
test('only supported two-device manual-play configuration is accepted', () => {
  for (const input of [{ mode: 'PASS_AND_PLAY' }, { mode: 'AUTOMATIC' }, { rows: 7 }, { columns: 27 }, { obstacles: 5 }, { fleet: ['Carrier'] }, { names: ['A', 'a'] }, { fleet, budget: 8 }]) assert.throws(() => normalizeConfig(input));
});
test('each device holds only its own fleet with an independent placement random source', async () => {
  const { game: creator, setup } = await fixture();
  const joiner = createMaritimeGame(setup.config, { boardSeed: boardSeed(setup), localIndex: 1, placementSeed: 'different-private-seed' });
  assert.equal(me(creator).ships.length, 4); assert.equal(other(creator).ships.length, 0);
  assert.equal(me(joiner).ships.length, 4); assert.equal(other(joiner).ships.length, 0);
  assert.notEqual(creator.snapshot().rngState, joiner.snapshot().rngState);
  assert.deepEqual(creator.state().players.map(p => p.obstacles), joiner.state().players.map(p => p.obstacles));
  await deploy(creator); await deploy(joiner);
  const code = await decodeSetup(setup.code); assert.ok(!Object.hasOwn(code, 'quads')); assert.ok(!Object.hasOwn(code, 'rngState'));
  assert.ok([...creator.engine.store].every(q => !q.subject.value.includes('ship-2-')));
  assert.ok([...joiner.engine.store].every(q => !q.subject.value.includes('ship-1-')));
});
test('warm and Arctic terrain preserve exact displacement and legal placement entropy', () => {
  for (const climate of ['WARM_WATER', 'ARCTIC']) {
    const config = normalizeConfig({ rows: 8, columns: 9, obstacles: 4, climate, fleet });
    const pair = generateBoardPair(config, new RandomEngine('fair'));
    assert.equal(pair.obstacles[0].length, 12); assert.equal(pair.obstacles[1].length, 12);
    assert.equal(placementEntropy(pair.obstacles[0], config), placementEntropy(pair.obstacles[1], config));
    assert.deepEqual(pair, generateBoardPair(config, new RandomEngine('fair')));
  }
});
test('coastal exclusions apply to heavy tropical vessels only', () => {
  const config = normalizeConfig({ fleet });
  assert.equal(legalPlacements(4, ['B2'], config).some(p => p.start === 'A1' && p.orientation === 'H'), false);
  assert.equal(legalPlacements(4, ['B2'], { ...config, climate: 'ARCTIC' }).some(p => p.start === 'A1' && p.orientation === 'H'), true);
  assert.equal(legalPlacements(2, ['B2'], config).some(p => p.start === 'A1' && p.orientation === 'H'), true);
});
test('manual placement rejects overlap and out-of-bounds without mutating RDF or RNG', async () => {
  const { game } = await fixture(), ships = me(game).ships, before = JSON.stringify(game.snapshot());
  assert.equal((await game.act('placeShip', { shipIri: ships[0].iri, start: 'J10', orientation: 'H' })).ok, false);
  assert.equal((await game.act('lockFleet')).ok, false); assert.equal(JSON.stringify(game.snapshot()), before);
  assert.equal((await game.act('placeShip', { shipIri: ships[0].iri, start: 'A1', orientation: 'H' })).ok, true);
  assert.equal((await game.act('placeShip', { shipIri: ships[1].iri, start: 'A1', orientation: 'V' })).ok, false);
  await game.act('clearPlacement'); assert.ok(me(game).ships.every(s => !s.placed));
});
test('automatic firing is absent; explicit reports are required and stay local', async () => {
  const { game } = await fixture(); await deploy(game);
  assert.equal((await game.act('fire', { targets: ['A1'] })).ok, false);
  assert.equal((await record(game, 'outgoing', [{ coordinate: 'A1' }])).ok, false);
  assert.equal(game.state().results.length, 0);
  assert.equal((await record(game, 'outgoing', [{ coordinate: 'A1', type: 'Hit' }])).ok, true);
  assert.equal(game.state().results[0].type, 'Hit'); assert.equal(other(game).ships.length, 0);
  assert.equal(game.state().index.values(game.state().results[0].shotIri, V.struckSegment).length, 0);
});
test('a journal accepts only the local player and alternates outgoing/incoming verbal reports', async () => {
  const { game } = await fixture(); await deploy(game);
  const before = JSON.stringify(game.snapshot());
  assert.equal((await record(game, 'incoming', [{ coordinate: 'A1', type: 'Miss' }])).ok, false);
  assert.equal((await game.act('recordReport', { direction: 'outgoing', reports: [{ coordinate: 'A1', type: 'Miss' }] }, playerIri(1))).ok, false);
  assert.equal(JSON.stringify(game.snapshot()), before);
  await record(game, 'outgoing', [{ coordinate: 'A1', type: 'Miss' }]);
  assert.equal(game.state().currentPlayerIri, playerIri(1));
  const target = [...me(game).cells.keys()].find(c => !me(game).ships.some(s => s.cells.includes(c)));
  assert.equal((await record(game, 'incoming', [{ coordinate: target, type: 'Miss' }])).ok, true);
  assert.equal(game.state().currentPlayerIri, playerIri(0));
});
test('incoming reports are manually supplied and consistency checked without replacement outcomes', async () => {
  const { game } = await fixture({}, 1); await deploy(game);
  const ship = me(game).ships[0], target = ship.cells[0], before = JSON.stringify(game.snapshot());
  assert.equal((await record(game, 'incoming', [{ coordinate: target, type: 'Miss' }])).ok, false);
  assert.equal(JSON.stringify(game.snapshot()), before);
  assert.equal((await record(game, 'incoming', [{ coordinate: target, type: 'Hit' }])).ok, true);
  const result = game.state().results[0], ix = game.state().index;
  assert.equal(ix.one(result.shotIri, V.struckShip), ship.iri); assert.ok(ix.one(result.shotIri, V.munition));
  assert.equal(me(game).ships[0].hits, 1); assert.ok([...game.engine.store].some(q => q.object.value === V.damage));
  assert.deepEqual(validateMaritime(game.engine.store), []);
});
test('salvo requires complete explicit, unique, unresolved coordinate reports and commits atomically', async () => {
  const { game } = await fixture({ salvo: true }); await deploy(game);
  const before = JSON.stringify(game.snapshot());
  for (const reports of [[], [{ coordinate: 'A1', type: 'Miss' }, { coordinate: 'A1', type: 'Hit' }], [{ coordinate: 'Z26', type: 'Miss' }], [{ coordinate: 'A1', type: 'Miss' }, { coordinate: 'A2' }], Array.from({length:6},(_,i)=>({coordinate:'A'+(i+1),type:'Miss'}))]) {
    assert.equal((await record(game, 'outgoing', reports)).ok, false); assert.equal(JSON.stringify(game.snapshot()), before);
  }
  assert.equal((await record(game, 'outgoing', [{ coordinate: 'A1', type: 'Hit' }, { coordinate: 'A2', type: 'Sunk' }])).ok, true);
  assert.equal(game.state().results.length, 2); assert.equal(game.state().results[1].type, 'Sunk');
});
test('Sunk needs no vessel class and denotes a participating non-mission capable warship', async () => {
  const { game } = await fixture({ salvo: true }); await deploy(game);
  await record(game, 'outgoing', [{ coordinate: 'A1', type: 'Hit' }, { coordinate: 'A2', type: 'Sunk' }]);
  const state = game.state(), ix = state.index, sunk = state.results.find(r => r.type === 'Sunk'), ship = ix.one(sunk.shotIri, V.struckShip);
  assert.ok(ship); assert.ok(ix.values(sunk.shotIri, V.participant).includes(ship));
  assert.deepEqual(ix.values(ship, V.type), [MW + 'Warship']);
  assert.ok(ix.values(ix.one(ship, V.missionStasis), V.type).includes(MW + 'SunkStasis'));
  assert.equal(ix.values(ship, V.location).length, 0);
});
test('manual terrain reports distinguish tropical blocks from Arctic glancing misses', async () => {
  for (const climate of ['WARM_WATER','ARCTIC']) {
    const { game } = await fixture({ climate, obstacles: 2 }); await deploy(game);
    const target = other(game).obstacles[0];
    assert.equal((await record(game, 'outgoing', [{ coordinate: target, type: 'Hit' }])).ok, false);
    assert.equal((await record(game, 'outgoing', [{ coordinate: target, type: climate === 'ARCTIC' ? 'GlancingMiss' : 'Blocked' }])).ok, true);
    assert.equal(game.state().index.values(game.state().results[0].shotIri, V.struckShip).length, 0);
  }
});
test('two independent journals reach victory/defeat only by manually recording verbal reports', async () => {
  const { game: first, setup } = await fixture({ salvo: true });
  const second = createMaritimeGame(setup.config, { boardSeed: boardSeed(setup), localIndex: 1, placementSeed: 'second' });
  await deploy(first); await deploy(second);
  const winning = me(second).ships.flatMap(s => s.cells), own = new Set(me(first).ships.flatMap(s=>s.cells));
  const harmless = [...me(first).cells.keys()].filter(c=>!own.has(c));
  while (winning.length) {
    const reports = truthfulReport(second, winning.splice(0,5)), untouched = JSON.stringify(second.snapshot());
    assert.equal((await record(first, 'outgoing', reports)).ok, true);
    assert.equal(JSON.stringify(second.snapshot()), untouched, 'No runtime cross-device state mutation');
    assert.equal((await record(second, 'incoming', reports)).ok, true);
    if (!first.state().complete) {
      const replies = [{ coordinate: harmless.shift(), type: 'Miss' }];
      assert.equal((await record(second, 'outgoing', replies)).ok, true); assert.equal((await record(first, 'incoming', replies)).ok, true);
    }
  }
  assert.equal(first.state().winnerIri, playerIri(0)); assert.equal(second.state().winnerIri, playerIri(0));
  assert.equal(first.state().complete, true); assert.equal(second.state().complete, true);
  assert.equal(me(second).intact, 0); assert.equal(other(first).ships.length, 0);
  assert.equal((await record(first, 'outgoing', [{coordinate:'J10',type:'Miss'}])).ok, false);
});
test('local save restores canonical RDF, transactions and private RNG; obsolete host saves are rejected', async () => {
  const { game, setup } = await fixture(); await deploy(game); await record(game, 'outgoing', [{ coordinate:'A1',type:'Hit' }]);
  const value = JSON.parse(JSON.stringify(localSave(game,setup))), restored = await parseLocalSave(value);
  assert.equal(canonicalizeQuads(restored.game.snapshot().quads), canonicalizeQuads(game.snapshot().quads));
  assert.equal(restored.game.snapshot().rngState,game.snapshot().rngState);
  assert.equal(JSON.stringify(restored.game.snapshot().transactions),JSON.stringify(game.snapshot().transactions));
  await assert.rejects(parseLocalSave({...value,version:1,audience:'host'}));
  const bad=structuredClone(value);bad.quads.find(q=>q.predicate.value===V.value && q.object.value==='A1').object.value='A2';await assert.rejects(parseLocalSave(bad));
  const named=structuredClone(value);named.transactions[0].delta.additions[0].graph.termType='NamedNode';await assert.rejects(parseLocalSave(named));
});
test('largest Arctic board, seven-vessel setup and local inventory round-trip', async () => {
  const { game,setup } = await fixture({ rows:26,columns:26,climate:'ARCTIC',obstacles:4,fleet:['Carrier','Battleship','Cruiser','Submarine','Destroyer','Battleship','Carrier'] });
  await deploy(game);const restored=await parseLocalSave(JSON.parse(JSON.stringify(localSave(game,setup))));
  assert.equal(me(restored.game).ships.length,7);assert.equal(other(restored.game).ships.length,0);assert.equal(restored.game.state().config.rows,26);
});
