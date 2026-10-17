import { base32Encode, base32Decode, ALPHABET } from '../query-whom/js/protocol.js';
import { normalizeConfig, SHIPS } from './game-config.js';
const TYPES = Object.keys(SHIPS), PROTOCOL = 2;
const digest = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
export const formatCode = code => code.match(/.{1,4}/g).join('-');
export function inviteUrl(code, baseUrl) { const url = new URL(baseUrl); url.search = ''; url.hash = new URLSearchParams({ invite: code }); return url.href; }
export function boardSeed(setup) { return setup.seed.map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export async function createSetup(input, seedText = '') {
  const config = normalizeConfig(input);
  // Public terrain needs reproducibility, not a cryptographic secret. Keep private
  // placement randomness separate. Bit packing avoids whole bytes for small fields.
  const seed = seedText ? (await digest(new TextEncoder().encode(seedText))).slice(0, 4) : crypto.getRandomValues(new Uint8Array(4));
  let bits = '';
  const put = (value, width) => { bits += value.toString(2).padStart(width, '0'); };
  put(PROTOCOL, 8); put(config.rows - 8, 5); put(config.columns - 8, 5);
  put(config.obstacles, 3); put(config.climate === 'ARCTIC' ? 1 : 0, 1); put(config.salvo ? 1 : 0, 1);
  put(config.budget - 8, 5); put(config.fleet.length - 4, 2);
  config.fleet.forEach(type => put(TYPES.indexOf(type), 3)); seed.forEach(byte => put(byte, 8));
  const payload = Uint8Array.from(bits.padEnd(Math.ceil(bits.length / 8) * 8, '0').match(/.{8}/g), byte => parseInt(byte, 2));
  const bytes = new Uint8Array(payload.length + 2); bytes.set(payload); bytes.set((await digest(payload)).slice(0, 2), payload.length);
  return { code: base32Encode(bytes), seed: [...seed], config };
}
export async function decodeSetup(input) {
  if (typeof input !== 'string' || input.length > 2000) throw new Error('Enter a Maritime Warship code or invitation link.');
  let raw = input.trim();
  if (/^https?:/i.test(raw)) { const params = new URLSearchParams(new URL(raw).hash.slice(1)); if (params.getAll('invite').length !== 1) throw new Error('The link needs exactly one invitation code.'); raw = params.get('invite'); }
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (![20, 21, 48, 50, 52, 53].includes(code.length) || [...code].some(c => !ALPHABET.includes(c))) throw new Error('Check the setup code. Spaces and dashes are fine.');
  if (base32Decode(code)[0] === 2) return decodeCompact(code);
  const bytes = base32Decode(code), count = bytes[6];
  if (bytes[0] !== 1 || count < 4 || count > 7 || bytes.length !== 26 + count || base32Encode(bytes) !== code || bytes[4] > 3) throw new Error('Unsupported or malformed setup code.');
  const checksum = await digest(bytes.slice(0, -3));
  if (!bytes.slice(-3).every((b, i) => b === checksum[i])) throw new Error('The code checksum failed. Check for a typing mistake.');
  const config = normalizeConfig({ rows: bytes[1], columns: bytes[2], obstacles: bytes[3], climate: bytes[4] & 1 ? 'ARCTIC' : 'WARM_WATER', salvo: Boolean(bytes[4] & 2), budget: bytes[5], fleet: [...bytes.slice(7, 7 + count)].map(i => TYPES[i]) });
  return { code, config, seed: [...bytes.slice(7 + count, -3)] };
}

async function decodeCompact(code) {
  const bytes = base32Decode(code), payload = bytes.slice(0, -2);
  if (base32Encode(bytes) !== code) throw new Error('Malformed setup code padding.');
  const checksum = await digest(payload);
  if (!bytes.slice(-2).every((byte, i) => byte === checksum[i])) throw new Error('The code checksum failed. Check for a typing mistake.');
  const bits = [...payload].map(byte => byte.toString(2).padStart(8, '0')).join(''); let offset = 8;
  const take = width => { const value = parseInt(bits.slice(offset, offset + width), 2); offset += width; return value; };
  const rows = take(5) + 8, columns = take(5) + 8, obstacles = take(3), climate = take(1) ? 'ARCTIC' : 'WARM_WATER', salvo = Boolean(take(1));
  const budget = take(5) + 8, count = take(2) + 4;
  const fleet = Array.from({ length: count }, () => TYPES[take(3)]), seed = Array.from({ length: 4 }, () => take(8));
  if (payload.length !== Math.ceil(offset / 8) || /1/.test(bits.slice(offset))) throw new Error('Malformed setup code length or padding.');
  return { code, config: normalizeConfig({ rows, columns, obstacles, climate, salvo, budget, fleet }), seed };
}
