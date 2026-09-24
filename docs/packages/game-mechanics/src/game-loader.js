import { RdfStore, assertDefaultGraph } from './rdf-store.js';
import { success, failure, asFailure } from './result.js';

export async function loadGame({ config, initialRdf, parseRdf, storeFactory = (quads) => new RdfStore(quads), validator }) {
  if (!config?.id || !config?.version || !config?.schemaVersion) return failure('INVALID_GAME_CONFIG', 'Game id, version, and schemaVersion are required.');
  try {
    const quads = assertDefaultGraph(await parseRdf(initialRdf, { baseIri: config.baseIri }));
    const store = storeFactory(quads);
    const validation = await validator.validate(store, { phase: 'initialization', config });
    return validation.ok ? success({ config: Object.freeze({ ...config }), store, validation: validation.value }) : validation;
  } catch (error) { return asFailure(error, 'GAME_LOAD_FAILED'); }
}
