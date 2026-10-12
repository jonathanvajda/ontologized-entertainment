import { parseRdfTextWithN3 } from '../../packages/rdf-io/src/n3-adapter.js';
import { CATALOG_ONTOLOGY, CCO_COMMIT, CCO_SHA256, prefixes } from './vocabulary.js';
import { projectCatalog } from './catalog.js';

export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function loadKnowledgeGraph(N3, base = new URL('../', import.meta.url)) {
  const manifestUrl = new URL('assets/catalog-manifest.json', base);
  const response = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!response.ok) throw new Error('The character manifest could not be loaded.');
  const manifest = await response.json();
  if (manifest.cco?.commit !== CCO_COMMIT || manifest.cco?.sha256 !== CCO_SHA256 || manifest.files?.['ontology/CommonCoreOntologiesMerged.ttl'] !== CCO_SHA256 || manifest.schemaVersion !== '1.0.0' || manifest.deckVersion !== 1 || manifest.protocolVersion !== 1) throw new Error('Unsupported knowledge graph version.');
  const store = new N3.Store(), resources = new Map(), visited = new Set();
  async function visit(iri) {
    const relative = manifest.imports[iri];
    if (!relative || !manifest.files[relative]) throw new Error(`An ontology import is not packaged locally: ${iri}`);
    const url = new URL(relative, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(new URL('../', base).pathname)) throw new Error('Invalid import resource path.');
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const result = await fetch(url);
    if (!result.ok) throw new Error('A packaged ontology could not be loaded.');
    const bytes = await result.arrayBuffer();
    if (await sha256(bytes) !== manifest.files[relative]) throw new Error('A packaged ontology failed its integrity check. Reload after updating.');
    const text = new TextDecoder().decode(bytes);
    const quads = parseRdfTextWithN3(text, { format: 'turtle', runtime: { N3 } }).quads;
    if (quads.some(q => q.graph.termType !== 'DefaultGraph')) throw new Error('Unexpected named graph.');
    store.addQuads(quads); resources.set(relative, text);
    for (const quad of quads) if (quad.predicate.value === prefixes.owl + 'imports') await visit(quad.object.value);
  }
  await visit(CATALOG_ONTOLOGY);
  const catalog = projectCatalog(store, manifest);
  return { store, catalog, manifest, resources };
}
