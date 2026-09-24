const DEFAULT_GRAPH = Object.freeze({ termType: 'DefaultGraph', value: '' });

export const namedNode = (value) => ({ termType: 'NamedNode', value: String(value) });
export const literal = (value, datatype = 'http://www.w3.org/2001/XMLSchema#string') => ({
  termType: 'Literal',
  value: String(value),
  language: '',
  datatype: namedNode(datatype)
});
export const quad = (subject, predicate, object, graph = DEFAULT_GRAPH) => ({ subject, predicate, object, graph });

const termKey = (term = DEFAULT_GRAPH) => `${term.termType}:${term.value}:${term.language || ''}:${term.datatype?.value || ''}`;
export const quadKey = (item) => [item.subject, item.predicate, item.object, item.graph || DEFAULT_GRAPH].map(termKey).join('|');

/** Small RDF/JS-compatible default-graph store. N3.Store may be supplied instead. */
export class RdfStore {
  #quads = new Map();

  constructor(quads = []) { this.addQuads(quads); }
  get size() { return this.#quads.size; }
  addQuad(item) { this.#quads.set(quadKey(item), item); return this; }
  addQuads(items = []) { for (const item of items) this.addQuad(item); return this; }
  removeQuad(item) { this.#quads.delete(quadKey(item)); return this; }
  removeQuads(items = []) { for (const item of items) this.removeQuad(item); return this; }
  has(item) { return this.#quads.has(quadKey(item)); }
  getQuads(subject = null, predicate = null, object = null, graph = null) {
    return [...this.#quads.values()].filter((item) =>
      matches(item.subject, subject) && matches(item.predicate, predicate) &&
      matches(item.object, object) && matches(item.graph || DEFAULT_GRAPH, graph));
  }
  match(...args) { return new RdfStore(this.getQuads(...args)); }
  clone() { return new RdfStore(this.getQuads()); }
  [Symbol.iterator]() { return this.#quads.values(); }
}

function matches(actual, expected) {
  return expected == null || termKey(actual) === termKey(expected);
}

export function cloneStore(store) {
  if (!store?.getQuads) throw new TypeError('A store with getQuads() is required.');
  const items = store.getQuads(null, null, null, null);
  try { return new store.constructor(items); } catch { return new RdfStore(items); }
}

export function applyDelta(store, { additions = [], removals = [] } = {}) {
  if (!store?.addQuad || !store?.removeQuad) throw new TypeError('A mutable RDF/JS store is required.');
  removals.forEach((item) => store.removeQuad(item));
  additions.forEach((item) => store.addQuad(item));
  return store;
}

export function invertDelta({ additions = [], removals = [] } = {}) {
  return { additions: [...removals], removals: [...additions] };
}

export function assertDefaultGraph(items = []) {
  const named = items.find((item) => item.graph?.termType && item.graph.termType !== 'DefaultGraph');
  if (named) throw new TypeError('Named graphs are outside the baseline canonical-state contract.');
  return items;
}
