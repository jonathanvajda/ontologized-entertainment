import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { N3, root, manifest, catalogQuads, baseStore } from './helpers.mjs';
import { projectCatalog, sortedCards } from '../js/catalog.js';
import { Q, TYPE, PART, BEARER, personIri, prefixes, CCO_SHA256, traitFields } from '../js/vocabulary.js';

test('44 supplied people have complete RDF projections and stable identity', () => {
  const catalog = projectCatalog(baseStore, manifest);
  assert.equal(catalog.length, 44); assert.equal(catalog[0].name, 'Oliver'); assert.equal(catalog[24].name, 'Ava');
  assert.equal(catalog[38].name, 'Ella'); assert.equal(catalog[39].name, 'Katherine'); assert.equal(catalog[43].name, 'Avery');
  assert.equal(catalog[0].ethnicity, 'White');
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
test('revised named characters retain their intended CSV and RDF traits', () => {
  const catalog = projectCatalog(baseStore, manifest);
  assert.equal(catalog[3].name, 'Noah'); assert.equal(catalog[3].hairColor, 'Red');
  assert.equal(catalog[6].name, 'Joshua'); assert.equal(catalog[6].hairColor, 'Brown');
  assert.equal(catalog[12].name, 'Levi'); assert.equal(catalog[12].hairColor, 'Brown');
  assert.equal(catalog[38].name, 'Ella'); assert.equal(catalog[38].traits['Eye openness'], 'Open');
  assert.equal(catalog[38].traits['Eye direction'], 'Forward');
  assert.equal(catalog[9].ethnicity, 'East Asian');
  assert.equal(catalog[35].name, 'Lily'); assert.equal(catalog[35].ethnicity, 'East Asian');
  assert.equal(catalog[11].name, 'Emmanuel'); assert.equal(catalog[11].ethnicity, 'Black or African American');
  assert.equal(catalog[5].ethnicity, 'South Asian'); assert.equal(catalog[5].traits.Mustache, 'No');
  assert.equal(catalog[3].traits.Freckles, 'Yes'); assert.equal(catalog[6].traits.Freckles, 'No');
  assert.equal(catalog[9].traits['Hair texture'], 'Straight');
  assert.equal(catalog[11].traits['Hair texture'], 'Curly');
  assert.equal(manifest.deckVersion, 5);
  assert.equal(manifest.personCount, 44);
  assert.equal(catalog[40].name, 'Christopher'); assert.equal(catalog[40].hairColor, 'Light brown'); assert.equal(catalog[40].eyeColor, 'Green');
  assert.equal(catalog[41].name, 'Kelvin'); assert.equal(catalog[41].traits.Bald, 'Yes'); assert.equal(catalog[41].traits['Eye direction'], 'Forward');
  assert.equal(catalog[39].name, 'Katherine'); assert.equal(catalog[39].traits.Glasses, 'Yes');
  assert.equal(catalog[42].name, 'Elloise'); assert.equal(catalog[42].hairColor, 'Light brown'); assert.equal(catalog[42].traits['Hair length'], 'Long'); assert.equal(catalog[42].traits['Hair texture'], 'Straight');
  assert.equal(catalog[43].name, 'Avery'); assert.equal(catalog[43].traits['Hair texture'], 'Straight'); assert.equal(catalog[43].traits.Hat, 'No'); assert.equal(catalog[43].traits['Hat type'], 'None');
});
test('current texture and freckle distributions include the portrait revisions', () => {
  const catalog = projectCatalog(baseStore, manifest);
  const counts = field => catalog.reduce((result, person) => {
    const value = person.traits[field]; result[value] = (result[value] || 0) + 1; return result;
  }, {});
  assert.deepEqual(counts('Hair texture'), { Coily: 8, Curly: 9, 'Not applicable': 4, Straight: 11, Wavy: 12 });
  assert.deepEqual(counts('Freckles'), { No: 36, Yes: 8 });
});

test('four revised women have matching complete RDF traits', () => {
  const catalog = projectCatalog(baseStore, manifest);
  const faith = catalog[21], olivia = catalog[23], elizabeth = catalog[29], sophia = catalog[32];
  assert.equal(faith.name, 'Faith'); assert.equal(faith.eyeColor, 'Brown');
  assert.equal(faith.traits['Hair texture'], 'Wavy'); assert.equal(faith.traits.Hairstyle, 'Side part');
  assert.equal(faith.traits['Hair accessory'], 'Hair clip');
  for (const person of [faith, elizabeth]) {
    assert.equal(person.traits.Hat, 'No'); assert.equal(person.traits['Hat type'], 'None');
    assert.equal(person.traits['Hat color'], 'Not applicable'); assert.equal(person.traits['Hat accessory'], 'None');
  }
  for (const person of [olivia, elizabeth, sophia]) assert.equal(person.traits['Hair length'], 'Long');
  assert.equal(olivia.name, 'Olivia'); assert.equal(olivia.traits.Hairstyle, 'French braid'); assert.equal(olivia.traits.Bow, 'Yes');
  assert.equal(elizabeth.name, 'Elizabeth'); assert.equal(elizabeth.traits.Hairstyle, 'Ponytail'); assert.equal(elizabeth.traits.Glasses, 'Yes');
  assert.equal(sophia.name, 'Sophia'); assert.equal(sophia.ethnicity, 'Black or African American');
  assert.equal(sophia.traits['Skin tone'], 'Medium-brown'); assert.equal(sophia.traits['Hair texture'], 'Wavy');
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
  for (const [child,parent] of [['BlondeHairColor','ont00000026'],['LightBrownHairColor','ont00000026'],['HazelEyeColor','ont00000044'],['WhiteEthnicity','ont00000780'],['Head','ont00000084']]) assert(closure.countQuads(Q(child), prefixes.rdfs + 'subClassOf', prefixes.cco + parent, null));
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
test('hair-color sorting keeps brunette shades together and bald people last', () => {
  const catalog = projectCatalog(baseStore, manifest);
  const cards = catalog.map(({ id }) => ({ id }));
  const colors = sortedCards(cards, 'hairColor', catalog).map(card => catalog[card.id - 1].hairColor);
  assert.deepEqual([...new Set(colors)], [
    'Black',
    'Brown',
    'Light brown',
    'Red',
    'Blonde',
    'Black going grey/white',
    'Brown going grey/white',
    'Fully white/grey',
    'Bald'
  ]);
  assert(colors.slice(-4).every(color => color === 'Bald'));
});
test('full generated Oliver diagram contains real type and descriptive edges', async () => {
  const diagram = await readFile(new URL('ontology/oliver-example.md',root),'utf8');
  assert(diagram.includes('rdf:type')); assert(diagram.includes('cco:ont00001262')); assert(diagram.includes('qw:hasNoseSize'));
  assert(diagram.includes('qw:hasHatColor')); assert(diagram.includes('qw:person-01-left-eye'));
});
