import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCategory, calculateTotals, rankPlayers, solitaireBand } from '../rules/scoring.js';
import { createPokerDiceGame, parseSnapshot, serializeSnapshot } from '../model/poker-dice-model.js';

test('all standard scoring categories follow the specification', () => {
  assert.equal(scoreCategory('sixes', [6, 6, 6, 2, 1]), 18);
  assert.equal(scoreCategory('three-kind', [4, 4, 4, 2, 6]), 20);
  assert.equal(scoreCategory('four-kind', [5, 5, 5, 5, 2]), 22);
  assert.equal(scoreCategory('full-house', [3, 3, 3, 6, 6]), 25);
  assert.equal(scoreCategory('full-house', [3, 3, 3, 3, 3]), 0);
  assert.equal(scoreCategory('small-straight', [1, 2, 3, 4, 4]), 30);
  assert.equal(scoreCategory('large-straight', [1, 2, 3, 4, 5]), 40);
  assert.equal(scoreCategory('large-straight', [2, 3, 4, 5, 6]), 40);
  assert.equal(scoreCategory('five-kind', [6, 6, 6, 6, 6]), 50);
  assert.equal(scoreCategory('choice', [1, 2, 3, 4, 6]), 16);
});

test('upper bonus applies at and above 63 only', () => {
  assert.equal(calculateTotals({ sixes: 30, fives: 25, fours: 7 }).bonus, 0);
  assert.equal(calculateTotals({ sixes: 30, fives: 25, fours: 8 }).bonus, 35);
  assert.equal(calculateTotals({ sixes: 30, fives: 25, fours: 9 }).bonus, 35);
});

test('seeded rolls reproduce and held dice survive rerolls', async () => {
  const first = createPokerDiceGame({ names: ['A'], seed: 'same' }); const second = createPokerDiceGame({ names: ['A'], seed: 'same' });
  assert.equal((await first.act('rollDice')).ok, true); assert.equal((await second.act('rollDice')).ok, true);
  assert.deepEqual(first.state().dice.map((d) => d.value), second.state().dice.map((d) => d.value));
  const held = first.state().dice[0]; await first.act('toggleHold', { dieIri: held.iri }); await first.act('rollDice');
  assert.equal(first.state().dice[0].value, held.value); assert.equal(first.state().rollCount, 2);
});

test('third roll forces score and a category cannot be overwritten', async () => {
  const game = createPokerDiceGame({ names: ['A'], seed: 5 });
  await game.act('rollDice'); await game.act('rollDice'); await game.act('rollDice');
  assert.deepEqual(game.state().legalActions, ['commitScore']);
  assert.equal((await game.act('commitScore', { categoryId: 'ones' })).ok, true);
  await game.act('rollDice');
  assert.equal((await game.act('commitScore', { categoryId: 'ones' })).ok, false);
});

test('save snapshots restore semantic and random state', async () => {
  const game = createPokerDiceGame({ names: ['A', 'B'], seed: 'restore' }); await game.act('rollDice');
  const restored = parseSnapshot(serializeSnapshot(game));
  assert.deepEqual(restored.state(), game.state()); assert.equal(restored.engine.random.getState(), game.engine.random.getState());
});

test('undo and redo restore both RDF and RNG state', async () => {
  const game = createPokerDiceGame({ names: ['A'], seed: 'undo' }); const before = game.engine.random.getState();
  await game.act('rollDice'); const rolled = game.state().dice.map((die) => die.value); const after = game.engine.random.getState();
  assert.notEqual(after, before); assert.equal(game.engine.undo().ok, true); assert.equal(game.engine.random.getState(), before);
  assert.equal(game.engine.redo().ok, true); assert.equal(game.engine.random.getState(), after); assert.deepEqual(game.state().dice.map((die) => die.value), rolled);
});

test('ranking shares exact ties and solitaire bands are stable', () => {
  const ranked = rankPlayers([{ name: 'A', scores: { choice: 20 } }, { name: 'B', scores: { choice: 20 } }]);
  assert.deepEqual(ranked.map((p) => p.rank), [1, 1]); assert.equal(solitaireBand(299), 'Expert'); assert.equal(solitaireBand(300), 'Master');
});

test('multiplayer advances in fixed order and completes only when every card is full', async () => {
  const game = createPokerDiceGame({ names: ['A', 'B'], seed: 17 });
  const categories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three-kind', 'four-kind', 'full-house', 'small-straight', 'large-straight', 'five-kind', 'choice'];
  for (let round = 0; round < categories.length; round += 1) {
    for (let player = 0; player < 2; player += 1) {
      assert.equal(game.state().currentPlayerIndex, player); await game.act('rollDice'); await game.act('commitScore', { categoryId: categories[round] });
    }
    assert.equal(game.state().complete, round === categories.length - 1);
  }
  assert.equal(game.state().ranking.length, 2);
});

test('illegal actions preserve RNG and canonical RDF', async () => {
  const game = createPokerDiceGame({ names: ['A'], seed: 21 }); const rng = game.engine.random.getState(); const size = game.engine.store.size;
  const result = await game.act('commitScore', { categoryId: 'ones' });
  assert.equal(result.ok, false); assert.equal(game.engine.random.getState(), rng); assert.equal(game.engine.store.size, size);
});
