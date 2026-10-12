import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openStorage } from '../js/storage.js';

test('atomic snapshots and active pointer preserve tables and reject stale writes', async () => {
  const db = await openStorage(new IDBFactory());
  assert.equal(await db.save('one',{state:'first'},0),1);
  assert.equal((await db.read('settings','active')).value,'one');
  assert.equal(await db.save('two',{state:'second'},0),1);
  assert.equal((await db.list()).length,2);
  await assert.rejects(db.save('one',{state:'stale'},0),/another tab/);
  assert.equal((await db.read('sessions','one')).value.state,'first');
  assert.equal((await db.read('settings','active')).value,'two');
  assert.equal(await db.save('one',{state:'updated'},1),2);
  assert.equal((await db.read('sessions','one')).value.state,'updated');
  db.db.close();
});
test('artifact records retain schema content and its integrity metadata', async () => {
  const db = await openStorage(new IDBFactory());
  await db.cacheArtifacts({files:{'schema.ttl':'hash'}},new Map([['schema.ttl','data']]));
  const artifact = await db.read('artifacts','schema.ttl'); assert.equal(artifact.text,'data'); assert.equal(artifact.sha256,'hash');
  db.db.close();
});
