import test from 'node:test';
import assert from 'node:assert/strict';
import { createButlerGame, restoreButlerGame, serializeHostGame } from '../model/butler-game.js';
import { CARDS, ROOMS, SUSPECTS, WEAPONS } from '../game-config.js';
import { readInvitationUrl, importSymmetricKey, openEncryptedRdfCapsule } from '../../packages/game-mechanics/src/index.js';

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

test('player invitation ciphertext contains no card labels and opens only that hand', async () => {
  const game = await createButlerGame({ names, mode: 'host', seed: 'capsule' });
  const [invite] = await game.invitations('https://example.test/player/');
  const payload = readInvitationUrl(invite.url);
  const serialized = JSON.stringify(payload.capsule);
  for (const card of CARDS) assert.equal(serialized.includes(card.label), false);
  const opened = await openEncryptedRdfCapsule(payload.capsule, await importSymmetricKey(payload.key));
  const expected = game.state().players[0].hand.map((card) => card.id);
  const actual = opened.privateQuads.filter((row) => row.predicate.value.endsWith('memberOf')).map((row) => row.subject.value.split('card-')[1]);
  assert.deepEqual(actual.sort(), expected.sort());
});

test('host save round-trips RDF state and deterministic random state', async () => {
  const game = await createButlerGame({ names, seed: 'restore' });
  game.act('roll');
  const restored = restoreButlerGame(serializeHostGame(game));
  assert.deepEqual(restored.state(), game.state());
});
