import { decodeGame } from './protocol.js';

export function inviteUrl(code, baseUrl) {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = new URLSearchParams({ invite: code }).toString();
  return url.href;
}

export async function readInvite(url) {
  const parameters = new URLSearchParams(new URL(url).hash.slice(1));
  if (!parameters.has('invite')) return null;
  if (parameters.getAll('invite').length !== 1) throw new Error('The invitation link contains multiple codes.');
  return (await decodeGame(parameters.get('invite'))).code;
}
