import { RdfStore } from '../rdf-store.js';

export const HIDDEN = 'https://w3id.org/ontoeagle/game/hidden-information/';
export const VISIBILITY = Object.freeze({
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  VisibilityPolicy: HIDDEN + 'VisibilityPolicy', governs: HIDDEN + 'governs', visibleTo: HIDDEN + 'visibleTo',
  visibleDuringPhase: HIDDEN + 'visibleDuringPhase', mode: HIDDEN + 'visibilityMode', Public: HIDDEN + 'Public'
});

export function createVisibilityIndex(store, vocabulary = VISIBILITY) {
  const policies = new Map();
  const policyIris = store.getQuads(null, term(vocabulary.type), term(vocabulary.VisibilityPolicy), null).map((item) => item.subject.value);
  for (const policyIri of policyIris) {
    const governed = objects(store, policyIri, vocabulary.governs);
    const policy = { iri: policyIri, viewers: objects(store, policyIri, vocabulary.visibleTo), phases: objects(store, policyIri, vocabulary.visibleDuringPhase), modes: objects(store, policyIri, vocabulary.mode) };
    governed.forEach((entityIri) => policies.set(entityIri, [...(policies.get(entityIri) || []), policy]));
  }
  return policies;
}

/**
 * Produces a disposable audience projection from canonical RDF.
 * Unclassified subjects are public by default; games may opt into deny-by-default.
 */
export function projectVisibleStore(store, { viewerIri = null, phaseIri = null, defaultVisibility = 'public', includePolicyMetadata = false, vocabulary = VISIBILITY } = {}) {
  const index = createVisibilityIndex(store, vocabulary); const policySubjects = new Set([...index.values()].flat().map((policy) => policy.iri));
  const visible = store.getQuads(null, null, null, null).filter((item) => {
    if (!includePolicyMetadata && policySubjects.has(item.subject.value)) return false;
    const policies = index.get(item.subject.value);
    if (!policies?.length) return defaultVisibility === 'public';
    return policies.some((policy) => policyAllows(policy, viewerIri, phaseIri, vocabulary));
  });
  return new RdfStore(visible);
}

export function validateVisibilityCoverage(store, { sensitiveClasses = [], vocabulary = VISIBILITY } = {}) {
  const index = createVisibilityIndex(store, vocabulary); const findings = [];
  for (const classIri of sensitiveClasses) for (const item of store.getQuads(null, term(vocabulary.type), term(classIri), null)) {
    if (!index.has(item.subject.value)) findings.push({ severity: 'violation', code: 'MISSING_VISIBILITY_POLICY', entityIri: item.subject.value, classIri, message: `Sensitive entity ${item.subject.value} has no visibility policy.` });
  }
  return findings;
}

function policyAllows(policy, viewerIri, phaseIri, vocabulary) {
  if (policy.modes.includes(vocabulary.Public)) return !policy.phases.length || policy.phases.includes(phaseIri);
  const viewerAllowed = policy.viewers.length > 0 && policy.viewers.includes(viewerIri);
  const phaseAllowed = !policy.phases.length || policy.phases.includes(phaseIri);
  return viewerAllowed && phaseAllowed;
}
function term(value) { return value == null ? null : { termType: 'NamedNode', value }; }
function objects(store, subject, predicate) { return store.getQuads(term(subject), term(predicate), null, null).map((item) => item.object.value); }
