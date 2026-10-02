# Legacy bathroom design contract v1

This contract is retained as migration input for locally saved Milestone 1 bathroom designs. New projects use the [v2 renovation project contract](../v2/README.md).

This folder is the language-neutral interchange contract for the initial bathroom pilot. Python/FastAPI owns authoritative geometry validation; the TypeScript editor may mirror checks for instant feedback. The deterministic cases here must be run against both implementations to prevent drift. Python workers may consume analytics/event contracts but must not treat this snapshot as permission to mutate a project.

The JSON Schemas in this folder define the v1 snapshot and command envelopes. Keep Pydantic models aligned with them, and use the existing OpenAPI/type-generation setup for TypeScript API transport types rather than maintaining endpoint DTOs by hand.

## Snapshot shape

```json
{
  "schemaVersion": 1,
  "designId": "design-001",
  "revision": 1,
  "units": "mm",
  "room": {
    "shape": "rectangle",
    "widthMm": 2400,
    "depthMm": 3000,
    "wallHeightMm": 2400,
    "openings": []
  },
  "placements": []
}
```

The origin and wall offset conventions are defined in [Milestone 0](../../../docs/MILESTONE_0_DOMAIN_CONTRACT.md). Product dimensions are captured in each placement as a versioned footprint so a later catalogue update does not silently change an old project. Optional clearance zones store user-entered width, depth, and cardinal direction; clearance warnings are advisory and do not claim building-code compliance.

## Command shape

Commands are explicit discriminated values, not renderer events. V1 command names are `create-design`, `set-room`, `upsert-opening`, `remove-opening`, `place-product`, `move-product`, `rotate-product`, and `remove-product`. Each mutation carries `commandId`, `designId`, and `expectedRevision`. The application returns either a new snapshot/revision or structured domain errors with stable machine-readable codes; UI copy is mapped separately.

## Geometry test vectors

Vectors are normative. `valid` is the expected domain decision; `errorCode` is expected for invalid cases. Tests should assert stable error codes and relevant entity IDs, not exact user-facing prose.

| ID | Case | Expected |
|---|---|---|
| G-001 | 2400 × 3000 mm rectangular room; vanity footprint 1000 × 500 at (100, 100), rotation 0 | valid |
| G-002 | Same room; 1200 × 500 footprint at (100, 100), rotation 90 | valid; rotated footprint extents are 500 × 1200 |
| G-003 | 2400 × 3000 mm room; vanity footprint 1000 × 500 at (1500, 100), rotation 0 | invalid: `PLACEMENT_OUT_OF_BOUNDS` (X extent 2500) |
| G-004 | Two 1000 × 500 footprints at (100, 100) and (900, 100) | invalid: `PLACEMENTS_OVERLAP` |
| G-005 | South-wall door offset 100, width 900 in a 2400 mm-wide room; window offset 1200, width 800 | valid; openings do not overlap |
| G-006 | South-wall door offset 1800, width 900 in a 2400 mm-wide room | invalid: `OPENING_OUT_OF_BOUNDS` (end 2700) |
| G-007 | South-wall openings at offsets 100/width 900 and 800/width 600 | invalid: `OPENINGS_OVERLAP` |
| G-008 | Any canonical dimension encoded as a decimal or non-integer | invalid: `DIMENSION_MUST_BE_INTEGER_MM` |
| G-009 | Snapshot uses unsupported `schemaVersion` | reject at contract boundary: `UNSUPPORTED_SCHEMA_VERSION` |
| G-010 | Window sill height plus opening height exceeds wall height | invalid: `OPENING_OUT_OF_BOUNDS` |

These cases are maintained with the contract and become the first pure-domain test suite. In Milestone 1, run them against both Python and TypeScript implementations. Add cases when a rule is introduced; do not silently reinterpret a vector. A changed expected result requires a reviewed domain/contract change and schema/version decision. FastAPI validation is authoritative if the implementations disagree; treat disagreement as a release-blocking defect.

## Versioning rules

- Additive optional fields may be introduced compatibly when readers ignore unknown fields.
- Changing units, coordinate/anchor meanings, required fields, or invariant semantics requires a new schema version and an explicit migration.
- Keep API transport DTOs, database records, and renderer models as separate representations mapped at their boundaries.
