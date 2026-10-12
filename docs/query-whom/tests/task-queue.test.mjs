import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskQueue } from '../js/task-queue.js';

test('an import arriving during home loading runs after loading finishes', async () => {
  const enqueue = createTaskQueue(), events = [];
  let finishHome;
  const loading = new Promise(resolve => { finishHome = resolve; });
  const home = enqueue(async () => { events.push('home visible'); await loading; events.push('home ready'); });
  await Promise.resolve();
  const imported = enqueue(() => events.push('import validated'));
  assert.deepEqual(events, ['home visible']);
  finishHome(); await Promise.all([home, imported]);
  assert.deepEqual(events, ['home visible', 'home ready', 'import validated']);
});

test('a rejected operation does not prevent the next queued event', async () => {
  const enqueue = createTaskQueue();
  const failed = enqueue(() => { throw new Error('invalid save'); });
  const next = enqueue(() => 'ready');
  await assert.rejects(failed, /invalid save/);
  assert.equal(await next, 'ready');
});
