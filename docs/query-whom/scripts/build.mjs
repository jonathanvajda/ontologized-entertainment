import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { N3, browserLibrary } from './runtime.mjs';
import { prefixes, Q, TYPE, PART, BEARER, PERSON, CCO_COMMIT, CCO_SHA256, CCO_VERSION, APP_ONTOLOGY, CATALOG_ONTOLOGY, hairClasses, eyeClasses, ethnicityClasses, traitFields } from '../js/vocabulary.js';
import { projectCatalog } from '../js/catalog.js';
import { DECK_VERSION } from '../js/protocol.js';

const root = new URL('../', import.meta.url), check = process.argv.includes('--check');
const path = (relative) => new URL(relative, root);
const hash = data => createHash('sha256').update(data).digest('hex');
const lit = (value, type) => JSON.stringify(String(value)) + (type ? `^^xsd:${type}` : '');
const header = Object.entries(prefixes).map(([p, iri]) => `@prefix ${p}: <${iri}> .`).join('\n') + '\n\n';
const parse = text => new N3.Parser().parse(text);
async function output(relative, text) {
  if (check) assert.equal(await readFile(path(relative), 'utf8'), text, `Stale artifact: ${relative}`);
  else { await mkdir(new URL('.', path(relative)), { recursive: true }); await writeFile(path(relative), text); }
}

const Papa = await browserLibrary(new URL('../../vendor/papaparse.min.js', import.meta.url), 'Papa');
const source = await readFile(path('personal-traits-40-people-alt.csv'), 'utf8');
const parsed = Papa.parse(source, { header: true, skipEmptyLines: true });
assert.equal(parsed.errors.length, 0, 'Invalid CSV');
const rows = parsed.data;
assert.equal(rows.length, 40);
const expected = ['Person', 'Name', 'Sex', 'Race', 'Hair color', 'Eye color', 'Facial hair', ...Object.keys(traitFields)];
assert.deepEqual([...parsed.meta.fields].sort(), expected.sort(), 'CSV columns must match the documented contract');
const ccoText = await readFile(path('ontology/CommonCoreOntologiesMerged.ttl'), 'utf8');
assert.equal(hash(Buffer.from(ccoText)), CCO_SHA256, 'Pinned CCO merged file changed');
const cco = new N3.Store(parse(ccoText));
assert(cco.countQuads(CCO_VERSION, null, null, null) || cco.countQuads(null, prefixes.owl + 'versionIRI', CCO_VERSION, null));
const classes = [
  ['Head', 'cco:ont00000084', 'Head', 'A bodily component consisting of the head of a represented person.'],
  ['Sideburns', 'cco:ont00000157', 'Sideburns', 'Facial hair growing along the sides of a represented person’s face.'],
  ['QueryWhomSession', 'game:GameSession', 'Query Whom session', 'A local process of playing Query Whom.'],
  ['CandidateRole', 'obo:BFO_0000023', 'Candidate role', 'A role borne by a represented person in the context of a local game session.'],
  ['ActiveCandidateRole', 'qw:CandidateRole', 'Active candidate role', 'A candidate role currently considered eligible for an opponent guess.'],
  ['EliminatedCandidateRole', 'qw:CandidateRole', 'Eliminated candidate role', 'A candidate role currently excluded from opponent consideration.'],
  ['RevealTargetAct', 'game:GameAct', 'Reveal target act', 'An act disclosing the local target to its owner.'],
  ['EliminateCandidateAct', 'game:GameAct', 'Eliminate candidate act', 'An act excluding a local candidate.'],
  ['RestoreCandidateAct', 'game:GameAct', 'Restore candidate act', 'An act restoring a local candidate.'],
  ['CreateSessionAct', 'game:GameAct', 'Create session act', 'An act establishing a local game session.'],
  ['AsianEthnicity', 'cco:ont00000780', 'Asian', 'An application ethnicity category corresponding to the supplied Asian heritage categories.']
];
for (const [label, cls] of Object.entries(hairClasses)) classes.push([cls, 'cco:ont00000026', label, `A hair color quality classified as ${label} in the source catalog.`, label]);
for (const [label, cls] of Object.entries(eyeClasses)) classes.push([cls, 'cco:ont00000044', label, `An eye color quality classified as ${label} in the source catalog.`, label]);
for (const [sourceLabel, [cls, label]] of Object.entries(ethnicityClasses)) classes.push([cls, cls.includes('AsianEthnicity') ? 'qw:AsianEthnicity' : 'cco:ont00000780', label, `An application ethnicity quality mapped from the source Race category ${sourceLabel}; this is a curated convention, not an equivalence to a statistical classification.`, sourceLabel]);
const facialValues = [...new Set(rows.map(row => row['Facial hair']))].filter(v => !['None', 'Sideburns'].includes(v));
const facialClass = value => value === 'Sideburns' ? 'Sideburns' : value.replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase()) + 'FacialHair';
for (const value of facialValues) classes.push([facialClass(value), 'cco:ont00000157', value, `A portion of facial hair described as ${value} in the source catalog.`, value]);
let ontology = header + `<${APP_ONTOLOGY}> a owl:Ontology ; owl:versionInfo "1.0.0" ; owl:imports <${CCO_VERSION}>, <https://w3id.org/ontologized-entertainment/game> ; rdfs:label "Query Whom application ontology" ; rdfs:comment "Characters are represented in the game’s modeled world. Portrait files are depictions, not persons. Broad descriptive shortcuts follow the approved model. Ethnicity mappings retain source provenance." .\n\n`;
for (const [cls, parent, label, definition, sourceLabel] of classes) ontology += `qw:${cls} a owl:Class ; rdfs:subClassOf ${parent} ; rdfs:label ${lit(label)} ; skos:definition ${lit(definition)}${sourceLabel ? ` ; qw:sourceCategoryLabel ${lit(sourceLabel)}` : ''} .\n`;
ontology += '\nqw:sourceCategoryLabel a owl:AnnotationProperty .\n';
const datatypeProperties = {
  personNumber: 'positiveInteger', sourcePersonLabel: 'string', sourceRaceLabel: 'string', sourceFacialHairLabel: 'string',
  portraitPath: 'anyURI', gameCode: 'string', playerRole: 'string', targetRevealed: 'boolean',
  createdAt: 'dateTime', actionSequence: 'positiveInteger',
  ...Object.fromEntries(Object.values(traitFields).map(([property, , datatype]) => [property, datatype || 'string']))
};
for (const [property, datatype] of Object.entries(datatypeProperties)) ontology += `qw:${property} a owl:DatatypeProperty ; rdfs:range xsd:${datatype} ; rdfs:label ${lit(property.replace(/([A-Z])/g, ' $1').toLowerCase())} .\n`;
for (const [property, domain, range, definition] of [
  ['boardIncludes', 'qw:QueryWhomSession', 'cco:ont00001262', 'Relates a local session to a person on its immutable board.'],
  ['hasOwnTarget', 'qw:QueryWhomSession', 'cco:ont00001262', 'Relates a local session to the privately assigned target on this device.'],
  ['inSession', 'qw:CandidateRole', 'qw:QueryWhomSession', 'Scopes a candidate role to its local session.'],
  ['actInSession', 'game:GameAct', 'qw:QueryWhomSession', 'Relates a retained game act to its local session.'],
  ['affectsPerson', 'game:GameAct', 'cco:ont00001262', 'Relates a local act to the represented person it affects.']
]) ontology += `qw:${property} a owl:ObjectProperty ; rdfs:domain ${domain} ; rdfs:range ${range} ; skos:definition ${lit(definition)} .\n`;
await output('ontology/query-whom.ttl', ontology);

let catalog = header + `<${CATALOG_ONTOLOGY}> a owl:Ontology ; owl:versionInfo "${DECK_VERSION}" ; owl:imports <${APP_ONTOLOGY}>, <${CCO_VERSION}> ; rdfs:label "Query Whom character catalog v${DECK_VERSION}" .\n\n`;
const ids = new Set();
for (const row of rows) {
  const match = /^Person (\d+)$/.exec(row.Person); assert(match, 'Invalid person number');
  const id = Number(match[1]); assert(id >= 1 && id <= 40 && !ids.has(id)); ids.add(id);
  for (const column of parsed.meta.fields) assert.equal(typeof row[column], 'string');
  assert(row.Name.trim()); assert(ethnicityClasses[row.Race]); assert(eyeClasses[row['Eye color']]); assert(['Male', 'Female'].includes(row.Sex));
  assert(['Yes', 'No'].includes(row.Bald)); const bald = row.Bald === 'Yes';
  assert.equal(bald, row['Hair color'] === 'Bald', 'Bald/color mismatch');
  assert(bald || hairClasses[row['Hair color']]);
  const base = `person-${String(id).padStart(2, '0')}`, p = `qw:${base}`, head = `${p}-head`, hair = `${p}-scalp-hair`;
  const triples = [];
  const add = (s, pred, obj) => triples.push(`${s} ${pred} ${obj} .`);
  add(p, 'a', 'cco:ont00001262'); add(p, 'rdfs:label', lit(row.Name)); add(p, 'qw:personNumber', lit(id, 'positiveInteger'));
  add(p, 'qw:sourcePersonLabel', lit(row.Person)); add(p, 'qw:sourceRaceLabel', lit(row.Race));
  add(p, 'qw:portraitPath', lit(`portraits/${base}.png`, 'anyURI'));
  add(p, 'obo:BFO_0000178', head); add(head, 'a', 'qw:Head');
  if (!bald) { add(head, 'obo:BFO_0000178', hair); add(hair, 'a', 'cco:ont00000058'); add(hair, 'obo:BFO_0000196', `${p}-hair-color`); add(`${p}-hair-color`, 'a', `qw:${hairClasses[row['Hair color']]}`); }
  else assert(row['Hair length'] === 'None' && row['Hair texture'] === 'Not applicable' && row.Hairstyle === 'Bald', 'Inconsistent bald row');
  const eyes = ['left', 'right'].map(side => `${p}-${side}-eye`);
  for (const eye of eyes) { add(head, 'obo:BFO_0000178', eye); add(eye, 'a', 'cco:ont00000500'); add(eye, 'obo:BFO_0000196', `${eye}-color`); add(`${eye}-color`, 'a', `qw:${eyeClasses[row['Eye color']]}`); }
  add(p, 'obo:BFO_0000196', `${p}-ethnicity`); add(`${p}-ethnicity`, 'a', `qw:${ethnicityClasses[row.Race][0]}`);
  add(p, 'obo:BFO_0000196', `${p}-sex`); add(`${p}-sex`, 'a', row.Sex === 'Male' ? 'cco:ont00001363' : 'cco:ont00001212');
  if (row['Facial hair'] !== 'None') { const facial = row['Facial hair'] === 'Sideburns' ? `${p}-sideburns` : `${p}-facial-hair`; add(head, 'obo:BFO_0000178', facial); add(facial, 'a', `qw:${facialClass(row['Facial hair'])}`); add(facial, 'qw:sourceFacialHairLabel', lit(row['Facial hair'])); }
  for (const [column, [predicate, bearer, datatype]] of Object.entries(traitFields)) {
    let value = row[column];
    if (datatype === 'boolean') { assert(['Yes', 'No'].includes(value), `Invalid ${column}`); value = value === 'Yes' ? 'true' : 'false'; }
    if (datatype === 'nonNegativeInteger') assert(/^\d+$/.test(value));
    const subjects = bearer === 'person' ? [p] : bearer === 'head' ? [head] : bearer === 'eyes' ? eyes : [bald ? head : hair];
    for (const subject of subjects) add(subject, `qw:${predicate}`, lit(value, datatype));
  }
  catalog += triples.join('\n') + '\n\n';
  await readFile(path(`portraits/${base}.png`));
}
await output('assets/catalog-v1.ttl', catalog);
const catalogStore = new N3.Store(parse(catalog)), projection = projectCatalog(catalogStore);
for (const row of rows) {
  const person = projection[Number(row.Person.slice(7)) - 1];
  assert.equal(person.name, row.Name); assert.equal(person.sex, row.Sex); assert.equal(person.sourceRaceLabel, row.Race);
  assert.equal(person.hairColor, row['Hair color']); assert.equal(person.eyeColor, row['Eye color']);
  for (const column of Object.keys(traitFields)) assert.equal(person.traits[column], row[column], `Round-trip ${row.Person}: ${column}`);
  assert.equal(person.traits['Facial hair'], row['Facial hair']);
}
await output('assets/catalog-v1.json', JSON.stringify(projection, null, 2) + '\n');
if (!check) {
  const generated = spawnSync('python', [fileURLToPath(path('scripts/portraits.py'))], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(generated.stderr); console.log(generated.stdout.trim());
}
const imports = {
  [CATALOG_ONTOLOGY]: 'assets/catalog-v1.ttl', [APP_ONTOLOGY]: 'ontology/query-whom.ttl',
  [CCO_VERSION]: 'ontology/CommonCoreOntologiesMerged.ttl',
  'https://www.commoncoreontologies.org/CommonCoreOntologiesMerged': 'ontology/CommonCoreOntologiesMerged.ttl',
  'https://w3id.org/ontologized-entertainment/game': '../src/ontologies/GameOntology.ttl'
};
for (const name of ['Agent', 'Event', 'InformationEntity', 'Geospatial', 'Quality', 'Time']) imports[`https://www.commoncoreontologies.org/${name}Ontology`] = 'ontology/CommonCoreOntologiesMerged.ttl';
const all = new N3.Store();
for (const relative of new Set(Object.values(imports))) {
  const text = await readFile(path(relative), 'utf8'), quads = parse(text); all.addQuads(quads);
  for (const quad of quads) if (quad.predicate.value === prefixes.owl + 'imports') assert(imports[quad.object.value], `Unmapped import ${quad.object.value}`);
}
for (const quad of [...parse(ontology), ...parse(catalog), ...parse(await readFile(path('../src/ontologies/GameOntology.ttl'), 'utf8'))]) {
  assert.equal(quad.graph.termType, 'DefaultGraph');
  for (const term of [quad.subject, quad.predicate, quad.object]) if (term.termType === 'NamedNode' && /^https:\/\/www.commoncoreontologies.org\/ont\d+$/.test(term.value)) assert(cco.countQuads(term, null, null, null), `Unknown CCO term ${term.value}`);
}
const files = {};
for (const relative of [...new Set(Object.values(imports)), 'assets/catalog-v1.json', 'personal-traits-40-people-alt.csv', 'vendor/qrcode.js', 'vendor/jsQR.js', '../vendor/n3.min.js']) files[relative] = hash(await readFile(path(relative)));
for (let id = 1; id <= 40; id++) for (const suffix of ['.png', '-320.webp', '-960.webp']) {
  const relative = `${suffix === '.png' ? 'portraits' : 'assets/portraits'}/person-${String(id).padStart(2, '0')}${suffix}`;
  files[relative] = hash(await readFile(path(relative)));
}
const manifest = { gameVersion: '1.0.0', schemaVersion: '1.0.0', protocolVersion: 1, deckVersion: DECK_VERSION, personCount: 40,
  cco: { commit: CCO_COMMIT, versionIri: CCO_VERSION, sha256: files['ontology/CommonCoreOntologiesMerged.ttl'] }, imports, files };
manifest.catalogHash = hash(Buffer.from(catalog));
await output('assets/catalog-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// Generate a full Oliver graph directly from the actual instance triples.
const oliver = [...catalogStore].filter(q => q.subject.value.startsWith(Q('person-01')));
const nodes = new Map();
const nodeId = term => { const key = `${term.termType}:${term.value}:${term.datatype?.value || ''}`; if (!nodes.has(key)) nodes.set(key, { id: `n${nodes.size}`, term }); return nodes.get(key).id; };
const compact = iri => { const entry = Object.entries(prefixes).find(([, base]) => iri.startsWith(base)); return entry ? entry[0] + ':' + iri.slice(entry[1].length) : iri; };
const edges = oliver.map(q => `  ${nodeId(q.subject)} -->|${compact(q.predicate.value)}| ${nodeId(q.object)}`);
const mermaid = ['flowchart LR', ...[...nodes.values()].map(({id, term}) => `  ${id}${term.termType === 'Literal' ? '([' : '['}${JSON.stringify(term.termType === 'Literal' ? term.value + (term.datatype.value.endsWith('#string') ? '' : ' · ' + compact(term.datatype.value)) : compact(term.value))}${term.termType === 'Literal' ? '])' : ']'}`), ...edges].join('\n');
await output('ontology/oliver-example.md', '# Oliver: complete generated RDF instance\n\nIncludes explicit type edges and every source column. Generated from catalog-v1.ttl.\n\n```mermaid\n' + mermaid + '\n```\n');
console.log(`${check ? 'Validated' : 'Built'} 40 characters, ${catalogStore.size} catalog triples and ${all.size} closure triples.`);

// Walk actual ES-module imports so the complete shared package closure is available offline.
const precachePaths = new Set(['index.html', 'app.css', 'manifest.webmanifest', 'assets/icon.svg', 'assets/catalog-manifest.json', 'README.md',
  '../styles/normalize.css', '../styles/skeleton.css', 'vendor/qrcode.js', 'vendor/jsQR.js', '../vendor/n3.min.js', ...new Set(Object.values(imports))]);
async function visitModule(relative) {
  if (precachePaths.has(relative)) return;
  precachePaths.add(relative);
  const text = await readFile(path(relative), 'utf8');
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const url = new URL(match[1], path(relative));
    const { relative: relativePath } = await import('node:path');
    const next = relativePath(fileURLToPath(root), fileURLToPath(url)).replaceAll('\\', '/');
    await visitModule(next);
  }
}
await visitModule('js/app.js');
for (let id = 1; id <= 40; id++) for (const size of [320, 960]) precachePaths.add(`assets/portraits/person-${String(id).padStart(2, '0')}-${size}.webp`);
const cacheFiles = [];
for (const relative of [...precachePaths].sort()) cacheFiles.push({ path: relative, sha256: hash(await readFile(path(relative))) });
const template = await readFile(path('scripts/service-worker.template.js'), 'utf8');
const version = hash(JSON.stringify(cacheFiles) + template).slice(0, 24);
await output('assets/precache.json', JSON.stringify({ version, files: cacheFiles }, null, 2) + '\n');
await output('service-worker.js', template.replace('__CACHE_VERSION__', version));
console.log(`Offline cache: ${cacheFiles.length} resources, version ${version}.`);
