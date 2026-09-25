const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8Encode = (value) => encoder.encode(String(value));
export const utf8Decode = (value) => decoder.decode(value);

export function bytesToBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function base64UrlToBytes(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
