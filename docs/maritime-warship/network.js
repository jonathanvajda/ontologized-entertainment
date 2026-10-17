import { base32Encode, base32Decode, ALPHABET } from '../query-whom/js/protocol.js';
import { normalizeConfig, SHIPS } from './game-config.js';
const TYPES = Object.keys(SHIPS), PROTOCOL = 1;
const digest = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
export const formatCode = code => code.match(/.{1,4}/g).join('-');
export function inviteUrl(code, baseUrl) { const url = new URL(baseUrl); url.search = ''; url.hash = new URLSearchParams({ invite: code }); return url.href; }
export function boardSeed(setup) { return setup.seed.map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export async function createSetup(input, seedText = '') {
  const config = normalizeConfig(input);
  const seed = seedText ? (await digest(new TextEncoder().encode(seedText))).slice(0, 16) : crypto.getRandomValues(new Uint8Array(16));
  const bytes = new Uint8Array(7 + config.fleet.length + 16 + 3);
  bytes.set([PROTOCOL, config.rows, config.columns, config.obstacles, (config.climate === 'ARCTIC' ? 1 : 0) | (config.salvo ? 2 : 0), config.budget, config.fleet.length]);
  bytes.set(config.fleet.map(type => TYPES.indexOf(type)), 7); bytes.set(seed, 7 + config.fleet.length);
  bytes.set((await digest(bytes.slice(0, -3))).slice(0, 3), bytes.length - 3);
  return { code: base32Encode(bytes), seed: [...seed], config };
}
export async function decodeSetup(input) {
  if (typeof input !== 'string' || input.length > 2000) throw new Error('Enter a Maritime Warship code or invitation link.');
  let raw = input.trim();
  if (/^https?:/i.test(raw)) { const params = new URLSearchParams(new URL(raw).hash.slice(1)); if (params.getAll('invite').length !== 1) throw new Error('The link needs exactly one invitation code.'); raw = params.get('invite'); }
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (code.length < 48 || code.length > 53 || [...code].some(c => !ALPHABET.includes(c))) throw new Error('Check the setup code. Spaces and dashes are fine.');
  const bytes = base32Decode(code), count = bytes[6];
  if (bytes[0] !== PROTOCOL || count < 4 || count > 7 || bytes.length !== 26 + count || base32Encode(bytes) !== code || bytes[4] > 3) throw new Error('Unsupported or malformed setup code.');
  const checksum = await digest(bytes.slice(0, -3));
  if (!bytes.slice(-3).every((b, i) => b === checksum[i])) throw new Error('The code checksum failed. Check for a typing mistake.');
  const config = normalizeConfig({ rows: bytes[1], columns: bytes[2], obstacles: bytes[3], climate: bytes[4] & 1 ? 'ARCTIC' : 'WARM_WATER', salvo: Boolean(bytes[4] & 2), budget: bytes[5], fleet: [...bytes.slice(7, 7 + count)].map(i => TYPES[i]) });
  return { code, config, seed: [...bytes.slice(7 + count, -3)] };
}
