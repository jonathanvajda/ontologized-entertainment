import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openStorage } from '../js/storage.js';

test('ten games saved through separate connections retain independent progress', async () => {
  const factory = new IDBFactory();
  const connections = await Promise.all(Array.from({ length: 10 }, () => openStorage(factory)));
  try {
    await Promise.all(connections.map((storage, i) => storage.save(`game-${i}`, { state: `initial-${i}` })));
    await Promise.all(connections.map((storage, i) => storage.save(`game-${i}`, { state: `progress-${i}` }, 1)));
    const records = await connections[0].list(); assert.equal(records.length, 10);
    for (let i = 0; i < 10; i++) {
      const record = await connections[i].read('sessions', `game-${i}`);
      assert.equal(record.revision, 2); assert.equal(record.value.state, `progress-${i}`);
    }
    await assert.rejects(connections[1].save('game-0', { state: 'stale' }, 1), /another tab/);
    assert.equal((await connections[0].read('sessions', 'game-0')).value.state, 'progress-0');
  } finally { connections.forEach(storage => storage.db.close()); }
});

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
test('pause clears automatic resume but preserves progress for explicit resume', async () => {
  const storage = await openStorage(new IDBFactory());
  await storage.save('game', { state: 'progress' });
  assert.equal(await storage.pause('game', 1), 2);
  assert.equal(await storage.read('settings', 'active'), undefined);
  const record = await storage.read('sessions', 'game');
  assert.equal(record.status, 'paused'); assert.equal(record.value.state, 'progress');
  assert.equal((await storage.list()).length, 1);
  await storage.save('game', record.value, record.revision);
  assert.equal((await storage.read('sessions', 'game')).status, 'active');
  assert.equal((await storage.read('settings', 'active')).value, 'game');
  storage.db.close();
});
test('ending without history removes the save and rejects stale resurrection', async () => {
  const storage = await openStorage(new IDBFactory());
  await storage.save('game', { state: 'progress' });
  await storage.end('game', 1);
  assert.equal(await storage.read('sessions', 'game'), undefined);
  assert.equal(await storage.read('settings', 'active'), undefined);
  assert.equal((await storage.list()).length, 0);
  await assert.rejects(storage.save('game', { state: 'stale' }, 1), /another tab/);
  assert.equal(await storage.read('sessions', 'game'), undefined);
  storage.db.close();
});
test('finished history stays out of resume lists and cannot be silently reopened', async () => {
  const storage = await openStorage(new IDBFactory());
  await storage.save('game', { state: 'progress' });
  await storage.end('game', 1, { keepHistory: true });
  const record = await storage.read('sessions', 'game');
  assert.equal(record.status, 'ended'); assert.equal(record.revision, 2); assert(record.endedAt);
  assert.equal((await storage.list()).length, 0);
  assert.equal((await storage.list({ includeEnded: true })).length, 1);
  await assert.rejects(storage.save('game', { state: 'stale' }, 2), /ended/);
  await assert.rejects(storage.pause('game', 2), /ended/);
  await storage.removeFinished('game', 2);
  assert.equal((await storage.list({ includeEnded: true })).length, 0);
  storage.db.close();
});
test('ending a saved table does not clear another table’s active pointer', async () => {
  const storage = await openStorage(new IDBFactory());
  await storage.save('paused', { state: 'one' }); await storage.pause('paused', 1);
  await storage.save('current', { state: 'two' });
  await assert.rejects(storage.end('paused', 1), /another tab/);
  await storage.end('paused', 2, { keepHistory: true });
  assert.equal((await storage.read('settings', 'active')).value, 'current');
  assert.equal((await storage.list()).length, 1);
  storage.db.close();
});
