import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEverythingsSusGame, restoreEverythingsSusGame, serializeHostGame } from '../model/everything-is-sus-game.js';
import { BOARD_REGIONS, CARDS, ENTRANCE_MARKERS, ROOMS, SECRET_PASSAGES, SECRET_PASSAGE_CORNERS, START_SITES, SUSPECTS, WEAPONS, boardRegionStyle } from '../game-config.js';
import { openHandCode } from '../model/compact-hand-code.js';
import { normalizeSleuthMarks, remainingSleuthCandidates } from '../model/sleuth-sheet-state.js';
import { namedNode, quad } from '../../packages/game-mechanics/src/index.js';

const names = ['Ada', 'Bert', 'Cy'];
const NS = 'https://w3id.org/ontoeagle/games/everything-is-sus/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const LOCATED_IN = 'http://purl.obolibrary.org/obo/BFO_0000171';
const DICE_ROLL = 'https://w3id.org/ontologized-entertainment/game/dice/DiceRollingAct';

function placePerson(game, suspectId, locationId) {
  const person = namedNode(NS + 'person-' + suspectId);
  game.store.removeQuads(game.store.getQuads(person, namedNode(LOCATED_IN), null, null));
  game.store.addQuad(quad(person, namedNode(LOCATED_IN), namedNode(NS + (ROOMS.some((room) => room.id === locationId) ? 'room-' : 'site-') + locationId)));
}

async function gameWithRollAtLeast(minimum, prefix = 'roll') {
  for (let index = 0; index < 100; index += 1) {
    const game = await createEverythingsSusGame({ names, seed: `${prefix}-${index}` });
    if (game.act('roll').value >= minimum) return game;
  }
  throw new Error('No suitable deterministic roll found.');
}

async function gameWithRollValue(value, prefix = 'exact-roll') {
  for (let index = 0; index < 100; index += 1) {
    const game = await createEverythingsSusGame({ names, seed: `${prefix}-${index}` });
    if (game.act('roll').value === value) return game;
  }
  throw new Error(`Could not produce roll ${value}.`);
}

test('board geometry uses the approved 26 by 18 topology without image-frame offsets', () => {
  assert.deepEqual(BOARD_REGIONS.study, { column: 1, row: 6, width: 4, height: 7 });
  assert.deepEqual(BOARD_REGIONS.ballroom, { column: 11, row: 5, width: 8, height: 9 });
  assert.deepEqual(BOARD_REGIONS['dining-room'], { column: 20, row: 10, width: 7, height: 9 });
  assert.match(boardRegionStyle('pool-room'), /--board-x:0%/);
  assert.match(boardRegionStyle('pool-room'), /--board-y:0%/);
  assert.match(boardRegionStyle('pool-room'), /--board-clip:polygon/);
  assert.equal(ROOMS.some((room) => room.id === 'study' && room.label === 'Study'), true);
  assert.equal(ROOMS.every((room) => room.boardImage && room.boardImage !== room.image), true);
});

test('every rendered door and open entryway lies on its topology boundary', () => {
  const boundaries = {
    'pool-porch-door':['x',10], 'porch-south-door':['y',3], 'ballroom-north-entry':['y',4],
    'greenhouse-hall-door':['y',3], 'greenhouse-kitchen-door':['y',3], 'study-game-door':['x',4],
    'study-living-door':['y',12], 'game-hall-door':['x',9], 'ballroom-west-entry':['x',10],
    'ballroom-east-entry':['x',18], 'kitchen-west-entry':['x',19], 'ballroom-south-entry':['y',13], 'kitchen-dining-door':['y',9],
    'living-hall-entry':['x',9], 'dining-hall-entry':['x',19]
  };
  assert.equal(ENTRANCE_MARKERS.length, Object.keys(boundaries).length);
  for (const marker of ENTRANCE_MARKERS) {
    const [axis, coordinate] = boundaries[marker.id];
    assert.equal(marker[axis], coordinate, `${marker.id} must remain on ${axis}=${coordinate}`);
    assert.ok(axis === 'x' ? marker.width < 1 : marker.height < 1, `${marker.id} must cross its boundary orthogonally`);
  }
});

test('board-only PNG proportions exactly match their topology regions', () => {
  const pngSize = (url) => { const bytes = readFileSync(url); return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }; };
  for (const room of ROOMS) {
    const image = pngSize(new URL(`../assets/art/${room.boardImage}`, import.meta.url));
    const region = BOARD_REGIONS[room.id];
    assert.equal(image.width * region.height, image.height * region.width, `${room.id} board art must match ${region.width}:${region.height}`);
  }
  const foyer = pngSize(new URL('../assets/art/foyer-board-02.png', import.meta.url));
  assert.equal(foyer.width * BOARD_REGIONS.foyer.height, foyer.height * BOARD_REGIONS.foyer.width);
});

test('secret passages occupy the four literal outer estate corners', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SECRET_PASSAGE_CORNERS).map(([room, marker]) => [room, marker.corner])), {
    'pool-room':'top-left', greenhouse:'top-right', 'living-room':'bottom-left', 'dining-room':'bottom-right'
  });
});

test('deal creates one three-card solution and distributes every other card once', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'deal-fixture' });
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

test('seeded setup, Foyer placement, and one-die sequence are deterministic', async () => {
  const left = await createEverythingsSusGame({ names, seed: 'repeatable' });
  const right = await createEverythingsSusGame({ names, seed: 'repeatable' });
  assert.deepEqual(left.solution, right.solution);
  assert.deepEqual(left.state().locations, right.state().locations);
  const leftRoll = left.act('roll').value; const rightRoll = right.act('roll').value;
  assert.equal(leftRoll, rightRoll); assert.ok(leftRoll >= 1 && leftRoll <= 6);
});

test('chosen suspects establish turn order and receive unique randomized Foyer sites', async () => {
  const tokenIds = ['peach', 'marinara', 'mint'];
  const chosenNames = ['Ms. Peach', 'Lt. Marinara', 'Mrs. Mint'];
  const game = await createEverythingsSusGame({ names: chosenNames, tokenIds, seed: 'roles' });
  const state = game.state();
  assert.deepEqual(state.players.map((player) => player.tokenId), tokenIds);
  const occupiedStarts = tokenIds.map((id) => state.locations[id]);
  assert.equal(new Set(occupiedStarts).size, 3);
  assert.equal(occupiedStarts.every((site) => START_SITES.includes(site)), true);
  assert.equal(state.locations.eggshell, 'reserve');
  await assert.rejects(() => createEverythingsSusGame({ names: chosenNames, tokenIds: ['peach', 'peach', 'mint'] }));
});

test('one-die roll and every movement step are captured in RDF while the token remains only a representation', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'movement-rdf' });
  const before = game.state(); const active = before.players[0]; const origin = before.locations[active.tokenId];
  assert.equal(game.act('roll').ok, true);
  const option = game.movementOptions().find((candidate) => candidate.available && candidate.kind === 'step');
  assert.ok(option);
  assert.equal(game.act('moveStep', { destination: option.destination }).ok, true);
  assert.equal(game.state().locations[active.tokenId], option.destination);
  assert.notEqual(game.state().locations[active.tokenId], origin);
  assert.equal(game.store.getQuads(null, namedNode(RDF_TYPE), namedNode(DICE_ROLL), null).length, 1);
  assert.equal(game.store.getQuads(namedNode(NS + 'token-' + active.tokenId), namedNode(LOCATED_IN), null, null).length, 0);
  assert.equal(game.store.getQuads(null, namedNode(RDF_TYPE), namedNode(NS + 'MovementAct'), null).length, 1);
});

test('occupied walkable sites are disabled and never traversed', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'occupied' });
  const state = game.state(); const active = state.players[0];
  game.act('roll');
  const target = game.movementOptions().find((option) => option.kind === 'step')?.destination;
  assert.ok(target);
  placePerson(game, state.players[1].tokenId, target);
  const blocked = game.movementOptions().find((option) => option.destination === target);
  assert.equal(blocked.available, false); assert.equal(blocked.reason, 'Occupied');
  assert.equal(game.act('moveStep', { destination: target }).ok, false);
});

test('doors cost two, entryways cost one, and only one crossing is allowed per turn', async () => {
  const game = await gameWithRollAtLeast(2, 'ingress'); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'ballroom');
  const exit = game.movementOptions().find((option) => option.destination === 'N4');
  assert.equal(exit.cost, 1); assert.equal(exit.kind, 'entryway'); assert.equal(exit.available, true);
  game.act('moveStep', { destination: 'N4' });
  assert.equal(game.state().moves, game.state().die - 1);
  const reentry = game.movementOptions().find((option) => option.destination === 'ballroom');
  const door = game.movementOptions().find((option) => option.destination === 'screened-porch');
  assert.equal(reentry.available, false); assert.equal(reentry.reason, 'Already crossed an entrance');
  assert.equal(door.cost, 2); assert.equal(door.available, false);
});

test('a roll of one can cross an open entryway but not a doorway', async () => {
  const game = await gameWithRollValue(1, 'one-pace-boundary'); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'N4');
  const entryway = game.movementOptions().find((option) => option.destination === 'ballroom');
  const doorway = game.movementOptions().find((option) => option.destination === 'screened-porch');
  assert.equal(entryway.cost, 1); assert.equal(entryway.available, true);
  assert.equal(doorway.cost, 2); assert.equal(doorway.available, false); assert.equal(doorway.reason, 'Not enough moves');
});

test('room accusation may be skipped or refuted, and resolution concludes the turn', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'room-accusation' }); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'living-room');
  const accusation = game.act('roomAccuse', { suspectId: 'mint', weaponId: 'rope' });
  assert.equal(accusation.ok, true); assert.equal(game.state().phase, 'refutation');
  const refutation = game.refutation();
  const result = refutation ? game.act('resolveRefutation', { refuterIri: refutation.player.iri, cardId: refutation.matches[0].id }) : game.act('resolveRefutation');
  assert.equal(result.ok, true); assert.equal(game.state().currentPlayerIndex, 1); assert.equal(game.state().phase, 'turn-start');
});

test('a player may end a turn without rolling or moving', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'skip-turn' });
  assert.equal(game.act('endTurn').ok, true); assert.equal(game.state().currentPlayerIndex, 1);
});

test('corner-room secret passages are paired diagonally and end movement in the destination room', async () => {
  assert.deepEqual(SECRET_PASSAGES, { 'pool-room': 'dining-room', 'dining-room': 'pool-room', greenhouse: 'living-room', 'living-room': 'greenhouse' });
  const game = await createEverythingsSusGame({ names, seed: 'secret-passage' }); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'pool-room');
  assert.equal(game.act('secretPassage').value, 'dining-room');
  assert.equal(game.state().locations[active.tokenId], 'dining-room');
  assert.equal(game.state().phase, 'room-decision');
});

test('a rolled player may still choose the current room secret passage', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'rolled-secret-passage' }); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'greenhouse');
  assert.equal(game.act('roll').ok, true);
  assert.equal(game.act('secretPassage').value, 'living-room');
  assert.equal(game.state().locations[active.tokenId], 'living-room');
  assert.equal(game.state().moves, 0);
  assert.equal(game.state().phase, 'room-decision');
});

test('greenhouse door and kitchen hallway entry use their reduced boundary costs', async () => {
  const game = await gameWithRollAtLeast(2, 'east-hall-access'); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'S4');
  let option = game.movementOptions().find((candidate) => candidate.destination === 'greenhouse');
  assert.equal(option.available, true); assert.equal(option.cost, 2); assert.equal(option.kind, 'door');
  placePerson(game, active.tokenId, 'S8');
  option = game.movementOptions().find((candidate) => candidate.destination === 'kitchen');
  assert.equal(option.available, true); assert.equal(option.cost, 1); assert.equal(option.kind, 'entryway');
});

test('an unresolved room accusation never prevents ending the turn', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'end-unavailable-accusation' }); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'living-room');
  assert.equal(game.act('roomAccuse', { suspectId: 'mint', weaponId: 'rope' }).ok, true);
  assert.equal(game.state().phase, 'refutation');
  assert.equal(game.act('endTurn').ok, true);
  assert.equal(game.state().currentPlayerIndex, 1);
  assert.equal(game.state().phase, 'turn-start');
});

test('sleuth marks preserve one local candidate in every category', () => {
  const own = ['eggshell', 'shovel', 'ballroom'];
  const allOtherIds = CARDS.filter((card) => !own.includes(card.id)).map((card) => card.id);
  const normalized = normalizeSleuthMarks(CARDS, own, allOtherIds);
  for (const category of ['suspect', 'weapon', 'room']) {
    assert.equal(remainingSleuthCandidates(CARDS, own, normalized, category).length, 1);
  }
  assert.equal(normalized.has('eggshell'), false);
});

test('a final accusation is rejected unless the active suspect person is on a Foyer square', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'foyer-only-final' }); const active = game.state().players[0];
  placePerson(game, active.tokenId, 'ballroom');
  const suspectId = game.solution.find((id) => SUSPECTS.some((card) => card.id === id));
  const weaponId = game.solution.find((id) => WEAPONS.some((card) => card.id === id));
  const roomId = game.solution.find((id) => ROOMS.some((card) => card.id === id));
  const result = game.act('accuse', { suspectId, weaponId, roomId });
  assert.equal(result.ok, false); assert.match(result.message, /Foyer square/i); assert.equal(game.state().complete, false);
});

test('incorrect final accusers lose future turns and advancement is automatic', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'bad-guess' });
  const wrongSuspect = SUSPECTS.find((card) => !game.solution.includes(card.id));
  const wrongWeapon = WEAPONS.find((card) => !game.solution.includes(card.id));
  const wrongRoom = ROOMS.find((card) => !game.solution.includes(card.id));
  assert.equal(game.act('accuse', { suspectId: wrongSuspect.id, weaponId: wrongWeapon.id, roomId: wrongRoom.id }).value, false);
  assert.equal(game.state().players[0].eliminated, true); assert.equal(game.state().currentPlayerIndex, 1);
});

test('correct final accusation completes the game and verifies its commitment', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'solution' });
  const suspectId = game.solution.find((id) => SUSPECTS.some((card) => card.id === id));
  const weaponId = game.solution.find((id) => WEAPONS.some((card) => card.id === id));
  const roomId = game.solution.find((id) => ROOMS.some((card) => card.id === id));
  assert.equal(game.act('accuse', { suspectId, weaponId, roomId }).value, true);
  assert.equal(game.state().complete, true); assert.equal(await game.verifySolution(), true);
});

test('five-letter player code reconstructs only the matching private hand', async () => {
  const game = await createEverythingsSusGame({ names, mode: 'host', seed: 'compact-code' }); const [access] = await game.playerAccessCodes();
  assert.match(access.handCode, /^[A-Z]{5}$/);
  const opened = await openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: access.suspectId });
  assert.deepEqual(opened.map((card) => card.id).sort(), game.state().players[0].hand.map((card) => card.id).sort());
  await assert.rejects(() => openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: 'brown' }));
});

test('compact hand codes round-trip every seat for three through six players', async () => {
  for (let count = 3; count <= 6; count += 1) {
    const roster = Array.from({ length: count }, (_, index) => `Detective ${index + 1}`); const game = await createEverythingsSusGame({ names: roster, mode: 'host', seed: `compact-${count}` }); const accessCodes = await game.playerAccessCodes();
    for (let index = 0; index < count; index += 1) { const access = accessCodes[index]; const cards = await openHandCode({ code: access.handCode, tableCode: access.tableCode, suspectId: access.suspectId }); assert.deepEqual(cards.map((card) => card.id).sort(), game.state().players[index].hand.map((card) => card.id).sort()); }
  }
});

test('host save round-trips RDF state and deterministic random state', async () => {
  const game = await createEverythingsSusGame({ names, seed: 'restore' }); game.act('roll'); const restored = restoreEverythingsSusGame(serializeHostGame(game)); assert.deepEqual(restored.state(), game.state());
});
