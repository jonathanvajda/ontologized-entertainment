# Character Deduction Game — Capability and Technical Specification

**Status:** Draft v0.1 — implementation planning, not an implementation  
**Platform:** static GitHub Pages website / installable mobile-friendly PWA (PWA enhancements optional)  
**Players:** two, using separate mobile devices and communicating verbally or by their own messaging apps  
**Principles:** offline after load; no accounts, backend, advertising, analytics, React, or runtime CDN; minimal vendored dependencies; RDF-backed local gameplay

## 1. Purpose and scope

Build an original two-player character deduction game. One player creates a game using 20–44 distinct portraits from a fixed 44-person character library. Both see the same board and independently receive different secret target cards. Players ask yes/no questions using communications outside the application and manually eliminate candidates on their own screens. An optional QR scan or manually entered code joins the same board. Portraits have fixed identifiers, names, metadata, and assets from the existing spreadsheet.

### 1.1 In scope

- Single main `index.html` with views/panels for create, join, share, reveal, board, zoom, and basic settings.
- Responsive portrait-card grid and persistent own-target dock.
- User-adjustable board size (integer 20–44; default 24) via thumb-friendly range slider, with tick labels and numeric output.
- Local game code and QR sharing; validation and version compatibility.
- Reproducible selection and ordering of board cards.
- Two disjoint eligible target partitions, followed by private independent random selection on the respective devices.
- Manual eliminated/restored card status, optional hidden eliminated cards, sorting and enlargement.
- Local RDF quadstore graph for board membership and candidate/elimination roles.
- Static image and character-catalog assets; import/generation at development time from the supplied spreadsheet.
- Graceful camera failure with manual code entry.
- Automated unit, property, integration, accessibility, and mobile tests.

### 1.2 Out of scope for v1

- Accounts, server matchmaking, real-time multiplayer synchronization, chat, turns, scoring, or voice recognition.
- Automatic recognition of spoken questions or elimination decisions.
- Full semantic formalization of the spreadsheet's traits, SHACL enforcement at runtime, OWL reasoning.
- Tamper-proof/cryptographically secure secret dealing, cheating detection, or cryptographic commitments.
- Automatically updating published character catalogs without versioning.

## 2. UX: screens, controls, and navigation

### 2.1 Home

- Prominent **Create Game** and **Join Game** actions; readable for children aged six or older.
- Create displays a range slider (20–44, step 1, default 24), current number in large digits, and **Create** button.
- Join displays **Scan QR**, manually editable code input, and **Join**. Auto-uppercase; strip spaces and hyphens; reject invalid alphabet and failed checksum. Do not auto-open external URLs from arbitrary scanned QR payloads.
- URL navigation remains on `index.html`; use internal view state rather than a routing framework.

### 2.2 Share game

- Player 1 sees generated QR, formatted uppercase code, **Copy code**, **Show full screen QR**, **Continue**.
- QR contains a versioned, validated game payload, not executable content. Text code encodes the same game definition as QR where feasible; QR may carry an app URL with an encoded payload, but local decoding must not fetch network resources.
- Player 2 scans or enters the exact code, reconstructs and validates the board and version, sees the count and **Continue**.
- Role is assigned by workflow (creator = Player 1, joiner = Player 2), never inferred from the shared code.
- Add clear error states: invalid code, incompatible deck version, unsupported character pool, camera unavailable, QR unreadable.

### 2.3 Secret target reveal

- First show a private **Reveal your person** panel with a deliberately initiated button.
- On click show full portrait and name; continue/dismiss shrinks it into a fixed/sticky bottom-center dock that remains inspectable by its owner.
- On the shared board, the owner's card is automatically inactive and bears a muted **YOU** overlay; it cannot be toggled back to an opponent candidate.
- Avoid flashing the private portrait while navigating; allow intentional re-open in the dock.

### 2.4 Board and inspection interaction

**Recommended gesture model:** tap/click the portrait (or name) to open a large modal image; tap the top-right **X** control to eliminate. For an eliminated card, the top-right control becomes a **Restore**/undo icon. Do not combine zoom and elimination into a single tap. Support Esc / close button and backdrop tap for exiting the modal. This reduces accidental moves and is accessible with keyboard and screen readers.

- Candidate active: normal image, legible name below.
- Eliminated: grayscale or faded image, faint X overlay; name remains legible when hidden-eliminated mode is off.
- Own target: faded image, **YOU** overlay, no elimination/restore control; also visible in private bottom dock.
- Long-press optional but not required, avoiding dependence on unsupported mobile gestures.
- At least 44 × 44 CSS px interactive targets, visible focus indicators, high-contrast overlays and text alternatives.
- Undo recent elimination optional; first implementation can restore with a tap.

### 2.5 Sorting and responsive layout

- Sorting: **Default shuffle**, **Name**, **Hair color**, **Eye color**, **Ethnicity**, **Gender** (labels correspond to exactly the existing spreadsheet columns; normalize aliases in build step). Ascending/descending optional for v1.
- The chosen sort rearranges a view; it does not mutate canonical game membership, assignments, or candidate roles.
- Toggle **Hide eliminated**. When enabled, eliminate/restore updates grid membership; the surviving cards fluidly reflow and enlarge within a sensible min/max portrait width.
- Use CSS Grid, e.g. `repeat(auto-fit, minmax(min(100%, var(--card-min-width)), 1fr))`, with viewport/container-responsive card size and `object-fit: cover` or `contain` according to artwork. Cap maximal portrait width to avoid grotesquely huge single cards. Preserve aspect ratio and dock clearance.
- Filters and sorting are local UI preferences, not secret protocol inputs.

## 3. Game creation and target assignment

### 3.1 Canonical catalog

- Canonical `personId` values 1–44, unique and immutable; file paths and names are *not* identifiers.
- Canonical roster order by numeric ID, fixed to a versioned catalog (`deckId`, `deckVersion`, content manifest hash).
- Validation: exact expected IDs, portrait path exists, no duplicate IDs, nonempty label, normalized optional sort keys, correct image sizes.
- Each device must use identical catalog and algorithm version or explicitly reject/require the matching offline-compatible pack.

### 3.2 Random sampling, ordering, and code-space warning

For board size `k`, sample `k` unique people without replacement and produce a randomized permutation. Avoid `Math.random()` for creating seeds, use `crypto.getRandomValues()`. Do not rely on implementation-specific `Array.sort(() => Math.random() - .5)`.

**Important distinction:** a fixed-length random seed makes board construction reproducible, but does **not** mathematically guarantee that two different seeds produce different ordered boards. An injective code requires explicitly ranking/unranking the *ordered selection* (k-permutations), not merely seeding a shuffle.

For 44 fixed people, the ordered boards of size `k` number `P(44,k) = 44!/(44-k)!`. The aggregate number of ordered boards for k = 20..44 is `sum(P(44,k))`, which is > 2^182 and requires **37 Base32 data characters** to index injectively across all sizes, before version/checksum. Fixed-width individual sizes could also be encoded with a size field and k-specific permutation rank. Thus an **8-character code is not enough** to guarantee unique board *and* order across the requested size range. Do not make this promise in the UI.

**Decision proposal:**

- **v1 default pragmatic mode:** random 128-bit `gameSeed`, represented with **26 Base32 characters**, plus compact format/deck version and at least one checksum character. Reconstruct with a specified, deterministic integer PRNG and an unbiased Fisher–Yates shuffle, then take k cards (or select/reorder as defined in a locked algorithm spec). Extremely low random collisions, but not mathematical injectivity of board outcomes.
- **Strict injective alternative:** uniformly sample the ordered-board rank for the chosen k, encode size + rank in Base32; use a reversible k-permutation unranking algorithm. Include deck version and checksum. For a single uniform namespace spanning k=20..44, reserve **37 data characters**, plus validation/version fields. This is the correct path if “guarantee no duplicate board+shuffle representations” is a hard mathematical requirement.
- QR is strongly preferred for the strict encoding, since 33+ characters are awkward for children. Manual typing should remain available, with grouping every 4 characters.
- Never label the code a cryptographic **hash**: it is a reversible game identifier/seed.

**Alphabet:** `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 characters); uppercase. Format groups of four, e.g. `ABCD-EFGH-...`; hyphens do not count as characters. Store canonical unhyphenated form. Add code checksum such as a CRC/digest truncation as typo detection, not authentication. State precisely in tests whether code version, size and checksum consume alphabet characters.

### 3.3 Default offline, collision-free distinct target assignment

- Shuffle the common visible board deterministically using the shared game definition (or use the already encoded ordered selection).
- Partition the private eligibility positions into `A = floor(k/2)` and `B = ceil(k/2)` disjoint groups. Player 1 gets group A; Player 2 gets group B.
- On each device, **independently** select exactly one position uniformly from its own group using `crypto.getRandomValues` with rejection sampling. This random draw is **not encoded in or recoverable from the shared code**.
- Both assignments cannot be the same person because their eligibility groups are disjoint.
- The public algorithm permits a technical user to reconstruct which half is eligible to the opponent, but it does not reveal the opponent's actual private draw. The UI must not display or label the partition.
- Persist the own secret card ID only on the device that drew it; do not put private card ID in a URL, QR, clipboard, diagnostics, or analytics.
- Do not regenerate the own card on refresh if an in-progress game is resumed; restore the locally persisted draw.

**No three-character response code is recommended for secrecy.** Three Base32 characters hold only 15 bits; encryption of a three-character value cannot create stronger secrecy or solve hidden collision-free dealing by itself. A response could be designed for explicit handshake/verification, but would need a separate, specified cryptographic protocol and may expose data. Reserve this for later design.

### 3.4 Optional future cryptographic protocol

A rigorously reviewed two-party private dealing protocol with additional QR exchanges or a local authenticated channel may eliminate even the leaked-half advantage. Mental-poker protocols are a relevant family; secure implementation requires explicit cheating model, randomness/commitment handling, key exchange, verification, failure handling and review. Not in v1. One-QR trusted-dealer alternatives do not protect Player 2's target from a modified host client.

## 4. RDF model

### 4.1 Design rules

- Use your vendored N3.js quad store for local RDF; JSON-LD.js and RDFlib.js remain available as existing SDK adapters, but are not required for the minimal runtime path.
- Keep *immutable catalog facts* separate from *mutable local game session facts* using logical graph separation in the quadstore. Named graphs are an implementation detail of state isolation; an explicit immutable/mutable store split is an acceptable alternative if preferred.
- RDF captures identities, physical features and local eligibility status. Binary pictures stay as files, not embedded RDF literals. UI-only sort and zoom preferences may stay in ordinary JS/local storage; if formalized, use a separate UI state vocabulary.
- Use the authoritative **CCO release matching the imported ontology** to verify `Person`, `has continuant part`, `bearer of`, and related object property IRIs before freezing the Turtle; do not ship unverified identifiers.

### 4.2 Vocabulary (planned)

| Local/standard term | Intended superclass or meaning |
|---|---|
| `cco:Person` | CCO Person; verified `https://www.commoncoreontologies.org/ont00001262` in pinned develop merged ontology (see Query Whom README) |
| `game:Hair` | Material entity / continuant part of person; refine against chosen ontology |
| `game:HairColorQuality` | `bfo:Quality` (`obo:BFO_0000019`) |
| `game:EyeColorQuality` | `bfo:Quality` |
| `game:Ethnicity` | `bfo:Quality` per project modeling decision (pragmatic game taxonomy, not endorsement as objective biological category) |
| `game:CandidateRole` | `bfo:Role` (`obo:BFO_0000023`) |
| `game:EliminatedCandidateRole` | `game:CandidateRole`, if elimination role is intended as a **specialization** of candidacy; separate roles also workable but choose semantics consistently |
| `game:GameSession` | local game-definition/session class |
| `game:genderSortKey` | local UI sort metadata, *not* formal identity inference |

- Define color subclasses from actual spreadsheet values, **not** speculative palette terms: e.g. `BlackHairColorQuality`, `BrownHairColorQuality`, `GrayHairColorQuality`, `BlueEyeColorQuality`, etc., as subclasses of respective color-quality class. Prefer distinct class IRIs for *hair-brown* and *eye-brown* if domain specificity is desirable.
- Person → hair instance through verified continuant-part relation; hair instance → individual color quality via verified `bearer_of` relation. Similar pattern for eye color, with an eye (or eye aggregate) as color-quality bearer.
- For ethnicity, model a local quality instance inhering in/born by person as requested, but clearly label the modeling as an application convention. Avoid guessing ethnicity from portrait; source any value only from the curated spreadsheet. Allow unknown/unspecified. Rely on supplied spreadsheet columns for sorting.
- `rdfs:label` gives the display name; spreadsheet ID gives stable asset association.

### 4.3 Example Turtle (schematic; properties must be resolved)

```turtle
@prefix game: <https://example.org/character-game/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix obo: <http://purl.obolibrary.org/obo/> .
@prefix cco: <https://www.commoncoreontologies.org/> .

# Validate this CCO term against the selected release before production.
game:Person017 a cco:ont00001262 ;
    rdfs:label "Ella" ;
    game:hasHair game:Hair017 .

game:Hair017 a game:Hair ;
    game:hasColorQuality game:HairColor017 .
game:HairColor017 a game:BrownHairColorQuality .
game:BrownHairColorQuality rdfs:subClassOf game:HairColorQuality .
game:HairColorQuality rdfs:subClassOf obo:BFO_0000019 .
game:Ethnicity rdfs:subClassOf obo:BFO_0000019 .
game:CandidateRole rdfs:subClassOf obo:BFO_0000023 .
game:EliminatedCandidateRole rdfs:subClassOf game:CandidateRole .

# These two local predicates are placeholders, to be replaced with
# verified CCO/BFO continuant-part and bearer-of object properties.
```

**Clarification on mutable role semantics:** If every card in play must *continue* bearing a `CandidateRole`, assign a candidate-role instance at setup, and on elimination add a distinct eliminated-role instance without deleting the original. If you want eliminated cards to *cease* bearing the active candidate role, remove its bearer relation and add the eliminated-role bearer relation, while preserving immutable `game:boardIncludes` membership. Either pattern is implementable, but **do not declare `EliminatedCandidateRole rdfs:subClassOf CandidateRole` and simultaneously interpret it as logically “not a candidate”**. Recommended v1: membership is immutable; operational `ActiveCandidateRole` and `EliminatedCandidateRole` are siblings of `CandidateRole` and mutually exclusive *per local game session*, enforced by app logic.

### 4.4 Local state transition

Proposed operational role taxonomy:

```turtle
game:CandidateRole rdfs:subClassOf obo:BFO_0000023 .
game:ActiveCandidateRole rdfs:subClassOf game:CandidateRole .
game:EliminatedCandidateRole rdfs:subClassOf game:CandidateRole .
```

- On game creation, insert local board membership for each participant and one `ActiveCandidateRole` instance and its person → role bearer relationship for each card, scoped to the current local game.
- On own-card reveal, replace own active-role bearer link with own `EliminatedCandidateRole` link and set an additional local `game:isOwnCard true` display/state marker (never emit in shared payload). That card is locked, not restorable.
- On manual elimination, atomically delete the person's active-role bearer link and insert a link to their eliminated-role instance; reverse that operation on restore. Retain stable role instance IRIs to avoid orphan nodes and unbounded growth.
- Ensure at most one *operational status* bearer relation per person within the local session. If role identities are preserved, prefer toggling the two role links; choose a single explicit transition strategy and unit-test it.
- Do not mutate the original catalog's Person, name, hair or ethnicity assertions; each local game has a separate state graph or session-specific role IRIs.
- Quadstore update triggers UI reconciliation of affected card(s); querying all 20–44 cards is also cheap and acceptable initially.

**Note:** RDF/OWL's open-world semantics do not enforce exclusive status on their own. The app's state machine must enforce and test these invariants (SHACL optional in future).

### 4.5 State model and persistence

- Session object: `protocolVersion`, `deckVersion`, `gameCode`, `boardSize`, `orderedPersonIds`, `playerRole`, `ownTargetId`, `createdAt`, `sortMode`, `hideEliminated`, and local role-status graph identity.
- Canonical source of candidate status: RDF quadstore. Derived active/hidden arrays are views, not authoritative state.
- Persist snapshots in IndexedDB using existing SDK adapters; `localStorage` only for innocuous preferences if desired.
- On resume, validate manifest/version, restore own private target and local status. Offer **Restart Game** with a confirmation. Game generation on either device should not accidentally overwrite a session.
- No camera frames or QR images retained; stop video tracks after scan success, cancel, or page hide.

## 5. Capabilities and acceptance criteria

| ID | Capability | Acceptance criteria |
|---|---|---|
| C01 | Host create game | 20–44 slider, step 1, default 24; creates valid board with no repeated IDs |
| C02 | Random deterministic board | Same version+code reconstructs same ordered IDs on both devices; invalid code rejected |
| C03 | Sharing | QR and formatted uppercase Base32 code displayed; clipboard copy; checksum validated |
| C04 | Joining | Valid QR or typed code loads same board; unsupported version rejected with meaningful message |
| C05 | Collision-free roles | Creator and joiner privately draw from disjoint partitions; assignments never identical |
| C06 | Secret reveal | Own card hidden until explicit reveal; zoom/dock works; never appears in shared QR/code |
| C07 | Board render | Exactly k portrait cards, correct label underneath, no duplicates or broken image paths |
| C08 | Eliminate/restore | Dedicated control updates local RDF role status and grey/X presentation, reversible |
| C09 | Own card exclusion | Own card marked YOU and inactive, locked from restore; private dock remains available |
| C10 | Inspect/zoom | Tap portrait opens accessible enlarged image without changing active status |
| C11 | Sort | Shuffle/name/hair/eye/ethnicity/gender sort; stable tie-breaker by person ID |
| C12 | Hide eliminated | Inactive cards disappear from grid; remaining grid dynamically reallocates usable width |
| C13 | Offline | After assets are cached, all local gameplay operates with airplane mode enabled |
| C14 | Resume | Refresh restores own target, eliminations, sorting and game code |
| C15 | Accessibility | Keyboard actions, visible focus, 44px targets, descriptive names, readable overlays |
| C16 | Error handling | Missing camera, denied permissions, bad code, version mismatch, bad catalog handled gracefully |
| C17 | Catalog maintenance | Build-time validation from spreadsheet, stable IDs, reproducible manifest, assets referenced |
| C18 | No external services | No runtime API calls, third-party tracking, remote CDN requests, or personal-data upload |

## 6. Technical requirements

| ID | Requirement |
|---|---|
| T01 | Vanilla HTML5, CSS, modern browser ES modules; functional ES6 modules, no React and no SPA/router framework |
| T02 | Normalize.css + Skeleton as vendored baseline, then modular custom CSS for mobile game UI |
| T03 | Deploy with GitHub Pages, relative paths so project subpath deployments work |
| T04 | Bundle/vendored copies of fixed-version libraries and their licenses; no runtime CDN |
| T05 | N3.js quadstore for canonical/session RDF, reuse existing project SDK adapters instead of duplicating RDF logic |
| T06 | HTML template / `document.createElement` view rendering; no dangerous HTML injection of spreadsheet values |
| T07 | `BigInt` for base32 numbers and permutation ranking; never truncate to JS Number for large indices |
| T08 | `crypto.getRandomValues()` with unbiased rejection sampling for random private choice/seed |
| T09 | Document one canonical PRNG/shuffle and version it; identical byte-level outcomes across browsers |
| T10 | Versioned, checksummed code grammar; normalization/case/hyphen stripping; strict bounds checks |
| T11 | QR generator renders local canvas/SVG; scanner accesses user-facing/back-facing camera only with permission |
| T12 | Use camera `getUserMedia` only on HTTPS/localhost; GitHub Pages provides HTTPS; manual input always works |
| T13 | Save mutable session RDF and secret locally (IndexedDB), never to shared payload or logs |
| T14 | Optional service worker for offline asset cache, with update/version invalidation rules |
| T15 | Responsive CSS Grid with preferred target aspect ratio, reserved bottom dock space, safe-area support |
| T16 | Unit/property tests for rank/unrank, codec, shuffle, partition, transitions, and state restoration |
| T17 | Automated repo CI deploy checks, license/security audit of vendored libraries, accessibility smoke tests |
| T18 | Document/verify exact CCO/BFO class/property IRIs and chosen ontology versions before releasing RDF vocabulary |

### 6.1 Vendor library recommendation

| Need | Recommended approach | Why |
|---|---|---|
| Generate QR | [`qrcode-generator`](https://github.com/kazuhikoarase/qrcode-generator), MIT | Small, browser-ready, canvas/SVG output, no framework |
| Scan QR | [`jsQR`](https://github.com/cozmo/jsQR), Apache-2.0, plus native `getUserMedia()` | Standalone decoder, no framework, process local camera frames |
| Alternate scanner | [`html5-qrcode`](https://www.npmjs.com/package/html5-qrcode), Apache-2.0 | More integrated UI/camera handling but more implementation/dependency surface |
| Native browser QR | `BarcodeDetector` as optional optimization | Not universally available; never sole scanner |
| Cryptographic randomness | Native Web Crypto (`crypto.getRandomValues`) | No dependency; adequate for unbiased local random selection |
| RDF | Existing vendored N3.js; other RDF SDK adapters optional | Avoid expanding dependency footprint |
| Local persistence | Existing IndexedDB helper / idb adapter | No network or server |

Browser camera access requires a secure context and user permission. Browser `BarcodeDetector` remains unevenly supported; use `jsQR` as reliable primary/fallback. Stop tracks on exit. See [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector).

## 7. Proposed file/folder structure

```text
character-game/
├── index.html
├── README.md
├── LICENSE
├── .nojekyll
├── manifest.webmanifest                 # optional PWA install
├── sw.js                                # optional offline cache
├── assets/
│   ├── icons/
│   ├── portraits/
│   │   ├── person-001.webp
│   │   ├── person-002.webp
│   │   └── ...
│   └── data/
│       ├── catalog-v1.json              # build artifact from spreadsheet
│       ├── catalog-v1.ttl               # RDF catalog, if desired
│       └── catalog-manifest.json         # hashes, version, validation metadata
├── css/
│   ├── app.css
│   ├── cards.css
│   ├── responsive.css
│   └── accessibility.css
├── js/
│   ├── app.js                            # top-level controller/state machine
│   ├── config.js
│   ├── game/
│   │   ├── catalog.js
│   │   ├── code-base32.js
│   │   ├── game-code.js
│   │   ├── combinations.js              # if needed for ranking
│   │   ├── permutations.js              # strict code alternative
│   │   ├── shuffle.js
│   │   ├── deal.js
│   │   └── validate.js
│   ├── rdf/
│   │   ├── vocabulary.js
│   │   ├── catalog-loader.js
│   │   ├── session-store.js
│   │   └── role-transitions.js
│   ├── qr/
│   │   ├── encode.js
│   │   └── scan.js
│   ├── ui/
│   │   ├── screens.js
│   │   ├── create-game.js
│   │   ├── join-game.js
│   │   ├── board.js
│   │   ├── card.js
│   │   ├── card-modal.js
│   │   ├── own-card-dock.js
│   │   └── sorting.js
│   └── storage/
│       └── persistence.js
├── vendor/
│   ├── normalize/
│   ├── skeleton/
│   ├── qrcode-generator/
│   ├── jsqr/
│   ├── n3/                          # or link to established SDK package
│   └── LICENSES.md
├── ontology/
│   └── character-game-vocabulary.ttl
├── scripts/
│   └── catalog-import.mjs           # optional dev/build-only spreadsheet import
├── tests/
│   ├── game-code.test.js
│   ├── shuffle.test.js
│   ├── deal.test.js
│   ├── rdf-transitions.test.js
│   ├── catalog.test.js
│   └── ui-smoke.test.js
└── .github/
    └── workflows/
        └── deploy.yml
```

For the existing monorepo, import shared namespace, RDF I/O, IndexedDB, and test utilities from your established local packages rather than copying them here. `scripts/catalog-import.mjs` runs only during development/CI and does not affect runtime static hosting. Vendor only the libraries actually used in shipped code.

## 8. Implementation sequence

1. **Catalog contract** — inspect the real spreadsheet; determine precise column names and portrait inventory; create validated immutable IDs and manifest.
2. **Protocol choice** — decide pragmatic short seed versus mathematically injective ordered-board code; freeze encoding, deck version and reproducibility vectors before UI work.
3. **Game core** — deterministic board setup, partition, private role-specific draws, invariants, tests.
4. **RDF vocabulary** — verify official CCO/BFO IRIs, write a small Turtle fixture and role-state transitions against N3.Store.
5. **Wireframes** — main/create/join/share/reveal/board/zoom states; test 20/24/44 cards on mobile.
6. **QR exchange** — vendored generator/scanner and manual fallback; test iOS Safari/Android Chrome.
7. **Board interactions** — elimination, restoration, own-card lock, sorting, hide/reflow and zoom.
8. **Persistence & offline** — local resume, asset caching, version handling and update prompts.
9. **QA/release** — random/property tests, accessibility, responsive behavior, GitHub Pages deployment.

## 9. Open decisions (explicitly not blockers for a v1 prototype)

- Prefer **26-character compact random seed** (practically collision-resistant but not injective) or **37+ character strict rank code** (mathematically injective ordered boards)?
- Should QR carry a link (convenient for native camera apps, but may navigate/reload) or just the validated game payload (simpler for built-in scanner)? Support both when possible.
- Should gender/race/ethnicity spreadsheet fields be displayed as sort keys, only internal metadata, or omitted from UI? Avoid inferring those values from illustrations; preserve the supplied source semantics.
- Exact official CCO property IRIs and relevant ontology versions; verify before generating production RDF.
- Whether eliminations should be local and manual only (recommended), and whether the target reveal should be shown only once or reopenable intentionally (recommend reopenable).
- Number and format of portraits (WebP primary, fallbacks if needed), image licensing and accessibility.

## 10. Acceptance test invariants

For every supported size k and protocol version:

```text
20 <= k <= 44
board.length === k
unique(board.personIds).length === k
all(board.personIds belong to versioned catalog)
reconstruct(code, version) === same ordered board on both devices
player1.eligible ∩ player2.eligible === empty
player1.target !== player2.target
player1.target ∈ board; player2.target ∈ board
ownTargetId not present in shared QR/code/diagnostics
exactly one operational active/eliminated status per board card in local session
eliminate + restore returns the same local candidate status
changing sort/filter never changes target, membership or RDF candidate status
invalid / out-of-range / version-mismatched codes never silently start a different game
```

**Nonfunctional acceptance:** first-game setup understandable by a six-year-old with basic adult assistance for camera permissions; no keyboard needed when QR works; usable in portrait phone mode; no app accounts, tracking, remote services, or server dependencies during gameplay.
