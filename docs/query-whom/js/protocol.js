export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PROTOCOL_VERSION = 1;
export const DECK_VERSION = 1;
const digest = async (bytes) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

export function base32Encode(bytes) {
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; result += ALPHABET[(value >>> bits) & 31]; }
    value &= (1 << bits) - 1;
  }
  if (bits) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}
export function normalizeCode(code) {
  if (typeof code !== 'string' || code.length > 128) throw new Error('Enter a valid game code.');
  const normalized = code.toUpperCase().replace(/[\s-]/g, '');
  if (normalized.length !== 37 || [...normalized].some(c => !ALPHABET.includes(c))) throw new Error('Game codes have 37 letters and numbers. Check your code.');
  return normalized;
}
export function base32Decode(code) {
  let bits = 0, value = 0; const bytes = [];
  for (const char of code) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid code alphabet.');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
    value &= (1 << bits) - 1;
  }
  if (value !== 0) throw new Error('Invalid code padding.');
  return new Uint8Array(bytes);
}
export const formatCode = (code) => normalizeCode(code).match(/.{1,4}/g).join('-');
function assertSize(size) { if (!Number.isInteger(size) || size < 20 || size > 40) throw new Error('Choose between 20 and 40 people.'); }
export async function encodeGame({ size, seed, deckVersion = DECK_VERSION, protocolVersion = PROTOCOL_VERSION }) {
  assertSize(size);
  if (!(seed instanceof Uint8Array) || seed.length !== 16) throw new Error('A 16-byte seed is required.');
  if (!Number.isInteger(deckVersion) || deckVersion < 1 || deckVersion > 65535 || protocolVersion !== 1) throw new Error('Unsupported version.');
  const bytes = new Uint8Array(23);
  bytes[0] = protocolVersion; new DataView(bytes.buffer).setUint16(1, deckVersion, false); bytes[3] = size;
  bytes.set(seed, 4); bytes.set((await digest(bytes.slice(0, 20))).slice(0, 3), 20);
  return base32Encode(bytes);
}
export async function decodeGame(input) {
  const code = normalizeCode(input), bytes = base32Decode(code);
  if (bytes.length !== 23 || base32Encode(bytes) !== code) throw new Error('Invalid game code.');
  const checksum = await digest(bytes.slice(0, 20));
  if (!bytes.slice(20).every((b, i) => b === checksum[i])) throw new Error('The code checksum failed. Check for a typing mistake.');
  if (bytes[0] !== PROTOCOL_VERSION) throw new Error('This game uses an unsupported protocol version.');
  const deckVersion = new DataView(bytes.buffer).getUint16(1, false);
  if (deckVersion !== DECK_VERSION) throw new Error('This game needs a different character catalog.');
  assertSize(bytes[3]);
  return { code, protocolVersion: bytes[0], deckVersion, size: bytes[3], seed: bytes.slice(4, 20) };
}

/** Protocol v1: SHA-256(seed[16] || counter[uint32 big-endian]), starting at zero. */
export class HashRandom {
  constructor(seed) {
    if (!(seed instanceof Uint8Array) || seed.length !== 16) throw new Error('Invalid seed.');
    this.seed = seed.slice(); this.counter = 0; this.words = []; this.cursor = 0;
  }
  getState() { return { seed: [...this.seed], counter: this.counter, words: [...this.words], cursor: this.cursor }; }
  setState(state) { this.seed = new Uint8Array(state.seed); this.counter = state.counter; this.words = [...state.words]; this.cursor = state.cursor; }
  async nextWord() {
    if (this.cursor === this.words.length) {
      if (this.counter > 0xffffffff) throw new Error('Random source exhausted.');
      const input = new Uint8Array(20); input.set(this.seed);
      new DataView(input.buffer).setUint32(16, this.counter++, false);
      const hash = await digest(input), view = new DataView(hash.buffer);
      this.words = Array.from({ length: 8 }, (_, i) => view.getUint32(i * 4, false)); this.cursor = 0;
    }
    return this.words[this.cursor++];
  }
  async randomInt(min, max) {
    const bound = max - min + 1;
    if (!Number.isInteger(min) || !Number.isInteger(max) || bound < 1 || bound > 0x100000000) throw new Error('Invalid random bounds.');
    const limit = Math.floor(0x100000000 / bound) * bound;
    let word; do { word = await this.nextWord(); } while (word >= limit);
    return min + word % bound;
  }
  async shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = await this.randomInt(0, i); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
}
export async function reconstructBoard(definition) {
  assertSize(definition.size);
  return (await new HashRandom(definition.seed).shuffle(Array.from({ length: 40 }, (_, i) => i + 1))).slice(0, definition.size);
}
export function eligibleTargets(board, playerRole) {
  if (!['creator', 'joiner'].includes(playerRole)) throw new Error('Invalid player role.');
  const split = Math.floor(board.length / 2);
  return playerRole === 'creator' ? board.slice(0, split) : board.slice(split);
}
export function privateChoice(items, getWord = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  if (!items.length) throw new Error('No eligible targets.');
  const limit = Math.floor(0x100000000 / items.length) * items.length;
  let word; do { word = getWord(); } while (word >= limit);
  return items[word % items.length];
}
export async function newGameCode(size) { return encodeGame({ size, seed: crypto.getRandomValues(new Uint8Array(16)) }); }
