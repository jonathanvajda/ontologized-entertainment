# Provisional decisions register

| Decision | Reason | Alternatives considered | Date | Capabilities | Known limitation / migration cost | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RDF is canonical; JS projections are derived | Preserves semantic inspectability without penalizing repeated UI queries | JS-only state; dual authority | 2026-09-24 | CAP-027, 035, 040 | Projection contracts may evolve; rebuild is always supported | adopted |
| Ordinary default graph, no reification | Keeps current-state queries and deltas small | Named graphs; RDF-star; reification | 2026-09-24 | CAP-014, 027-030 | A future provenance model would require save migration | provisional |
| One shared game ontology plus SHACL graph | Game mechanics form one domain; validation shapes have a distinct operational role | Per-mechanic ontologies; one combined file | 2026-09-24 | CAP-001-031 | Concrete games must publish extension ontologies | adopted |
| Injected RDF parser/serializer and RDF/JS store | Works with vendored N3 in browsers and lightweight stores in tests | Hard N3 import; rdflib | 2026-09-24 | CAP-001, 033, 040 | Adapters must enforce the default-graph contract | adopted |
| JSON save package before ZIP | Portable, inspectable, and dependency-free baseline | JSZip container | 2026-09-24 | CAP-032-034 | Binary assets require a later compatible container format | provisional |
| SVG renderer uses DOM directly; D3 remains optional | Core interactions do not require another runtime | Mandatory D3 | 2026-09-24 | CAP-035-039 | Complex boards can add a D3 adapter | adopted |
| Short game codes are labels, not keys | Human-enterable codes do not provide enough entropy and cannot retrieve serverless state | Derive every secret from code/PIN | 2026-09-24 | CAP-043-045 | Invitations are longer and normally require QR/link/file transfer | adopted |
| Host RDF is complete; player RDF is audience-scoped | Preserves RDF authority while preventing foreign secrets on player devices | Replicate encrypted full state to every device | 2026-09-24 | CAP-041, 043 | Host remains trusted and authoritative | adopted |
| Visibility policies are RDF; ciphertext and keys are technical artifacts | Audience rules are semantic while cryptographic packaging is implementation-specific | Named graphs; RDF reification of ciphertext | 2026-09-24 | CAP-041-045 | Sensitive dependent nodes must be policy-covered | adopted |
| Multi-device baseline is setup-static | A static site has no rendezvous channel; hands remain stable in the first deduction-game use case | Pretend game-code sync; mandatory backend | 2026-09-24 | CAP-043-044 | Mutable remote games need WebRTC/manual messages/backend | provisional |

## Technical debt register

No game-specific debt exists yet. The first game must record any bypass of the transition pipeline, redundant asserted values, unsupported save assumptions, temporary ontology shortcuts, or generic-engine patches here before release.
