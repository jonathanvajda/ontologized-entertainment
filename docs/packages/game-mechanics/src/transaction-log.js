import { applyDelta, invertDelta } from './rdf-store.js';
import { success, failure } from './result.js';

export class TransactionLog {
  #entries = [];
  #cursor = 0;
  constructor(entries = []) { this.restore(entries); }
  get cursor() { return this.#cursor; }
  entries() { return this.#entries.map(structuredCloneSafe); }
  append(record) {
    this.#entries.splice(this.#cursor);
    const entry = { sequence: this.#cursor + 1, ...structuredCloneSafe(record) };
    this.#entries.push(entry);
    this.#cursor = this.#entries.length;
    return entry;
  }
  undo(store) {
    if (!this.#cursor) return failure('NOTHING_TO_UNDO', 'No committed transaction can be undone.');
    const entry = this.#entries[this.#cursor - 1];
    applyDelta(store, invertDelta(entry.delta));
    this.#cursor -= 1;
    return success(entry);
  }
  redo(store) {
    if (this.#cursor >= this.#entries.length) return failure('NOTHING_TO_REDO', 'No transaction can be redone.');
    const entry = this.#entries[this.#cursor];
    applyDelta(store, entry.delta);
    this.#cursor += 1;
    return success(entry);
  }
  replay(store, count = this.#entries.length) {
    this.#entries.slice(0, count).forEach((entry) => applyDelta(store, entry.delta));
    this.#cursor = Math.min(count, this.#entries.length);
    return store;
  }
  restore(entries = [], cursor = entries.length) {
    this.#entries = structuredCloneSafe(entries);
    this.#cursor = Math.max(0, Math.min(cursor, this.#entries.length));
    return this;
  }
}

function structuredCloneSafe(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
