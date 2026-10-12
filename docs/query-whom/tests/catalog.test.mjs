import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { N3, root, manifest, catalogQuads, baseStore } from './helpers.mjs';
import { projectCatalog, sortedCards } from '../js/catalog.js';
import { Q, TYPE, PART, BEARER, personIri, prefixes, CCO_SHA256, traitFields } from '../js/vocabulary.js';

test('40 supplied people have complete RDF projections and stable identity', () => {
  const catalog = projectCatalog(baseStore, manifest);
  assert.equal(catalog.length, 40); assert.equal(catalog[0].name, 'Oliver'); assert.equal(catalog[24].name, 'Ava');
  assert.equal(catalog[38].name, 'Ella'); assert.equal(catalog[0].ethnicity, 'White');
  assert.equal(catalog[0].hairColor, 'Blonde'); assert.equal(catalog[0].eyeColor, 'Hazel');
  for (const person of catalog) assert.equal(Object.keys(person.traits).length, Object.keys(traitFields).length + 1);
  assert(catalog.every(person => person.portraitPath === `portraits/person-${String(person.id).padStart(2,'0')}.png`));
});
test('bald persons have no scalp-hair or scalp-hair-color instance', () => {
  const catalog = projectCatalog(baseStore);
  for (const person of catalog.filter(person => person.traits.Bald === 'Yes')) {
    const head = baseStore.getQuads(person.iri, PART, null, null)[0].object;
    const parts = baseStore.getQuads(head, PART, null, null).map(q => q.object);
    assert(!parts.some(part => baseStore.countQuads(part, TYPE, prefixes.cco + 'ont00000058', null)));
    assert.equal(baseStore.countQuads(personIri(person.id) + '-hair-color', null, null, null), 0);
  }
});
test('CCO identity, class ancestry, local import closure and hashes', async () => {
  const ccoBytes = await readFile(new URL('ontology/CommonCoreOntologiesMerged.ttl', root));
  assert.equal(createHash('sha256').update(ccoBytes).digest('hex'), CCO_SHA256);
  const closure = new N3.Store();
  for (const file of new Set(Object.values(manifest.imports))) {
    const bytes = await readFile(new URL(file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[file]);
    const parsed = new N3.Parser().parse(bytes.toString()); closure.addQuads(parsed);
    for (const q of parsed) { assert.equal(q.graph.termType, 'DefaultGraph'); if (q.predicate.value === prefixes.owl + 'imports') assert(manifest.imports[q.object.value]); }
  }
  assert(closure.countQuads(prefixes.cco + 'ont00001262', prefixes.rdfs + 'label', null, null));
  for (const [child,parent] of [['BlondeHairColor','ont00000026'],['HazelEyeColor','ont00000044'],['WhiteEthnicity','ont00000780'],['Head','ont00000084']]) assert(closure.countQuads(Q(child), prefixes.rdfs + 'subClassOf', prefixes.cco + parent, null));
  for (const q of catalogQuads) if (q.predicate.value === TYPE && q.object.value !== prefixes.owl + 'Ontology') assert(closure.countQuads(q.object, TYPE, prefixes.owl + 'Class', null));
  const ownQuality = baseStore.getQuads(personIri(1), BEARER, null, null).map(q => q.object);
  assert(ownQuality.some(q => baseStore.countQuads(q, TYPE, Q('WhiteEthnicity'), null)));
});
test('malformed catalog fails; sort never mutates membership', () => {
  const broken = new N3.Store(catalogQuads); broken.removeQuads(broken.getQuads(personIri(1), Q('personNumber'), null, null));
  assert.throws(() => projectCatalog(broken));
  const cards = [{id:2,active:true},{id:1,active:false}], copy = structuredClone(cards);
  assert.deepEqual(sortedCards(cards, 'name', projectCatalog(baseStore)).map(c=>c.id), [2,1]);
  assert.deepEqual(cards,copy);
});
test('full generated Oliver diagram contains real type and descriptive edges', async () => {
  const diagram = await readFile(new URL('ontology/oliver-example.md',root),'utf8');
  assert(diagram.includes('rdf:type')); assert(diagram.includes('cco:ont00001262')); assert(diagram.includes('qw:hasNoseSize'));
  assert(diagram.includes('qw:hasHatColor')); assert(diagram.includes('qw:person-01-left-eye'));
});
