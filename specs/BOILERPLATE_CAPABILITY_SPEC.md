# Browser Board Game Boilerplate — Capability Specification

## 1. Purpose

This capability specification defines the reusable, game-agnostic capabilities expected of a lightweight, fully in-browser board-game engine. The boilerplate is intended to support multiple game families by providing a common baseline for state management, RDF-backed game data, turn handling, actions, randomization, scoring, persistence, rendering integration, and validation.

The capability specification describes **what the boilerplate must be able to do**. It intentionally avoids overcommitting to implementation details that belong in the technical specification or in an individual game specification.

The architecture is expected to evolve. Decisions identified as provisional may be revised as concrete games reveal better abstractions. Technical debt should be recorded rather than hidden.

---

## 2. Design Goals

The boilerplate SHOULD:

- run entirely in a modern browser;
- work well in landscape mode on mobile devices;
- remain lightweight enough for static hosting;
- support multiple game families without coupling the engine to a specific board layout or visual theme;
- use RDF as the canonical semantic game-state representation;
- support BFO/CCO-aligned game models;
- allow efficient JavaScript projections of RDF state for gameplay and rendering;
- distinguish semantic game state from UI/rendering state;
- support deterministic testing where randomness is seeded;
- support save, restore, export, audit, replay, and validation;
- allow game-specific capabilities to extend the baseline without modifying core code unnecessarily;
- permit architectural decisions to be revisited with documented migration paths.

The boilerplate SHOULD NOT require:

- a backend server;
- 3D rendering;
- server-side databases;
- React or another large UI framework;
- a specific board geometry;
- a specific game genre;
- RDF reification as a core state-management mechanism;
- named graphs as a core state-management mechanism;
- pervasive temporal modeling of all mutable state.

---

## 3. Conceptual State Layers

The boilerplate SHALL distinguish three state layers.

### 3.1 Canonical RDF State

The authoritative semantic representation of the current game and its retained semantic history.

Examples:

- players and player roles;
- territories, sites, regions, and other spatial entities;
- cards and card aggregates;
- pieces and resources;
- acts and processes;
- qualities;
- current relations such as location, participation, aggregate membership, or other game-relevant state;
- historical actions and processes that have occurred.

### 3.2 Derived Operational State

A JavaScript projection generated from the RDF state for efficient gameplay.

Examples:

- number of armies in a territory;
- cards in a player hand;
- adjacency indexes;
- currently legal actions;
- computed score;
- reachable spaces;
- ownership/control summaries;
- cached lookup maps.

Derived state MUST be regenerable from canonical RDF plus game configuration.

### 3.3 UI / Rendering State

Transient or presentation-specific state that generally does not belong in the ontology.

Examples:

- selected territory;
- hovered card;
- open modal;
- drag position;
- zoom and pan;
- SVG path geometry;
- animation progress;
- CSS fill colors;
- screen coordinates.

---

## 4. Core Game Capabilities

### CAP-001 — Game Initialization

The engine SHALL support creation of a new game from a game-specific configuration and initial RDF dataset.

The engine SHALL be able to:

- instantiate players;
- instantiate game objects;
- establish initial board state;
- establish initial card/resource collections;
- initialize turn and phase state;
- initialize a seeded or unseeded randomization source;
- validate the initial state before play begins.

### CAP-002 — Player Representation

The engine SHALL support one or more players.

A player MAY be represented as a Person, an artificial agent, or another game-specific agent type.

The engine SHALL support game-specific roles such as:

- player role;
- current-player role;
- attacker role;
- defender role;
- banker role;
- team-member role;
- winner role.

Role semantics SHALL be defined in the game specification.

### CAP-003 — Territories, Sites, and Board Locations

The engine SHALL support game entities that function as territories, spaces, regions, sites, nodes, or locations.

The game specification SHALL determine the most appropriate BFO/CCO-aligned type, such as:

- site;
- operational area;
- administrative region;
- constituent state;
- game-specific subclass.

The engine SHALL NOT assume that visual board geometry is encoded in RDF.

### CAP-004 — Board Topology

The engine SHALL support relations needed to describe topology and movement structure, including where applicable:

- adjacency;
- connectivity;
- routes;
- graph edges;
- movement constraints;
- source/destination relationships;
- membership in larger spatial aggregates.

The engine SHALL distinguish semantic topology from visual placement.

### CAP-005 — Object Aggregates and Membership

The engine SHALL support object aggregates and membership relations.

Examples include:

- draw deck;
- discard deck;
- player hand;
- market;
- reserve;
- territory aggregate;
- team;
- group of persons;
- collection of pieces.

The engine SHALL permit both:

- class-level grouping, where all instances meeting a condition are treated together; and
- aggregate-level grouping, where a specific aggregate is an entity in the game.

### CAP-006 — Individuated Game Objects

The engine SHALL support individual IRIs for game-relevant objects whose identity matters.

Examples include:

- individual cards;
- individual pieces;
- individual trains;
- individual armies;
- individual buildings;
- individual tokens;
- individual dice if required by the game.

The engine SHOULD prefer counting individuals over storing redundant quantity literals when practical.

### CAP-007 — Qualities

The engine SHALL support qualities borne by game entities.

Examples may include:

- color quality;
- terrain quality;
- rank quality;
- suit quality;
- status quality;
- other game-specific qualities.

Game specifications SHALL decide whether a concept is best represented as:

- a quality;
- a role;
- a class assertion;
- an information content entity;
- or another BFO/CCO-aligned entity.

### CAP-008 — Information Content Entities and Literal Values

The engine SHALL support information content entities whose semantics are primarily established through their class/type.

Where a literal is needed, the baseline pattern SHALL allow `rdf:value` to associate the information-bearing node with the literal.

Examples may include:

- labels;
- numerical specifications;
- costs;
- die results;
- textual instructions;
- identifiers;
- scores when a game-specific model requires an asserted value rather than a derived count.

Game specifications SHOULD avoid redundant datatype assertions when the value can be reliably derived from individuated entities.

### CAP-009 — Possession

The engine SHALL support game concepts corresponding to possession.

Where CCO-aligned modeling is appropriate, possession MAY be represented using an instance of Act of Possession involving:

- an agent/player; and
- the possessed object.

The game specification SHALL define what continuing state is needed for efficient current-state queries after the act occurs.

### CAP-010 — Ownership

The engine SHALL support game concepts corresponding to ownership.

Where CCO-aligned modeling is appropriate, ownership MAY be represented using an instance of Act of Ownership involving:

- an agent/player; and
- the owned object.

The game specification SHALL define what current-state relation or pattern is authoritative for present ownership.

### CAP-011 — Control

The engine SHALL support one or more game-specific meanings of control.

Control MAY include:

- physical manipulation/control;
- normative or rule-based control;
- strategic control derived from other facts;
- territorial control.

The game specification SHALL state whether control is:

- directly asserted;
- represented through an act/process;
- represented through a role;
- or derived from other state.

### CAP-012 — Actions

The engine SHALL support game actions as explicit operations.

Examples include:

- move;
- draw;
- discard;
- attack;
- purchase;
- trade;
- build;
- claim;
- place;
- pass;
- shuffle;
- roll;
- score;
- end turn.

Each action SHALL be capable of specifying:

- actor or agent;
- participants;
- target or destination when relevant;
- required parameters;
- preconditions;
- state changes/effects;
- rule identifiers or references where applicable.

### CAP-013 — Action Legality

The engine SHALL be able to determine whether a proposed action is legal before committing it.

Legality MAY depend on:

- current phase;
- current player;
- adjacency;
- possession;
- resource availability;
- role;
- territory state;
- score;
- card state;
- game-specific conditions.

Illegal actions SHALL NOT mutate canonical game state.

### CAP-014 — Atomic State Transition

A committed game action SHALL apply its semantic state changes atomically from the perspective of gameplay.

The transition pipeline SHALL support:

1. action proposal;
2. precondition validation;
3. RDF delta calculation;
4. candidate-state evaluation;
5. invariant validation;
6. commit or rejection;
7. operational-state refresh;
8. rendering update.

### CAP-015 — Turns, Rounds, and Phases

The engine SHALL support game progression concepts including:

- turns;
- rounds;
- phases;
- subphases;
- active-player transitions;
- simultaneous phases where a game requires them.

The game specification SHALL define the phase model and legal actions per phase.

### CAP-016 — Randomization

The engine SHALL support reproducible and non-reproducible randomization.

Supported randomization patterns SHALL include:

- dice rolls;
- card shuffling;
- random draws;
- bag/pool sampling;
- randomized setup;
- weighted random selection where needed.

A game SHALL be able to use a seeded random-number generator for tests and replay.

### CAP-017 — Finite Random Sources

The engine SHALL support randomization over finite individuated collections without replacement.

For example, if exactly ten purple cards exist, the engine SHALL be able to determine their current distribution across:

- draw pile;
- player hands;
- discard pile;
- market;
- other valid aggregates.

The engine SHALL prevent logically impossible duplication of an individual object.

### CAP-018 — Resource and Piece Management

The engine SHALL support both:

- individuated resources/pieces; and
- literal-bearing or specification-based values where individuation is impractical.

The game specification SHALL determine which approach applies to each resource type.

### CAP-019 — Placement

The engine SHALL support placing game entities in or on board entities.

Game-specific placement MAY distinguish:

- region placement;
- node placement;
- edge placement;
- slot placement;
- containment;
- location;
- aggregate membership.

### CAP-020 — Movement

The engine SHALL support movement of game entities.

Movement rules MAY involve:

- adjacency;
- path finding;
- movement cost;
- blocking;
- transport type;
- ownership/control restrictions;
- phase restrictions.

### CAP-021 — Trading and Transfer

The engine SHALL support transfer of objects or resources between eligible entities.

Game-specific implementations MAY support:

- direct transfer;
- trade proposals;
- acceptance/rejection;
- bank exchange;
- auction;
- purchase;
- sale.

### CAP-022 — Effects and Triggered Consequences

The engine SHALL support consequences triggered by actions or state transitions.

Examples include:

- paying rent;
- receiving resources;
- drawing a card;
- losing pieces;
- gaining a role;
- ending a phase;
- recalculating score.

Triggered effects SHOULD be traceable to the action or rule that caused them.

### CAP-023 — Temporary Effects

The engine SHALL support temporary conditions and modifiers where required by a game.

Examples include:

- double movement until turn end;
- blocked movement for a round;
- temporary scoring bonus;
- temporary role;
- temporary immunity.

Temporal regions SHOULD be used sparingly and only where semantically useful.

### CAP-024 — Scoring

The engine SHALL support game-specific scoring.

Scores MAY be:

- entirely derived;
- partly derived and partly asserted;
- event-based;
- set-completion-based;
- territory-based;
- resource-based;
- objective-based;
- end-game-only.

The scoring implementation SHALL declare the authoritative source of score truth.

### CAP-025 — End Conditions

The engine SHALL support game-specific end conditions independent of the scoring mechanism.

Examples include:

- score threshold;
- deck exhaustion;
- elimination;
- objective completion;
- turn limit;
- board control;
- depletion of a finite supply.

### CAP-026 — Winning and Ranking

The engine SHALL support computation of winners and, where relevant, final ranking.

Tie-breaking rules SHALL be game-specific.

### CAP-027 — Current-State Semantics

For ordinary mutable assertions, the baseline interpretation SHALL be:

> If the triple is present in the canonical RDF state, it currently holds. If it no longer holds, the obsolete triple is removed.

The engine SHALL NOT require reification, named graphs, or universal temporal qualification to determine whether an ordinary current-state assertion is active.

### CAP-028 — Semantic History

The engine SHALL support retention of historical actions/processes as ordinary RDF individuals.

Examples include:

- movement process;
- card-drawing process;
- act of purchase;
- act of ownership;
- act of possession;
- attack process;
- dice-rolling process;
- turn;
- round.

Concluded historical actions SHOULD generally remain in the RDF dataset.

### CAP-029 — Technical Change Log

The engine SHALL support an implementation-level change log recording committed state mutations.

A change-log entry SHOULD be able to record:

- transaction identifier;
- game action identifier;
- added triples;
- removed triples;
- ordering metadata;
- optional random seed/state information;
- optional diagnostic metadata.

The change log is an implementation artifact and does not need to be represented as domain RDF.

### CAP-030 — Undo, Redo, and Replay

The boilerplate SHOULD support reversible transactions where game rules permit them.

It SHOULD support:

- undo of recent committed transactions;
- redo;
- replay from an initial state plus transaction log;
- reconstruction of state for debugging.

Individual games MAY disable undo for competitive or hidden-information reasons.

### CAP-031 — Validation

The engine SHALL support validation of canonical game state.

Validation SHALL support:

- structural RDF checks;
- game invariants;
- legal cardinality constraints;
- aggregate membership constraints;
- object-location constraints;
- game-specific consistency rules.

SHACL MAY be used where it provides clear value.

SHACL SHALL NOT be required as the main gameplay rule-execution engine.

### CAP-032 — Save and Restore

The engine SHALL support saving and restoring game progress in-browser.

The save architecture SHALL support:

- canonical RDF state;
- technical transaction history as required;
- randomization state as required for replay;
- game identifier and version;
- schema/configuration version;
- optional UI state.

### CAP-033 — Export and Import

The engine SHALL support portable export/import of game state.

At minimum, a save package SHOULD be capable of preserving:

- RDF state;
- game/version metadata;
- transaction log where enabled;
- randomization state where needed.

### CAP-034 — Browser Persistence

The boilerplate SHALL support IndexedDB-based persistence for saved games and related artifacts.

### CAP-035 — Rendering Adapter

The engine SHALL expose a rendering-neutral view model so different renderers can display the same semantic state.

The rendering layer SHALL NOT be the canonical source of game state.

### CAP-036 — SVG / Vector Board Rendering

The baseline renderer SHOULD support SVG/vector rendering suitable for:

- irregular territory shapes;
- common geometric shapes;
- nodes and edges;
- labels;
- territory recoloring;
- tokens;
- lightweight animations;
- touch interaction.

### CAP-037 — Theme / Skin Support

The boilerplate SHALL support game-specific themes without changing core semantic entities.

Theme configuration MAY determine:

- colors;
- fonts;
- icons;
- textures;
- SVG paths;
- board background;
- token appearance;
- animation settings.

### CAP-038 — Mobile Landscape Interaction

The baseline interface SHALL be designed for touch use in landscape orientation.

Controls SHOULD:

- have adequate touch targets;
- minimize hover-only behavior;
- avoid requiring precision pointer input;
- support board pan/zoom where needed;
- avoid dense permanent panels where overlays or drawers are more appropriate.

### CAP-039 — Accessibility

The boilerplate SHOULD provide reusable support for:

- semantic labels;
- keyboard interaction where practical;
- non-color-only indicators;
- readable contrast;
- scalable text;
- reduced-motion preferences where animations exist.

### CAP-040 — Testability

The engine SHALL expose deterministic, UI-independent APIs for testing game rules and transitions.

Tests SHOULD be able to:

- load RDF fixtures;
- create an action;
- test legality;
- compute an RDF delta;
- commit the action;
- run invariants;
- inspect resulting canonical and derived state.

---

## 5. Validation Capability Guidance

SHACL is part of the supported toolbox but not automatically required for every rule.

Prefer SHACL for questions such as:

- Must every Card be in exactly one valid aggregate?
- Must every active ArmyPiece be located in exactly one valid territory?
- May a collection contain only objects of a specified type?
- Must a game contain exactly N instances of a finite game-piece class?

Prefer JavaScript rule logic for questions such as:

- May Player 1 attack Territory B right now?
- What sequence of effects follows a dice result?
- Which card should be drawn next?
- How does a player resolve a multi-step trade?

Prefer SPARQL or JavaScript derivation for questions such as:

- How many armies occupy this territory?
- What territories are reachable?
- What cards are in this player's hand?
- What is the current computed score?

---

## 6. Provisional Architectural Decisions

The following decisions define the current baseline but MAY be revised after implementation experience:

1. RDF is canonical; JavaScript operational state is derived.
2. BFO/CCO alignment is preferred for game-specific semantic models.
3. Literal-bearing information entities use `rdf:value` where appropriate.
4. Individuated entities are preferred over redundant quantity literals when practical.
5. Current mutable state is normally represented through the presence/absence of ordinary triples.
6. Historical actions/processes are retained as RDF individuals.
7. Technical RDF deltas are stored outside the domain ontology in a transaction log.
8. RDF reification is excluded from the baseline.
9. Named graphs are excluded from the baseline.
10. Temporal regions are used sparingly.
11. SHACL is a validation mechanism, not the primary gameplay engine.
12. Rendering geometry is not required to be RDF.
13. D3/SVG is a preferred initial rendering approach, but rendering remains replaceable.

---

## 7. Technical-Debt Principle

When a concrete game exposes a mismatch between the boilerplate and the game's needs, the implementation SHALL document:

- the violated assumption;
- the local workaround;
- whether the workaround should remain game-specific;
- whether the boilerplate should change;
- migration impact on existing games;
- whether the issue represents acceptable technical debt or a design defect.

A working local solution is preferable to premature generalization, provided the debt is explicitly recorded.

---

## 8. Hidden Information Extension

### CAP-041 — Audience- and Phase-Scoped Projection

The engine SHALL support disposable RDF projections constrained by viewer identity and game phase. Canonical RDF remains authoritative. Visibility policy is semantic state; DOM concealment is UI state.

### CAP-042 — Pass-and-Play Privacy

The engine SHALL support confirmed reveal, neutral device handoff, timeout, and concealment on page visibility loss. This provides presentation privacy and SHALL NOT be represented as cryptographic isolation.

### CAP-043 — Multi-Device Information Isolation

The engine SHALL support a host-authoritative mode in which each player device receives only public state and its own encrypted RDF partition. A player export SHALL NOT include another player's private state or the host-only solution.

### CAP-044 — Zero-Server Invitation Transport

The engine SHALL support encrypted player invitations through URL fragments, QR-compatible tokens, copy/paste, or files. A short game code MAY label a session but SHALL NOT be treated as a sufficient secret or state-retrieval mechanism without a rendezvous service.

### CAP-045 — Targeted Disclosure and Commitment

The engine SHALL support recipient-targeted micro-disclosures and salted cryptographic commitments verifiable when concealed information is later revealed.

Detailed normative requirements are in `docs/game-boilerplate/hidden-information-capability-spec.md`.
