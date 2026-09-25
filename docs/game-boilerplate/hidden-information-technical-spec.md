# Hidden Information Technical Specification

**Status:** Adopted baseline  
**Version:** 0.1.0  
**Date:** 2026-09-24

## 1. Architecture

```text
PASS-AND-PLAY
Canonical RDF Store -> Visibility Projector -> Conceal/Reveal UI
   (all secrets)        (viewer + phase)        (privacy only)

MULTI-DEVICE
Host Canonical RDF -> RDF Partitioner -> AES-GCM Player Capsule
   (all secrets)       public + private          |
                                                   v
                                      URL fragment / QR / file
                                                   |
                                                   v
Player Page Store <- Decrypt + validate <- Player-scoped key
(public + own private RDF only)
```

The host is authoritative. Player pages are static audience clients unless a game explicitly adds an action-message transport.

## 2. Shared module boundaries

The implementation lives under `docs/packages/game-mechanics/src/hidden-information/`:

| Module | Responsibility |
| --- | --- |
| `rdf-visibility.js` | RDF visibility policies, viewer/phase projections, sensitive-class coverage |
| `crypto-engine.js` | Web Crypto, AES-256-GCM, SHA-256 commitments, secure randomness, PIN convenience wrapping |
| `rdf-capsule.js` | RDF/JS quad rows, encrypted audience capsules, stable quad canonicalization |
| `transport.js` | Base64url tokens, fragment invitations, route descriptors |
| `disclosure.js` | P-256 ECDH identities and recipient-targeted disclosures |
| `privacy-screen.js` | UI-neutral pass-and-play conceal/reveal lifecycle |
| `encoding.js` | UTF-8, base64url, and stable JSON serialization |

All modules are ES modules, DOM-independent, and usable from static pages.

## 3. RDF visibility model

The vocabulary is `docs/src/ontologies/HiddenInformationOntology.ttl`.

```turtle
:Policy-Hand-A a hi:VisibilityPolicy ;
  hi:governs :Card-17 , :Card-04 ;
  hi:visibleTo :Player-A ;
  hi:visibleDuringPhase :PrivateReviewPhase .
```

Projection uses AND between audience and phase constraints and OR between multiple policies governing one entity. Games MUST classify dependent secret resources as well as roots. Hiding a card while leaving its secret label public is invalid.

## 4. Key and code model

### 4.1 Game code

A 4–12 character Crockford-style code is a human session label, not a secret.

### 4.2 Player content key

The host generates an independent random 256-bit AES key per player. It encrypts that player's RDF capsule and is delivered in an invitation fragment or equivalent transfer. Imported keys SHOULD be non-extractable where practical.

### 4.3 Optional PIN wrap

A PIN may wrap an exported secret locally using PBKDF2-HMAC-SHA-256 with a random 128-bit salt and at least 310,000 iterations. A four-digit PIN remains vulnerable to offline guessing.

### 4.4 Disclosure identity

Each player has a P-256 ECDH key pair. A player capsule may contain that player's private disclosure JWK and every other player's public JWK, but no other private key.

## 5. Authenticated encryption format

```json
{
  "algorithm": "A256GCM",
  "iv": "base64url-96-bit-iv",
  "aad": {
    "purpose": "player-rdf-capsule",
    "gameId": "...",
    "gameVersion": "...",
    "schemaVersion": "...",
    "gameCode": "TABLE7",
    "playerIri": "...",
    "version": 1
  },
  "ciphertext": "base64url-ciphertext-and-tag"
}
```

IVs are random 96-bit values and MUST NOT repeat under one key. AAD is stable-serialized and verified during decryption. Context mismatch is a hard failure.

## 6. RDF capsule format

A decrypted capsule contains `issuedAt`, `publicQuads`, and `privateQuads`. Each quad is encoded as RDF/JS term rows. Capsules never contain executable rule code. Game validators check versions, player identity, allowed vocabulary, inventory uniqueness, and visibility boundaries.

## 7. Invitation transport

Preferred URL form:

```text
https://example.test/game/player/#invite=<base64url-token>
```

The fragment contains a versioned encrypted capsule plus player-scoped content key, or the player imports a local invitation file. The token may be too large for one QR; games SHALL measure its size and provide copy/paste or file import. Player pages remove the fragment with `history.replaceState` after import.

## 8. Targeted disclosures

Disclosure authenticated context includes `purpose`, `gameId`, `senderIri`, `recipientIri`, `disclosureId`, and `version`. The encrypted body contains only the disclosed resource or minimal RDF subgraph. Static games transfer it through in-person screen presentation, QR, or copy/paste. Live remote messaging needs another adapter.

## 9. Commitments

Commitments use `SHA-256(random 256-bit salt || stable canonical value)`. Stable JSON sorts object keys. RDF quads sort a deterministic N-Quads-like representation and reject blank nodes. Arbitrary external RDF requires a standards-compliant dataset canonicalization implementation.

## 10. Pass-and-play UI integration

App code SHALL render a neutral handoff, require the named viewer to confirm, build a fresh RDF projection, mount private content only while revealed, conceal on timeout/blur/navigation, and clear private DOM and accessibility nodes. CSS hiding alone is insufficient.

## 11. Persistence

Host IndexedDB stores may contain complete state and key records, preferably protected locally. Player stores contain only the player's capsule, notebook, and public configuration. Database names identify host versus player scope.

## 12. Error handling

Expected structured codes include `VISIBILITY_DENIED`, `MISSING_VISIBILITY_POLICY`, `INVALID_CAPSULE_CONTEXT`, `DECRYPTION_FAILED`, `INVITATION_TOO_LARGE`, `UNSUPPORTED_CAPSULE_VERSION`, `COMMITMENT_MISMATCH`, and `DISCLOSURE_WRONG_RECIPIENT`.

## 13. Security requirements

- Use Web Crypto; do not implement cryptographic primitives manually.
- Use AES-GCM with 256-bit keys and random 96-bit IVs.
- Never use gameplay PRNG output as key material.
- Never derive solutions, salts, and player keys from a public short code.
- Never place secrets in URL query parameters.
- Treat imported capsules and RDF as untrusted.
- Do not log keys, plaintext capsules, PINs, solution salts, or private RDF.
- Apply content-size limits before imports.
- Make security limitations explicit in setup UI.

## 14. Testing

The shared suite covers visibility projection, AES context binding, RDF capsule isolation, commitments, ECDH disclosures, fragment transport, PIN wrapping, and pass-and-play concealment. Games add fixtures for their sensitive classes, audience matrix, phases, inventory, and host/player exports.
