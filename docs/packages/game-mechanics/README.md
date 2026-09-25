# Game mechanics

`@ontoeagle/game-mechanics` is the reusable, browser-only engine foundation for RDF-backed games. It deliberately contains no concrete game.

## Runtime contract

- ES modules, no framework, no backend, and no build step are required.
- Canonical state is an ordinary default-graph RDF/JS store; named graphs and reification are outside the baseline.
- N3.js can be loaded from `../../vendor/n3.min.js` and supplied through game-specific parsing/serialization adapters.
- Derived projections and UI state are disposable. Renderers only consume view models and propose actions.
- IndexedDB persistence and portable JSON save packages are supported. Imported RDF is parsed by a trusted adapter and validated before restore.

```js
import { RdfStore, RuleRegistry, Validator, createGameEngine } from './src/index.js';

const store = new RdfStore(initialQuads);
const rules = new RuleRegistry().registerAction('pass', {
  effects: () => ({ additions: [], removals: [] })
});
const engine = createGameEngine({ store, rules, validator: new Validator(), seed: 'test-seed' });
const result = await engine.actions.propose({ actionType: 'pass', actorIri: 'urn:player:1' });
```

The baseline ontology is `../../src/ontologies/GameOntology.ttl`; optional structural shapes are in `GameShapes.ttl`.

## Hidden information

The optional `src/hidden-information/` modules add audience- and phase-aware RDF projections, pass-and-play concealment, encrypted player-scoped RDF capsules, URL-fragment transport, targeted ECDH disclosures, and solution commitments.

```js
import {
  projectVisibleStore,
  createEncryptedRdfCapsule,
  createPrivacyScreen
} from './src/index.js';
```

Pass-and-play concealment is a presentation boundary only. For device isolation, keep complete canonical RDF on the host and give each player only their public partition and encrypted private capsule. Human-readable game codes are session labels, not cryptographic secrets. See `../../game-boilerplate/hidden-information-technical-spec.md`.
