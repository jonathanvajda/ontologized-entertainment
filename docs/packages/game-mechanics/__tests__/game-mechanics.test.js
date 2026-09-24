import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RdfStore, RandomEngine, RuleRegistry, Validator, TransactionLog, TurnEngine, ScoreEngine,
  namedNode, quad, createGameEngine, createProjection, createSavePackage, importSaveJson,
  exportSaveJson, SAVE_FORMAT_VERSION
} from '../src/index.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const LOCATED = 'urn:game:locatedIn';
const ADJACENT = 'urn:game:adjacentTo';
const PIECE = namedNode('urn:piece:1');
const A = namedNode('urn:place:a');
const B = namedNode('urn:place:b');
const location = (place) => quad(PIECE, namedNode(LOCATED), place);

test('RDF store clones and applies an atomic legal transition', async () => {
  const store = new RdfStore([location(A), quad(A, namedNode(ADJACENT), B)]);
  const rules = new RuleRegistry().registerAction('move', {
    preconditions: [({ action, store: current }) => current.has(location(namedNode(action.parameters.from)))],
    effects: ({ action }) => ({
      removals: [location(namedNode(action.parameters.from))],
      additions: [location(namedNode(action.targetIri))]
    })
  });
  const validator = new Validator([
    (candidate) => candidate.getQuads(PIECE, namedNode(LOCATED), null, null).length > 1
      ? { message: 'Piece has multiple locations.' } : null
  ]);
  const engine = createGameEngine({ store, rules, validator, seed: 42, vocabulary: { locatedIn: LOCATED, adjacentTo: ADJACENT } });
  const result = await engine.actions.propose({ actionType: 'move', actorIri: 'urn:player:1', targetIri: B.value, parameters: { from: A.value } });
  assert.equal(result.ok, true);
  assert.equal(store.has(location(A)), false);
  assert.equal(store.has(location(B)), true);
  assert.equal(engine.transactions.entries().length, 1);
  assert.deepEqual(engine.getOperationalState().piecesByLocation.get(B.value), [PIECE.value]);
});

test('illegal and invalid actions do not mutate canonical state', async () => {
  const store = new RdfStore([location(A)]);
  const rules = new RuleRegistry()
    .registerAction('blocked', { preconditions: [() => false], effects: () => ({ removals: [location(A)] }) })
    .registerAction('duplicate', { effects: () => ({ additions: [location(B)] }) });
  const validator = new Validator([(candidate) => candidate.getQuads(PIECE, namedNode(LOCATED), null, null).length > 1 ? { message: 'Too many.' } : null]);
  const engine = createGameEngine({ store, rules, validator, seed: 7 });
  assert.equal((await engine.actions.propose({ actionType: 'blocked' })).code, 'ILLEGAL_ACTION');
  assert.equal((await engine.actions.propose({ actionType: 'duplicate' })).code, 'INVALID_STATE');
  assert.deepEqual(store.getQuads(), [location(A)]);
  assert.equal(engine.transactions.entries().length, 0);
});

test('transaction history supports undo, redo, and replay', () => {
  const initial = new RdfStore([location(A)]);
  const log = new TransactionLog();
  log.append({ id: 'tx-1', delta: { removals: [location(A)], additions: [location(B)] } });
  const replayed = log.replay(new RdfStore([location(A)]));
  assert.equal(replayed.has(location(B)), true);
  assert.equal(log.undo(replayed).ok, true);
  assert.equal(replayed.has(location(A)), true);
  assert.equal(log.redo(replayed).ok, true);
  assert.equal(replayed.has(location(B)), true);
  assert.equal(initial.has(location(A)), true);
});

test('seeded randomization is reproducible and finite draws do not duplicate', () => {
  const first = new RandomEngine('repeatable');
  const second = new RandomEngine('repeatable');
  assert.deepEqual(Array.from({ length: 10 }, () => first.rollDie(6)), Array.from({ length: 10 }, () => second.rollDie(6)));
  const pool = ['a', 'b', 'c', 'd'];
  const draw = first.drawMany(pool, 4);
  assert.equal(new Set(draw).size, 4);
  assert.throws(() => first.drawMany(pool, 5), /exceeds/);
});

test('projection makes semantic topology symmetric without changing RDF', () => {
  const store = new RdfStore([
    quad(A, namedNode(RDF_TYPE), namedNode('urn:type:Territory')),
    quad(A, namedNode(ADJACENT), B)
  ]);
  const projection = createProjection(store, { adjacentTo: ADJACENT });
  assert.deepEqual(projection.adjacencyByTerritory.get(A.value), [B.value]);
  assert.deepEqual(projection.adjacencyByTerritory.get(B.value), [A.value]);
  assert.equal(store.size, 2);
});

test('turns, phases, rounds, scoring, and ranking are game-configurable', () => {
  const turns = new TurnEngine({ players: ['p1', 'p2'], phases: ['act', 'cleanup'] });
  assert.equal(turns.canAct('p2').code, 'NOT_CURRENT_PLAYER');
  assert.equal(turns.nextPhase().phase, 'cleanup');
  assert.deepEqual(turns.nextPhase(), { currentPlayerIri: 'p2', phase: 'act', round: 1, turn: 2 });
  turns.nextPhase(); turns.nextPhase();
  assert.equal(turns.snapshot().round, 2);
  const scores = new ScoreEngine([() => ({ p1: 3, p2: 5 }), () => new Map([['p1', 4]])]).calculate({});
  assert.deepEqual([...scores], [['p1', 7], ['p2', 5]]);
  assert.equal(new ScoreEngine().rank(scores)[0][0], 'p1');
});

test('save packages are versioned, portable, and reject malformed imports', () => {
  const save = createSavePackage({ game: { id: 'test', version: '1' }, schemaVersion: '1', state: '<a> <b> <c>.', now: () => '2026-09-24T00:00:00.000Z' });
  assert.equal(save.manifest.saveFormatVersion, SAVE_FORMAT_VERSION);
  assert.equal(importSaveJson(exportSaveJson(save), { gameId: 'test' }).ok, true);
  assert.equal(importSaveJson('{oops').code, 'MALFORMED_SAVE');
  assert.equal(importSaveJson(JSON.stringify(save), { gameId: 'other' }).code, 'WRONG_GAME');
});
