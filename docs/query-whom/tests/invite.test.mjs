import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteUrl, readInvite } from '../js/invite.js';
import { encodeGame } from '../js/protocol.js';

test('invites preserve deployment subpaths and contain only the public code', async () => {
  const code = await encodeGame({ size: 24, seed: new Uint8Array(16) });
  const url = inviteUrl(code, 'https://example.org/project/docs/query-whom/?private=secret#old');
  assert.equal(url, `https://example.org/project/docs/query-whom/#invite=${code}`);
  assert.equal(await readInvite(url), code);
  assert.equal(await readInvite('https://example.org/#main'), null);
  await assert.rejects(readInvite('https://example.org/#invite=bad'));
  await assert.rejects(readInvite(`${url}&invite=${code}`), /multiple/);
});
