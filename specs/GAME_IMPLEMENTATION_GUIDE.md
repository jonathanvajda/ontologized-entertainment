# Browser Board Game Boilerplate — Game Implementation Guide and Spec Crosswalk

## 1. Purpose

This guide explains how to build an individual board game on top of the shared browser-game boilerplate.

It crosswalks:

1. the **Boilerplate Capability Specification** — what the engine can do;
2. the **Boilerplate Technical Specification** — how the common engine is implemented; and
3. the **Game Specification** — what each particular game must decide, model, configure, and implement.

The goal is to let a new game reuse the boilerplate without pretending that every semantic, visual, or rules decision can be generalized in advance.

---

## 2. Recommended Game Package Structure

A game built on the boilerplate SHOULD contain a structure similar to:

```text
game/
├── README.md
├── game-config.js
├── ontology/
│   ├── game-schema.ttl
│   ├── initial-state.ttl
│   └── shapes.ttl                # optional
├── rules/
│   ├── actions.js
│   ├── legality.js
│   ├── effects.js
│   ├── scoring.js
│   └── end-conditions.js
├── board/
│   ├── board.svg                 # optional
│   ├── geometry.json             # optional
│   └── entity-visual-map.js
├── theme/
│   ├── theme.css
│   └── assets/
├── tests/
│   ├── fixtures/
│   ├── actions.test.js
│   ├── invariants.test.js
│   └── scoring.test.js
└── migrations/
    └── ...                       # only when needed
```

The precise structure MAY evolve, but game-specific ontology, rule logic, rendering assets, and tests SHOULD remain visibly separated.

---

## 3. What the Boilerplate Already Decides

A game specification normally does **not** need to redesign the following unless it has a compelling reason:

- RDF is the canonical semantic state;
- JavaScript operational state is derived;
- current mutable state normally uses ordinary RDF triples;
- obsolete current-state triples are removed;
- historical semantic actions/processes may remain as RDF individuals;
- named graphs are not part of the baseline;
- RDF reification is not part of the baseline;
- temporal regions are used selectively rather than universally;
- state transitions use a controlled action pipeline;
- technical RDF deltas are logged outside domain RDF;
- IndexedDB is used for local saves;
- rendering state is distinct from semantic state;
- SVG/D3 is the initial preferred renderer family;
- game logic does not live in the renderer;
- randomness goes through a shared randomization adapter;
- SHACL is optional and focused on invariants rather than general rule execution.

If a game overrides one of these decisions, its README MUST explain why.

---

## 4. What Every Game Specification Must Decide

### 4.1 Game Identity

Specify:

- game name;
- game identifier/IRI base;
- version;
- ontology namespace;
- compatibility with boilerplate version;
- save-format version.

### 4.2 Player Model

Specify:

- what entity is the player/agent;
- whether a Person bears a Player Role;
- minimum/maximum players;
- teams, if any;
- relevant temporary/permanent roles;
- player-specific qualities or information artifacts;
- player elimination rules.

### 4.3 Spatial / Board Entity Model

Specify all major spatial entity classes.

For each, state:

- BFO/CCO superclass;
- game-specific subclass;
- whether it is a site, administrative region, operational area, artifact, node, route, etc.;
- identity rule;
- relevant object properties;
- relevant qualities;
- whether its visual geometry exists outside RDF.

Example table:

| Game concept | Semantic type | Identity basis | Visual representation |
|---|---|---|---|
| Territory | Constituent State subclass | stable IRI | SVG path |
| Route | game-specific connected-object class | stable IRI | SVG path/edge |
| Board space | game-specific site | stable IRI | SVG element |

### 4.4 Topology Model

Specify:

- adjacency semantics;
- connectivity semantics;
- directionality;
- edge/route entities;
- reachability rules;
- movement-cost rules;
- derived versus asserted topology.

### 4.5 Object and Resource Model

For each game object type, specify whether it is:

- individuated;
- fungible but represented by individuals;
- represented as an aggregate;
- represented through an information content entity and `rdf:value`;
- represented only as derived state.

Example decision table:

| Concept | Individual IRIs? | Count derived? | Literal needed? |
|---|---:|---:|---:|
| Train cards | Yes | Yes | No |
| Money | Game-specific | Maybe | Maybe |
| Victory points | Usually no | Usually yes | Sometimes |

### 4.6 Aggregate Model

List all important aggregates, for example:

- draw pile;
- discard pile;
- hand;
- market;
- territory group;
- team;
- reserve.

For each, specify:

- aggregate class;
- eligible member classes;
- whether membership changes during play;
- minimum/maximum cardinality;
- whether exactly-one-container rules apply.

### 4.7 Quality Model

List important qualities such as:

- color;
- terrain;
- suit;
- rank;
- status;
- category.

For each, state whether it is modeled as:

- quality;
- role;
- class assertion;
- ICE;
- derived classification.

### 4.8 Possession, Ownership, and Control

The game specification MUST separately define any relevant meanings of:

- possession;
- ownership;
- occupation;
- control;
- stewardship;
- team affiliation.

For each concept, answer:

1. Is there an act/process that establishes or changes it?
2. What RDF pattern represents current state?
3. Is the current state asserted or derived?
4. What causes it to terminate?
5. Does it produce or depend on a role?

### 4.9 Information Content Entities and Literals

List each game concept that ultimately requires a literal.

For each, specify:

- the ICE class that carries the semantics;
- expected datatype;
- use of `rdf:value`;
- validation constraints;
- whether the value could instead be derived.

### 4.10 Turn / Phase Model

Define:

- turn structure;
- round structure;
- phase list;
- phase ordering;
- active-player rules;
- simultaneous phases;
- transitions;
- legal actions per phase.

Suggested table:

| Phase | Entry condition | Legal actions | Exit condition |
|---|---|---|---|
| Draw | turn begins | draw | required cards drawn |
| Action | draw complete | build/trade/move | player ends phase |
| Cleanup | action phase ended | automatic | cleanup complete |

### 4.11 Action Catalog

Every game SHOULD enumerate supported action types.

For each action specify:

- name;
- action/process class;
- actor;
- participants;
- required inputs;
- preconditions;
- RDF additions;
- RDF removals;
- semantic history entities created;
- triggered effects;
- validation checks;
- undo policy.

### 4.12 Randomization

Specify every random mechanism:

- die type;
- shuffle mechanism;
- finite deck/pool;
- random setup;
- weighting;
- seed behavior;
- replay requirements.

### 4.13 Scoring

For each score component, specify:

- semantic source;
- whether it is asserted or derived;
- calculation function/query;
- update frequency;
- visibility;
- tie-breaking effect.

### 4.14 End Conditions

Specify each possible game-ending condition independently from scoring.

### 4.15 Invariants

List all rules that must remain true after a committed transaction.

For each invariant, choose an implementation method:

- JavaScript;
- SHACL core;
- SHACL SPARQL;
- SPARQL ASK;
- combination.

Example:

| Invariant | Severity | Preferred mechanism |
|---|---|---|
| Card in exactly one active container | Violation | SHACL / JS |
| No duplicate physical card IRI | Violation | RDF identity + validation |
| Active piece has exactly one valid location | Violation | SHACL |
| Score display matches derived score | Warning | JS |

### 4.16 Temporal Modeling

Explicitly identify the few game concepts requiring temporal regions.

Do not temporalize mutable state by default.

For each temporalized concept, explain why duration matters semantically.

### 4.17 Board Rendering

Specify:

- board geometry source;
- SVG/path assets;
- generated shapes;
- semantic-entity-to-visual mapping;
- board pan/zoom requirements;
- labels;
- token placement strategy;
- overlap resolution;
- dynamic color/style rules.

### 4.18 Theme / Skin

Specify:

- color palette;
- typography;
- icons;
- token art;
- board background;
- interaction states;
- animation preferences;
- reduced-motion behavior.

### 4.19 Mobile Interaction

Specify:

- primary landscape breakpoint;
- minimum touch target;
- board gestures;
- drawers/modals;
- interaction fallback for hover-dependent desktop behavior.

### 4.20 Save / Replay Policy

Specify:

- whether undo is available;
- whether redo is available;
- whether deterministic replay is required;
- whether transaction history is retained indefinitely;
- whether hidden information affects save/export rules;
- whether UI state is saved.

---

## 5. Capability-to-Technical-to-Game Crosswalk

| Capability area | Boilerplate capability | Boilerplate technical implementation | Game-specific decisions |
|---|---|---|---|
| Canonical state | RDF is authoritative | N3 store | ontology classes/properties/IRIs |
| Operational state | derived JS view | state projector | game-specific indexes and computed values |
| Board spaces | generic territory/location support | render adapter + semantic model | site/region classes and topology |
| Geometry | rendering separate from RDF | SVG/D3/geometry assets | exact paths, shapes, layout |
| Players | role-capable player model | turn engine + RDF state | Person/agent model and roles |
| Cards/pieces | individuated objects supported | RDF instances + aggregate indexes | exact object classes and inventory |
| Quantities | prefer derived counts | projection/query layer | which values are counted vs literal |
| Literals | ICE + `rdf:value` supported | RDF parsing/projection | ICE classes and datatypes |
| Possession | supported conceptually | action/history + current-state pattern | exact CCO-aligned pattern |
| Ownership | supported conceptually | action/history + current-state pattern | exact CCO-aligned pattern |
| Control | may be asserted/derived | rule/projection layer | exact semantics and derivation |
| Aggregates | supported | aggregate indexes | decks, hands, teams, region groups |
| Actions | normalized action pipeline | action engine | action catalog and handlers |
| Legality | precommit validation | rule registry | conditions per action |
| Turns/phases | reusable engine | turn engine | phase graph and transitions |
| Randomness | shared RNG | random engine | dice, decks, seeds, weighting |
| Scoring | reusable computation layer | score engine | formulas/queries/tie breakers |
| End conditions | reusable checks | rule/end-condition registry | exact game-ending predicates |
| History | semantic processes retained | RDF individuals | action/process vocabulary |
| Change log | auditable technical history | JSON transaction log | retention/undo policy |
| Validation | invariant support | JS/SHACL/SPARQL | exact invariant set |
| Temporal regions | selective support | ordinary RDF patterns | which processes/effects need them |
| Save/restore | common persistence | IndexedDB | save policy/versioning |
| Import/export | common package | serializers + manifest | allowed formats/distribution |
| Theme | skinning supported | CSS/assets/config | game art and palette |
| Mobile | landscape baseline | responsive UI | game-specific layout constraints |

---

## 6. Game README Template

Each game SHOULD include a README using this outline.

```markdown
# <Game Name>

## 1. Overview

## 2. Boilerplate Version

## 3. Namespace and IRI Policy

## 4. Player Model

## 5. Spatial / Board Model

## 6. Object and Resource Types

## 7. Aggregates and Membership

## 8. Qualities

## 9. Possession / Ownership / Control

## 10. Information Content and Literal Values

## 11. Turn and Phase Model

## 12. Action Catalog

## 13. Randomization

## 14. Scoring

## 15. End Conditions

## 16. Invariants and Validation

## 17. Temporal Modeling Exceptions

## 18. Board Geometry and Rendering

## 19. Theme / Skin

## 20. Save / Undo / Replay Policy

## 21. Boilerplate Overrides

## 22. Known Technical Debt

## 23. Open Architectural Questions
```

---

## 7. Boilerplate Override Template

When a game departs from a boilerplate assumption, document it using:

```markdown
### Override: <short name>

**Boilerplate assumption:**

<what the common engine normally assumes>

**Game requirement:**

<why this game differs>

**Implementation:**

<what the game does instead>

**Scope:**

- [ ] Game-specific only
- [ ] Candidate boilerplate improvement
- [ ] Temporary workaround

**Migration impact:**

<what would break if generalized or changed later>
```

---

## 8. Technical Debt Template

```markdown
### Debt: <short name>

**Introduced because:**

<reason>

**Affected capability:**

<capability ID or area>

**Current workaround:**

<description>

**Risk:**

- Low / Medium / High

**Likely resolution:**

<game-local fix, common-engine refactor, ontology migration, etc.>

**Trigger for revisiting:**

<what would make this debt important enough to address>
```

---

## 9. Decision Heuristics

### Prefer RDF assertion when:

- the fact is part of the semantic game world;
- the fact should survive save/export;
- the fact needs ontology-aware querying;
- the fact is not merely a rendering convenience.

### Prefer derived JavaScript state when:

- the value can be deterministically computed from RDF;
- the value is queried frequently;
- recomputing it improves UI performance;
- asserting it would create synchronization risk.

### Prefer renderer/UI state when:

- the information exists only to display or interact with the game;
- the value is transient;
- the value is screen/device-specific;
- the value does not change game semantics.

### Prefer an individuated entity when:

- identity matters;
- finite inventory matters;
- duplication must be detectable;
- transfer/history matters;
- the object may bear distinct qualities/roles.

### Prefer an aggregate when:

- the collection itself matters as an entity;
- membership changes during play;
- rules operate on the collection as a whole.

### Prefer a class/query instead of an aggregate when:

- the grouping is purely classificatory;
- the collection does not itself participate in gameplay;
- membership is simply “all instances satisfying condition X.”

### Prefer a temporal region when:

- duration or temporal ordering matters semantically;
- the entity is genuinely an occurrent or temporary condition;
- queries need more than “current versus no longer current.”

Do not use temporal regions merely to avoid deleting obsolete current-state triples.

### Prefer SHACL when:

- a state invariant can be expressed declaratively;
- the constraint is structural or cardinality-oriented;
- post-transition validation is useful;
- readable constraint reports are valuable.

### Prefer JavaScript rules when:

- a rule is procedural;
- an action has multiple steps;
- randomness is involved;
- the rule triggers state transitions;
- the rule depends heavily on turn/phase context.

---

## 10. First-Game Learning Loop

The first concrete game SHOULD be treated as a validation exercise for the boilerplate.

For each major implementation issue:

1. implement the simplest game-local solution that preserves correctness;
2. record the assumption that failed;
3. decide whether the issue belongs in the common engine;
4. avoid immediate generalization unless a second use case justifies it;
5. add a regression test before promoting a game-specific solution into the boilerplate;
6. update the capability and technical specs when a common architectural decision genuinely changes.

This process is intentional. The boilerplate is expected to mature through concrete games rather than being fully correct in advance.

---

## 11. Suggested Workflow for a New Game

1. Create the game README from the template.
2. Define namespace and entity identity policy.
3. Define spatial/board entity types.
4. Define players and roles.
5. Define finite physical/game objects.
6. Define aggregates and membership.
7. Define qualities and ICE patterns.
8. Define possession/ownership/control semantics.
9. Define turn/phase model.
10. Define action catalog.
11. Define random mechanisms.
12. Define scoring and end conditions.
13. Define invariants and choose JS/SHACL/SPARQL implementation.
14. Build initial RDF fixture.
15. Build state projection.
16. Implement core actions without UI.
17. Add transition tests.
18. Add renderer mapping.
19. Add theme/assets.
20. Add persistence/save tests.
21. Record boilerplate overrides and technical debt.
22. Revisit the shared specs only after concrete evidence supports a change.

---

## 12. Definition of Ready for Game Implementation

A game is ready for substantive implementation when the game-specific README defines at least:

- player types/roles;
- core board/spatial entity classes;
- object/resource classes;
- aggregate classes;
- topology;
- turn/phase sequence;
- initial action catalog;
- randomization model;
- primary scoring method;
- primary end condition;
- initial invariants;
- rendering geometry strategy.

Everything else MAY remain provisional and evolve through implementation.
