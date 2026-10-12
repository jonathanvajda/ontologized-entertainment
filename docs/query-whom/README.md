# Query Whom

A two-player character deduction game. Each player uses a separate device.
Create a board of 20–40 people, share its QR or code, privately reveal your
person, and ask yes-or-no questions out loud or through your own chat.
Your friend guesses your person; you guess theirs. Tap a portrait to inspect
it and use the separate × control to eliminate a candidate. Eliminations stay
local. “Eliminated people” restores cards even when they are hidden. Your own
person is marked YOU and cannot be restored to the opponent candidate list.

The first load needs HTTPS (or localhost) and a modern browser with Web Crypto
and IndexedDB. Wait for “Ready to play offline” before disconnecting. Camera
access is optional; manual code entry always works. The home screen keeps old
tables available. The private dock is concealed on resume until you open it.
The application does not track turns, record questions, or declare a winner.

## Development

From this directory:

```text
npm ci
python -m pip install Pillow==12.3.0
npm run build
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Serve the repository root, for example `python -m http.server 8000`, then open
`http://localhost:8000/docs/query-whom/`. Opening index.html as a file does not
support module loading, camera access, or service workers. The browser QA
script starts and stops its own HTTP server and exercises repository subpaths.
No npm package is loaded by the shipped game at runtime.

## Semantic model

`ontology/query-whom.ttl` extends CCO and the shared Game Ontology.
`assets/catalog-v1.ttl` imports that vocabulary and the pinned CCO merged
ontology. Its 40 character instances are generated from the supplied CSV.
`ontology/oliver-example.md` is a complete Mermaid instance graph generated
from Oliver’s actual triples, including explicit type edges.

CCO develop is pinned at commit
`be13b74cccf85617739c5288f9fdac805437386c`, version 2.2, merged version IRI
`https://www.commoncoreontologies.org/2026-08-13/CommonCoreOntologiesMerged`.
SHA-256: `a9453382b25b40781c181d6ba44981f228abb76d90d548846713adba9baadb42`.
The merged file includes BFO. The manifest resolves shared module imports to
this merged content so released module files cannot introduce a second CCO
version. No import is fetched from an ontology website during gameplay.

The approved model reuses Person, Scalp Hair, Facial Hair, Eye, Hair Color,
Eye Color, Ethnicity, Male Sex and Female Sex. Head and specific color,
ethnicity and facial-hair categories extend those classes. Other descriptions
use typed application literals on the approved bearer. For bald characters,
scalp-hair-only source descriptions are retained on the head; no scalp-hair
or scalp-hair-color individual is invented. Source “None” and “Not applicable”
are retained. Both eyes have their own eye-color quality.

Source Race mappings: Caucasian → White; African → Black or African American;
Hispanic → Hispanic or Latino; East Asian and South Asian remain subclasses
of Asian. These are user-approved application conventions, not OWL equivalence
assertions to statistical classifications. Original labels remain provenance.
Characters describe the represented game world; portrait files are depictions.
The sort label Sex preserves the CSV’s meaning.

One N3 quadstore holds default-graph schema, catalog and local session triples.
One stable role individual per person/session changes active/eliminated type.
The current triples are authoritative. Historical acts remain in RDF; JSON
transaction deltas are persisted separately. No named graphs, RDF-star,
universal temporal qualification or runtime OWL reasoning is required.

## Protocol v1

Public payload: protocol byte, two-byte big-endian deck version, board-size
byte, 16 seed bytes, and the first three SHA-256 checksum bytes of the first
20 bytes. Base32 alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, 37 characters,
zero pad bits, grouping every four for display. The checksum detects mistakes;
it is not authentication. Distinct seeds can produce the same board.

Random words are SHA-256(seed || uint32 big-endian counter), beginning at
counter zero, consumed as eight big-endian uint32 words per digest. Bounded
choice rejects words at or above floor(2^32 / bound) * bound. Fisher–Yates
shuffles IDs 1–40 and takes the first k. Fixed vectors are in the protocol tests.
This adapter retains all seed bits without changing other games’ generators.

Creator targets come from the first floor(k/2) positions; joiner targets come
from the remainder. Web Crypto chooses a private target independently. The
public partition reveals the opponent’s eligible half to a technical user,
but not their draw. This v1 follows the specified cooperative-play model.

## Persistence, privacy and updates

IndexedDB stores schema/catalog artifacts, versioned local saves, transaction
history and UI preferences. A snapshot and active-table pointer commit in one
transaction. Revision checks reject stale writes from another tab. Invalid
imports never replace existing saves. Imports replay trusted actions and
compare their deltas against the saved state. Unsupported versions are rejected.

Rejoining the same board in the same role resumes an existing save rather than
redrawing a secret. New games keep previous tables. Save exports deliberately
include the local secret; share codes and QR contain only the public payload.
Do not send a private export to an opponent. Production logs contain no session
state. Camera frames and QR images are not retained; tracks stop on cancellation,
success, page hiding or navigation. No external runtime API or CDN is used.

The generated service worker caches the module/import closure and optimized
portraits with integrity hashes. Each worker is bound to its own cache version.
Updates wait; apply them from My games after returning home. Existing saves
are validated against catalog hashes, never silently rewritten. Old caches
are retained to protect open tabs; clearing site data removes caches and saves.
Catalog/ontology breaking changes require new deck/save compatibility versions.

## Assets and attribution

The 40 supplied `portraits/person-NN.png` originals are preserved. Transparent
320- and 960-pixel WebP derivatives are used in-browser. The original CSV,
images, generated RDF and derivatives are hashed in the catalog manifest.
Portrait usage follows the supplied project assets; no new third-party images
are included.

CCO: BSD 3-Clause, `ontology/CCO-LICENSE.txt`. QR generator: qrcode-generator
1.4.4, MIT, `vendor/QRCODE-LICENSE.txt`. Scanner: jsQR 1.4.0, Apache-2.0,
`vendor/JSQR-LICENSE.txt`. Existing N3 and Normalize/Skeleton assets are reused.
The lockfile audits the fixed QR dependencies and development tooling.

## Adopted decisions and limitations

- Default-graph quadstore and shared action pipeline; no core bypass for gameplay.
- RDF catalog is authoritative; catalog JSON is generated and never independently edited.
- HTML/CSS Grid renderer consumes projections; no SVG or D3 dependency needed here.
- SHA-256 random adapter is asynchronous and local to Query Whom.
- Explicit restoration is available; transaction-level undo is not exposed for private reveals.
- Runtime checks are JavaScript invariants; ontology entailment is not a gameplay engine.
- Old incompatible saves are retained with an error; v1 has no speculative migration.
- Browser CI covers Chromium; physical iOS/Android camera and permission flows still need device testing.
