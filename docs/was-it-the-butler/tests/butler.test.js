import test from 'node:test';
import assert from 'node:assert/strict';
import { createButlerGame, restoreButlerGame, serializeHostGame } from '../model/butler-game.js';
import { CARDS, ROOMS, SUSPECTS, WEAPONS } from '../game-config.js';
import { openHandCode } from '../model/compact-hand-code.js';

const names = ['Ada', 'Bert', 'Cy'];

test('deal creates one three-card solution and distributes every other card once', async () => {
  const game = await createButlerGame({ names, seed: 'deal-fixture' });
  const state = game.state();
  const dealt = state.players.flatMap((player) => player.hand.map((card) => card.id));
  assert.equal(game.solution.length, 3);
  assert.equal(new Set(game.solution).size, 3);
  assert.equal(SUSPECTS.some((card) => game.solution.includes(card.id)), true);
  assert.equal(WEAPONS.some((card) => game.solution.includes(card.id)), true);
  assert.equal(ROOMS.some((card) => game.solution.includes(card.id)), true);
  assert.equal(dealt.length, CARDS.length - 3);
  assert.equal(new Set([...dealt, ...game.solution]).size, CARDS.length);
});

test('seeded setup and dice sequence are deterministic', async () => {
  const left = await createButlerGame({ names, seed: 'repeatable' });
  const right = await createButlerGame({ names, seed: 'repeatable' });
  assert.deepEqual(left.solution, right.solution);
  assert.deepEqual(left.state().players.map((player) => player.hand.map((card) => card.id)), right.state().players.map((player) => player.hand.map((card) => card.id)));
  assert.deepEqual(left.act('roll').value, right.act('roll').value);
});

test('chosen suspects identify players and establish turn order', async () => {
  const tokenIds = ['peach', 'marinara', 'mint'];
  const chosenNames = ['Ms. Peach', 'Lt. Marinara', 'Mrs. Mint'];
  const game = await createButlerGame({ names: chosenNames, tokenIds, seed: 'roles' });
  assert.deepEqual(game.state().players.map((player) => player.tokenId), tokenIds);
  assert.equal(game.state().players[0].name, 'Ms. Peach');
  await assert.rejects(() => createButlerGame({ names: chosenNames, tokenIds: ['peach', 'peach', 'mint'] }));
});

test('every suspect starts in the shared Foyer and cannot suggest there', async () => {
  const game = await createButlerGame({ names, seed: 'foyer-start' });
  assert.deepEqual(new Set(Object.values(game.state().locations)), new Set(['foyer']));
  const result = game.act('suggest', { suspectId: 'mint', weaponId: 'rope' });
  assert.equal(result.ok, false);
  assert.match(result.message, /card room/i);
});

test('turn flow enforces movement, suggestion, refutation, and advancement', async () => {
  const game = await createButlerGame({ names, seed: 42 });
  assert.equal(game.act('roll').ok, true);
  assert.equal(game.act('move', { roomId: 'living-room' }).ok, true);
  assert.equal(game.state().phase, 'suggestion');
  assert.equal(game.act('suggest', { suspectId: 'mint', weaponId: 'rope' }).ok, true);
  const refutation = game.refutation();
  const result = refutation
    ? game.act('resolveRefutation', { refuterIri: refutation.player.iri, cardId: refutation.matches[0].id })
    : game.act('resolveRefutation');
  assert.equal(result.ok, true);
  assert.equal(game.act('endTurn').ok, true);
  assert.equal(game.state().currentPlayerIndex, 1);
});

test('incorrect accusers lose turns but still remain in the case data', async () => {
  const game = await createButlerGame({ names, seed: 'bad-guess' });
  const wrongSuspect = SUSPECTS.find((card) => !game.solution.includes(card.id));
  const wrongWeapon = WEAPONS.find((card) => !game.solution.includes(card.id));
  const wrongRoom = ROOMS.find((card) => !game.solution.includes(card.id));
  assert.equal(game.act('accuse', { suspectId: wrongSuspect.id, weaponId: wrongWeapon.id, roomId: wrongRoom.id }).value, false);
  assert.equal(game.state().players[0].eliminated, true);
  game.act('endTurn');
  assert.equal(game.state().currentPlayerIndex, 1);
});

test('correct accusation completes the game and verifies its commitment', async () => {
  const game = await createButlerGame({ names, seed: 'solution' });
  const suspectId = game.solution.find((id) => SUSPECTS.some((card) => card.id === id));
  const weaponId = game.solution.find((id) => WEAPONS.some((card) => card.id === id));
  const roomId = game.solution.find((id) => ROOMS.some((card) => card.id === id));
  assert.equal(game.act('accuse', { suspectId, weaponId, roomId }).value, true);
  assert.equal(game.state().complete, true);
  assert.equal(await game.verifySolution(), true);
});

test('five-letter player code reconstructs only the matching private hand', async () => {
  const game = await createButlerGame({ names, mode: 'host', seed: 'compact-code' });
  const [access] = await game.playerAccessCodes();
  assert.match(access.handCode, /^[A-Z]{5}$/);
  const opened = await openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: access.suspectId });
  assert.deepEqual(opened.map((card) => card.id).sort(), game.state().players[0].hand.map((card) => card.id).sort());
  await assert.rejects(() => openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: 'brown' }));
});

test('compact hand codes round-trip every seat for three through six players', async () => {
  for (let count = 3; count <= 6; count += 1) {
    const roster = Array.from({ length: count }, (_, index) => `Detective ${index + 1}`);
    const game = await createButlerGame({ names: roster, mode: 'host', seed: `compact-${count}` });
    const accessCodes = await game.playerAccessCodes();
    for (let index = 0; index < count; index += 1) {
      const access = accessCodes[index];
      const cards = await openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: access.suspectId });
      assert.deepEqual(cards.map((card) => card.id).sort(), game.state().players[index].hand.map((card) => card.id).sort());
    }
  }
});

test('host save round-trips RDF state and deterministic random state', async () => {
  const game = await createButlerGame({ names, seed: 'restore' });
  game.act('roll');
  const restored = restoreButlerGame(serializeHostGame(game));
  assert.deepEqual(restored.state(), game.state());
});
