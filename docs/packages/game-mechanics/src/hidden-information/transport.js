import { base64UrlToBytes, bytesToBase64Url, stableStringify, utf8Decode, utf8Encode } from './encoding.js';

export function encodeTransportToken(value) { return bytesToBase64Url(utf8Encode(stableStringify(value))); }
export function decodeTransportToken(token, { maxBytes = 200_000 } = {}) {
  const bytes = base64UrlToBytes(token); if (bytes.byteLength > maxBytes) throw new RangeError('Transport token exceeds the configured size limit.');
  return JSON.parse(utf8Decode(bytes));
}
export function createInvitationUrl(baseUrl, invitation) { const url = new URL(baseUrl, globalThis.location?.href || 'https://example.invalid/'); url.hash = `invite=${encodeTransportToken(invitation)}`; return url.toString(); }
export function readInvitationUrl(urlValue) { const url = new URL(urlValue, globalThis.location?.href || 'https://example.invalid/'); const token = new URLSearchParams(url.hash.slice(1)).get('invite'); return token ? decodeTransportToken(token) : null; }

export function createRouteSet(basePath = './') {
  const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return Object.freeze({ landing: normalized, passAndPlay: `${normalized}pass-and-play/`, host: `${normalized}host/`, player: `${normalized}player/` });
}
