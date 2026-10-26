import { Q, TYPE, PART, BEARER, PERSON, personIri, prefixes, hairClasses, eyeClasses, ethnicityClasses, traitFields } from './vocabulary.js';
import { CATALOG_SIZE, DECK_VERSION } from './protocol.js';

const HAIR_COLOR_ORDER = new Map([
  ['Black', 0],
  ['Dark brown', 1],
  ['Brown', 2],
  ['Light brown', 3],
  ['Red', 4],
  ['Blonde', 5],
  ['Black going grey/white', 6],
  ['Brown going grey/white', 6],
  ['Fully white/grey', 7],
  ['Bald', 9]
]);

export function projectCatalog(store, manifest) {
  const objects = (s, p) => store.getQuads(s, p, null, null).map(q => q.object.value);
  const one = (s, p) => {
    const values = objects(s, p);
    if (values.length !== 1) throw new Error(`Catalog requires one ${p} on ${s}.`);
    return values[0];
  };
  const typedChild = (s, relation, type) => objects(s, relation).find(child => objects(child, TYPE).includes(type));
  const colorLabel = (s, classes) => {
    const qualities = objects(s, BEARER);
    return Object.entries(classes).find(([, cls]) => qualities.some(q => objects(q, TYPE).includes(Q(cls))))?.[0];
  };
  const result = [];
  const ids = store.getQuads(null, TYPE, PERSON, null).map(q => Number(one(q.subject.value, Q('personNumber'))));
  if (ids.length !== CATALOG_SIZE || new Set(ids).size !== CATALOG_SIZE || ids.some(id => !Number.isInteger(id) || id < 1 || id > CATALOG_SIZE)) throw new Error(`Catalog must contain exactly people 1–${CATALOG_SIZE}.`);
  for (let id = 1; id <= CATALOG_SIZE; id++) {
    const iri = personIri(id), head = typedChild(iri, PART, Q('Head'));
    if (!head) throw new Error(`Missing head for person ${id}.`);
    const hair = typedChild(head, PART, prefixes.cco + 'ont00000058');
    const eyes = objects(head, PART).filter(child => objects(child, TYPE).includes(prefixes.cco + 'ont00000500'));
    if (eyes.length !== 2) throw new Error(`Person ${id} needs two eyes.`);
    const bald = one(iri, Q('isBald'));
    if (!['true', 'false'].includes(bald) || (bald === 'true') === Boolean(hair)) throw new Error(`Inconsistent scalp hair on person ${id}.`);
    const hairColor = bald === 'true' ? 'Bald' : colorLabel(hair, hairClasses);
    const eyeColor = colorLabel(eyes[0], eyeClasses);
    if (!hairColor || !eyeColor || eyeColor !== colorLabel(eyes[1], eyeClasses)) throw new Error(`Missing/inconsistent colors on person ${id}.`);
    const qualities = objects(iri, BEARER);
    const ethnicity = Object.values(ethnicityClasses).find(([cls]) => qualities.some(q => objects(q, TYPE).includes(Q(cls))))?.[1];
    const sex = qualities.some(q => objects(q, TYPE).includes(prefixes.cco + 'ont00001363')) ? 'Male'
      : qualities.some(q => objects(q, TYPE).includes(prefixes.cco + 'ont00001212')) ? 'Female' : null;
    if (!ethnicity || !sex) throw new Error(`Missing ethnicity or sex on person ${id}.`);
    const traits = {};
    for (const [column, [predicate, bearer, datatype]] of Object.entries(traitFields)) {
      const subject = bearer === 'person' ? iri : bearer === 'head' ? head : bearer === 'eyes' ? eyes[0] : hair || head;
      const value = one(subject, Q(predicate));
      traits[column] = datatype === 'boolean' ? value === 'true' ? 'Yes' : 'No' : value;
      if (bearer === 'eyes' && one(eyes[1], Q(predicate)) !== value) throw new Error('Eye descriptive values differ.');
    }
    const facial = objects(head, PART).find(child => objects(child, Q('sourceFacialHairLabel')).length);
    traits['Facial hair'] = facial ? one(facial, Q('sourceFacialHairLabel')) : 'None';
    const portraitPath = one(iri, Q('portraitPath'));
    if (portraitPath !== `portraits/person-${String(id).padStart(2, '0')}.png`) throw new Error('Invalid portrait path.');
    const name = one(iri, prefixes.rdfs + 'label');
    if (!name.trim()) throw new Error('Empty character name.');
    result.push({ id, iri, name, hairColor, eyeColor, ethnicity, sex, portraitPath,
      thumbnail: `assets/portraits/person-${String(id).padStart(2, '0')}-320.webp`,
      portrait: `assets/portraits/person-${String(id).padStart(2, '0')}-960.webp`,
      traits, sourcePersonLabel: one(iri, Q('sourcePersonLabel')), sourceRaceLabel: one(iri, Q('sourceRaceLabel')) });
  }
  if (manifest && (manifest.deckVersion !== DECK_VERSION || manifest.personCount !== result.length)) throw new Error('Unsupported catalog manifest.');
  return result;
}

export function sortedCards(cards, sortMode, catalog) {
  const people = new Map(catalog.map(person => [person.id, person]));
  if (sortMode === 'shuffle') return [...cards];
  if (!['name', 'hairColor', 'eyeColor', 'ethnicity', 'sex'].includes(sortMode)) throw new Error('Unknown sort mode.');
  return [...cards].sort((a, b) => {
    const x = people.get(a.id)[sortMode], y = people.get(b.id)[sortMode];
    if (sortMode === 'hairColor') {
      const rankDifference = (HAIR_COLOR_ORDER.get(x) ?? 8) - (HAIR_COLOR_ORDER.get(y) ?? 8);
      if (rankDifference) return rankDifference;
    }
    return (x < y ? -1 : x > y ? 1 : 0) || a.id - b.id;
  });
}
