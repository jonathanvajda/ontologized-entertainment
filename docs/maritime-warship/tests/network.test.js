import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetup, decodeSetup, boardSeed } from '../network.js';
import { presetFleet } from '../game-config.js';
import { base32Encode, base32Decode } from '../../query-whom/js/protocol.js';

test('compact codes preserve every rule field and ship order across fleet sizes', async () => {
  for (const count of [4, 5, 6, 7]) {
    for (const [rows, columns, obstacles, climate, salvo] of [[8, 26, 0, 'WARM_WATER', false], [26, 8, 4, 'ARCTIC', true]]) {
      const setup = await createSetup({ rows, columns, obstacles, climate, salvo, fleet: presetFleet(count).reverse(), budget: 35 }, 'compact');
      assert.ok(setup.code.length >= 20 && setup.code.length <= 21);
      assert.deepEqual(await decodeSetup(setup.code), setup);
      assert.equal(setup.seed.length, 4);
      assert.equal(boardSeed(setup).length, 8);
    }
  }
});

test('legacy v1 fixture retains its original 128-bit terrain seed and rules', async () => {
  const setup = await decodeSetup('2672N2226E4242J52J2242J52J4JE3SA3672Q52F3S9JTZBG');
  assert.equal(setup.config.rows, 10); assert.equal(setup.config.columns, 10);
  assert.deepEqual(setup.config.fleet, ['Battleship', 'Cruiser', 'Submarine', 'Destroyer']);
  assert.deepEqual(setup.seed, Array.from({ length: 16 }, (_, i) => i));
  assert.equal(boardSeed(setup), '000102030405060708090a0b0c0d0e0f');
});

test('compact codes reject checksum changes, padding changes and invalid rule fields', async () => {
  const setup = await createSetup({ fleet: presetFleet(4) }, 'bad-code');
  const original = base32Decode(setup.code);
  const changed = original.slice(); changed[3] ^= 1;
  await assert.rejects(decodeSetup(base32Encode(changed)), /checksum/);
  const resign = async bytes => {
    bytes.set(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice(0, -2))).slice(0, 2), bytes.length - 2);
    return base32Encode(bytes);
  };
  const padding = original.slice(); padding[padding.length - 3] |= 1;
  await assert.rejects(decodeSetup(await resign(padding)), /padding/);
  const dimensions = original.slice(); dimensions[1] |= 0xf8;
  await assert.rejects(decodeSetup(await resign(dimensions)), /dimensions/);
});

test('player names round-trip through typed codes and invitations without changing terrain', async () => {
  const { formatCode, inviteUrl } = await import('../network.js');
  const defaultSetup = await createSetup({}, 'same-ocean');
  for (const names of [['Ada', 'Bert'], ['Zo\u00eb', '\u674e\u96f7'], ['A'.repeat(24), 'B'.repeat(24)], ['\u6c34'.repeat(24), '\u51b0'.repeat(24)], ['\ud83d\udea2 Admiral', 'Captain O\u2019Brien']]) {
    const setup = await createSetup({ names }, 'same-ocean');
    assert.equal(boardSeed(setup), boardSeed(defaultSetup), 'Names do not alter terrain generation');
    for (const input of [formatCode(setup.code).toLowerCase(), inviteUrl(setup.code, 'https://example.test/warship/')]) {
      assert.deepEqual(await decodeSetup(input), setup);
    }
  }
  const legacy = await decodeSetup('2AAA5F2NWKJ7DVZ2MMUJ');
  assert.deepEqual(legacy.config.names, ['Admiral One', 'Admiral Two']);
  assert.deepEqual(legacy.seed, [140, 10, 189, 252]);
});

test('re-sharing legacy games adds their saved names while retaining both seed formats and private RDF', async () => {
  const { withPlayerNames } = await import('../network.js');
  const { createMaritimeGame } = await import('../model/game.js');
  const { localSave, parseLocalSave } = await import('../storage.js');
  const { canonicalizeQuads } = await import('../../packages/game-mechanics/src/hidden-information/rdf-capsule.js');
  for (const code of ['2672N2226E4242J52J2242J52J4JE3SA3672Q52F3S9JTZBG', '2AAA5F2NWKJ7DVZ2MMUJ']) {
    const original = await decodeSetup(code), names = ['Ada', 'Bert'];
    const game = createMaritimeGame({ ...original.config, names }, { boardSeed: boardSeed(original) });
    await game.act('autoPlace');
    await parseLocalSave(localSave(game, original)); // Old saves did not encode names.
    const upgraded = await withPlayerNames(original, names);
    assert.equal(boardSeed(upgraded), boardSeed(original));
    assert.deepEqual(await decodeSetup(upgraded.code), upgraded);
    assert.deepEqual(upgraded.config.names, names);
    const restored = await parseLocalSave(localSave(game, upgraded));
    assert.equal(canonicalizeQuads(restored.game.snapshot().quads), canonicalizeQuads(game.snapshot().quads));
    const changed = localSave(game, upgraded);
    changed.quads.find(q => q.predicate.value.endsWith('label') && q.object.value === 'Ada').object.value = 'Wrong name';
    await assert.rejects(parseLocalSave(changed), /player names/);
  }
});

test('named setup codes reject truncated names and invalid UTF-8 even with a valid checksum', async () => {
  const setup = await createSetup({ names: ['Ada', 'Bert'] }, 'invalid-names');
  const bytes = base32Decode(setup.code);
  const resign = async candidate => {
    candidate.set(new Uint8Array(await crypto.subtle.digest('SHA-256', candidate.slice(0, -2))).slice(0, 2), candidate.length - 2);
    return base32Encode(candidate);
  };
  const length = bytes.slice(); length[10] = 96;
  await assert.rejects(decodeSetup(await resign(length)), /player names/);
  const invalid = bytes.slice(); invalid[11] = 255;
  await assert.rejects(decodeSetup(await resign(invalid)), /encoded data|encoding|UTF/i);
});
