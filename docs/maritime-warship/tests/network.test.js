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
