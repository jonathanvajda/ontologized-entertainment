import { createGameDatabase } from '../packages/game-mechanics/src/persistence.js';
import { literal, namedNode, quad } from '../packages/game-mechanics/src/rdf-store.js';
import { CARDS, NS } from './game-config.js';

const DATABASE_NAME = 'everything-is-sus-local-v1';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const PRIVATE_TYPE = NS + 'PrivatePlayerState';
const predicates = {
  type: RDF + 'type',
  privateTableCode: NS + 'privateTableCode',
  privateStateForPerson: NS + 'privateStateForPerson',
  hasPrivateCard: NS + 'hasPrivateCard',
  ruledOutCard: NS + 'ruledOutCard',
  privateNotes: NS + 'privateNotes'
};

export async function openEverythingsSusStorage({ indexedDBRef = globalThis.indexedDB } = {}) {
  const db = await createGameDatabase({ name: DATABASE_NAME, version: 1, indexedDBRef });

  return {
    async saveGame(mode, gameOrSnapshot) {
      const snapshot = typeof gameOrSnapshot?.snapshot === 'function' ? gameOrSnapshot.snapshot() : gameOrSnapshot;
      if (!snapshot?.quads || !snapshot?.code) throw new TypeError('A complete RDF game snapshot is required.');
      const id = `game:${mode}:${snapshot.code}`;
      const record = { id, kind: 'rdf-game-state', mode, code: snapshot.code, updatedAt: new Date().toISOString(), snapshot };
      await writeSaveAndPointer(db, record, gamePointer(mode));
      return record;
    },

    async loadActiveGame(mode) {
      const pointer = await read(db, 'preferences', gamePointer(mode));
      return pointer?.value ? read(db, 'saveStates', pointer.value) : null;
    },

    async clearActiveGame(mode, { deleteSave = true } = {}) {
      const key = gamePointer(mode);
      const pointer = await read(db, 'preferences', key);
      await transaction(db, ['preferences', 'saveStates'], 'readwrite', ({ preferences, saveStates }) => {
        preferences.delete(key);
        if (deleteSave && pointer?.value) saveStates.delete(pointer.value);
      });
    },

    async savePrivateState({ tableCode, suspectId, cardIds = [], markedCardIds = [], notes = '', makeActive = true }) {
      const state = normalizePrivateState({ tableCode, suspectId, cardIds, markedCardIds, notes });
      const id = privateId(state.tableCode, state.suspectId);
      const record = { id, kind: 'rdf-private-player-state', updatedAt: new Date().toISOString(), quads: privateStateQuads(state) };
      if (makeActive) await writeSaveAndPointer(db, record, playerPointer());
      else await write(db, 'saveStates', record);
      return record;
    },

    async loadPrivateState(tableCode, suspectId) {
      const record = await read(db, 'saveStates', privateId(tableCode, suspectId));
      return record ? parsePrivateState(record.quads) : null;
    },

    async loadActivePrivateState() {
      const pointer = await read(db, 'preferences', playerPointer());
      const record = pointer?.value ? await read(db, 'saveStates', pointer.value) : null;
      return record ? parsePrivateState(record.quads) : null;
    },

    async clearActivePrivateState() {
      await transaction(db, ['preferences'], 'readwrite', ({ preferences }) => preferences.delete(playerPointer()));
    },

    close() { db.close(); }
  };
}

export function privateStateQuads(input) {
  const state = normalizePrivateState(input);
  const subject = namedNode(`${NS}private-state/${encodeURIComponent(state.tableCode)}/${encodeURIComponent(state.suspectId)}`);
  const make = (predicate, object) => quad(subject, namedNode(predicate), object);
  return [
    make(predicates.type, namedNode(PRIVATE_TYPE)),
    make(predicates.privateTableCode, literal(state.tableCode)),
    make(predicates.privateStateForPerson, namedNode(NS + 'person-' + state.suspectId)),
    ...state.cardIds.map((id) => make(predicates.hasPrivateCard, namedNode(NS + 'card-' + id))),
    ...state.markedCardIds.map((id) => make(predicates.ruledOutCard, namedNode(NS + 'card-' + id))),
    make(predicates.privateNotes, literal(state.notes, XSD + 'string'))
  ];
}

export function parsePrivateState(quads = []) {
  const value = (predicate) => quads.find((item) => item.predicate.value === predicate)?.object.value || '';
  const values = (predicate) => quads.filter((item) => item.predicate.value === predicate).map((item) => item.object.value);
  const strip = (iri, prefix) => iri.startsWith(prefix) ? iri.slice(prefix.length) : '';
  return normalizePrivateState({
    tableCode: value(predicates.privateTableCode),
    suspectId: strip(value(predicates.privateStateForPerson), NS + 'person-'),
    cardIds: values(predicates.hasPrivateCard).map((iri) => strip(iri, NS + 'card-')),
    markedCardIds: values(predicates.ruledOutCard).map((iri) => strip(iri, NS + 'card-')),
    notes: value(predicates.privateNotes)
  });
}

function normalizePrivateState({ tableCode, suspectId, cardIds = [], markedCardIds = [], notes = '' }) {
  const known = new Set(CARDS.map((card) => card.id));
  return {
    tableCode: String(tableCode || '').trim().toUpperCase(),
    suspectId: String(suspectId || '').trim(),
    cardIds: [...new Set(cardIds)].filter((id) => known.has(id)),
    markedCardIds: [...new Set(markedCardIds)].filter((id) => known.has(id)),
    notes: String(notes || '')
  };
}

const gamePointer = (mode) => `active-game:${mode}`;
const playerPointer = () => 'active-private:player';
const privateId = (tableCode, suspectId) => `private:${String(tableCode).trim().toUpperCase()}:${suspectId}`;

async function writeSaveAndPointer(db, record, pointerId) {
  await transaction(db, ['saveStates', 'preferences'], 'readwrite', ({ saveStates, preferences }) => {
    saveStates.put(record);
    preferences.put({ id: pointerId, value: record.id, updatedAt: record.updatedAt });
  });
}

function read(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function write(db, storeName, record) {
  return transaction(db, [storeName], 'readwrite', (stores) => stores[storeName].put(record));
}

function transaction(db, storeNames, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('The local save transaction was aborted.'));
    try { operation(stores); } catch (error) { tx.abort(); reject(error); }
  });
}
