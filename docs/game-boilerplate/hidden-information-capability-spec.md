# Hidden Information Capability Specification

**Status:** Adopted baseline  
**Version:** 0.1.0  
**Date:** 2026-09-24

## 1. Purpose

This specification defines reusable hidden-information capabilities for static, browser-only games. It supports two distinct deployment patterns:

1. **Pass-and-play privacy:** one device contains the full canonical RDF state, but the interface reveals only the current audience's projection and places concealment screens between viewers.
2. **Multi-device isolation:** a host device owns the complete canonical RDF state while each player device receives only a public RDF partition and that player's encrypted private RDF partition.

These patterns achieve similar gameplay outcomes but provide different security guarantees. UI concealment is not cryptographic isolation.

## 2. Security model

The architecture SHALL distinguish presentation privacy, storage isolation, transport confidentiality, and commitment integrity.

A four-to-six-character game code and short numeric PIN MUST NOT be treated as sufficient cryptographic entropy. Short codes MAY identify a session or provide a convenience lock, but actual confidentiality requires high-entropy keys.

The architecture does not defend against a malicious host, a compromised browser, screen capture, physical observation during a reveal, or a player voluntarily sharing their own secret.

## 3. Capabilities

### HI-CAP-001 — Audience-aware RDF projection

The engine SHALL derive a viewer-specific store or view model from canonical RDF using explicit visibility policies. A policy MAY constrain visibility by player or agent IRI, public audience, turn, round, phase, or disclosure state. Projection MUST NOT mutate canonical RDF.

### HI-CAP-002 — Phase-dependent visibility

An entity MAY be hidden in one phase and visible in another. Phase transition commits SHALL refresh the audience projection before rendering.

### HI-CAP-003 — Default visibility policy

Games SHALL declare whether unclassified RDF subjects are public or private. Games handling consequential secrets SHOULD use deny-by-default and validate that every sensitive class has a visibility policy.

### HI-CAP-004 — Pass-and-play concealment lifecycle

The engine SHALL support explicit viewer confirmation, concealment on blur, an optional timeout, a neutral device-handoff screen, and removal of private content from the accessibility tree while concealed.

This capability provides presentation privacy only. Full RDF remains inspectable on that device.

### HI-CAP-005 — Host-authoritative multi-device partitioning

The host SHALL retain complete canonical RDF. A player device SHALL receive only its required public RDF partition, its own private RDF partition, visibility-safe configuration, and cryptographic material scoped to that player and permitted disclosures.

Another player's hand or the hidden solution SHALL NOT be present in that player's plaintext storage.

### HI-CAP-006 — Encrypted RDF capsules

The engine SHALL serialize RDF/JS quads into versioned audience capsules and encrypt them with authenticated encryption. Capsule context SHALL bind game identity, schema version, session code, and player identity. Decrypting with the wrong key or altered context SHALL fail.

### HI-CAP-007 — Zero-server transport

Encrypted capsules and invitations SHALL be transferable without an application server through URL fragments, QR codes encoding those fragments, copy/paste tokens, downloaded invitation files, or a local peer-to-peer adapter.

URL fragments are preferred over query strings because browsers do not send fragments to the static host. Large payloads MAY require QR segmentation or file transfer. A short game code alone cannot retrieve host-created state without a rendezvous service and SHALL NOT be presented as if it could.

### HI-CAP-008 — Targeted disclosure

The engine SHALL support a disclosure addressed to one recipient. The disclosure MAY contain one card, clue, vote, objective, or other bounded RDF/JSON payload without including the sender's remaining private state.

An encrypted disclosure SHALL bind sender, recipient, game, and disclosure identifiers as authenticated context.

### HI-CAP-009 — Cryptographic commitments

The engine SHALL support salted SHA-256 commitments over deterministically canonicalized values. A later reveal SHALL be verifiable against the earlier commitment.

RDF commitments require stable canonicalization. Blank nodes MUST be skolemized or processed by a standards-compliant RDF dataset canonicalization algorithm before commitment.

### HI-CAP-010 — Deterministic randomization with secret boundaries

Deterministic shuffle and deal MAY support replay, but a publicly known seed MUST NOT also derive secret player keys or solution salts. Randomization state that reveals concealed outcomes stays host-private until the game permits disclosure.

### HI-CAP-011 — Local key protection

Player keys MAY be wrapped under a PIN-derived key for local convenience. The UI and documentation SHALL state that a short PIN is vulnerable to offline guessing and does not replace a high-entropy invitation secret.

### HI-CAP-012 — Save, restore, and export

Host saves MAY contain the full encrypted or locally protected canonical game. Player saves MAY contain only that player's capsule, notebook, public state, and scoped keys. Exports SHALL identify their audience.

### HI-CAP-013 — Revocation and expiry

Invitation and disclosure payloads SHOULD carry issue time, schema version, and stable identifiers. Static zero-server invitations cannot be remotely revoked after distribution; games requiring revocation or live membership changes need a transport/backend adapter.

### HI-CAP-014 — Testability

Headless tests SHALL cover audience/phase projection, policy coverage, authenticated encryption, wrong-player rejection, transport and size limits, commitments, targeted disclosure, concealment lifecycle, and save/export audience boundaries.

## 4. RDF modeling rules

Visibility policies are semantic information content entities and MAY be canonical RDF. Ciphertext, IVs, raw keys, transport tokens, and DOM concealment state are technical artifacts and SHOULD remain outside domain RDF.

The baseline remains one ordinary default graph. Hidden information does not introduce named graphs, reification, or RDF-star. Policies govern subject resources; every sensitive dependent resource must receive its own policy or be materialized only inside an encrypted capsule.

## 5. Limitations requiring explicit disclosure

- Pass-and-play cannot resist developer-tools or storage inspection.
- A static player page cannot discover host state from a short code alone.
- Multi-device pages do not synchronize mutable state without manual message exchange, WebRTC, or a backend.
- URL fragments avoid server transmission but remain visible to the receiving user and browser history until removed.
- Anyone possessing a complete invitation can assume that player identity.
- Commitments prove consistency with a prior digest; they do not prove fair random generation by a malicious host.
