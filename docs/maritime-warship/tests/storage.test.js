import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMaritimeGame } from '../model/game.js';
import { createSetup, boardSeed } from '../network.js';
import { localSave, saveActive, loadActive, loadMatch, listMatches } from '../storage.js';
import { createGameDatabase, putRecord } from '../../packages/game-mechanics/src/persistence.js';

const require = createRequire(new URL('../../query-whom/package.json', import.meta.url));
globalThis.indexedDB = require('fake-indexeddb').indexedDB;

test('legacy journal migration, independent RDF saves, resuming and ending preserve other games', async () => {
  const setup = await createSetup({}, 'saved-ocean');
  const create = name => createMaritimeGame(setup.config, { boardSeed: boardSeed(setup), name });
  const legacy = create('Legacy game'), first = create('Saturday with Sam'), second = create('Sunday with Alex');
  const connection = await createGameDatabase({ name: 'maritime-warship-local-v2' });
  await putRecord(connection, 'saveStates', { id: 'local-player', value: localSave(legacy, setup) });
  await putRecord(connection, 'preferences', { id: 'active', audience: 'local-player' });
  assert.equal((await listMatches()).length, 1);
  assert.equal((await loadMatch(legacy.sessionId)).sessionId, legacy.sessionId);

  await first.act('autoPlace'); await first.act('lockFleet');
  await first.act('recordReport', { direction: 'outgoing', reports: [{ coordinate: 'A1', type: 'Hit' }] });
  await saveActive(localSave(first, setup));
  const firstRecord = await loadMatch(first.sessionId);
  await saveActive(localSave(second, setup));
  assert.equal((await loadActive()).sessionId, second.sessionId);
  assert.deepEqual(await loadMatch(first.sessionId), firstRecord, 'Starting another game never overwrites the first journal');
  const entries = await listMatches();
  assert.equal(entries.length, 3);
  assert.equal(entries.find(entry => entry.id === first.sessionId).shots, 1);
  assert.equal(entries.find(entry => entry.id === first.sessionId).name, 'Saturday with Sam');
  assert.equal(entries.find(entry => entry.id === first.sessionId).status, 'active');

  await first.act('endGame'); await saveActive(localSave(first, setup));
  assert.equal((await loadActive()).sessionId, second.sessionId, 'Ending a different journal preserves the active pointer');
  assert.equal((await listMatches()).find(entry => entry.id === first.sessionId).status, 'ended');
  assert.equal((await loadMatch(first.sessionId)).transactions.at(-1).action.actionType, 'endGame');
  await second.act('endGame'); await saveActive(localSave(second, setup));
  assert.equal(await loadActive(), null);
  assert.deepEqual((await loadMatch(legacy.sessionId)).quads, localSave(legacy, setup).quads, 'Migration preserves the original RDF');
  connection.close();
});
