import { decryptJson, encryptJson, requireWebCrypto } from './crypto-engine.js';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

export async function generateDisclosureIdentity(cryptoRef = globalThis.crypto) { return requireWebCrypto(cryptoRef).subtle.generateKey(ECDH, true, ['deriveKey', 'deriveBits']); }
export async function exportDisclosureIdentity(keyPair, cryptoRef = globalThis.crypto) {
  const subtle = requireWebCrypto(cryptoRef).subtle; return { publicKey: await subtle.exportKey('jwk', keyPair.publicKey), privateKey: await subtle.exportKey('jwk', keyPair.privateKey) };
}
export async function importDisclosureIdentity(identity, cryptoRef = globalThis.crypto) {
  const subtle = requireWebCrypto(cryptoRef).subtle;
  return { publicKey: await subtle.importKey('jwk', identity.publicKey, ECDH, true, []), privateKey: await subtle.importKey('jwk', identity.privateKey, ECDH, false, ['deriveKey', 'deriveBits']) };
}
export async function importDisclosurePublicKey(jwk, cryptoRef = globalThis.crypto) { return requireWebCrypto(cryptoRef).subtle.importKey('jwk', jwk, ECDH, true, []); }
export async function deriveDisclosureKey(privateKey, publicKey, cryptoRef = globalThis.crypto) {
  return requireWebCrypto(cryptoRef).subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function createDisclosure({ gameId, senderIri, recipientIri, disclosureId, payload, senderPrivateKey, recipientPublicKey, cryptoRef = globalThis.crypto }) {
  const key = await deriveDisclosureKey(senderPrivateKey, recipientPublicKey, cryptoRef); const aad = { purpose: 'targeted-disclosure', gameId, senderIri, recipientIri, disclosureId, version: 1 };
  return { ...aad, envelope: await encryptJson(payload, key, { additionalData: aad, cryptoRef }) };
}
export async function openDisclosure(disclosure, { recipientPrivateKey, senderPublicKey, cryptoRef = globalThis.crypto }) {
  const { envelope, ...aad } = disclosure; const key = await deriveDisclosureKey(recipientPrivateKey, senderPublicKey, cryptoRef);
  return decryptJson(envelope, key, { expectedAdditionalData: aad, cryptoRef });
}
