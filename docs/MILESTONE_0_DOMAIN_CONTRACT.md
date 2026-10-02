# Milestone 0: product and domain contract

This document records the initial bathroom-pilot assumptions and the narrow v1 workflow contract that implementation will build against. The platform architecture treats renovation projects and spaces as reusable concepts; this contract deliberately limits the first workflow to a reviewable bathroom plan and is not a general CAD format.

## Pilot user and journey

- **Primary first user:** a homeowner measuring and planning a bathroom.
- **Early reviewers / pilot partners:** bathroom installers and renovation professionals, who can assess whether the plan communicates dimensions and fixture placement clearly.
- **Core journey:** enter room measurements → add doors/windows → place a vanity and shower → see fit/clearance feedback → compare a few finishes → review 2D and 3D → save and share/export with an installer.
- **Initial fixture model:** user-named rectangular footprints with dimensions supplied by the user. A seeded catalogue and pricing are out of scope for this contract.
- **Reviewable first output:** a scaled 2D plan with room dimensions, opening dimensions, fixture footprints and positions, plus a 3D preview derived from the same saved snapshot.

This is the product hypothesis for discovery; homeowner/installer interviews and pilot success measures remain open before Milestone 0 can be closed.

## V1 geometry decisions

| Concern | V1 decision |
|---|---|
| Room outline | One axis-aligned rectangle. Wall-segment polygons, alcoves, and sloped ceilings are deferred. |
| Units | Integer millimetres for all canonical dimensions and positions. No floating-point metres in persisted design data. |
| Coordinate frame | Origin at the southwest/inside floor corner; `x` increases east and `y` increases north. Room width is the X extent; depth is the Y extent. |
| Walls | Stable IDs `south`, `east`, `north`, `west`. Opening offset starts at the corresponding wall's inside start corner: south west→east, east south→north, north east→west, west north→south. |
| Openings | Door or window on exactly one wall; `offsetMm` and `widthMm` must fit the wall. The vertical opening extent (`sillHeightMm + heightMm`; door sill is zero) must fit `wallHeightMm`. Windows carry `sillHeightMm`; doors may carry `swing` (`inward-left`, `inward-right`, or `none`). Openings on a wall cannot overlap. |
| Product placement | A footprint is a rectangle with stable placement ID, user-provided display name, product/version reference, integer X/Y position, and quarter-turn rotation (`0`, `90`, `180`, `270`). The position denotes the southwest corner of the rotated footprint. Dimensions, position and rotation are entered by the user; the editor does not choose fixture presets. |
| Placement invariants | A product footprint must fit inside the room. Two solid footprints cannot overlap in V1; edge contact is allowed because it has no shared area. A user may provide a rectangular clearance zone (width, depth and direction) attached to a fixture. Zone conflicts with the room boundary or another fixture are warnings and do not alter placement validity. No code-compliance clearance is inferred. |
| Wall height | One positive `wallHeightMm` applies to all four walls in V1. Ceiling shape and services are deferred. |
| Persistence | Design snapshots are versioned, immutable values at the application boundary, with a revision for optimistic saves. |

Door swing visualization and actual building-code compliance are not inferred by V1 geometry validity. Product placement results do not represent construction approval.

## Command and snapshot boundary

The TypeScript browser uses local checks during drag previews. FastAPI/Pydantic validates request shape; Python domain logic performs authoritative authorization and geometry checks before persistence. Canonical snapshot and command payloads are serializable, stable-ID based, integer-mm data. Renderer objects and library types never cross this boundary. The same geometry vectors must pass in both the Python domain tests and TypeScript client checks.

Python analytics/AI workloads use versioned JSON payloads and Python's data/AI ecosystem, behind separate worker interfaces. They do not bypass API validation or commit design mutations. An AI-generated change is only a proposal; the accepted command is submitted to FastAPI and validated with the same domain rules as a human edit.

The v1 shape is documented in [`../contracts/design/v1/README.md`](../contracts/design/v1/README.md). The deterministic geometry vectors there become executable domain tests in Milestone 1.

## Still needed to close Milestone 0

1. Validate the journey and plan/export usefulness with homeowners and at least one bathroom installer.
2. Confirm measurement conventions and whether the first target bathroom needs a non-rectangular outline.
3. Set measurable pilot outcomes (for example, completion rate, time to reviewable plan, and number of placement corrections).
4. Turn the versioned contract vectors into passing Python domain and TypeScript editor-check tests when those modules are scaffolded in Milestone 1.
