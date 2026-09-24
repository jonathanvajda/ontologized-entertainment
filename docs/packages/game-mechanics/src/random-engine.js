/** Mulberry32-based deterministic random source with serializable state. */
export class RandomEngine {
  #state;
  constructor(seed = cryptoSeed()) { this.#state = normalizeSeed(seed); }
  getState() { return this.#state >>> 0; }
  setState(state) { this.#state = normalizeSeed(state); return this; }
  randomFloat() {
    this.#state = (this.#state + 0x6D2B79F5) >>> 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  randomInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError('randomInt requires integer min <= max.');
    return min + Math.floor(this.randomFloat() * (max - min + 1));
  }
  shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = this.randomInt(0, i);
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }
  drawOne(items) { return this.drawMany(items, 1)[0]; }
  drawMany(items, count) {
    if (!Number.isInteger(count) || count < 0 || count > items.length) throw new RangeError('Draw count exceeds the finite pool.');
    return this.shuffle(items).slice(0, count);
  }
  rollDie(sides = 6) {
    if (!Number.isInteger(sides) || sides < 2) throw new RangeError('A die requires at least two sides.');
    return this.randomInt(1, sides);
  }
  weightedChoice(entries) {
    const normalized = entries.map((entry) => Array.isArray(entry) ? { value: entry[0], weight: entry[1] } : entry);
    const total = normalized.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
    if (!(total > 0)) throw new RangeError('At least one positive weight is required.');
    let cursor = this.randomFloat() * total;
    for (const entry of normalized) {
      cursor -= Math.max(0, Number(entry.weight) || 0);
      if (cursor < 0) return entry.value;
    }
    return normalized.at(-1).value;
  }
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let hash = 2166136261;
  for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function cryptoSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(values)[0];
  return Date.now() >>> 0;
}
