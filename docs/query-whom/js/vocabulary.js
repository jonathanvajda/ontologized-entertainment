import { mergeProjectPrefixes } from '../../packages/namespace-registry/src/prefix-map.js';
import { DECK_VERSION } from './protocol.js';

export const prefixes = mergeProjectPrefixes({}, {
  qw: 'https://w3id.org/ontologized-entertainment/query-whom/',
  cco: 'https://www.commoncoreontologies.org/',
  obo: 'http://purl.obolibrary.org/obo/',
  game: 'https://w3id.org/ontologized-entertainment/game/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  skos: 'http://www.w3.org/2004/02/skos/core#'
}).prefixes;
export const Q = (local) => prefixes.qw + local;
export const TYPE = prefixes.rdf + 'type';
export const PART = prefixes.obo + 'BFO_0000178';
export const BEARER = prefixes.obo + 'BFO_0000196';
export const PERSON = prefixes.cco + 'ont00001262';
export const personIri = (id) => Q(`person-${String(id).padStart(2, '0')}`);
export const CCO_COMMIT = 'be13b74cccf85617739c5288f9fdac805437386c';
export const CCO_SHA256 = 'a9453382b25b40781c181d6ba44981f228abb76d90d548846713adba9baadb42';
export const CCO_VERSION = 'https://www.commoncoreontologies.org/2026-08-13/CommonCoreOntologiesMerged';
export const APP_ONTOLOGY = prefixes.qw.slice(0, -1);
export const CATALOG_ONTOLOGY = Q(`catalog/v${DECK_VERSION}`);

export const hairClasses = {
  Blonde: 'BlondeHairColor', Black: 'BlackHairColor', Brown: 'BrownHairColor', 'Light brown': 'LightBrownHairColor', Red: 'RedHairColor',
  'Black going grey/white': 'BlackGoingGreyWhiteHairColor',
  'Brown going grey/white': 'BrownGoingGreyWhiteHairColor', 'Fully white/grey': 'WhiteGreyHairColor'
};
export const eyeClasses = { Blue: 'BlueEyeColor', Brown: 'BrownEyeColor', 'Dark brown': 'DarkBrownEyeColor', Green: 'GreenEyeColor', Hazel: 'HazelEyeColor' };
export const ethnicityClasses = {
  Caucasian: ['WhiteEthnicity', 'White'], African: ['BlackOrAfricanAmericanEthnicity', 'Black or African American'],
  Hispanic: ['HispanicOrLatinoEthnicity', 'Hispanic or Latino'],
  'East Asian': ['EastAsianEthnicity', 'East Asian'], 'South Asian': ['SouthAsianEthnicity', 'South Asian']
};

// Exact CSV contract: [predicate, bearer, datatype]. Named CCO concepts have dedicated instances.
export const traitFields = {
  Age: ['hasAgeYears', 'person', 'nonNegativeInteger'], 'Age group': ['hasAgeGroup', 'person'],
  'Age appearance': ['hasAgeAppearance', 'person'], 'Hair length': ['hasHairLength', 'hair'],
  'Hair texture': ['hasHairTexture', 'hair'], Bald: ['isBald', 'person', 'boolean'],
  Hairstyle: ['hasHairstyle', 'hair'], Bangs: ['hasBangs', 'head', 'boolean'],
  Beard: ['hasBeard', 'head', 'boolean'], Mustache: ['hasMustache', 'head', 'boolean'],
  'Eye direction': ['hasEyeDirection', 'eyes'], 'Eye openness': ['hasEyeOpenness', 'eyes'],
  'Eyebrow thickness': ['hasEyebrowThickness', 'head'], 'Eyebrow shape': ['hasEyebrowShape', 'head'],
  'Nose size': ['hasNoseSize', 'head'], 'Nose shape': ['hasNoseShape', 'head'],
  'Rosy cheeks': ['hasRosyCheeks', 'head', 'boolean'], Freckles: ['hasFreckles', 'head', 'boolean'],
  Dimples: ['hasDimples', 'head', 'boolean'], Smile: ['hasSmile', 'head', 'boolean'],
  'Teeth visible': ['hasTeethVisible', 'head', 'boolean'], 'Mouth open': ['hasMouthOpen', 'head', 'boolean'],
  Expression: ['hasExpression', 'head'], 'Face shape': ['hasFaceShape', 'head'], 'Ear size': ['hasEarSize', 'head'],
  'Skin tone': ['hasSkinTone', 'person'], Glasses: ['hasGlasses', 'person', 'boolean'],
  Hat: ['hasHat', 'person', 'boolean'], 'Hat type': ['hasHatType', 'person'], 'Hat color': ['hasHatColor', 'person'],
  'Hat accessory': ['hasHatAccessory', 'person'], Earrings: ['hasEarrings', 'person', 'boolean'],
  'Earring type': ['hasEarringType', 'person'], Bow: ['hasBow', 'person', 'boolean'],
  Collar: ['hasCollar', 'person', 'boolean'], Necklace: ['hasNecklace', 'person', 'boolean'],
  'Hair accessory': ['hasHairAccessory', 'hair'], 'Clothing color': ['hasClothingColor', 'person']
};
