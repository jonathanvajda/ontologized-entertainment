# Everything's Sus — Capability and Technical Specification

**Status:** Refined implementation draft  
**Game version:** 0.1.0  
**Schema version:** 1  
**Date:** 2026-10-24

## 1. Overview

Everything's Sus is a three-to-six-player deduction game built on the Ontologized Entertainment RDF game engine and hidden-information extension. It supports:

- pass-and-play on one device with audience/phase concealment;
- local multi-device play with a host page and static player pages;
- host-authoritative board, turn, movement, room-accusation, and final-accusation state;
- player-scoped five-letter hand codes and local notebooks;
- commitment and later verification of the concealed solution.

The game has no backend and does not claim live synchronization from a short code. Multi-device player pages receive setup information once and remain useful because hands never change during normal play.

## 2. Identity and routes

| Field | Value |
| --- | --- |
| Game IRI | `https://w3id.org/ontologize-entertainment/games/everything-is-sus` |
| Ontology namespace | `https://w3id.org/ontologize-entertainment/games/everything-is-sus/` |
| Prefix | `everything-is-sus:` |
| Game version | `0.1.0` |
| Rules profile | `estate-mystery-1` |
| Save format | `1` |

Static routes:

```text
docs/everything-is-sus/index.html          mode landing
docs/everything-is-sus/pass-and-play/     one-device game
docs/everything-is-sus/host/              multi-device host
docs/everything-is-sus/player/            player hand + notebook
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
| Rooms | Ballroom, Living Room, Dining Room, Kitchen, Study, Game Room, Screened-in Porch, Greenhouse, Swimming Pool Room |

Each card is both a `game:Card` and a category-specific subclass. Card art is rendering configuration outside RDF; asset identifiers map stable card IRIs to files.

### 4.2 Physical and spatial entities

| Concept | Semantic model | Identity |
| --- | --- | --- |
| Suspect person | In-game person controlled by a player or moved as evidence | Stable IRI |
| Board room | Instance of `obo:BFO_0000029` (site); capacity 0–6 suspect people | Stable IRI |
| Foyer space | Instance of `obo:BFO_0000029` and walkable-space class; capacity 0–1 suspect person | Stable grid IRI |
| Hallway space | Instance of `obo:BFO_0000029` and walkable-space class; capacity 0–1 suspect person | Stable grid IRI |
| Stair site | Instance of `obo:BFO_0000029`; non-walkable | Stable grid IRI |
| Doorway connection | Asserted adjacency between passage and room | Endpoint pair |
| Secret passage | Individuated route entity | Stable IRI |
| Suspect token | Individuated `game:GamePiece` that visually represents, but is not identical with, one suspect person | One per suspect |
| Weapon token | Individuated `game:GamePiece` | One per weapon |
| Player hand | `obo:BFO_0000027` | One per player |
| Sealed solution | Three-member protected aggregate | One per session |

Every room, Foyer cell, hallway cell, and stair cell is a BFO site. A suspect person's current location target is either one room site or one walkable cell site. Canonical location is asserted on that suspect person with `obo:BFO_0000171` (`located in`), for example `person-mint obo:BFO_0000171 site-N15` in the Foyer or `person-mint obo:BFO_0000171 room-ballroom` after entering the Ballroom. The human player controls a suspect person but is not asserted to occupy the game-board site. A local functional relation such as `everything-is-sus:representsPerson` links each visual token to its person. Token placement is projected from the person's location; the token is never used as a substitute for the person in location assertions.

Board topology is semantic RDF; pixel geometry and artwork are external JSON/SVG/image assets.

### 4.3 Floorplan topology

The board composition SHALL follow this architectural layout:

| Band | Left | Center | Right |
| --- | --- | --- | --- |
| Back | Swimming Pool Room | Screened-in Porch | Greenhouse |
| Middle | Side-by-side Study and Game Room | Ballroom | Kitchen above Dining Room |
| Front | Living Room across lower-left | Foyer | Dining Room extending through lower-right |

Required adjacency is Study–Game Room, Study–Living Room, Game Room–Living Room, Game Room–Ballroom, Swimming Pool Room–Screened-in Porch, Screened-in Porch–Greenhouse, Screened-in Porch–Ballroom, Greenhouse–Kitchen, Kitchen–Ballroom, Kitchen–Dining Room, Ballroom–Dining Room, and Foyer–Living Room/Ballroom/Dining Room.

Adjacency describes architectural reachability, not necessarily a single movement point. Slanted plan marks designate hinged doors; paired slanted marks designate one double door. Parallel straight marks designate broad direct access, especially at the Ballroom, with no hallway inserted between the rooms. Exterior windows MUST occur only on exterior walls, stairs MUST terminate at a modeled landing, and door regions MUST remain unobstructed in the art. `assets/board-topology.json` represents the grid frame, room ranges, walkable terrain, stairs, doors, broad openings, capacity, crossing cost, and walkability independently of the art. Runtime square IDs use familiar grid coordinates such as `N15`; visible labels are not required.

The approved topology is the explicit 26-column (`A`–`Z`) by 18-row (`1`–`18`) plan in `specs/everything-is-sus/board-layout.png`. Runtime room masks are exact cell sets: Swimming Pool Room `A1:J3` plus `A4:I5` (excluding hallway sites `J4` and `J5`); Screened-in Porch `K1:R3`; Greenhouse `S1:Z3`; Study `A6:D12`; Game Room `E6:I12`; Living Room `A13:I18`; Ballroom `K5:R13`; Kitchen `T4:Z9`; Dining Room `T10:Z18`; and the walkable Foyer cells `K15:R16` plus `M17:P18`. Hallway, stair, door, and open-entryway markings remain a separate topology layer above room artwork. Artwork MUST NOT determine legal geometry.

Each orthogonal edge between two ordinary walkable cells has movement cost 1. A topology edge marked as an open entryway also has cost 1; an edge marked as a doorway has cost 2. These are total edge costs, not surcharges. Every movement path has an ingress/egress crossing count, initialized to zero and capped at one. Crossing either marked edge type increments it once. A double door is one topology edge and one crossing. Entering a room ends movement; leaving a room consumes the sole crossing but may be followed by ordinary passage-space steps.

The topology also defines two bidirectional secret-passage pairs between the literal corner rooms: Swimming Pool Room–Dining Room and Greenhouse–Living Room. Each endpoint SHALL have a persistent player-visible passage marker independent of the room bitmap. Markers occupy the literal outer estate corners: Swimming Pool Room top-left, Greenhouse top-right, Living Room bottom-left, and Dining Room bottom-right. The active endpoint marker SHALL be clickable at `turn-start` and during `movement` while the person remains in that room. Passage use discards any rolled allowance, moves the suspect person directly to the paired room, and enters `room-decision`.

Room sites do not expose internal movement cells. Up to six suspect people may be `located in` the same room site, and its renderer SHALL provide six stable token slots. Each individual Foyer or hallway site has maximum person occupancy one. Weapon pieces do not consume person occupancy. A legal path cannot enter or traverse an occupied capacity-one site.

The coordinate labels and diagnostic colors SHALL NOT appear in the ordinary player view. A subtle square grid SHALL remain visible on each singly occupiable hallway and Foyer site so players can count paces. The production board SHALL retain the illustrated estate, outer walls, and lawn. Hallways use a light neutral floor treatment rather than black. Stair regions use a dedicated top-down tread treatment, oriented from the outer landing toward the Foyer, and MUST NOT reuse a miniature Foyer image. Every board-only room bitmap SHALL have the same width-to-height ratio as its topology bounding box. The renderer uses `100% 100%` placement only because those ratios are identical; tests SHALL read each PNG's intrinsic dimensions and compare them to `BOARD_REGIONS`. Runtime cropping and non-uniform stretching are prohibited. Board-interior bitmaps are frameless furnishing-and-floor layers and MUST NOT contain baked-in perimeter walls, doors, entryways, windows, or thresholds. Square card illustrations remain separate assets. A thicker coordinate-derived architectural overlay, with room art inset behind it, supplies shared interior partitions, physical doors, clean wall gaps for open entryways, and secret-passage marks. Consequently, every visible ingress or egress is positioned from `ENTRANCE_MARKERS` and can be validated against a topology boundary. An open entryway MUST NOT depict any door, gate, saloon door, curtain, or other closure. No room art may bleed into a hallway—specifically, the Swimming Pool Room mask excludes `J4` and `J5`. Column letters, row numbers, Greek start identifiers, and capacity data remain hidden.

## 5. Canonical RDF and information partition

### 5.1 Public host state

- game/session identity and profile;
- player order, active/eliminated status, and token assignment;
- suspect-person locations and their token-to-person representation links;
- board topology;
- turn/phase, the optional die result, remaining movement allowance, and ingress/egress crossing count;
- room accusations and whether/which player refuted, but not the shown card;
- final-accusation outcome after resolution;
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

Suspect-person location, current player, phase, and eligibility use ordinary direct triples and replacement deltas. An accepted move deletes the person's prior `obo:BFO_0000171` assertion and inserts exactly one new assertion to the destination site in the same transaction. Historical movement acts preserve origin, destination, pace cost, and turn even though only the current direct location triple remains active. Historical room accusations, refutations, final accusations, eliminations, and solution reveal remain RDF individuals.

Technical compact-code checksums and local notebook storage are not RDF.

### 5.5 Shared die semantics, validation, and rendering

Movement uses one fair six-sided die. Its randomization contract is one independent integer result in the inclusive range 1–6, with probability `1/6` for each result. The host-authoritative shared `RandomEngine.rollDie(6)` MUST generate the value; animation MUST NOT determine or replace the canonical result. The shared implementation SHALL use unbiased bounded-integer sampling (for example, rejection sampling over the underlying unsigned integer source) rather than a modulo mapping that gives some faces more source values than others.

The implementation SHALL reuse and generalize the existing dice mechanism rather than create an Everything's Sus-only duplicate:

- `docs/src/ontologies/DiceOntology.ttl` defines the reusable die, face-value, dice-rolling-act, current-face, and result relations factored from Poker Dice.
- `docs/src/ontologies/DiceShapes.ttl` defines the reusable `rdf:value` integer constraint with inclusive bounds 1 and 6.
- `docs/src/ontologies/PokerDiceOntology.ttl` retains compatible Poker Dice subclasses and subproperties.
- `docs/poker-dice/rendering/dice-svg.js` is the shared accessible SVG face renderer.

The game-independent semantics have been lifted into the shared Dice ontology and SHACL graph. Poker Dice retains its specialized subclasses and properties, while Everything's Sus uses `dice:SixSidedDie`, `dice:DiceRollingAct`, and `dice:DieFaceValue` directly; its movement die is never classified as a five-die Poker Dice pool member merely to reuse code.

The SVG renderer SHALL receive a one-element die array and retain its existing 1–6 pip geometry and rolling state. Its API SHALL gain a backward-compatible non-holdable presentation option, such as `showHold: false`, and an accessible label override such as `Movement die: 4`. Poker Dice keeps the existing hold controls by default. The movement die is disabled while rolling and after its one canonical result has been committed for the turn.

Canonical RDF records one die-rolling act, one face-value result, the player who rolled, and the turn in which it occurred. The result supplies the initial movement allowance. RDF does not record animation frames.

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
10. Use a domain-separated `foyer-placement` random stream to shuffle the six Foyer start sites: α=`L15`, β=`N15`, γ=`P15`, δ=`M16`, ε=`O16`, and ζ=`Q16`. Assign each selected player-suspect to a distinct shuffled site independently of selection and turn order. Unselected suspect people begin at an off-board reserve site. The Greek identifiers are authoring identifiers and are not printed in the production view.
11. Assert each suspect person's initial `located in` relation, project each selected suspect's representing token into its start site, create the first turn from the selected player order, and commit setup atomically.

The public table code MUST NOT derive the deal, solution, salts, or keys.

## 7. Turn and phase model

A turn is an ordered sequence of optional player actions followed by mandatory cleanup:

1. The player may roll the single d6 once, or skip rolling.
2. If rolled, the player may spend zero through the full allowance on legal movement. Movement may end on a hallway or Foyer site; reaching a room is not required.
3. After the player resolves their end location, they may submit one room accusation only if their suspect person is located in a murder-room site.
4. A submitted room accusation starts its deterministic refutation sequence. A shown card may resolve it automatically; if no card is available or the physical/private reveal cannot be completed, the active player can still end the turn.

`endTurn` is therefore legal at every voluntary decision point: before rolling, after rolling without moving, after any legal partial movement, after declining a room accusation, and from the refutation phase when no further card is shown. Skipping a step does not fabricate a roll, movement, or disclosure act in RDF.

| Phase | Legal actions | Exit |
| --- | --- | --- |
| `turn-start` | `roll`, `useSecretPassage`, `submitRoomAccusation` when already in a room, `submitFinalAccusation`, `endTurn` | Roll committed, movement choice taken, accusation submitted, or turn ended |
| `movement` | `moveStep`, `crossBoundary`, `useSecretPassage` when still in its endpoint room, `stopMovement`, `endTurn` | Room entered, passage used, allowance exhausted, player stops, or turn ends |
| `room-decision` | `submitRoomAccusation` when in a room, `submitFinalAccusation`, `endTurn` | Accusation submitted or turn ended |
| `refutation` | `cannotRefute`, `selectRefutationCard`, `confirmPrivateReveal`, `endTurn` | First refutation, full circuit, or explicit turn end |
| `notebook` | local notebook actions | Player ends turn |
| `final-accusation` | select triple, confirm | Resolved immediately |
| `turn-cleanup` | automatic | Next eligible player or game end |
| `complete` | reveal/verify/export | Terminal |

Eliminated players are skipped as active players but remain in the refutation order.

## 8. Action catalog

| Action | Principal preconditions | Canonical effects |
| --- | --- | --- |
| `roll` | Active, eligible player; `turn-start`; no roll yet this turn | Generate one uniform integer from 1–6; add one die-rolling act/result; set movement allowance to the result; enter movement |
| `moveStep` | Orthogonally adjacent walkable destination; destination occupancy below capacity; at least 1 pace remains | Spend 1 pace; replace the suspect person's current `located in` triple; retain movement phase |
| `crossBoundary` | Marked ingress/egress boundary; crossing count is 0; destination occupancy below capacity; enough allowance remains | Spend 1 pace for an open entryway or 2 for a doorway; set crossing count to 1; replace the person's location; entering a room resolves movement |
| `stopMovement` | Movement is active | Preserve the current site as the end location; discard unused allowance; enter room decision |
| `useSecretPassage` | Current room owns route; phase is `turn-start` or `movement`; person has not left the endpoint room | Replace location; discard remaining allowance; enter room decision |
| `submitRoomAccusation` | Active suspect person is located in the named murder room; movement resolved; no room accusation this turn | Create room-accusation act; move named suspect person and weapon into that room; initialize refutation cursor at the next player in fixed order |
| `cannotRefute` | Cursor player holds no card matching the room accusation | Record negative response; advance cursor deterministically with wraparound |
| `selectRefutationCard` | Cursor player owns selected matching card | Create protected disclosure event; end refutation |
| `submitFinalAccusation` | Eligible active player at an allowed voluntary decision point whose suspect person is located on a Foyer site | Compare triple with host-only solution; reveal/complete or eliminate accuser |
| `endTurn` | Any nonterminal active phase, including an unresolved/unavailable refutation | Discard unused allowance and advance to next non-eliminated active player without fabricating a disclosure |
| `revealSolution` | Game complete | Publish solution and salt; verify commitment |

Notebook actions remain player-local UI/persistence operations and do not mutate host RDF.

## 9. Room-accusation refutation and privacy

The refutation order is the fixed player order established at setup: begin with the player immediately after the accuser, advance one player at a time, and wrap at the end. Eliminated players remain in this sequence because they retain their cards. The first player holding one or more cards named by the room accusation must refute it and chooses exactly one matching card to display. No later player responds after a card is shown.

The host may know that Player B refuted Player A's room accusation, but the shown card is visible only to A and B.

The public accusation event and change log SHALL preserve the announced suspect, weapon, and current room. The accusation UI SHALL render that room as a fixed, non-editable third field. Failure to produce a refutation card is a valid outcome and MUST NOT trap the game in `refutation`; an explicit **End turn** remains available.

- Pass-and-play: project the matching cards for B during a confirmed private selection screen, then project exactly the selected card for A during a second confirmed screen.
- Multi-device baseline: B selects one matching card on B's player page and physically shows it to A. The host records only that B refuted.
- Optional token flow: B encrypts a one-card disclosure to A using the shared ECDH module; A imports it locally. This requires a manual QR/copy step and is not required for the first UI.

## 10. Final accusation and commitment

A final accusation is distinct from the refutable room accusation. It is legal only when the active suspect person's canonical location is one of `FOYER_SITES`; a token drawn in the Foyer is merely the projection of that required RDF fact. The action is evaluated only on the host/pass-and-play authoritative device and is compared directly with the concealed solution. Before evaluation the chosen triple is confirmed without revealing the solution. The interface SHALL keep the action visible but disabled elsewhere with the brief explanation **Return to the Foyer**.

On success or terminal table defeat, the host publishes solution IRIs and commitment salt. The UI SHALL reveal the three corresponding card faces sequentially with an envelope/opening transition. Every client can verify the setup digest. On failure, only correctness=false and elimination are public; no solution card is rendered while another eligible player remains.

## 11. Validation invariants

| Invariant | Mechanism |
| --- | --- |
| Exactly 21 unique cards exist | SHACL + JS |
| Solution contains exactly one suspect, weapon, and room | SHACL |
| Every card belongs to exactly one solution/hand aggregate | JS + SHACL SPARQL |
| Each player has exactly one hand and token | SHACL |
| Every sensitive card/hand/solution subject has a visibility policy | Shared coverage validator |
| Player hand code reconstructs exactly its scoped hand | JS compact-code boundary test |
| Every suspect person has exactly one current `located in` site | SHACL |
| Every suspect token represents exactly one suspect person; token placement is derived | SHACL + renderer tests |
| Room sites permit 0–6 suspect people; hallway and Foyer sites permit 0–1 | SHACL + JS |
| A movement roll has exactly one integer result in the inclusive range 1–6 | Shared dice SHACL + JS |
| Each die result has equal selection probability by construction | Shared random-engine boundary/statistical tests |
| Movement follows orthogonal topology and never spends more than the roll | JS |
| Ordinary steps and open entryways cost 1; doorways cost 2 | JS topology fixtures |
| At most one ingress/egress is crossed in a turn | RDF turn state + JS |
| Room-accusation room equals the active suspect person's current room | JS |
| Refutation follows fixed player order and stops at the first capable player | JS |
| Refutation card matches the room accusation, belongs to the refuter, and is chosen by that refuter | JS + visibility tests |
| `endTurn` is accepted at every voluntary decision point, including unavailable/unresolved refutation | JS transition tests |
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

- Setup/deal, randomized Foyer placement, hand-code distribution, public board, turns, one-die SVG roll, pace-by-pace movement, room accusations, refutation status, final accusations, saves, and final reveal verification.
- During movement, expose legal destinations exclusively as controls on the board: the orthogonal neighboring cells, adjacent marked room entrances, and the active corner-room passage arrow. Overlay the pace cost on each available destination. Do not duplicate these as direction or entrance buttons in the side panel.
- Permit the player to stop movement and end the turn while located on a hallway or Foyer site. The UI MUST NOT force selection of a reachable room.
- Never display a player's hand during ordinary multi-device play.
- Render a compact suspect label on every board token. Hover/focus and touchscreen selection SHALL expose the full portrait and name without changing location.
- Render each player access row as a compact control. Activating it SHALL open a modal with the suspect portrait, private hand code, and a QR code for a fragment-based player URL. The QR payload SHALL use the shared game-mechanics adapter and SHALL auto-populate and submit the player access form without a server round trip.

### Player

- Scan a host-displayed invitation QR with the device camera, or enter the table code, chosen suspect, and five-letter private hand code manually. A successful scan SHALL populate and submit the same local form without contacting a server.
- Reject codes whose checksum does not match that access context.
- Show only own hand, private notebook, current static game identity, and optional disclosure tools.
- In each sleuth-sheet category, prevent the last unchecked non-hand item from being checked. Highlight it as the last remaining local possibility, and release it when another item in that category is unchecked. Normalize previously saved all-checked categories to the same invariant.
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
| Estate exterior/base | 1 | 2400×1800 landscape | Lawn, mansion perimeter, outer walls, and neutral connective floor beneath semantic hit regions |
| Room illustrations | 9 | 1600×1000 landscape | Separately generated room cards and board insets clipped to exact room masks |
| Hallway floor treatment | 1 tileable set | 1024×1024 | Light off-white, tan, or gray walkable spaces; never debug black |
| Stair treatment | 1 | Proportional top-down art | Clearly recognizable aerial stairs in non-walkable stair masks |
| Suspect portraits | 6 | 1200×1500 portrait | Suspect cards and player selection |
| Weapon still lifes | 6 | 1200×1500 portrait | Weapon cards |
| Room card crops | 9 | derived 1200×1500 | Room cards |
| Suspect tokens | 6 | 512×512 transparent top-down | Board pieces |
| Weapon tokens | 6 | 512×512 transparent top-down | Room evidence pieces |
| Card back | 1 | 1200×1500 portrait | Concealed cards |
| Sealed envelope | 1 | 1200×800 transparent/isolated | Solution and commitment UI |
| Landing hero | 1 | 2400×1350 landscape | Game landing page |
| UI motifs | 6–10 | transparent PNG/WebP | Dice, notebook, magnifier, passages, seals |

Board topology and interactive targets SHALL be SVG/JSON geometry layered independently of the art. Production rendering does not show grid lines, row/column labels, Greek start labels, or the specification's categorical colors. A developer overlay MAY reveal them for topology debugging. The board illustration itself is not semantic state.

### 14.3 Asset identifiers

Each semantic entity maps through a manifest rather than embedding filenames in RDF:

```js
{
  entityIri: 'https://w3id.org/ontoeagle/games/everything-is-sus/MrsEggshell',
  cardImage: './assets/cards/suspect-mrs-eggshell.webp',
  tokenImage: './assets/tokens/suspect-mrs-eggshell.webp',
  alt: 'Mrs. Eggshell in a white evening jacket'
}
```

Every image requires meaningful alternative text. Decorative crops use empty alt text. Runtime derivatives SHOULD use WebP or AVIF with a PNG fallback where transparency compatibility matters.

### 14.4 Current 255×255 prototype assets

`board-layout.png` and its legend are topology-authoring references, not production board art. The production renderer SHALL compose the estate exterior/base, neutral hallway floor, top-down stairs, and nine topology-proportioned, frameless room interiors beneath the architectural overlay. Room masks must prevent art leakage into passages, including exclusion of `J4` and `J5` from the Swimming Pool Room. Card art and board-interior art are separate assets but SHALL retain the same visual identity. The Swimming Pool Room contains a left-to-right swimming pool with no architectural staircase emerging from the water; a small pool ladder is permitted. The Game Room centers a television, console/controllers, seating, and tabletop games rather than billiards. Prior composite boards remain versioned references. Foyer remains a distinct non-card semantic location.

Board-interior furniture SHALL remain physically coherent without relying on an omitted wall. Bookcases, counters, televisions, and similar edge furniture must form a continuous floor-standing unit or sit flush against the corresponding topology edge; portraits, sconces, floating shelf fragments, and other wall-mounted objects are prohibited in frameless layers. Furniture and plants SHALL leave every topology ingress zone visually unobstructed. The Foyer uses a pale neutral floor close in value to the hallway, a low-contrast dashed fiat-boundary line, and a subtle central inlay/table; it is not enclosed by walls and must read as broadly walkable.

## 15. Proposed package structure

```text
docs/everything-is-sus/
├── index.html
├── pass-and-play/index.html
├── host/index.html
├── player/index.html
├── manifest.webmanifest
├── service-worker.js
├── ontology/
│   ├── EverythingsSusOntology.ttl
│   ├── EverythingsSusShapes.ttl
│   └── initial-state.ttl
├── rules/
├── model/
├── rendering/
├── crypto/
├── assets/
│   ├── board-topology.json
│   ├── board/
│   ├── rooms/
│   ├── cards/
│   ├── tokens/
│   └── ui/
└── tests/
```

## 16. Implementation sequence

1. Playtest the square-level path edges, crossing metadata, and the two corner-room secret-passage pairs.
2. Create the game ontology, SHACL shapes, and complete initial fixture.
3. Implement deterministic solution/deal, visibility policies, and compact hand-code boundary tests.
4. Implement headless movement, room-accusation, refutation, final-accusation, and commitment tests.
5. Build pass-and-play concealment and complete a usability pass.
6. Build host hand-code distribution and player compact-code decoder/notebook.
7. Freeze the art manifest and generate/commission assets in consistent batches.
8. Integrate responsive board geometry and assets.
9. Complete offline, save/restore, accessibility, and audience-leak tests.

## 17. Open decisions

The 26×18 room geometry, doors, open entryways, Foyer, hallways, and stairs are frozen in `assets/board-topology.json`. The implemented movement graph derives individual path nodes, occupancy, and boundary costs from that topology while keeping room artwork separate from scalable hit regions. Square identifiers remain internal and are not printed for players.

1. Playtesting resolved boundary costs at 1 pace for an open entryway and 2 paces for a doorway; one fair six-sided die remains fixed.
2. Whether remaining in a room permits a new room accusation every turn; this draft permits it.
3. Whether a failed accuser continues refuting; this draft requires it.
4. Whether the first release includes manual encrypted disclosure tokens or physical screen showing only.
5. Final character visual descriptions before image generation.

The former room-level movement action remains only as a compatibility alias for loading or dispatching older clients. Canonical play uses stepwise person-location updates. Topology and accusation constraints remain configuration/rule-layer concerns rather than artwork assumptions.
