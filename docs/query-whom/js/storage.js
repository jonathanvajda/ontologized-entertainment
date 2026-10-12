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
  return {
    db, read,
    async cacheArtifacts(manifest, resources) {
      const tx = db.transaction('artifacts', 'readwrite'), done = waitForIdbTransaction(tx);
      const store = tx.objectStore('artifacts');
      store.put({ id: 'manifest', value: manifest });
      for (const [id, text] of resources) store.put({ id, sha256: manifest.files[id], text });
      await done;
    },
    async save(sessionId, value, expectedRevision = 0) {
      const tx = db.transaction(['sessions', 'settings'], 'readwrite'), done = waitForIdbTransaction(tx);
      // Attach the rejection handler immediately, including an intentional conflict abort.
      done.catch(() => {});
      const store = tx.objectStore('sessions'), current = await resolveIdbRequest(store.get(sessionId));
      if ((current?.revision || 0) !== expectedRevision) { tx.abort(); await done.catch(() => {}); throw new Error('This game changed in another tab. Reload to resume its latest save.'); }
      const revision = expectedRevision + 1;
      store.put({ id: sessionId, revision, value, updatedAt: new Date().toISOString() });
      tx.objectStore('settings').put({ id: 'active', value: sessionId });
      await done; return revision;
    },
    async list() {
      const tx = db.transaction('sessions', 'readonly'), done = waitForIdbTransaction(tx);
      const values = await resolveIdbRequest(tx.objectStore('sessions').getAll()); await done;
      return values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  };
}
