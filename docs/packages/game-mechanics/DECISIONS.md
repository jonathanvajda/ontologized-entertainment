# Provisional decisions register

| Decision | Reason | Alternatives considered | Date | Capabilities | Known limitation / migration cost | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RDF is canonical; JS projections are derived | Preserves semantic inspectability without penalizing repeated UI queries | JS-only state; dual authority | 2026-09-24 | CAP-027, 035, 040 | Projection contracts may evolve; rebuild is always supported | adopted |
| Ordinary default graph, no reification | Keeps current-state queries and deltas small | Named graphs; RDF-star; reification | 2026-09-24 | CAP-014, 027-030 | A future provenance model would require save migration | provisional |
| One shared game ontology plus SHACL graph | Game mechanics form one domain; validation shapes have a distinct operational role | Per-mechanic ontologies; one combined file | 2026-09-24 | CAP-001-031 | Concrete games must publish extension ontologies | adopted |
| Injected RDF parser/serializer and RDF/JS store | Works with vendored N3 in browsers and lightweight stores in tests | Hard N3 import; rdflib | 2026-09-24 | CAP-001, 033, 040 | Adapters must enforce the default-graph contract | adopted |
| JSON save package before ZIP | Portable, inspectable, and dependency-free baseline | JSZip container | 2026-09-24 | CAP-032-034 | Binary assets require a later compatible container format | provisional |
| SVG renderer uses DOM directly; D3 remains optional | Core interactions do not require another runtime | Mandatory D3 | 2026-09-24 | CAP-035-039 | Complex boards can add a D3 adapter | adopted |

## Technical debt register

No game-specific debt exists yet. The first game must record any bypass of the transition pipeline, redundant asserted values, unsupported save assumptions, temporary ontology shortcuts, or generic-engine patches here before release.
