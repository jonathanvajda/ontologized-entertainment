# Was It the Butler? — Capability and Technical Specification

**Status:** Refined implementation draft  
**Game version:** 0.1.0  
**Schema version:** 1  
**Date:** 2026-09-24

## 1. Overview

Was It the Butler? is a three-to-six-player deduction game built on the Ontologized Entertainment RDF game engine and hidden-information extension. It supports:

- pass-and-play on one device with audience/phase concealment;
- local multi-device play with a host page and static player pages;
- host-authoritative board, turn, movement, suggestion, and accusation state;
- player-scoped five-letter hand codes and local notebooks;
- commitment and later verification of the concealed solution.

The game has no backend and does not claim live synchronization from a short code. Multi-device player pages receive setup information once and remain useful because hands never change during normal play.

## 2. Identity and routes

| Field | Value |
| --- | --- |
| Game IRI | `https://w3id.org/ontologize-entertainment/games/was-it-the-butler` |
| Ontology namespace | `https://w3id.org/ontologize-entertainment/games/was-it-the-butler/` |
| Prefix | `butler:` |
| Game version | `0.1.0` |
| Rules profile | `estate-mystery-1` |
| Save format | `1` |

Static routes:

```text
docs/was-it-the-butler/index.html          mode landing
docs/was-it-the-butler/pass-and-play/     one-device game
docs/was-it-the-butler/host/              multi-device host
docs/was-it-the-butler/player/            player hand + notebook
```

The landing page presents two primary choices: **Pass and play** and **Multiple devices**. The multiple-device panel then exposes **Host a game** and **Join as a player**.

## 3. Security modes

### 3.1 Pass-and-play

One canonical RDF store contains public board state, every hand, and the solution. `hi:VisibilityPolicy` individuals govern cards, hand membership, notebook data, and solution entities. The renderer receives only a viewer/phase projection.

Private nodes are mounted only after named-player confirmation and removed on conceal, timeout, blur, or handoff. This is presentation privacy, not storage isolation.

### 3.2 Multi-device

The host owns complete canonical RDF. For each player it produces a five-letter bearer code encoding both the hand size and combinatorial rank of that hand. The rank is masked and checksummed against the public table code and chosen suspect identifier. It contains no solution and no other hand.

Four capital letters can represent every possible hand of at most six cards, but leave only about three bits of redundancy after the largest hand is represented. Five letters are therefore the minimum supported width. Encoding all possible three-to-six-card hands consumes about 16.3 bits and leaves seven checksum bits. The table code is a public label and does not derive the deal. The chosen suspect supplies player identity and binds the code without claiming to add secret entropy.

The player page is a compact decoder and renderer rather than an RDF client. It has the shared card manifest but no host triplestore, SPARQL evaluator, or SHACL validator. It reconstructs only the hand represented by its access code and keeps notebook data locally.

Player pages do not submit movement or notebook changes to the host in baseline 0.1.0. Refutations are performed in person by showing one selected card on the refuter's device. The generic targeted-disclosure module remains available for a later QR/token workflow.

### 3.3 Trust boundary

The host operator is trusted because the host contains all secrets. Player-device inspection reveals that player's own hand and notebook only. Hand codes are bearer credentials and cannot be revoked without adding a live service. They prevent derivation of the actual other hands and solution because those facts are absent, but they are not cryptographic authenticators: the possible card subsets are inherently enumerable.

## 4. Entity register

### 4.1 Cards

The 21 card IRIs are stable and individuated.

| Category | Members |
| --- | --- |
| Suspects | Mrs. Eggshell, Lt. Marinara, Ms. Peach, Mrs. Mint, Prof. Mulberry, Mr. Brown |
| Weapons | Shovel, Baseball Bat, Pistol, Rope, Knife, Electric Guitar |
| Rooms | Ballroom, Living Room, Dining Room, Kitchen, Library, Game Room, Screened-in Porch, Greenhouse, Pool Room |

Each card is both a `game:Card` and a category-specific subclass. Card art is rendering configuration outside RDF; asset identifiers map stable card IRIs to files.

### 4.2 Physical and spatial entities

| Concept | Semantic model | Identity |
| --- | --- | --- |
| Board room | Subclass of `game:BoardLocation` / BFO Site | Stable IRI |
| Foyer | Non-card `game:BoardLocation`; shared token start zone | Stable IRI |
| Passage space | `butler:PassageSpace`, game board location | Stable IRI from geometry manifest |
| Doorway connection | Asserted adjacency between passage and room | Endpoint pair |
| Secret passage | Individuated route entity | Stable IRI |
| Suspect token | Individuated `game:GamePiece` | One per suspect |
| Weapon token | Individuated `game:GamePiece` | One per weapon |
| Player hand | `game:GameObjectAggregate` | One per player |
| Sealed solution | Three-member protected aggregate | One per session |

Board topology is semantic RDF; pixel geometry and artwork are external JSON/SVG/image assets.

### 4.3 Floorplan topology

The board composition SHALL follow this architectural layout:

| Band | Left | Center | Right |
| --- | --- | --- | --- |
| Back | Pool Room | Screened-in Porch | Greenhouse |
| Middle | Game Room and Library | Ballroom | Kitchen |
| Front | Living Room | Foyer | Dining Room |

Required adjacency is Library–Game Room, Library–Living Room, Game Room–Pool Room, Game Room–Ballroom, Pool Room–Screened-in Porch, Screened-in Porch–Greenhouse, Screened-in Porch–Ballroom, Greenhouse–Kitchen, Kitchen–Ballroom, Kitchen–Dining Room, and Foyer–Living Room/Ballroom/Dining Room.

Adjacency describes architectural reachability, not necessarily a single movement point. A future `board-topology.json` SHALL represent walkable corridor squares, doorways, the six Foyer starts, room entry nodes, occupancy, and optional passage edges independently of the art. Stable square IDs use grid coordinates such as `sq-r12-c08`; visible labels are not required.

A logical grid around 36×36 or 40×40 is the starting design target. The exact extent should be derived from the room footprints and useful corridor length rather than fixed at 50×50. Room geometry may occupy most of the image, but the movement graph needs enough walkable corridor nodes for two-die values and blocking to matter; the prototype SHALL be playtested before limiting walkable area to 10–20 percent.

## 5. Canonical RDF and information partition

### 5.1 Public host state

- game/session identity and profile;
- player order, active/eliminated status, and token assignment;
- token locations;
- board topology;
- turn/phase and dice results;
- suggestions and whether/which player refuted, but not the shown card;
- accusation outcome after resolution;
- public solution commitment digest.

### 5.2 Private player state

- membership of cards in that player's hand;
- complete identity of those cards;
- the player's notebook entries;
- compact-code context scoped to that player.

### 5.3 Host-only state

- sealed solution membership;
- solution commitment salt until reveal;
- every hand membership;
- player hand-code records;
- deterministic shuffle state if it would expose the deal.

### 5.4 Current-state semantics

Token location, current player, phase, and eligibility use ordinary direct triples and replacement deltas. Historical moves, suggestions, refutations, accusations, eliminations, and solution reveal remain RDF individuals.

Technical compact-code checksums and local notebook storage are not RDF.

## 6. Setup pipeline

1. Render all six suspect portraits as toggles. Validate that three to six are active and preserve selection order as turn order; this interaction makes a duplicate suspect unrepresentable and derives player count from the active set.
2. Generate a public table code using cryptographic randomness.
3. Generate a host-private gameplay seed. Suspect choices are public context and are not counted as entropy.
4. Select one card from each category for the solution using the shared deterministic random engine seeded from host-private entropy.
5. Canonicalize solution card IRIs, create a random commitment salt, and publish the SHA-256 commitment.
6. Shuffle the remaining 18 cards and deal round-robin without replacement.
7. Create canonical hand aggregates and visibility policies.
8. For multi-device mode, encode each dealt hand as a five-letter player-scoped hand code.
9. Validate inventory: 21 distinct cards distributed exactly once across solution and hands.
10. Place every suspect token in a distinct, nonblocking Foyer start position, create the first turn from the selected order, and commit setup atomically.

The public table code MUST NOT derive the deal, solution, salts, or keys.

## 7. Turn and phase model

| Phase | Legal actions | Exit |
| --- | --- | --- |
| `turn-start` | `accuse`, `roll`, `useSecretPassage`, `suggestIfRemaining` | Chosen action |
| `movement` | `moveStep`, `enterRoom`, `endMovement` | Room entered or movement ends |
| `suggestion` | `selectSuspect`, `selectWeapon`, `submitSuggestion`, `skipSuggestion` | Suggestion submitted/skipped |
| `refutation` | `cannotRefute`, `selectRefutationCard`, `confirmPrivateReveal` | First refutation or full circuit |
| `notebook` | local notebook actions | Player ends turn |
| `accusation` | select triple, confirm | Resolved immediately |
| `turn-cleanup` | automatic | Next eligible player or game end |
| `complete` | reveal/verify/export | Terminal |

Eliminated players are skipped as active players but remain in the refutation order.

## 8. Action catalog

| Action | Principal preconditions | Canonical effects |
| --- | --- | --- |
| `roll` | Active, eligible player; `turn-start` | Add dice-roll act/result; enter movement |
| `moveStep` | Destination adjacent, unblocked, movement remaining | Replace token location; retain movement act |
| `useSecretPassage` | Current room owns route; not otherwise moved | Replace location; consume movement choice |
| `submitSuggestion` | Active player in named room; one suggestion maximum | Create suggestion act; move named suspect/weapon; initialize refutation cursor |
| `cannotRefute` | Cursor player holds no suggested card | Record negative response; advance cursor |
| `selectRefutationCard` | Cursor player owns selected matching card | Create protected disclosure event; end refutation |
| `accuse` | Eligible active player at turn start | Compare triple with host-only solution; reveal/complete or eliminate accuser |
| `endTurn` | Required actions resolved | Advance to next non-eliminated active player |
| `revealSolution` | Game complete | Publish solution and salt; verify commitment |

Notebook actions remain player-local UI/persistence operations and do not mutate host RDF.

## 9. Refutation privacy

The host may know that Player B refuted Player A's suggestion, but the shown card is visible only to A and B.

- Pass-and-play: project the matching cards for B during a confirmed private selection screen, then project exactly the selected card for A during a second confirmed screen.
- Multi-device baseline: B selects one matching card on B's player page and physically shows it to A. The host records only that B refuted.
- Optional token flow: B encrypts a one-card disclosure to A using the shared ECDH module; A imports it locally. This requires a manual QR/copy step and is not required for the first UI.

## 10. Accusation and commitment

An accusation is evaluated only on the host/pass-and-play authoritative device. Before evaluation the chosen triple is confirmed without revealing the solution.

On success or terminal table defeat, the host publishes solution IRIs and commitment salt. Every client can verify the setup digest. On failure, only correctness=false and elimination are public; the solution remains concealed.

## 11. Validation invariants

| Invariant | Mechanism |
| --- | --- |
| Exactly 21 unique cards exist | SHACL + JS |
| Solution contains exactly one suspect, weapon, and room | SHACL |
| Every card belongs to exactly one solution/hand aggregate | JS + SHACL SPARQL |
| Each player has exactly one hand and token | SHACL |
| Every sensitive card/hand/solution subject has a visibility policy | Shared coverage validator |
| Player hand code reconstructs exactly its scoped hand | JS compact-code boundary test |
| Current token has exactly one location | SHACL |
| Movement follows topology and allowance | JS |
| Suggested room equals current room | JS |
| Refutation card matches suggestion and belongs to refuter | JS |
| Eliminated players cannot take active turns | JS |
| Solution commitment verifies on reveal | Shared crypto module |

## 12. Save and replay

Host save contains canonical RDF, transaction history, RNG state, commitment salt, and hand-code context. Player devices persist only their local notebook; the hand is reconstructed from the five-letter code and access details.

Undo is available in practice mode. Competitive play disables undo after private information is revealed or an accusation is evaluated. Replay tools must respect audience policies and MUST NOT expose future hidden state during ordinary playback.

## 13. Page requirements

### Landing

- Present theme, player count, approximate duration, and rules link.
- Primary actions: Pass and play; Multiple devices.
- Nested multi-device actions: Host a game; Join as a player.
- Explain that host and players must be physically together in baseline zero-server mode.

### Pass-and-play

- Board and public status remain visible.
- Full-screen neutral handoff replaces private content.
- Private hand/notebook DOM is created only after confirmation.

### Host

- Setup/deal, hand-code distribution, public board, turns, dice, movement, suggestions, refutation status, accusations, saves, and final reveal verification.
- Never display a player's hand during ordinary multi-device play.

### Player

- Enter table code, chosen suspect, and five-letter private hand code.
- Reject codes whose checksum does not match that access context.
- Show only own hand, private notebook, current static game identity, and optional disclosure tools.
- Work offline after import.

## 14. Image and visual asset specification

The game requires a cohesive illustrated estate-mystery system. Assets SHALL be original and avoid resemblance to protected characters, boards, or trade dress from other deduction games.

### 14.1 Art direction

- Setting: eccentric contemporary country estate with a lightly theatrical whodunit tone.
- Treatment: painterly editorial illustration with clean silhouettes, textured color, and readable small-scale subjects.
- Palette: deep bottle green, oxblood, aubergine, parchment, aged brass, pool blue, and warm shadow.
- Lighting: late-evening interior light, consistent direction across room and character art.
- Avoid photoreal violence, gore, police branding, and firearm emphasis. The pistol card should be treated as an inert evidence object.

### 14.2 Required manifest

| Asset group | Count | Recommended master | Runtime use |
| --- | ---: | --- | --- |
| Estate board base | 1 | 2400×1800 landscape | Board background beneath semantic hit regions |
| Room illustrations | 9 | 1600×1000 landscape | Room cards, board insets, landing previews |
| Suspect portraits | 6 | 1200×1500 portrait | Suspect cards and player selection |
| Weapon still lifes | 6 | 1200×1500 portrait | Weapon cards |
| Room card crops | 9 | derived 1200×1500 | Room cards |
| Suspect tokens | 6 | 512×512 transparent top-down | Board pieces |
| Weapon tokens | 6 | 512×512 transparent top-down | Room evidence pieces |
| Card back | 1 | 1200×1500 portrait | Concealed cards |
| Sealed envelope | 1 | 1200×800 transparent/isolated | Solution and commitment UI |
| Landing hero | 1 | 2400×1350 landscape | Game landing page |
| UI motifs | 6–10 | transparent PNG/WebP | Dice, notebook, magnifier, passages, seals |

Board topology and interactive targets SHALL be SVG/JSON geometry layered above the board image. The board illustration itself is not semantic state.

### 14.3 Asset identifiers

Each semantic entity maps through a manifest rather than embedding filenames in RDF:

```js
{
  entityIri: 'https://w3id.org/ontoeagle/games/was-it-the-butler/MrsEggshell',
  cardImage: './assets/cards/suspect-mrs-eggshell.webp',
  tokenImage: './assets/tokens/suspect-mrs-eggshell.webp',
  alt: 'Mrs. Eggshell in a white evening jacket'
}
```

Every image requires meaningful alternative text. Decorative crops use empty alt text. Runtime derivatives SHOULD use WebP or AVIF with a PNG fallback where transparency compatibility matters.

### 14.4 Current 255×255 prototype assets

The active manifest uses `person-mrs-mint-02.png`, `person-mr-brown-02.png`, `weapon-guitar-02.png`, `room-gameroom-02.png`, and the distinct Ballroom card art `room-ballroom-02.png`. The corresponding `-01` files remain alternate or board-zone art. In particular, `room-ballroom-01.png` is the former Hall illustration retained for the temporary Foyer/estate-board inset; Foyer remains a distinct non-card semantic location.

## 15. Proposed package structure

```text
docs/was-it-the-butler/
├── index.html
├── pass-and-play/index.html
├── host/index.html
├── player/index.html
├── manifest.webmanifest
├── service-worker.js
├── ontology/
│   ├── WasItTheButlerOntology.ttl
│   ├── WasItTheButlerShapes.ttl
│   └── initial-state.ttl
├── rules/
├── model/
├── rendering/
├── crypto/
├── geometry/
│   ├── board-topology.json
│   └── board-hit-regions.svg
├── assets/
│   ├── board/
│   ├── rooms/
│   ├── cards/
│   ├── tokens/
│   └── ui/
└── tests/
```

## 16. Implementation sequence

1. Finalize board topology and secret-passage layout.
2. Create the game ontology, SHACL shapes, and complete initial fixture.
3. Implement deterministic solution/deal, visibility policies, and compact hand-code boundary tests.
4. Implement headless movement, suggestion, refutation, accusation, and commitment tests.
5. Build pass-and-play concealment and complete a usability pass.
6. Build host hand-code distribution and player compact-code decoder/notebook.
7. Freeze the art manifest and generate/commission assets in consistent batches.
8. Integrate responsive board geometry and assets.
9. Complete offline, save/restore, accessibility, and audience-leak tests.

## 17. Open decisions

The current nine-room image and direct room-adjacency graph are placeholders, not a frozen movement board. The eventual board should keep artwork separate from a responsive logical overlay: individually identified corridor squares, room zones, doorway nodes, Foyer starting spaces, and secret-passage edges in `board-topology.json`, with scalable hit regions rendered above the composite board image. Square identifiers are required internally but need not be printed for players.

1. Exact grid extent, corridor geometry, doorway count, and secret-passage pairs; the six Foyer starts and broad room layout are decided.
2. Whether movement uses one or two dice; this draft selects two and should be confirmed before fixtures.
3. Whether remaining-in-room permits a new suggestion every turn; this draft permits it.
4. Whether a failed accuser continues refuting; this draft requires it.
5. Whether the first release includes manual encrypted disclosure tokens or physical screen showing only.
6. Final character visual descriptions before image generation.
7. Whether accusations remain legal anywhere at turn start or require the accuser to return to the Foyer. The prototype currently permits accusations anywhere.

The implemented RDF model and room-level movement graph remain valid while these decisions are playtested. Square-level topology and accusation constraints MUST remain configuration/rule-layer concerns rather than artwork assumptions.
