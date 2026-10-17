import { RdfStore } from '../../packages/game-mechanics/src/rdf-store.js';
import { projectMaritime } from './projection.js';
export function audienceStore(store, viewerIri) {
  if (projectMaritime(store).localPlayerIri !== viewerIri) throw new Error('Only the local player has a private journal on this device.');
  return new RdfStore([...store]);
}
export function viewerState(store, viewerIri) { return projectMaritime(audienceStore(store, viewerIri)); }
