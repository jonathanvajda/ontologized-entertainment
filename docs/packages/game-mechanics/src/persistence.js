const STORES = ['games', 'saveStates', 'transactionLogs', 'preferences', 'cachedGameAssets'];

export function createGameDatabase({ name = 'ontoeagle-games', version = 1, indexedDBRef = globalThis.indexedDB } = {}) {
  if (!indexedDBRef) throw new Error('IndexedDB is unavailable.');
  return new Promise((resolve, reject) => {
    const request = indexedDBRef.open(name, version);
    request.onupgradeneeded = () => STORES.forEach((store) => {
      if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' });
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(db, storeName, record) { return request(db, storeName, 'readwrite', (store) => store.put(record)); }
export async function getRecord(db, storeName, id) { return request(db, storeName, 'readonly', (store) => store.get(id)); }
export async function listRecords(db, storeName) { return request(db, storeName, 'readonly', (store) => store.getAll()); }
export async function deleteRecord(db, storeName, id) { return request(db, storeName, 'readwrite', (store) => store.delete(id)); }

function request(db, storeName, mode, operation) {
  if (!STORES.includes(storeName)) return Promise.reject(new TypeError(`Unknown game data store: ${storeName}`));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode); const req = operation(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

export { STORES as GAME_DATABASE_STORES };
