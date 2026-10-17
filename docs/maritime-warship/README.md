# Maritime Warship

A static naval strategy app for **two players on two devices**. Create a setup, let the other player join by code, QR or invitation link, then call coordinates and report results verbally. **There is no cross-device communication after setup.** Each device stores only its own fleet and local observations.

Serve the repository with `python -m http.server 8000 --directory docs` and open `http://localhost:8000/maritime-warship/`. No build, account, backend, React, or runtime external requests are required. HTTPS or localhost enables the optional camera, Web Crypto setup checksum, IndexedDB and offline service worker.

## Playing

1. Creator selects tropical or Arctic waters, an 8-26 by 8-26 board, zero to four hazard clusters, a 4-7 vessel preset or custom fleet, and standard or salvo firing. Custom draft cost is one point per segment, within an adjustable budget up to 35.
2. Share the displayed setup code, QR or invitation link with the second player. The joiner types, pastes or scans it on their device. It reconstructs public rules and terrain, not saved progress.
3. Each player privately arranges their own fleet. Select a vessel, click its starting cell, then click a highlighted ending cell. The full footprint previews on hover or keyboard focus; either endpoint can come first. Auto-deploy remains available. Lock your own fleet and confirm readiness verbally. Creator fires first.
4. On your firing turn, select targeting-grid coordinates and call them aloud. Manually choose the result your opponent tells you. During incoming turns, confirm the called coordinates on your lower primary grid; the app announces the calculated result for you to say aloud. Outgoing result controls start blank and use icon-labelled radio choices: Miss, Hit, Hit and sunk.
5. Confirm the complete local report to record it. Standard turns record one coordinate; salvo turns record 1-5 distinct coordinates as one atomic batch. Cancel clears uncommitted selections. In salvo mode, Add another target tucks the floating menu away without discarding staged outcomes; Report N selected reopens it. Local turn order alternates, but the app cannot verify that the other device recorded the same conversation.

Heavy tropical vessels (four or five cells) need orthogonal coastal clearance. No vessel may overlap a hazard or another vessel. Shots at terrain are misses in either climate. Incoming results are calculated from your known fleet and damage after you confirm the coordinates; the last cell announces Hit and sunk. Outgoing Hit/Miss/Sunk reports are not checked against a hidden opposing fleet: that fleet is absent from your dataset.

**Vessel identity disclosure is optional.** Hit and Sunk need no vessel name, class or footprint. A Sunk record individuates a participating warship in a non-mission-capable stasis without asserting a more specific class or linking it to earlier unidentified hits. Sunk counts and recorded hits support local completion. Players can divulge vessel identities verbally as they wish.

The lower primary grid shows your private fleet; the upper targeting grid shows only public terrain and manually recorded observations. During setup, only your fleet grid is shown. Neither victory nor resuming reveals opponent placements. Players can show each other their screens in person after finishing.

## Setup code

Like Query Whom!, the code is self-contained rather than a server lookup. It has 20-21 Base32 symbols (grouped for readability) and encodes:

- Protocol version, dimensions, hazard count, climate and salvo flag.
- Fleet classes and multiplicities, plus draft budget.
- A four-byte public terrain seed and two SHA-256 checksum bytes. Small rule fields and ship types are bit-packed. Legacy 48-53-character protocol v1 codes still decode unchanged.

The checksum detects typing mistakes; it is not authentication. The code contains **no fleet positions, private placement RNG, damage, observations, saves, player keys or current progress**. Private auto-placement uses a separate local random source. Re-sharing the code does not update or synchronize either device. Creator and joiner use opposite, rotationally fair terrain areas. Player display names are local labels and are not part of the shared code.

Invitation URLs use `#invite=<code>` and remove that fragment after joining. QR generation and camera scanning reuse the repository’s Query Whom! libraries. Manual entry remains available when camera access is denied or unavailable.

## Local state, saves and privacy

Canonical state is ordinary default-graph RDF. Operational JavaScript state is rebuilt from it; SVG geometry and staged selections stay outside domain RDF. BFO member part of is used directly. Cells and areas are CCO Geospatial Region individuals; weapon use and damage use their CCO classes directly. Only local ship segments receive known footprint and damage assertions. Reported opponent hits remain partial descriptions without invented segment identities.

A trusted action pipeline validates legality, computes RDF additions/removals, validates a candidate, and commits atomically. Historical acts, reports, damage and capability stases remain; obsolete current-state links are removed. Transaction deltas and RNG state stay in technical save metadata.

Every accepted action commits to the canonical RDF store and automatically persists its RDF snapshot and transaction log to IndexedDB. Each session has its own save key. Your games lists named journals, dates, turns, shots and status, with Resume or Review. The menu can rename a game, return to setup and saved games, or End game without declaring a winner. The previous single-slot journal is migrated automatically. No Save button is needed. Exports identify the local-player audience and contain private local state; do not share them as invitations. Save/schema version 2 / 0.2.0 rejects the earlier host-authoritative prototype format instead of treating a full two-fleet dataset as a private local journal. Old prototype IndexedDB records are left untouched in their old database.

Conceal/reveal protects your screen on demand, blur, visibility loss and after five minutes. Concealment directly opens the private-deck modal: one Reveal action restores the board, without an intermediate Return button. It does not isolate state from someone inspecting your browser. This is one player’s chart privacy, **not pass-and-play**. Charts default to approximately 25-30% smaller, with fully visible boards that stack when space is limited and scale to fit narrow screens and keyboard-focusable chart regions. Result controls appear in a floating menu beside the selected cell, including a complete batch for salvo play; interactive cells support arrow keys and Enter/Space. Chart scale is adjustable, reduced-motion preferences override effects, and audio is opt-in.

## Reuse and decisions

- Reuses the shared RDF/JS store, game engine, rule registry, validator, transaction log, PRNG, IndexedDB adapter, privacy lifecycle and RDF serialization helpers.
- Reuses Query Whom!’s Base32 codec and QR scanner. The scanner accepts an optional decoder, preserving Query Whom!’s existing default behavior.
- `network.js` contains setup-code creation/decoding only. There are no game messages, encrypted dispatches, synchronized host authority or remote calls.
- A 180-degree terrain rotation preserves obstacle volume and legal-placement entropy. Each cluster has three connected cells and full-fleet feasibility is checked.
- Configuration values use typed ICE nodes and `rdf:value`. `mw:hasLocalPlayer` identifies the local journal’s player. See [ontology](../src/ontologies/MaritimeWarshipOntology.ttl) and [patterns](../src/ontologies/MaritimeWarshipDesignPatterns.md).
- Boilerplate host-authoritative encrypted capsules and pass-and-play capabilities remain available to other games; they do not apply to this setup-only baseline. No generic engine patch is needed.

## Deferred ideas

As specified in [MARITIME_WARSHIP.md](../../specs/MARITIME_WARSHIP.md), automatic outgoing resolution from opposing fleet positions and one-device pass-and-play are optional future ideas. Neither is selectable or part of the current baseline. Automatic opposing-board reveal would also need additional information not provided by the setup code.

## Verification

From the repository root:

```text
node --test docs/maritime-warship/tests/*.test.js
node docs/maritime-warship/scripts/browser-qa.mjs
```

Browser QA uses the existing Playwright and axe installation under `docs/query-whom/node_modules`, starts/stops its own server, and checks separate independent device contexts, explicit manual reporting, code/QR joining, privacy, persistence, offline reload and desktop/mobile accessibility. Generated screenshots are in ignored `test-results/`.
