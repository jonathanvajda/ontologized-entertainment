# Boilerplate capability matrix

This matrix is the acceptance map for the two boilerplate specifications. “Extension contract” means the generic engine supplies the pipeline/API while a concrete game must define its semantics.

| Capability | Baseline implementation |
| --- | --- |
| CAP-001–008 initialization and semantic entities | `game-loader`, RDF store, Game Ontology classes, `rdf:value` score pattern |
| CAP-009–011 possession, ownership, control | CCO imports plus game extension contract; authoritative current relation is selected by each game |
| CAP-012–014 actions, legality, atomicity | `rule-registry` and candidate-store `action-engine` pipeline |
| CAP-015 turns/rounds/phases | `turn-engine` with configurable participants and phases |
| CAP-016–018 randomness and finite objects | seeded `random-engine`; finite draws reject overdraw and preserve individuation |
| CAP-019–023 placement, movement, transfer, effects | Game Ontology relations/action classes; action handlers and bounded triggers |
| CAP-024–026 scoring, ending, ranking | `score-engine`; registered end conditions; configurable tie breaker |
| CAP-027–030 current state, history, transactions, replay | direct-triple store, semantic Game Acts, JSON deltas, undo/redo/replay |
| CAP-031 validation | common async validator result; optional `GameShapes.ttl`; game invariant registry |
| CAP-032–034 saves and browser persistence | versioned save package and five-store IndexedDB adapter |
| CAP-035–037 rendering and themes | immutable view model, SVG adapter, external entity/geometry/theme map |
| CAP-038–039 mobile and accessibility | `game-shell.css`, 44px controls, keyboard SVG activation, ARIA labels, reduced motion |
| CAP-040 testability | deterministic headless ES-module tests and dependency injection |

The package also implements the technical specification’s module boundaries, structured result errors, suppressible structured logging, explicit versions, import size/type checks, default-graph enforcement, and provisional-decision/debt registers. Parsing and serialization stay adapter-driven so the existing vendored N3 runtime and shared RDF I/O package remain the single dependency boundary. `docs/game-boilerplate` is a game-neutral static PWA harness for localhost and GitHub Pages; it demonstrates module loading and offline caching without prematurely defining the first game.

## Hidden-information extension

| Capability | Baseline implementation |
| --- | --- |
| CAP-041 audience/phase projection | RDF `VisibilityPolicy` index and disposable projected stores |
| CAP-042 pass-and-play privacy | Confirmed reveal, timeout, blur concealment, and neutral handoff lifecycle |
| CAP-043 device isolation | Host-complete RDF plus AES-GCM player RDF capsules |
| CAP-044 zero-server invitation | Base64url URL fragments, QR-compatible tokens, copy/paste, and file-compatible objects |
| CAP-045 disclosure/commitment | P-256 ECDH targeted envelopes and salted SHA-256 commitments |
