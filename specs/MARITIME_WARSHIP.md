# Custom Battleship: Universal Rules & Technical Specification

## Part 1: Universal Game Rules & Abstract Mechanics

### 1. Overview
This specification describes a two-player game of hidden grid positioning, deduction, and tactical targeting. Players arrange a fleet of vessels across a grid containing environmental hazards and attempt to locate and sink all opponent vessels before their own fleet is destroyed. The mechanics described below apply universally regardless of the medium (physical or digital).

### 2. Equipment & Setup Components
* **The Grids:** Each player maintains two private grids:
  1. *Primary Grid:* Displays the player's own fleet and hazards, tracking damage received from enemy attacks.
  2. *Targeting Grid:* Tracks shots fired into enemy territory and records feedback (Hit, Miss, or Sunk).
* **Grid Labeling:** Grids consist of a uniform matrix of cells. Row labels use uppercase alphabetical letters (A through Z), and column labels use numerical identifiers (1 through N).

### 3. Climate Themes & Environmental Hazards
Before placing vessels, the environmental condition (Climate) is selected. Climates determine the physical nature and behavior of **Obstacles** on the grid:
* **Warm Water (Tropical Maritime):**
  * *Obstacles:* Represented as landmasses, islands, or coral reefs.
  * *Draft Rule:* Heavy vessels require deep water. The largest vessels in a fleet cannot be anchored adjacent to or overlapping island/reef sectors.
  * *Attack Interaction:* Visible island terrain cannot be targeted. Blocked is not a separate playable outcome.
* **Arctic (Frozen Maritime):**
  * *Obstacles:* Represented as ice fields, icebergs, or frozen hazard zones.
  * *Navigation Rule:* Vessels of any size cannot be positioned over frozen sectors.
  * *Attack Interaction:* Visible frozen obstacles cannot be targeted. Glancing Miss and Blocked are not separate playable outcomes.

### 4. Fleet Configurations
A fleet consists of $N$ distinct vessels (ranging from 4 to 7 vessels). Every vessel has a specific length measured in continuous grid cells:
* **Default Fleet (5 Vessels):** Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
* **Preset Variations:**
  * *4 Vessels:* Drops the largest vessel (Carrier).
  * *6 Vessels:* Adds an additional Battleship (4 cells).
  * *7 Vessels:* Adds an additional Battleship (4 cells) and an additional Carrier (5 cells).
* **Custom Draft:** Players allocate a point budget or choose a custom distribution of vessels up to fleet ceilings.

### 5. Placement Rules
1. Vessels must be placed orthogonally (horizontally or vertically) in a straight line.
2. No vessel may overlap another vessel.
3. No vessel may overlap an Obstacle cell.
4. Under Warm Water rules, vessels with length >= 4 must maintain open ocean clearance and cannot be anchored in shallow coastal cells adjacent to island obstacles.
5. Once play begins, vessel locations remain fixed for the duration of the match.

### 6. Gameplay & Targeting Systems
* **Default Resolution: Verbal Play with Local Defender Resolution.** The attacker calls coordinate(s) aloud. The defender confirms those incoming coordinates on their own device; the app derives and announces Miss, Hit, or Hit and sunk from the local fleet, prior damage, and terrain. The defender relays the result verbally. The attacker explicitly records that verbal result. Opponent placements are unavailable, so outgoing outcomes SHALL NOT be automatically resolved or prefilled.
* **Standard Rule:** A player selects one coordinate per turn. The defender reports the status.
* **Salvo Rule Variant:** When activated, a player selects 1–5 distinct coordinates simultaneously before firing. The defender reports all submitted coordinates as one complete batch.
* **Local Recording:** Outgoing coordinates require explicit verbal outcomes. Incoming coordinates require confirmation only; the app computes their outcomes. Standard or salvo batches commit atomically to the canonical RDF store and are automatically persisted as RDF snapshots and transaction history in IndexedDB after every accepted action. No Save button is needed. No state is sent to the other device. Players coordinate turns and readiness verbally; the creator fires first.
* **Optional Identity Disclosure:** Players decide whether to name hit or sunk vessels. Hit and Sunk MUST be recordable without disclosing vessel class, name, full footprint, or an association with earlier hits. A sunk vessel is a participating warship in a non-mission-capable stasis for the game mission; its more specific class may remain unknown.
4.2 Targeting Feedback Loop
An uncommitted selection may be canceled. After a verbal report, a coordinate is manually recorded with one of these results:
- Miss: The coordinate contains no vessel segment, excluding visible terrain obstacles, which cannot be targeted. Cancel abandons an uncommitted selection and is not a shot result.
- Hit: The coordinate strikes an active, unsunk vessel segment.
- Hit and sunk (stored as Sunk): The shot hits the last undamaged cell of a specific vessel. It is one exclusive outcome, rather than two separate choices.

### 7. Victory Condition
The game ends immediately when a player marks the final remaining vessel segment of the opponent’s fleet as Sunk, declaring that player the Winner.

---

## Part 2: Web Application Technical Specification

### 1. System Architecture & Tech Stack
* **Architecture:** Client-Side Single Page Application (SPA), serverless Progressive Web App (PWA).
* **State & Local Storage:** IndexedDB for match history and settings persistence and for active game state.
* **Setup-Only Sharing:** The creator shows a self-contained setup code, scannable QR, or invitation link. The second player reconstructs the same public rules and terrain on their own device. After joining, all changes are local; attacks and results are communicated verbally. No server, live connection, encrypted dispatch exchange, or further app-to-app communication is required or used.
* **UI/UX Stack:** Lightweight frontend framework, CSS Grid/Flexbox, dynamic Web Audio API / Canvas API for animations.

```
       ┌────────────────────────────────────────────────────────┐
       │               URL / QR-Code State Generator            │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Local Web Engine (Browser)                      │
│                                                                        │
│  ┌───────────────────────┐                  ┌───────────────────────┐  │
│  │   Match State Store   │                  │   Procedural Board    │  │
│  │      (IndexedDB)      │                  │    Generator Engine   │  │
│  └───────────┬───────────┘                  └───────────┬───────────┘  │
│              │                                          │              │
│              ▼                                          ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Placement Entropy Validator                  │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Game Loop Engine                          │  │
│  │  (Salvo Manager, Local UI State, Dynamic FX / Animations Engine) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Match Configuration Parameters

|Parameter|Type|Default|Bounds / Allowed Values|
|---|---|---|---|
|Play Mode|Fixed baseline|`TWO_DEVICE`|Creator and joiner each use their own device; pass-and-play is deferred.|
|Preset Mode|`Enum`|`QUICK_PLAY`|`QUICK_PLAY`, `CUSTOM_PLAY`|
|Row Dimension|`Integer` / `String` |`10` (`A`–`J`)| Range: $8$ to $26$ (`A`–`H` through `A`–`Z`)|
|Column Dimension|`Integer`|`10` |Range: $8$ to $26$
|Obstacle Count|`Integer`|`0`|Range: $0$ to $4$ procedural clusters|
|Climate Theme|`Enum`|`WARM_WATER`|`WARM_WATER` (Islands/Reefs), `ARCTIC` (Ice Fields)|
|Ship Count|`Integer` / `Preset`|`5`|Range: $4$ to $7$ ships|
|Ship Customizer|Key-Value Pair|Default Preset|Custom count per length class (Length 2–5) with max fleet ceiling|
|Salvo Rule|`Boolean`|`false`|`true` (5 shots per volley), `false` (1 shot per turn)|
|Resolution|Fixed baseline|`MANUAL_DEFENDER_REPORTING`|Incoming coordinates resolve against the local fleet after confirmation; outgoing verbal feedback is recorded manually. Automatic outgoing resolution is a future idea.|
|Animations|`Boolean`|`true`|Toggle visual feedback FX|


### 3. Board Generation & Fairness Metric (Placement Entropy)
To guarantee fairness when boards contain procedural obstacles, boards are evaluated using **Placement Entropy (E)**.
* **Volume Parity:** Total obstacle tile displacement must be equal across both boards: sum(Obstacles_P1) == sum(Obstacles_P2).
$$\sum \text{ObstacleCells}(G_1) = \sum \text{ObstacleCells}(G_2)$$
* **Placement Entropy Delta Threshold:** The total number of unique, legal coordinate placements available
$$E(G) = \sum_{S \in \text{Fleet}} \vert{}V(S, G)\vert{}$$
For the active fleet on each board must match within a 3% tolerance:
  `abs(Entropy_A - Entropy_B) / max(Entropy_A, Entropy_B) <= 0.03`
$$\frac{\vert{}E(G_1) - E(G_2)\vert{}}{\max(E(G_1), E(G_2))} \le 0.03$$

### 3.2 Deterministic Board Pair Generation Algorithm
Example (non-normative):
```python
def generate_fair_board_pair(width, height, obstacle_count, fleet, climate):
    # Step 1: Generate Master Obstacle Layout for Board A
    board_a = create_empty_grid(width, height)
    obstacles_a = seed_cellular_automata_obstacles(board_a, obstacle_count, climate)
    
    # Calculate placement entropy for Board A
    entropy_a = compute_placement_entropy(board_a, fleet, climate)
    
    # Step 2: Generate Board B (Attempt Rotational or Entropy Match)
    attempts = 0
    max_attempts = 500
    
    while attempts < max_attempts:
        board_b = create_empty_grid(width, height)
        # Seed obstacles using different pseudo-random seed with identical volume
        seed_cellular_automata_obstacles(board_b, obstacle_count, climate, seed=attempts)
        
        entropy_b = compute_placement_entropy(board_b, fleet, climate)
        
        # Evaluate Fairness Metric
        delta = abs(entropy_a - entropy_b) / max(entropy_a, entropy_b)
        if delta <= 0.03:
            return board_a, board_b
            
        attempts += 1
        
    # Fallback: Apply 180-degree point rotational reflection for guaranteed 0% delta
    board_b = generate_rotational_reflection(board_a)
    return board_a, board_b
```

### 4. Setup Sharing and Independent Devices

"Host" means the player who creates the initial setup, not an authoritative service or a device that receives later game updates.

* **Self-Contained Code:** Following Query Whom!, the full code carries the public setup itself. A short session label cannot retrieve state without a rendezvous service, so the manual-entry code must be long enough to encode dimensions, climate, hazards, fleet configuration, salvo rule, terrain seed and protocol version. Display grouped Base32 with a checksum for typing-error detection. Protocol v2 packs small fields into bits and uses a 32-bit public terrain seed and 16-bit SHA-256 checksum, requiring 20-21 Base32 symbols excluding dashes (down from 48-53). The seed reconstructs terrain locally; obstacle coordinates and verbose RDF are not transmitted. This seed is public, not a secret, and is independent of private fleet randomness. Protocol v3 retains those compact rule fields and adds length-prefixed UTF-8 player names when they differ from the defaults; named codes are longer. Both names reconstruct identically through manual codes, QR and invitations. Game titles remain local. Continue decoding protocol v1/v2 invitations and saves, retaining their default-name behavior. A short room identifier cannot retrieve state without a server; arbitrary text compression adds overhead to this compact binary data.
* **QR and Invitation:** A QR encodes the setup invitation; a fragment such as `#invite=<code>` carries the same code in a link. Camera scanning is optional; manual entry and pasted links always remain available. Strip the invitation fragment after joining.
* **Public Data Only:** The code contains rules and deterministic terrain information. It contains no fleet positions, observations, private placement random state, save contents, invitation secrets, or keys. Private auto-placement randomness must be independent of the shared terrain seed.
* **After Joining:** Both devices operate independently and may go offline. No attacks, reports, saves, damage changes, turn changes, or final results are sent to the other device. Players call coordinates and report outcomes verbally (or through their own external communication channel).
* **Private Local Journals:** Each canonical RDF dataset stores that device’s own fleet, public terrain and manually recorded observations. It does not contain the opponent’s undisclosed placements. The app records the locally understood turn sequence; it cannot verify that the other device has recorded the same conversation.

#### 4.1 Join flow

1. Creator configures the match and displays its code, QR, or invitation.
2. Joiner scans, pastes, or types that setup into their own device.
3. Each player privately places and locks their own fleet. They confirm readiness verbally.
4. Creator fires first. Each side confirms incoming coordinates for local resolution and manually records verbally reported outgoing results on its own boards.
5. Sharing the original setup again recreates the initial public setup, never the creator’s current progress.

### 5. User Interface & Action Workflow


|Theme|Primary Palette|Secondary / Accent|Obstacle Graphic / Behavior|
|---|---|---|---|
|**Tropical, warm water**|Deep Cyan (`#004d61`), Aqua (`#00c9a7`)|Sand Yellow (`#fbe8a6`), Coral (`#ff6f59`)|**Islands / Coral Reefs:** Renders organic sand/palm textures. Applies shallow water proximity borders to adjacent cells.|
|**Arctic, cold water**|Navy Slate (`#1a2238`), Ice Blue (`#89cff0`)|Frost White (`#f0f8ff`), Crystal Teal (`#4682b4`)|**Ice shelves / Icebergs:** Renders angular, cracked ice textures. Blocks all vessel lengths equally.|

6. User Interface & Action Workflow

The UI is to display both boards. They should be clearly labeled. The active player's board (i.e., during that player's turn) is to be emphasized, the inactive player's board (the player whose turn it isn't) is to be de-emphasized (slightly less bright?)

6.1 Cell Selection & Manual Reporting Workflow

Keep turn instructions to a compact status line. Render grids approximately 25-30% smaller by default, with adjustable scale and no internal grid scrollbars. Wrap the board panels vertically when needed and fit each complete chart to the available width. During deployment, select a ship silhouette showing its cell length, click one endpoint, then a highlighted legal endpoint; support either direction without requiring a separate rotation control. Preview the complete footprint on hover or keyboard focus before commitment.

During an outgoing turn, selecting an unresolved targeting-grid coordinate highlights a crosshair and its label. The player calls the coordinate aloud and manually chooses the result reported by the defender: Miss, Hit, or Hit and sunk. Every result starts unselected. Show the result controls in a floating menu near the selected screen cell, clamped to the viewport, rather than reserving permanent space above the boards. Keep all selected salvo coordinates in that menu. Hit and sunk does not require a vessel-class selector.

During an incoming turn, the player selects the coordinate(s) called by their opponent on the lower primary grid and confirms the coordinates. The app calculates and announces the result to relay verbally: Miss, Hit, or Hit and sunk. The final newly damaged cell of a vessel is Hit and sunk, including within an atomic salvo. The defender never chooses an outcome. The opposing fleet remains unknown.

Cancel clears uncommitted selections. In salvo play, 1-5 distinct coordinates may be selected with a Selected X/5 counter. Confirm commits a complete batch: explicit outcomes for outgoing shots, calculated outcomes for confirmed incoming coordinates, including damage and any locally supported final result. No opponent update is generated.

```text
Select coordinate(s) -> Call / hear coordinate(s) verbally
                              |
                Defender reports outcomes verbally
                              |
             Defender confirms coordinates; attacker marks verbal results
                              |
              Confirm complete local report batch
```

6.2 Screen Animations & Audio Feedback Engine
Hit Animation Sequence
When a Hit status resolves and animations are enabled:
Flash Cycle: The viewport background flashes sequentially through three rapid color states: `Normal → Deep Red (#8B0000) → Black (#000000) → Deep Red (#8B0000) → Normal` over $1350\text{ms}$.
Haptic & Audio: Triggers device vibration (`navigator.vibrate([100, 50, 100])`) and low-frequency explosion audio synthesized via Web Audio API.

Miss Animation Sequence
When a Miss status resolves and animations are enabled:

Splash feedback lasts 1800 ms (three times the previous 600 ms). Reduced-motion preferences continue to suppress animations.

Audio: High-frequency water splash audio synthesized via Web Audio API.

6.3 Game Termination Sequence
The engine checks its own intact segments and its recorded outgoing Hit/Sunk observations after each accepted local batch. Victory and defeat depend on locally recorded reports, not on inspecting an undisclosed opponent fleet.

Termination Trigger: When remaining_enemy_segments == 0:

Winner Overlay: Full-screen victory banner with gold particle effects, displaying VICTORY! ALL ENEMY SHIPS SUNK.

Loser Overlay: Full-screen defeat banner with smoke particle effects, displaying DEFEAT! YOUR FLEET WAS DESTROYED.

Display the local primary and targeting grids with the locally recorded result. Opposing placements are unavailable to this device; players may show each other their own boards in person. Automatic remote full-board reveal is not part of the baseline.

---

## Part 3: Optional Future Ideas

### Automatic Resolution from Fleet Positions

A future optional mode could calculate outgoing Hit, Miss, and Hit and sunk from opposing fleet positions and terrain when an attack is fired. Incoming shots already resolve from the local fleet in the baseline. It would require access to the relevant opposing placements or a separate resolution protocol; the current setup-only code does not provide those placements. This would bypass manual entry of the opponent’s verbal result on the attacker’s device. It is not part of the current baseline, is not currently selectable, and SHALL NOT replace manual outgoing reporting as the default. Any future implementation must preserve private information, atomic salvo resolution, and consistent damage and victory semantics.

### Pass-and-Play

One-device pass-and-play is a future option, not a current setup choice or required baseline. A future implementation would need separate viewer projections, confirmed handoffs, private DOM removal and a clear disclosure that both fleets reside on the same device. Current conceal/reveal controls protect the one local player’s chart; they are not pass-and-play.


## Feedback-driven interaction requirements

- **Board order:** The targeting grid is above the player's own primary grid. During deployment, hide the targeting grid entirely; reveal it when the fleet is locked. Keep complete grids visible without internal scrollbars.
- **Results:** Use mutually exclusive radio choices with icons and text: Miss, Hit, Hit and sunk. Nothing is preselected for outgoing shots. Cancel is a separate action. Vessel identity disclosure remains optional. Legacy Blocked/GlancingMiss RDF may be read from older saves but no new game offers those states.
- **History:** Show two labelled sections, Your shots (local player name) and Their shots (opponent name), with coordinates and results. Avoid unexplained IN/OUT prefixes.
- **Privacy:** Concealment removes the private board DOM and directly opens the private command-deck modal. One Reveal action restores the deck; no intermediate Return button. Delay the prompt while another modal is open, and show it when that modal closes. Retain explicit conceal, blur/visibility conceal, and the idle timeout.
- **Setup sharing:** Show Continue to fleet placement and Go back to setup. Do not depend on an X close button to advance. Going back discards the configuration and its temporary save without declaring a winner.
- **Menu and termination:** Label it Menu. Offer End game with a short confirmation, defaulting to Remove the save, with Keep in finished-game history as an explicit alternative; ending early does not declare a winner or update the other device. Setup & saved games pauses the current journal and opens the game list.
- **Multiple journals:** Persist snapshots per session identifier, rather than one shared local-player slot. List all games with a local editable name, player names, updated date/time, turn and shot counts, and active/completed/ended status. Resume active games or review finished journals. Preserve and migrate the previous single saved journal. The game name is an RDF label; list metadata is a disposable summary of the saved RDF and technical timestamps.

### Sharing and chart presentation refinement

Keep the sharing modal compact: a single-line setup code with an adjacent Copy code button, a read-only invite-link preview with its own adjacent Copy link button, and a compact scannable QR. Center Continue horizontally, with Go back underneath for initial setup. Join mode uses the code field for either a code or pasted invitation, without redundant sharing controls. Copy fallback selects the corresponding field without replacing the other value.

Use static, non-realistic light/dark water bands and recognizable island/ice silhouettes. Terrain remains fixed and public; decorative variations carry no gameplay information. Preserve the contrast of ship, damage, selection and shallow-water indicators. Hit and miss feedback uses a fixed viewport overlay with a broad edge wash reaching approximately 30% into the screen, including on long/scrolled boards; retain the 1350/1800 ms durations, pointer pass-through, and reduced-motion suppression.

Visible obstacle cells cannot be selected or targeted, for either climate. Shallow-water cells remain valid targets because eligible ships may occupy them. Keyboard arrows skip noninteractive cells; recorded outgoing guesses remain keyboard-editable. Existing saved terrain-shot observations remain readable.

### Save retention and removal

Follow Query Whom!: ending or finishing presents Remove the save (selected by default) and Keep in finished-game history (opt-in). The last shot is autosaved for recovery and immediately opens this choice; choosing removal deletes the snapshot and summary. Ended records are not kept automatically. Existing saved-game entries have a Remove action with cancellation/confirmation. Removal deletes private RDF/history, summary, any matching legacy slot and active pointer atomically, leaving unrelated games untouched. An identifier-only deletion marker prevents stale tab saves from resurrecting a removed record; deliberate backup import may restore it. Cancelling removal preserves the game. Abandoning initial setup removes its temporary save.


### Correcting guesses and recording incremental salvos

Click any recorded cell on the targeting grid, or its entry under Your shots, to correct Miss, Hit, or Hit and sunk. The current choice is preselected. Save correction updates the existing result, its shot classification and any reported sunk-ship witness atomically; it consumes no shot or turn. The transaction history retains the earlier assertion and correction. Recalculate hit limits, sunk counts and victory from the corrected dataset. A mistaken final sinking can be corrected before removing the save, reopening combat. Impossible combinations are rejected without mutation; correct a mistaken sinking before reducing the hits that support it, or submit related updates atomically through the headless API. Incoming outcomes remain calculated from the local fleet rather than manually overridden.

In salvo play, recording or confirming fewer than five shots keeps the current player's volley open. Both attacker and defender may record shots one at a time or in batches. Show the recorded count out of five and Finish volley on the active board; Finish volley ends a shorter volley, while the fifth shot automatically hands over. Pending, unconfirmed selections must be recorded or cancelled before finishing. An open volley is one AttackOrder/Salvo in RDF, even across several local confirmations, and survives reload. Duplicate coordinates and a total exceeding five shots remain invalid. Each device finishes its own local volley; coordinate readiness verbally. The headless recordReport/receiveAttack APIs expose continueVolley for incremental recording; omitting it retains the earlier complete-batch behavior.

When re-sharing a legacy saved game, issue a v3 invitation with its existing player names and identical rules and seed. A seed-length flag preserves legacy 128-bit terrain seeds as well as compact 32-bit seeds; never regenerate terrain or private fleets for this upgrade. New v3 saves verify that RDF player names match the invitation. Legacy saves may retain custom RDF names omitted from their old invitations.
