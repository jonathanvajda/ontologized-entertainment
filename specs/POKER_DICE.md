# Poker Dice — Initial Capability and Technical Specification

**Status:** Draft for implementation  
**Game version:** 0.1.0  
**Specification version:** 0.1.0  
**Date:** 2026-09-24

## 1. Overview

Poker Dice is a configurable, turn-based dice game for one to six local players. The default profile uses five six-sided dice, at most three rolls per turn, selective holding between rolls, and a thirteen-category scorecard. Each category may be scored once per player. Multiplayer ends after thirteen rounds; solitaire ends after thirteen turns and evaluates the final score against configurable achievement thresholds.

The game is inspired by the broad family that includes poker dice, Yatzy, Generala, and Yahtzee, but this specification defines its own explicit default rules. Named variants are future configuration profiles and MUST NOT silently change default behavior.

The normative player rules are maintained separately in `docs/POKER_DICE_RULES.md`.

## 2. Game identity and compatibility

| Field | Value |
| --- | --- |
| Game identifier | `https://w3id.org/ontoeagle/games/poker-dice` |
| Ontology namespace | `https://w3id.org/ontoeagle/games/poker-dice/` |
| Suggested prefix | `pd:` |
| Game version | `0.1.0` |
| Required game-mechanics package | `@ontoeagle/game-mechanics` `>=0.1.0 <0.2.0` |
| Required shared ontology | OntoEagle Game Ontology `>=0.1.0 <0.2.0` |
| Game schema version | `1` |
| Save-format version | `1` |
| Default rules profile | `standard-13` |

Breaking changes to category identifiers, score semantics, dice identity, or asserted score entries require a game-schema and save-format compatibility review.

## 3. Scope and capability summary

The first implementation SHALL support:

- one to six local human players;
- solitaire and local hot-seat multiplayer modes;
- exactly five individuated six-sided dice under the default profile;
- one mandatory roll and up to two optional rerolls per turn;
- holding and releasing individual dice between rolls;
- previewing every unused category after a roll;
- committing exactly one unused category per completed turn, including a zero score;
- deterministic seeded play for tests and replay;
- derived totals, upper bonuses, winners, ranks, and solitaire achievement bands;
- save, restore, export, import, audit, and deterministic replay;
- keyboard, pointer, and touch interaction in portrait or landscape layouts;
- game-neutral theme replacement without changing semantic state.

Online networking, remote accounts, computer opponents, wagering, hidden dice, and simultaneous play are out of scope for version 0.1.0.

## 4. Player model and modes

### 4.1 Semantic model

A human player is an instance of CCO `Person` bearing a `game:PlayerRole` during a Poker Dice game session. The active participant additionally bears, or is derived as bearing, `game:CurrentPlayerRole` for the current turn. A winner role is assigned only after multiplayer completion.

Players have stable IRIs scoped to the game session. Display names are player-provided labels and are not identity keys.

### 4.2 Supported modes

| Mode | Players | Progression | Completion and outcome |
| --- | ---: | --- | --- |
| Solitaire | 1 | Thirteen turns | Final score mapped to an achievement band |
| Local hot-seat | 2–6 | Thirteen rounds; one turn per player per round | Highest final total wins |

There are no teams and no player elimination. Turn order is fixed at initialization. A future online adapter may reuse the same canonical actions but is not part of this specification.

### 4.3 Solitaire achievement bands

The default profile uses these provisional bands:

| Total | Outcome |
| ---: | --- |
| 0–149 | Novice |
| 150–199 | Competent |
| 200–249 | Skilled |
| 250–299 | Expert |
| 300 or more | Master |

Bands are presentation and end-result configuration. They do not alter scoring or terminate a game early.

## 5. Spatial, board, and topology model

Poker Dice has no movement board, territories, routes, or semantic spatial topology. The playing surface, dice tray, and scorecard layout are rendering constructs.

The semantic model MAY include a `DiceCup` or `DicePool` aggregate, but screen coordinates, die positions, pip positions, scorecard cell geometry, drag offsets, and animation paths MUST remain outside canonical RDF.

Consequently, shared board-location, adjacency, movement, placement, and pathfinding capabilities are not used by the initial game.

## 6. Objects, aggregates, qualities, and information

### 6.1 Object model

| Concept | Semantic representation | Individual IRIs | Derived count | Literal |
| --- | --- | ---: | ---: | ---: |
| Die | `pd:PokerDie`, subclass of `game:GamePiece` | Yes, five | Yes | No |
| Die face result | `pd:DieFaceValue`, descriptive ICE | Yes per recorded result | No | `rdf:value` integer 1–6 |
| Dice pool | `pd:DicePool`, subclass of `game:GameObjectAggregate` | One/session | Membership | No |
| Scorecard | `pd:Scorecard`, ICE | One/player | No | No |
| Category | Named individual of `pd:ScoringCategory` | Thirteen/profile | No | No |
| Score entry | `pd:ScoreEntry`, ICE | One per claimed category/player | Countable | `rdf:value` non-negative integer |
| Total score | Derived projection | No | Yes | Not asserted by default |
| Upper bonus | Derived from score entries | No | Yes | Not separately asserted |

Dice are individuated because holding, reroll selection, result history, and duplication validation depend on identity.

### 6.2 Aggregate model

The game session has exactly one active dice pool containing exactly the five configured dice. Dice do not leave this aggregate during ordinary play. “Held” is not a second aggregate because held and unheld dice remain members of the same finite pool.

Each player has exactly one scorecard. Score entries are parts or members of that scorecard and are immutable after commitment in the default profile.

### 6.3 Quality and status model

- A die's current displayed face is current semantic state expressed through its current `DieFaceValue` information entity.
- Held status is an asserted, temporary current-state relation between a die and the active turn/player. It is removed at turn end.
- Category eligibility and potential score are derived classifications, not asserted qualities.
- Visual color, rotation, animation, focus, selection glow, and screen position are UI state.

### 6.4 Literal-bearing information entities

| ICE class | Datatype | Range/constraint | Authority |
| --- | --- | --- | --- |
| `pd:DieFaceValue` | `xsd:integer` | 1–6 for default dice | Current roll and roll history |
| `pd:ScoreEntry` | `xsd:nonNegativeInteger` | Score allowed by its category, including zero | Asserted committed score |
| Optional `pd:RandomSeedSpecification` | `xsd:string` or integer | Adapter-defined serializable seed | Save/replay manifest preferred |

Literal values use `rdf:value`. Total, subtotal, bonus, roll count, category availability, frequency tables, and achievement bands SHOULD be derived rather than redundantly asserted.

## 7. Possession, ownership, and control

No player owns or permanently possesses a die. Dice are common game equipment throughout the session.

Procedural control is derived from the current-player relation and current turn: only the current player may roll, change held status, or commit a category. Control begins when that player's turn begins and ends atomically when a score is committed. It does not require an `Act of Ownership` or `Act of Possession`.

The player-specific scorecard is associated with its player through an asserted current relation. A committed score entry is immutable and remains associated with that scorecard for the rest of the session.

## 8. Turn, round, and phase model

### 8.1 Turn phases

| Phase | Entry condition | Legal player actions | Exit condition |
| --- | --- | --- | --- |
| `awaiting-roll` | Turn begins; dice unheld; roll count 0 | `rollDice` | First roll succeeds |
| `selecting-dice` | A roll exists and roll count is 1 or 2 | `toggleHold`, `rollDice`, `commitScore` | Reroll requested or score committed |
| `must-score` | Third roll succeeds | `commitScore` | Score committed |
| `turn-cleanup` | Score committed | Automatic consequences only | Holds and transient values cleared; next turn begins or game ends |
| `complete` | Every player has claimed every configured category | No gameplay action | Terminal |

The first roll always rolls all five dice. A later roll rolls only unheld dice. A player MAY reroll with all dice held; this consumes a roll and leaves values unchanged, although the UI SHOULD warn before doing so. The player MAY score after the first or second roll and MUST score after the third.

### 8.2 Rounds

In multiplayer, a round is complete after every player has taken one turn. The game contains thirteen rounds under the default profile. In solitaire, round and turn numbers are equivalent, but the implementation MAY omit round presentation.

### 8.3 Active-player transition

After score commitment and cleanup, play passes to the next player in fixed order. After the final player, the round increments and play returns to the first player. After all scorecards contain thirteen entries, the session transitions to `complete` instead.

## 9. Action catalog

| Action | Process/class | Preconditions | RDF/current-state effects | History and consequences | Undo policy |
| --- | --- | --- | --- | --- | --- |
| `startGame` | `pd:GameInitializationAct` | Valid profile; 1–6 unique players | Creates session, dice pool, five dice, scorecards, order, first turn | Records seed metadata and initialization | Before first roll only |
| `rollDice` | `pd:DiceRollingAct` | Current player; roll phase; roll count < 3 | Replaces face values only for eligible dice; advances roll count/phase | Retains roll act and per-die results; refreshes previews | Allowed before later semantic actions only; competitive UI may disable |
| `toggleHold` | `pd:DieHoldingAct` or release act | Current player; at least one roll; turn incomplete | Adds/removes current held relation | May remain technical-only history to reduce RDF noise | Allowed until roll or score commit |
| `commitScore` | `pd:ScoreCommitmentAct` | Current player; at least one roll; category unused | Adds immutable score entry and value; no category overwrite | Derives totals/bonus; clears holds; ends turn; checks completion | Disabled after next player sees/acts; unrestricted in explicit practice mode |
| `undo` / `redo` | Technical transaction operation | Policy permits; history cursor valid | Applies inverse/original RDF delta | Does not create domain act | Mode-configurable |
| `saveGame` | Technical persistence operation | State valid | No semantic mutation | Stores RDF, transactions, RNG, manifest, optional UI | Not applicable |

Ordinary illegal actions return structured failures and MUST NOT mutate RDF, transaction history, score projections, or RNG state.

## 10. Randomization specification

The default game uses five fair independent six-sided dice.

- Each eligible die consumes one `randomInt(1, 6)` result from the shared random engine.
- The first roll makes all five dice eligible.
- A reroll excludes held dice.
- Dice are evaluated in stable die-IRI order so a seed and action stream reproduce the same results across browsers.
- Game rule code MUST NOT call `Math.random()`.
- The save package records the RNG algorithm identifier and serializable state.
- Each committed roll transaction records RNG state before and after the action.
- Rejected actions restore the prior RNG state.
- Cosmetic tumbling, rotation, or sound variation MUST use a separate non-authoritative animation source and cannot influence results.

Loaded or imported games MUST reject unsupported RNG algorithms unless a migration adapter is available.

## 11. Default scoring profile: `standard-13`

Let `dice` be the five current integer face values, `count(n)` the number of dice showing `n`, and `sum(dice)` their sum.

| Category ID | Rule | Score |
| --- | --- | ---: |
| `ones` … `sixes` | Always eligible | Face number multiplied by its count |
| `three-kind` | Some face occurs at least 3 times | Sum of all dice; otherwise 0 |
| `four-kind` | Some face occurs at least 4 times | Sum of all dice; otherwise 0 |
| `full-house` | Counts are exactly 3 and 2 | 25; otherwise 0 |
| `small-straight` | Contains 1-2-3-4, 2-3-4-5, or 3-4-5-6 | 30; otherwise 0 |
| `large-straight` | Exactly 1-2-3-4-5 or 2-3-4-5-6 | 40; otherwise 0 |
| `five-kind` | All five dice match | 50; otherwise 0 |
| `choice` | Always eligible | Sum of all dice |

The upper subtotal is the sum of `ones` through `sixes`. An upper subtotal of at least 63 earns a 35-point bonus. The grand total is the sum of all thirteen score entries plus the derived upper bonus.

A category is “eligible” even when its calculated score is zero. Committing it records zero and permanently consumes that category. A five-of-a-kind is not a full house under the default exact-count rule. There is no repeat-five-kind bonus and no joker substitution in version 0.1.0.

All potential category scores are recomputed after each roll. Preview values are derived UI/operational state; only the selected committed score is asserted.

## 12. End conditions, winners, and ties

The only default end condition is that every participating player's scorecard contains one entry for every configured category.

Multiplayer ranking sorts by:

1. grand total, descending;
2. upper subtotal, descending;
3. number of categories with a positive score, descending.

If players remain equal, they share the rank and winner role. No extra roll is used. Solitaire assigns the configured achievement band and may additionally display personal-best comparisons from local preferences; personal bests do not alter canonical session results.

## 13. Canonical RDF state and operational projection

Canonical RDF includes:

- game session, profile, version, players, roles, and player order;
- five die individuals and dice-pool membership;
- current turn and phase;
- current face-value ICE for each die;
- current holds;
- scorecards, category associations, and committed score entries;
- retained roll and score-commitment acts with participants/results.

The operational projection SHOULD include:

```js
{
  mode,
  players,
  currentPlayerIri,
  roundNumber,
  turnNumber,
  phase,
  rollCount,
  dice: [{ iri, value, held }],
  scorecardsByPlayer,
  categoryPreviewsByPlayer,
  upperSubtotalByPlayer,
  upperBonusByPlayer,
  totalByPlayer,
  ranking,
  legalActions
}
```

Roll count and ordinal turn/round values MAY be derived from retained acts where performant. A compact current-phase specification MAY be asserted if required for fast restore, provided a single authoritative pattern is documented in the ontology implementation.

## 14. Invariants and validation

| Invariant | Severity | Preferred mechanism |
| --- | --- | --- |
| Session has exactly five distinct dice under `standard-13` | Violation | SHACL plus JS profile validation |
| Every die is in exactly one active dice pool | Violation | SHACL |
| Every die has exactly one current face after the first roll | Violation | SHACL |
| Face literal is an integer from 1 through 6 | Violation | SHACL |
| Only dice in the current turn may be held | Violation | JavaScript |
| Roll count remains 0–3 and agrees with phase | Violation | JavaScript |
| First roll includes every die; rerolls exclude held dice | Violation | JavaScript transition tests |
| Each player has exactly one scorecard | Violation | SHACL |
| A scorecard has at most one entry per category | Violation | SHACL SPARQL or JS |
| Score entry equals the category function for the committed roll | Violation | JavaScript |
| Score entries are never replaced after commitment | Violation | JavaScript delta validation |
| Totals and bonus equal derivation from entries | Violation for final result; warning during projection diagnostics | JavaScript |
| Completed session has all configured categories for every player | Violation | JavaScript plus SHACL SPARQL |
| Only the current player can perform gameplay actions | Violation | JavaScript precondition |

Every invariant requires at least one passing and one failing fixture where practical.

## 15. Temporal modeling

`GameSession`, `Turn`, `Round`, `DiceRollingAct`, and `ScoreCommitmentAct` are occurrents or temporal entities because ordering and duration matter to audit and replay. Current die values, holds, active player, and category availability use ordinary current-state assertions and are not universally temporalized.

Obsolete face-value and hold assertions are removed. Historical roll-result entities preserve what each roll produced without RDF reification.

## 16. Rendering and visualization specification

### 16.1 Primary layout

The application SHALL render three regions:

1. turn header: current player, round/turn, roll count, and concise instructions;
2. dice tray: five interactive dice, hold indicators, and roll control;
3. scorecard: category names, previews, committed scores, subtotals, bonus, and total.

Landscape layouts SHOULD place the tray and scorecard side by side. Portrait layouts SHOULD place the dice tray above a scrollable scorecard. Multiplayer SHALL keep all players' totals visible while showing only the active player's actionable score cells.

### 16.2 Required SVG and D3 objects

No authored board SVG is required. Dice SHOULD be generated as reusable SVG elements:

- one `<g class="die">` per die, keyed by semantic die IRI;
- one rounded `<rect>` die body;
- up to seven fixed pip anchors rendered as `<circle>` elements according to face value;
- a non-color-only held marker, such as an SVG lock/ring plus visible “Held” text;
- optional shadow and roll transform that do not encode state.

D3 MAY be used for keyed data joins, enter/update/exit behavior, class/style updates, and transitions. D3 MUST NOT generate random outcomes or mutate RDF. The scorecard SHOULD use semantic HTML (`table`, buttons, headings, and output elements) rather than SVG because tabular accessibility is materially better.

Suggested render data:

```js
{
  dice: [{ iri, value, held, enabled, ariaLabel }],
  scoreRows: [{ categoryIri, label, preview, committed, enabled }],
  activePlayer: { iri, label },
  roll: { count, remaining, enabled },
  totals: { upper, bonus, grand }
}
```

### 16.3 Interaction and animation

- Selecting a die toggles held status after the first roll.
- Selecting an unused category opens a concise confirmation or commits directly according to a saved preference; zero-score selections require explicit confirmation.
- Roll animation SHOULD last 250–500 ms and reveal the already-determined semantic result.
- Reduced-motion mode replaces tumbling with an immediate face update or brief opacity change.
- Renderer updates occur only after a committed transition.

### 16.4 Visual states and theme

The default theme SHOULD use the existing `--ont-*` CSS tokens with a green-felt or neutral-panel tray, high-contrast light dice, dark pips, and the shared accent color. Held, focus, current-player, scorable, committed, and zero-score states require text, icon, border, or pattern distinctions in addition to color.

No raster art is required for version 0.1.0. Optional sound, haptics, and decorative skins are non-semantic adapters.

## 17. Accessibility and mobile interaction

- Minimum interactive target: 44 by 44 CSS pixels.
- Every die is a button or keyboard-operable group labeled with die number, face value, and held status.
- Roll and score actions are reachable by keyboard in logical order.
- Score previews and commits are announced through a polite live region; validation failures use an assertive alert only when necessary.
- Pips are supplemented by accessible numeric labels.
- No action depends on hover, drag, sound, color, or animation.
- Dice remain tappable at a 320 CSS-pixel viewport width.
- The scorecard uses sticky category/player headers where space permits.
- Multiplayer hot-seat transition SHOULD offer a neutral pass-device screen to avoid accidental interaction, even though results are not hidden information.

Pan and zoom are unnecessary for the initial game.

## 18. Save, undo, replay, and integrity policy

Saves include canonical RDF, transaction history, rules profile and version, RNG algorithm/state, game/schema versions, and optional non-semantic UI preferences. In-progress dice values and holds MUST survive restore.

Deterministic replay is required. Transaction history is retained for the full session by default.

- Solitaire and explicit practice mode: undo/redo available through committed transactions.
- Standard multiplayer: undo is disabled after the next player begins a turn; implementations MAY disable it entirely for fairness.
- Export contains no executable rule code.
- Imported states are untrusted and must pass manifest, RDF, profile, and invariant validation.
- UI state such as animation progress is not saved; theme and direct-commit preference MAY be saved as preferences.

## 19. Configuration contract and variants

The default rules SHALL be data-driven through a trusted configuration object similar to:

```js
{
  id: 'standard-13',
  dice: { count: 5, sides: 6, maxRollsPerTurn: 3 },
  players: { min: 1, max: 6 },
  categories: [
    'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'three-kind', 'four-kind', 'full-house',
    'small-straight', 'large-straight', 'five-kind', 'choice'
  ],
  upperBonus: { threshold: 63, score: 35 },
  repeatFiveKindBonus: null,
  jokerRule: false,
  scoringFunctions: trustedScoringRegistry,
  solitaireBands: [150, 200, 250, 300]
}
```

Configuration may select only trusted registered scoring and end-condition functions. Imported saves cannot supply JavaScript. Future profiles MAY change category inventory, face count, roll count, bonuses, straight rules, full-house treatment, or Generala/poker-style combinations, but each profile requires a stable identifier, tests, labels, and migration policy.

## 20. Proposed game package structure

```text
docs/games/poker-dice/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── game-config.js
├── ontology/
│   ├── PokerDiceOntology.ttl
│   ├── initial-state.ttl
│   └── PokerDiceShapes.ttl
├── rules/
│   ├── actions.js
│   ├── legality.js
│   ├── scoring.js
│   └── end-conditions.js
├── projection/
│   └── poker-dice-projector.js
├── rendering/
│   ├── dice-svg.js
│   ├── scorecard.js
│   └── entity-visual-map.js
├── theme/
│   └── poker-dice.css
└── tests/
    ├── fixtures/
    ├── actions.test.js
    ├── scoring.test.js
    ├── invariants.test.js
    └── replay.test.js
```

The ontology may ultimately reside in `docs/src/ontologies` if it is intended for reuse outside the game package. That decision should be made during ontology implementation, not by duplicating the ontology in both locations.

## 21. Test acceptance criteria

Before the game is implementation-complete, automated tests SHALL demonstrate:

- all face-frequency and category-scoring edge cases;
- exact versus non-exact full house behavior;
- duplicate-tolerant small straight detection;
- all two large straights;
- upper bonus immediately below, at, and above 63;
- category commitment at zero;
- prohibition on overwriting a category;
- first roll affects all dice and rerolls preserve held dice;
- third roll forces score selection;
- illegal actions preserve RDF and RNG state;
- player and round transitions for one, two, and six players;
- shared-rank tie behavior;
- completion only after every scorecard is full;
- save/restore during every phase;
- replay from the initial state produces byte-equivalent normalized semantic state;
- accessible die names, keyboard activation, touch targets, and reduced-motion rendering.

## 22. Boilerplate overrides

No boilerplate architectural override is currently required. In particular, RDF remains canonical, ordinary triples represent current state, roll history uses semantic individuals, randomization uses the shared adapter, and geometry remains outside RDF.

## 23. Initial technical debt

No debt is intentionally accepted at specification time. The first implementation should record evidence if any of these likely pressure points require a local workaround:

- atomic score commitment plus automatic turn cleanup;
- restoring RNG state when a transaction is rejected or undone;
- efficiently retaining roll history while replacing current face values;
- expressing scorecard category uniqueness in SHACL Core;
- rendering a multiplayer scorecard on narrow landscape screens.

## 24. Open architectural questions

1. Should hold/release acts remain semantic history, or should only current holds and technical transactions be retained?
2. Should the current roll count be asserted as an ICE for fast restore or always derived from roll acts within the current turn?
3. Should score-category definitions be ontology individuals, configuration records, or mirrored in both with a consistency check?
4. Should multiplayer expose a limited “correct mistaken category” action before the next turn, or rely exclusively on practice-mode undo?
5. Which second profile—classic poker combinations, Yatzy, or Generala—should validate that the scoring registry is genuinely configurable?

These questions do not block implementation of the `standard-13` profile.

## 25. Definition of ready

This game is ready for substantive implementation when this draft is accepted or amended, because it defines the player model, absence of spatial topology, individuated objects, aggregates, information values, control semantics, phases, action catalog, randomization, scoring, end condition, invariants, rendering strategy, mode configuration, and save/replay policy required by the implementation guide.
