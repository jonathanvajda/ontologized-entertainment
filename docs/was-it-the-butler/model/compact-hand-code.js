import { CARDS } from '../game-config.js';

const CODE_LENGTH = 5;
const CHECKSUM_BITS = 7;
const CHECKSUM_MASK = (1 << CHECKSUM_BITS) - 1;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const MIN_HAND_SIZE = 3;
const MAX_HAND_SIZE = 6;
const TOTAL_HANDS = Array.from({ length: MAX_HAND_SIZE - MIN_HAND_SIZE + 1 }, (_, index) => choose(CARDS.length, index + MIN_HAND_SIZE)).reduce((sum, count) => sum + count, 0);

export async function createHandCode({ cardIds, tableCode, suspectId }) {
  const indices = cardIds.map((id) => CARDS.findIndex((card) => card.id === id)).sort((a, b) => a - b);
  if (indices.some((index) => index < 0) || new Set(indices).size !== indices.length) throw new RangeError('The hand contains an unknown or duplicate card.');
  if (indices.length < MIN_HAND_SIZE || indices.length > MAX_HAND_SIZE) throw new RangeError('The hand size cannot be represented by this code version.');
  const rank = handOffset(indices.length) + rankCombination(indices, CARDS.length);
  const context = normalizeContext({ tableCode, suspectId });
  const mask = (await digestNumber(`mask|${context}`)) % TOTAL_HANDS;
  const concealedRank = (rank + mask) % TOTAL_HANDS;
  const checksum = (await digestNumber(`check|${context}|${concealedRank}`)) & CHECKSUM_MASK;
  return encodeBase26((concealedRank << CHECKSUM_BITS) | checksum, CODE_LENGTH);
}

export async function openHandCode({ code, tableCode, suspectId }) {
  const context = normalizeContext({ tableCode, suspectId });
  const packed = decodeBase26(code, CODE_LENGTH);
  const concealedRank = packed >>> CHECKSUM_BITS;
  const checksum = packed & CHECKSUM_MASK;
  if (concealedRank >= TOTAL_HANDS) throw new Error('That hand code is not valid.');
  const expected = (await digestNumber(`check|${context}|${concealedRank}`)) & CHECKSUM_MASK;
  if (checksum !== expected) throw new Error('That hand code does not match this table and suspect.');
  const mask = (await digestNumber(`mask|${context}`)) % TOTAL_HANDS;
  let rank = (concealedRank - mask + TOTAL_HANDS) % TOTAL_HANDS;
  let handSize = MIN_HAND_SIZE;
  while (handSize <= MAX_HAND_SIZE) {
    const count = choose(CARDS.length, handSize);
    if (rank < count) break;
    rank -= count;
    handSize += 1;
  }
  return unrankCombination(rank, CARDS.length, handSize).map((index) => CARDS[index]);
}

function normalizeContext({ tableCode, suspectId }) {
  const table = String(tableCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suspect = String(suspectId).toLowerCase().replace(/[^a-z-]/g, '');
  if (!table || !suspect) throw new Error('Table code and suspect are required.');
  return `butler-hand-v2|${table}|${suspect}`;
}

function handOffset(handSize) {
  let offset = 0;
  for (let size = MIN_HAND_SIZE; size < handSize; size += 1) offset += choose(CARDS.length, size);
  return offset;
}

async function digestNumber(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return new DataView(digest.buffer).getUint32(0, false);
}

function rankCombination(values, n) {
  let rank = 0;
  let previous = -1;
  for (let position = 0; position < values.length; position += 1) {
    for (let candidate = previous + 1; candidate < values[position]; candidate += 1) rank += choose(n - candidate - 1, values.length - position - 1);
    previous = values[position];
  }
  return rank;
}

function unrankCombination(rank, n, k) {
  const values = [];
  let candidate = 0;
  for (let position = 0; position < k; position += 1) {
    while (candidate < n) {
      const block = choose(n - candidate - 1, k - position - 1);
      if (rank < block) { values.push(candidate); candidate += 1; break; }
      rank -= block;
      candidate += 1;
    }
  }
  if (values.length !== k) throw new Error('The hand code could not be decoded.');
  return values;
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
  return result;
}

function encodeBase26(value, length) {
  let output = '';
  for (let index = 0; index < length; index += 1) { output = ALPHABET[value % 26] + output; value = Math.floor(value / 26); }
  if (value) throw new RangeError('The hand code exceeds its fixed width.');
  return output;
}

function decodeBase26(code, length) {
  const normalized = String(code).toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized.length !== length) throw new Error(`Enter the ${length}-letter hand code.`);
  let value = 0;
  for (const letter of normalized) value = value * 26 + ALPHABET.indexOf(letter);
  return value;
}
