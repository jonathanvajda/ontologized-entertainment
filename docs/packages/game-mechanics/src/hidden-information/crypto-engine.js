import { base64UrlToBytes, bytesToBase64Url, stableStringify, utf8Decode, utf8Encode } from './encoding.js';

const AES = { name: 'AES-GCM', length: 256 };
const PBKDF2_ITERATIONS = 310_000;
const CROCKFORD = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function requireWebCrypto(cryptoRef = globalThis.crypto) {
  if (!cryptoRef?.subtle || !cryptoRef?.getRandomValues) throw new Error('Web Crypto is required for hidden information.');
  return cryptoRef;
}

export function randomBytes(length = 32, cryptoRef = globalThis.crypto) {
  const output = new Uint8Array(length); requireWebCrypto(cryptoRef).getRandomValues(output); return output;
}

/** A human-readable session label. This is deliberately not a cryptographic secret. */
export function generateGameCode(length = 6, cryptoRef = globalThis.crypto) {
  if (!Number.isInteger(length) || length < 4 || length > 12) throw new RangeError('Game-code length must be 4–12.');
  const bytes = randomBytes(length, cryptoRef);
  return [...bytes].map((value) => CROCKFORD[value % CROCKFORD.length]).join('');
}

export async function generateSymmetricKey({ extractable = true, cryptoRef = globalThis.crypto } = {}) {
  return requireWebCrypto(cryptoRef).subtle.generateKey(AES, extractable, ['encrypt', 'decrypt']);
}
export async function exportSymmetricKey(key, cryptoRef = globalThis.crypto) {
  return bytesToBase64Url(new Uint8Array(await requireWebCrypto(cryptoRef).subtle.exportKey('raw', key)));
}
export async function importSymmetricKey(encoded, { extractable = false, cryptoRef = globalThis.crypto } = {}) {
  return requireWebCrypto(cryptoRef).subtle.importKey('raw', base64UrlToBytes(encoded), AES, extractable, ['encrypt', 'decrypt']);
}

export async function encryptJson(value, key, { additionalData = {}, cryptoRef = globalThis.crypto } = {}) {
  const cryptoApi = requireWebCrypto(cryptoRef); const iv = randomBytes(12, cryptoApi); const aad = utf8Encode(stableStringify(additionalData));
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, utf8Encode(stableStringify(value)));
  return { algorithm: 'A256GCM', iv: bytesToBase64Url(iv), aad: additionalData, ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptJson(envelope, key, { expectedAdditionalData, cryptoRef = globalThis.crypto } = {}) {
  if (envelope?.algorithm !== 'A256GCM') throw new Error('Unsupported encrypted-payload algorithm.');
  if (expectedAdditionalData && stableStringify(envelope.aad) !== stableStringify(expectedAdditionalData)) throw new Error('Encrypted-payload context does not match.');
  const plaintext = await requireWebCrypto(cryptoRef).subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(envelope.iv), additionalData: utf8Encode(stableStringify(envelope.aad)), tagLength: 128 }, key, base64UrlToBytes(envelope.ciphertext));
  return JSON.parse(utf8Decode(new Uint8Array(plaintext)));
}

export async function createCommitment(value, { salt = randomBytes(32), cryptoRef = globalThis.crypto } = {}) {
  const body = utf8Encode(stableStringify(value)); const combined = new Uint8Array(salt.length + body.length); combined.set(salt); combined.set(body, salt.length);
  const digest = await requireWebCrypto(cryptoRef).subtle.digest('SHA-256', combined);
  return { algorithm: 'SHA-256', digest: bytesToBase64Url(new Uint8Array(digest)), salt: bytesToBase64Url(salt) };
}
export async function verifyCommitment(value, commitment, cryptoRef = globalThis.crypto) {
  if (commitment?.algorithm !== 'SHA-256') return false;
  const recalculated = await createCommitment(value, { salt: base64UrlToBytes(commitment.salt), cryptoRef });
  return constantTimeEqual(base64UrlToBytes(recalculated.digest), base64UrlToBytes(commitment.digest));
}

/** PIN wrapping is a convenience lock, not a substitute for a high-entropy transfer secret. */
export async function wrapSecretWithPin(secretBytes, pin, { cryptoRef = globalThis.crypto } = {}) {
  if (!/^\d{4,12}$/u.test(String(pin))) throw new TypeError('PIN must contain 4–12 digits.');
  const cryptoApi = requireWebCrypto(cryptoRef); const salt = randomBytes(16, cryptoApi);
  const material = await cryptoApi.subtle.importKey('raw', utf8Encode(pin), 'PBKDF2', false, ['deriveKey']);
  const key = await cryptoApi.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, material, AES, false, ['encrypt', 'decrypt']);
  const envelope = await encryptJson({ secret: bytesToBase64Url(secretBytes) }, key, { additionalData: { purpose: 'local-pin-wrap', version: 1 }, cryptoRef });
  return { ...envelope, salt: bytesToBase64Url(salt), iterations: PBKDF2_ITERATIONS };
}
export async function unwrapSecretWithPin(envelope, pin, { cryptoRef = globalThis.crypto } = {}) {
  const cryptoApi = requireWebCrypto(cryptoRef); const material = await cryptoApi.subtle.importKey('raw', utf8Encode(pin), 'PBKDF2', false, ['deriveKey']);
  const key = await cryptoApi.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(envelope.salt), iterations: envelope.iterations }, material, AES, false, ['decrypt']);
  const value = await decryptJson(envelope, key, { expectedAdditionalData: { purpose: 'local-pin-wrap', version: 1 }, cryptoRef });
  return base64UrlToBytes(value.secret);
}

function constantTimeEqual(a, b) { if (a.length !== b.length) return false; let difference = 0; for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i]; return difference === 0; }
