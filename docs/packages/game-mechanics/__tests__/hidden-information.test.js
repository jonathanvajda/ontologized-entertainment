import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RdfStore, namedNode, literal, quad, createCommitment, verifyCommitment, generateSymmetricKey,
  encryptJson, decryptJson, createEncryptedRdfCapsule, openEncryptedRdfCapsule,
  createVisibilityIndex, projectVisibleStore, validateVisibilityCoverage, VISIBILITY,
  generateDisclosureIdentity, createDisclosure, openDisclosure,
  createInvitationUrl, readInvitationUrl, createPrivacyScreen, randomBytes, wrapSecretWithPin, unwrapSecretWithPin
} from '../src/index.js';

const nn = namedNode; const q = (s, p, o) => quad(nn(s), nn(p), typeof o === 'string' ? nn(o) : o);
const TYPE = VISIBILITY.type; const SECRET = 'urn:card:secret'; const PUBLIC = 'urn:state:public'; const PLAYER_A = 'urn:player:a'; const PLAYER_B = 'urn:player:b'; const PHASE = 'urn:phase:reveal';

function visibilityFixture() {
  return new RdfStore([
    q(SECRET, TYPE, 'urn:HiddenCard'), q(SECRET, 'urn:label', literal('Knife')),
    q(PUBLIC, 'urn:label', literal('Round 2')),
    q('urn:policy:secret', TYPE, VISIBILITY.VisibilityPolicy), q('urn:policy:secret', VISIBILITY.governs, SECRET),
    q('urn:policy:secret', VISIBILITY.visibleTo, PLAYER_A), q('urn:policy:secret', VISIBILITY.visibleDuringPhase, PHASE)
  ]);
}

test('RDF visibility projection combines audience and phase without mutating canonical RDF', () => {
  const store = visibilityFixture(); const before = store.size;
  assert.equal(createVisibilityIndex(store).get(SECRET).length, 1);
  assert.equal(projectVisibleStore(store, { viewerIri: PLAYER_A, phaseIri: PHASE }).getQuads(nn(SECRET), null, null, null).length, 2);
  assert.equal(projectVisibleStore(store, { viewerIri: PLAYER_B, phaseIri: PHASE }).getQuads(nn(SECRET), null, null, null).length, 0);
  assert.equal(projectVisibleStore(store, { viewerIri: PLAYER_A, phaseIri: 'urn:phase:other' }).getQuads(nn(SECRET), null, null, null).length, 0);
  assert.equal(store.size, before);
  assert.equal(validateVisibilityCoverage(store, { sensitiveClasses: ['urn:HiddenCard'] }).length, 0);
});

test('AES-GCM payloads bind ciphertext to authenticated game context', async () => {
  const key = await generateSymmetricKey(); const aad = { gameId: 'g1', playerIri: PLAYER_A };
  const encrypted = await encryptJson({ cards: ['a', 'b'] }, key, { additionalData: aad });
  assert.deepEqual(await decryptJson(encrypted, key, { expectedAdditionalData: aad }), { cards: ['a', 'b'] });
  await assert.rejects(() => decryptJson(encrypted, key, { expectedAdditionalData: { gameId: 'g2', playerIri: PLAYER_A } }));
});

test('encrypted RDF capsules expose only the supplied audience partition', async () => {
  const key = await generateSymmetricKey(); const publicQuads = [q(PUBLIC, 'urn:label', literal('Round 2'))]; const privateQuads = [q(SECRET, 'urn:label', literal('Knife'))];
  const capsule = await createEncryptedRdfCapsule({ gameId: 'g1', gameVersion: '1', schemaVersion: '1', gameCode: 'TABLE7', playerIri: PLAYER_A, publicQuads, privateQuads, key });
  assert.equal(JSON.stringify(capsule).includes('Knife'), false);
  const opened = await openEncryptedRdfCapsule(capsule, key); assert.equal(opened.privateQuads[0].object.value, 'Knife');
});

test('commitments verify exact canonical values and reject changes', async () => {
  const commitment = await createCommitment({ room: 'library', suspect: 'butler' });
  assert.equal(await verifyCommitment({ suspect: 'butler', room: 'library' }, commitment), true);
  assert.equal(await verifyCommitment({ room: 'hall', suspect: 'butler' }, commitment), false);
});

test('ECDH disclosures decrypt only for the targeted identity', async () => {
  const alice = await generateDisclosureIdentity(); const bob = await generateDisclosureIdentity(); const eve = await generateDisclosureIdentity();
  const disclosure = await createDisclosure({ gameId: 'g1', senderIri: PLAYER_A, recipientIri: PLAYER_B, disclosureId: 'd1', payload: { card: SECRET }, senderPrivateKey: alice.privateKey, recipientPublicKey: bob.publicKey });
  assert.deepEqual(await openDisclosure(disclosure, { recipientPrivateKey: bob.privateKey, senderPublicKey: alice.publicKey }), { card: SECRET });
  await assert.rejects(() => openDisclosure(disclosure, { recipientPrivateKey: eve.privateKey, senderPublicKey: alice.publicKey }));
});

test('fragment invitations round-trip without putting secrets in the query string', () => {
  const url = createInvitationUrl('https://example.test/player/', { gameCode: 'TABLE7', capsule: 'secret-token' });
  assert.equal(new URL(url).search, ''); assert.deepEqual(readInvitationUrl(url), { capsule: 'secret-token', gameCode: 'TABLE7' });
});

test('PIN wrapping round-trips but remains explicitly a local convenience lock', async () => {
  const secret = randomBytes(32); const wrapped = await wrapSecretWithPin(secret, '8492');
  assert.deepEqual(await unwrapSecretWithPin(wrapped, '8492'), secret); await assert.rejects(() => unwrapSecretWithPin(wrapped, '0000'));
});

test('pass-and-play privacy screen requires confirmation and conceals on blur', () => {
  const screen = createPrivacyScreen({ maxRevealMs: 0 }); assert.throws(() => screen.reveal(PLAYER_A));
  assert.equal(screen.reveal(PLAYER_A, { userConfirmed: true }).status, 'revealed'); screen.handleVisibilityChange(true); assert.equal(screen.getState().status, 'concealed'); screen.dispose();
});
