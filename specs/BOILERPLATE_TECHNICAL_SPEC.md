# Browser Board Game Boilerplate — Technical Specification

## 1. Purpose

This technical specification defines the initial implementation architecture for a reusable, static, browser-only board-game engine whose canonical game state is represented in RDF and whose game-specific semantic models are aligned, where practical, with BFO and CCO.

This document specifies **how the baseline capabilities are expected to be realized**. It deliberately identifies provisional decisions so that the architecture can evolve as concrete games are implemented.

---

## 2. Technical Constraints

The baseline SHALL:

- run entirely client-side;
- be deployable as a static website/PWA;
- require no application backend;
- use ES6 JavaScript;
- avoid React;
- prefer small reusable modules and pure functions;
- keep DOM manipulation outside core game logic;
- use IndexedDB for persistence;
- support mobile landscape use;
- support offline-capable deployment where practical;
- allow vendored dependencies;
- expose deterministic headless APIs for tests.

---

## 3. Reference Architecture

```text
Game-Specific Ontology / Configuration
                |
                v
        Canonical RDF Store
                |
        +-------+--------+
        |                |
        v                v
 Rule / Transition    Query / Projection
      Engine               Layer
        |                   |
        +---------+---------+
                  v
          Operational JS State
                  |
        +---------+----------+
        |                    |
        v                    v
   Renderer / UI       Persistence / Export
```

The canonical RDF store is authoritative for semantic game state.

The operational JavaScript model is disposable and MUST be rebuildable.

The renderer SHALL consume operational state rather than directly owning semantic state.

---

## 4. Recommended Module Boundaries

The exact file names are provisional, but the following conceptual modules SHOULD exist.

### 4.1 `rdf-store`

Responsibilities:

- create and manage the N3 store;
- load RDF;
- add/remove quads;
- clone candidate state for validation;
- serialize state;
- expose controlled store access.

Preferred dependency:

- N3.js.

### 4.2 `game-loader`

Responsibilities:

- load game-specific metadata;
- load ontology/schema resources;
- load initial instance data;
- instantiate game setup;
- verify version compatibility;
- invoke startup validation.

### 4.3 `state-projector`

Responsibilities:

- convert RDF to optimized JavaScript structures;
- cache entity lookups;
- calculate counts;
- build adjacency maps;
- build aggregate-membership indexes;
- generate renderer-facing board state;
- invalidate/rebuild affected projections after commits.

### 4.4 `action-engine`

Responsibilities:

- accept proposed game actions;
- resolve action handler;
- evaluate preconditions;
- compute semantic effects;
- generate RDF additions/removals;
- create semantic action/process individuals where required;
- pass candidate state to validation;
- commit or reject.

### 4.5 `rule-registry`

Responsibilities:

- map game rule identifiers to executable handlers;
- register action legality checks;
- register triggered effects;
- register phase restrictions;
- register end conditions;
- expose game-specific extension points.

Rules themselves MAY be represented as information content entities in RDF while executable implementation remains JavaScript.

### 4.6 `validator`

Responsibilities:

- run generic invariants;
- run game-specific invariants;
- optionally run SHACL validation;
- classify findings as violation/warning/info;
- prevent commits on configured blocking violations.

### 4.7 `random-engine`

Responsibilities:

- seeded pseudorandom-number generation;
- dice results;
- shuffling;
- random choice;
- finite-pool draws;
- reproducible tests;
- optional random-state capture for save/replay.

### 4.8 `turn-engine`

Responsibilities:

- current player;
- round/turn/phase progression;
- phase transition validation;
- phase-specific legal-action exposure;
- turn-ending logic.

### 4.9 `score-engine`

Responsibilities:

- calculate derived scores;
- evaluate scored events;
- apply game-specific scoring functions;
- calculate final results;
- apply tie-breaking rules.

### 4.10 `transaction-log`

Responsibilities:

- assign transaction identifiers;
- persist ordered mutations;
- record added triples;
- record removed triples;
- link technical mutation to semantic game action identifier when available;
- support undo/redo/replay.

The technical transaction log SHOULD be JSON/JavaScript data rather than domain RDF.

### 4.11 `persistence`

Responsibilities:

- IndexedDB schema;
- save game;
- restore game;
- list saves;
- delete save;
- version/migration metadata;
- store optional UI state;
- store transaction history.

Preferred IndexedDB helper:

- `idb`.

### 4.12 `export-import`

Responsibilities:

- export canonical RDF;
- export/import save package;
- validate imports;
- migrate older save versions where supported.

### 4.13 `render-adapter`

Responsibilities:

- convert projected game state into renderer input;
- map semantic entities to visual objects;
- expose interactions as proposed actions;
- keep rendering semantics separate from rule semantics.

### 4.14 `svg-renderer`

Initial preferred implementation:

- SVG;
- D3 where useful for data binding, paths, scales, interaction, and animation.

Responsibilities MAY include:

- territory paths;
- common geometric tiles;
- nodes/edges;
- labels;
- color/state styling;
- pieces/tokens;
- pan/zoom;
- lightweight transitions.

Physics SHALL NOT be a mandatory baseline dependency.

### 4.15 `ui-state`

Responsibilities:

- selection;
- modal/drawer state;
- zoom;
- pan;
- hover/focus;
- drag state;
- animation state;
- orientation-sensitive layout.

UI state SHALL NOT be treated as canonical semantic state unless an individual game explicitly requires it.

---

## 5. RDF Modeling Baseline

### 5.1 Canonical Store

The engine SHALL maintain one ordinary RDF dataset/store.

The baseline SHALL NOT depend on:

- named graphs;
- RDF reification;
- RDF-star;
- assertion-status resources.

### 5.2 Current State

Ordinary mutable state SHALL normally be represented through direct triples.

Example before movement:

```turtle
:Army17 :located_in :Arizona .
```

Example after movement:

```turtle
:Army17 :located_in :Nevada .
```

The obsolete current-state assertion is removed.

### 5.3 Historical Semantic State

Historical game actions/processes SHALL normally remain as RDF individuals.

Example pattern:

```turtle
:Movement37
    rdf:type :MovementProcess ;
    :has_agent :Player1 ;
    :has_participant :Army17 ;
    :has_origin :Arizona ;
    :has_destination :Nevada .
```

The exact predicates/classes SHALL be defined by the game ontology and relevant BFO/CCO patterns.

### 5.4 Information Model

Where a literal-bearing information content entity is required, the semantic meaning SHOULD be carried primarily by the node's class/type and the literal attached using `rdf:value`.

Example conceptual pattern:

```turtle
:PurchaseCostSpecification17
    rdf:type :PurchaseCostSpecification ;
    rdf:value "200"^^xsd:decimal .
```

Game objects SHOULD NOT automatically receive direct datatype properties merely for implementation convenience.

### 5.5 Individuation and Counting

Where practical, finite game objects SHOULD be individuated.

Example:

```turtle
:PurpleCard01 rdf:type :PurpleTrainCard .
:PurpleCard02 rdf:type :PurpleTrainCard .
```

Quantities such as number of cards or pieces SHOULD preferably be derived by counting individuals in relevant relations/aggregates.

### 5.6 Temporal Regions

Temporal regions SHALL be used sparingly.

They SHOULD be considered when duration itself is semantically important, such as:

- a turn;
- a round;
- an attack process;
- an extended trade negotiation;
- a temporary effect;
- another occurrent whose duration matters to gameplay.

Temporal regions SHOULD NOT be introduced merely to preserve every obsolete triple.

---

## 6. Game Action Pipeline

### 6.1 Action Object

A proposed action SHOULD use a normalized JavaScript structure similar to:

```js
{
  actionType: "move",
  actorIri: "...",
  targetIri: "...",
  parameters: {},
  clientContext: {}
}
```

The exact structure MAY evolve.

### 6.2 Processing Sequence

The baseline sequence SHALL be:

```text
1. Receive action proposal
2. Resolve action handler
3. Check action preconditions
4. Determine semantic game action/process entity if required
5. Compute RDF additions and removals
6. Apply delta to candidate store
7. Run blocking invariants / validation
8. Reject OR commit atomically
9. Append technical transaction-log entry
10. Refresh affected projections
11. Evaluate triggered effects
12. Evaluate phase/end/scoring consequences
13. Render resulting state
```

Triggered effects MAY recursively generate additional controlled transitions, but the implementation MUST prevent uncontrolled recursion.

---

## 7. Transaction Model

### 7.1 RDF Delta

Each committed semantic transition SHOULD be represented internally as:

```js
{
  additions: [/* RDF quads */],
  removals: [/* RDF quads */]
}
```

### 7.2 Transaction Record

A technical transaction record SHOULD support:

```js
{
  id: "tx-0042",
  actionIri: "...",
  additions: [],
  removals: [],
  sequence: 42,
  rngStateBefore: null,
  rngStateAfter: null
}
```

Additional implementation metadata MAY be added.

### 7.3 Atomicity

No partially applied game action may become visible as committed state.

Candidate state SHALL be validated before commit when blocking validators apply.

---

## 8. SHACL Integration

SHACL SHOULD be optional at the engine level and configurable per game.

Recommended uses:

- exactly-one-container constraints;
- required relations;
- class-specific property constraints;
- finite inventory checks;
- mutually incompatible state checks;
- structural consistency.

SHACL SHOULD NOT be used as the sole mechanism for:

- turn sequencing;
- executing attacks;
- drawing cards;
- resolving trades;
- randomization;
- complex multi-step action workflows.

The validator SHOULD provide a common result structure regardless of whether a finding originated in:

- JavaScript;
- SHACL;
- SPARQL-based validation.

---

## 9. SPARQL

SPARQL MAY be used for:

- diagnostics;
- complex queries;
- derived views;
- developer inspection;
- scoring calculations where readable and performant;
- SHACL SPARQL constraints.

Core gameplay SHALL NOT require SPARQL for every action.

Direct N3-store access MAY be used where simpler and faster.

---

## 10. Operational Projection

The projection layer SHOULD produce structures optimized for repeated UI/gameplay access.

Example:

```js
{
  territoriesByIri: new Map(),
  adjacencyByTerritory: new Map(),
  piecesByLocation: new Map(),
  cardsByContainer: new Map(),
  legalActionsByEntity: new Map(),
  scoreByPlayer: new Map()
}
```

Projection values MAY contain derived counts and convenience fields not directly asserted in RDF.

A derived value MUST NOT become authoritative merely because it exists in the projection.

---

## 11. Rendering Architecture

### 11.1 Separation

The renderer SHALL receive a view model and emit user interactions.

The renderer SHALL NOT mutate RDF directly.

### 11.2 Board Geometry

Board geometry SHOULD normally live outside the canonical ontology.

Potential representations:

- SVG path definitions;
- JSON geometry configuration;
- static SVG fragments;
- generated polygons/hexes;
- path/edge tables.

A game MAY place geometry in RDF if geometry is itself semantically relevant, but this is not the baseline.

### 11.3 Entity-to-Visual Mapping

The game package SHALL define how semantic entities map to visuals.

Example mapping configuration:

```js
{
  entityIri: "...Arizona",
  svgTarget: "#territory-arizona"
}
```

The exact configuration format remains provisional.

### 11.4 Dynamic Styling

Visual styling SHOULD be computed from semantic or derived state.

Example:

```text
RDF state -> derived controller/player -> theme palette -> SVG fill
```

Changing a visual color SHALL NOT require redefining the identity of the semantic object.

---

## 12. Randomization Architecture

A common random engine SHALL expose deterministic primitives.

Suggested functions:

```js
randomFloat()
randomInt(min, max)
shuffle(items)
drawOne(items)
drawMany(items, count)
rollDie(sides)
weightedChoice(entries)
```

The random engine SHOULD support injection of a seeded generator.

Game logic SHALL NOT directly use `Math.random()` outside the randomization adapter.

---

## 13. Persistence

### 13.1 IndexedDB

IndexedDB SHALL be used for local persistent saves.

Suggested logical stores:

```text
games
saveStates
transactionLogs
preferences
cachedGameAssets
```

The physical schema may differ.

### 13.2 Save Package

A save package SHOULD include:

```text
manifest.json
state.ttl (or another supported RDF serialization)
transactions.json
ui-state.json (optional)
```

A ZIP container MAY be introduced later if useful.

### 13.3 Save Manifest

The manifest SHOULD contain:

- game identifier;
- game version;
- boilerplate/engine version;
- schema version;
- save format version;
- timestamp;
- RNG metadata if needed;
- compatibility flags.

---

## 14. Versioning and Migration

Game state and engine versioning SHALL be explicit.

The persistence layer SHOULD support migrations by save-format version.

Breaking ontology changes MUST be considered save-format changes unless compatibility can be guaranteed.

---

## 15. Error Handling

Core APIs SHOULD return structured results rather than throwing for ordinary illegal gameplay.

Example:

```js
{
  ok: false,
  code: "ILLEGAL_ACTION",
  message: "...",
  details: {}
}
```

Unexpected programming errors MAY throw and SHALL be captured by a top-level error boundary/logging mechanism.

---

## 16. Logging

Reusable modules SHOULD support structured logging.

Suggested levels:

- debug;
- info;
- warn;
- error.

Logging SHOULD be suppressible in production.

---

## 17. Testing Strategy

### 17.1 Unit Tests

Unit tests SHOULD cover:

- pure rule functions;
- legality checks;
- RDF delta generation;
- projection functions;
- randomization with fixed seed;
- score calculations;
- phase transitions.

### 17.2 State Transition Tests

Tests SHOULD be expressible as:

```text
Given RDF fixture
When action X is proposed
Then action is legal/illegal
And RDF delta equals expected
And resulting state satisfies invariants
And derived state equals expected
```

### 17.3 Validation Tests

Every game-specific invariant SHOULD have at least one passing and one failing fixture where practical.

### 17.4 Rendering Tests

Rendering tests SHOULD focus on:

- stable mapping from semantic IDs to board elements;
- touch targets;
- state-dependent class/style application;
- mobile landscape layout.

Rendering tests SHOULD NOT be used as the primary verification of semantic game rules.

---

## 18. Suggested Initial Dependency Set

Baseline dependencies SHOULD remain minimal.

Likely candidates:

- N3.js — RDF parsing/storage/serialization;
- idb — IndexedDB helper;
- D3 — SVG/data binding/layout/interaction where useful;
- optional SHACL implementation — only if/when invariant validation benefits from it.

Additional dependencies SHALL be justified by a game or engine capability rather than included speculatively.

---

## 19. Performance Guidance

The engine SHOULD optimize for small-to-medium board-game datasets rather than general-purpose RDF scale.

Preferred techniques:

- direct indexed N3 lookups;
- incremental operational projections;
- avoid rebuilding the entire projection after every small change where unnecessary;
- validate only affected shapes/invariants when feasible;
- keep rendering updates localized;
- do not serialize/deserialize full RDF state per action.

---

## 20. Security / Integrity Guidance

Imported saves SHALL be treated as untrusted input.

The engine SHOULD:

- validate RDF parsing;
- validate manifest versions;
- reject malformed transaction data;
- avoid arbitrary code execution from game data;
- keep executable rules in trusted game code rather than interpreting unrestricted scripts from imported saves.

---

## 21. Provisional Decisions Register

The repository SHOULD contain a decision register for choices that may need revisiting.

Each entry SHOULD include:

```text
Decision
Reason
Alternatives considered
Date
Affected capabilities
Known limitations
Rollback/migration cost
Status: provisional | adopted | superseded
```

Initial provisional decisions include:

- N3 as the RDF-store foundation;
- D3/SVG as the initial renderer;
- RDF as canonical state;
- JS projection as operational state;
- no named graphs;
- no RDF reification;
- sparse temporal-region modeling;
- JSON transaction log;
- SHACL for selected invariants only.

---

## 22. Technical Debt Register

Technical debt SHOULD be recorded when a game-specific implementation requires:

- duplicated logic;
- bypass of the canonical transition pipeline;
- direct renderer-to-store mutation;
- redundant asserted values that risk synchronization drift;
- game-specific patches inside generic engine modules;
- temporary ontology shortcuts;
- performance workarounds;
- unsupported save-version assumptions.

Debt entries SHOULD state whether they are expected to be:

- paid down in the current game;
- promoted into the boilerplate;
- intentionally retained as game-specific behavior.

---

## 23. Hidden Information Architecture

Hidden information is implemented by optional ES modules under `game-mechanics/src/hidden-information`.

- RDF visibility policies drive audience- and phase-specific projections from the ordinary canonical default graph.
- Pass-and-play uses a conceal/reveal lifecycle but retains all canonical RDF on one device.
- Multi-device mode keeps complete canonical RDF on the host and transfers encrypted, player-scoped RDF capsules using AES-256-GCM.
- High-entropy player keys are independent from deterministic gameplay seeds and human-readable game codes.
- URL fragments, QR-compatible tokens, and files provide zero-server invitation transport.
- P-256 ECDH supports encrypted targeted disclosures.
- Salted SHA-256 commitments support later verification of host-concealed values.
- Cryptographic envelopes and keys remain technical artifacts rather than domain RDF.

Detailed algorithms, formats, limitations, and tests are in `docs/game-boilerplate/hidden-information-technical-spec.md`.
