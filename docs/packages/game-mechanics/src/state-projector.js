const iri = (term) => term?.value;

export function createProjection(store, vocabulary = {}) {
  const all = store.getQuads(null, null, null, null);
  const byPredicate = (predicate) => all.filter((item) => iri(item.predicate) === predicate);
  const groupedObjects = (predicate) => group(byPredicate(predicate), (item) => iri(item.subject), (item) => iri(item.object));
  const adjacency = groupedObjects(vocabulary.adjacentTo);
  for (const [source, targets] of adjacency) for (const target of targets) {
    if (!adjacency.has(target)) adjacency.set(target, []);
    if (!adjacency.get(target).includes(source)) adjacency.get(target).push(source);
  }
  return {
    quads: all,
    typesByEntity: groupedObjects(vocabulary.rdfType || 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    adjacencyByTerritory: adjacency,
    piecesByLocation: reverseGroup(byPredicate(vocabulary.locatedIn)),
    membersByAggregate: reverseGroup(byPredicate(vocabulary.memberOf)),
    cardsByContainer: reverseGroup(byPredicate(vocabulary.memberOf)),
    scoreByPlayer: new Map(),
    legalActionsByEntity: new Map()
  };
}

function group(items, key, value) {
  const output = new Map();
  for (const item of items) output.set(key(item), [...(output.get(key(item)) || []), value(item)]);
  return output;
}

function reverseGroup(items) { return group(items, (item) => iri(item.object), (item) => iri(item.subject)); }
