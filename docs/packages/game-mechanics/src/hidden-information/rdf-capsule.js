import { decryptJson, encryptJson } from './crypto-engine.js';

export function quadsToRows(quads) { return quads.map((item) => ({ subject: termRow(item.subject), predicate: termRow(item.predicate), object: termRow(item.object), graph: termRow(item.graph) })); }
export function rowsToQuads(rows) { return rows.map((item) => ({ subject: rowTerm(item.subject), predicate: rowTerm(item.predicate), object: rowTerm(item.object), graph: rowTerm(item.graph) })); }

export async function createEncryptedRdfCapsule({ gameId, gameVersion, schemaVersion, gameCode, playerIri, publicQuads = [], privateQuads = [], key, issuedAt = new Date().toISOString(), cryptoRef = globalThis.crypto }) {
  const aad = { purpose: 'player-rdf-capsule', gameId, gameVersion, schemaVersion, gameCode, playerIri, version: 1 };
  const payload = { issuedAt, publicQuads: quadsToRows(publicQuads), privateQuads: quadsToRows(privateQuads) };
  return { ...aad, envelope: await encryptJson(payload, key, { additionalData: aad, cryptoRef }) };
}
export async function openEncryptedRdfCapsule(capsule, key, { cryptoRef = globalThis.crypto } = {}) {
  const { envelope, ...aad } = capsule; const payload = await decryptJson(envelope, key, { expectedAdditionalData: aad, cryptoRef });
  return { ...aad, issuedAt: payload.issuedAt, publicQuads: rowsToQuads(payload.publicQuads), privateQuads: rowsToQuads(payload.privateQuads) };
}

/** Stable canonical form for commitments; blank nodes must be skolemized first. */
export function canonicalizeQuads(quads) {
  return quads.map((item) => [item.subject, item.predicate, item.object, item.graph].map(canonicalTerm).join(' ')).sort().join('\n');
}
function canonicalTerm(term = { termType: 'DefaultGraph', value: '' }) {
  if (term.termType === 'BlankNode') throw new TypeError('Blank nodes must be skolemized before canonical commitment.');
  if (term.termType === 'DefaultGraph') return '';
  if (term.termType === 'Literal') return `"${JSON.stringify(term.value).slice(1, -1)}"${term.language ? `@${term.language}` : `^^<${term.datatype?.value || 'http://www.w3.org/2001/XMLSchema#string'}>`}`;
  return `<${term.value}>`;
}
function termRow(term = { termType: 'DefaultGraph', value: '' }) { return { termType: term.termType, value: term.value, ...(term.language ? { language: term.language } : {}), ...(term.datatype?.value ? { datatype: term.datatype.value } : {}) }; }
function rowTerm(row) { return { termType: row.termType, value: row.value, ...(row.language ? { language: row.language } : {}), ...(row.termType === 'Literal' ? { datatype: { termType: 'NamedNode', value: row.datatype || 'http://www.w3.org/2001/XMLSchema#string' } } : {}) }; }
