import { openIndexedDbStore, resolveIdbRequest, waitForIdbTransaction } from '../../packages/indexeddb-data-management/src/indexeddb-adapter.js';

export async function openStorage(indexedDBRef = globalThis.indexedDB) {
  const db = await openIndexedDbStore({ name: 'query-whom-v1', version: 1, stores: [
    { name: 'sessions', options: { keyPath: 'id' } }, { name: 'settings', options: { keyPath: 'id' } },
    { name: 'artifacts', options: { keyPath: 'id' } }
  ] }, { indexedDBRef });
  async function read(store, id) {
    const tx = db.transaction(store, 'readonly'), done = waitForIdbTransaction(tx);
    const value = await resolveIdbRequest(tx.objectStore(store).get(id)); await done; return value;
  }
  async function changeLifecycle(sessionId, expectedRevision, status, keepSave = true) {
    const tx = db.transaction(['sessions', 'settings'], 'readwrite'), done = waitForIdbTransaction(tx);
    done.catch(() => {});
    const sessions = tx.objectStore('sessions'), settings = tx.objectStore('settings');
    const current = await resolveIdbRequest(sessions.get(sessionId));
    if (!current || current.revision !== expectedRevision || current.status === 'ended') {
      tx.abort(); await done.catch(() => {});
      throw new Error('This game changed or ended in another tab. Reload before continuing.');
    }
    const revision = expectedRevision + 1, now = new Date().toISOString();
    if (keepSave) sessions.put({ ...current, revision, status, updatedAt: now, ...(status === 'ended' ? { endedAt: now } : {}) });
    else sessions.delete(sessionId);
    const active = await resolveIdbRequest(settings.get('active'));
    if (active?.value === sessionId) settings.delete('active');
    await done;
    return revision;
  }
  return {
    db, read,
    async cacheArtifacts(manifest, resources) {
      const tx = db.transaction('artifacts', 'readwrite'), done = waitForIdbTransaction(tx);
      const store = tx.objectStore('artifacts');
      store.put({ id: 'manifest', value: manifest });
      for (const [id, text] of resources) store.put({ id, sha256: manifest.files[id], text });
      await done;
    },
    async save(sessionId, value, expectedRevision = 0, { allowReopen = false } = {}) {
      const tx = db.transaction(['sessions', 'settings'], 'readwrite'), done = waitForIdbTransaction(tx);
      // Attach the rejection handler immediately, including an intentional conflict abort.
      done.catch(() => {});
      const store = tx.objectStore('sessions'), current = await resolveIdbRequest(store.get(sessionId));
      if ((current?.revision || 0) !== expectedRevision || current?.status === 'ended' && !allowReopen) { tx.abort(); await done.catch(() => {}); throw new Error('This game changed or ended in another tab. Reload to resume its latest save.'); }
      const revision = expectedRevision + 1;
      store.put({ id: sessionId, revision, value, status: 'active', updatedAt: new Date().toISOString() });
      tx.objectStore('settings').put({ id: 'active', value: sessionId });
      await done; return revision;
    },
    pause(sessionId, expectedRevision) { return changeLifecycle(sessionId, expectedRevision, 'paused'); },
    end(sessionId, expectedRevision, { keepHistory = false } = {}) { return changeLifecycle(sessionId, expectedRevision, 'ended', keepHistory); },
    async removeFinished(sessionId, expectedRevision) {
      const tx = db.transaction('sessions', 'readwrite'), done = waitForIdbTransaction(tx); done.catch(() => {});
      const store = tx.objectStore('sessions'), current = await resolveIdbRequest(store.get(sessionId));
      if (!current || current.status !== 'ended' || current.revision !== expectedRevision) {
        tx.abort(); await done.catch(() => {}); throw new Error('The finished-game record changed. Refresh the list.');
      }
      store.delete(sessionId); await done;
    },
    async list({ includeEnded = false } = {}) {
      const tx = db.transaction('sessions', 'readonly'), done = waitForIdbTransaction(tx);
      const values = await resolveIdbRequest(tx.objectStore('sessions').getAll()); await done;
      return values.filter(record => includeEnded || record.status !== 'ended').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  };
}
