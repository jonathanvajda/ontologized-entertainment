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
