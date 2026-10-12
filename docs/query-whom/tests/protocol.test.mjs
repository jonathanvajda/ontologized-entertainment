import test from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET, base32Encode, base32Decode, normalizeCode, formatCode, encodeGame, decodeGame, reconstructBoard, HashRandom, eligibleTargets, privateChoice } from '../js/protocol.js';

const seed = Uint8Array.from({ length: 16 }, (_, i) => i);
test('locked protocol v1 code and ordered-board vector', async () => {
  const code = await encodeGame({ size: 24, seed });
  assert.equal(code, '26224822263283272S5JJ4AC3E82U5JHE59RY');
  assert.deepEqual(await reconstructBoard(await decodeGame(code)), [9,40,38,1,15,26,5,25,21,4,7,32,39,37,34,18,33,36,14,16,24,17,27,22]);
  assert.equal(normalizeCode(' ' + formatCode(code).toLowerCase() + '\n'), code);
  assert.equal(ALPHABET.length, 32);
});
test('all sizes reconstruct distinct members and disjoint target partitions', async () => {
  for (let size = 20; size <= 40; size++) for (let run = 0; run < 5; run++) {
    const sample = seed.slice(); sample[15] = run;
    const code = await encodeGame({ size, seed: sample }), definition = await decodeGame(code), board = await reconstructBoard(definition);
    assert.equal(code.length, 37); assert.equal(board.length, size); assert.equal(new Set(board).size, size);
    assert(board.every(id => id >= 1 && id <= 40));
    assert.deepEqual(board, await reconstructBoard(definition));
    const a = eligibleTargets(board, 'creator'), b = eligibleTargets(board, 'joiner');
    assert.equal(a.length, Math.floor(size / 2)); assert.equal(b.length, Math.ceil(size / 2));
    assert(a.every(id => !b.includes(id))); assert.notEqual(privateChoice(a, () => 0), privateChoice(b, () => 0));
  }
});
test('strict alphabet, checksum, padding, versions and bounds', async () => {
  const code = await encodeGame({ size: 24, seed });
  for (const invalid of ['https://example.com/' + code, code.slice(1), code + '2', 'O'.repeat(37), '2'.repeat(37), code.slice(0, -1) + '3']) await assert.rejects(decodeGame(invalid));
  await assert.rejects(encodeGame({ size: 19, seed })); await assert.rejects(encodeGame({ size: 41, seed }));
  await assert.rejects(decodeGame(await encodeGame({ size: 24, seed, deckVersion: 2 })), /catalog/);
  const bytes = base32Decode(code); bytes[0] = 2;
  bytes.set(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice(0,20))).slice(0,3), 20);
  await assert.rejects(decodeGame(base32Encode(bytes)), /protocol/);
});
test('every public seed byte affects the deterministic source', async () => {
  const expected = await new HashRandom(seed).nextWord();
  for (let i = 0; i < 16; i++) { const other = seed.slice(); other[i] ^= 1; assert.notEqual(await new HashRandom(other).nextWord(), expected); }
});
test('bounded random choice rejects the biased tail and retains state', async () => {
  const random = new HashRandom(seed); random.words = [0xffffffff, 17];
  assert.equal(await random.randomInt(0,9), 7); assert.equal(random.cursor, 2);
  const state = random.getState(), value = await random.nextWord(); random.setState(state); assert.equal(await random.nextWord(), value);
  const words = [0xffffffff, 4]; assert.equal(privateChoice(['a','b','c'], () => words.shift()), 'b');
});
