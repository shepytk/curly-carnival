# Implementation Roadmap

This roadmap builds a home renovation planning platform. Bathroom planning is the initial pilot workflow, not the long-term product boundary.

## Product direction

Build a browser-based home renovation planning platform that helps homeowners plan measured spaces, make design and product decisions, and share clear proposals with renovation professionals. Its foundation is a renovation project containing one or more spaces, with space geometry and design choices independent of any one room type.

The first pilot is bathroom planning. It should validate the shared project and space foundation through one complete workflow; bathroom-specific objects, clearance advice, materials, and screens stay within that workflow. Expand to other renovation work only after the pilot proves useful.

The build order reduces product and technical risk in sequence: validate the bathroom journey, prove the reusable project/space design model, prove rendering, then add shared persistence, professional tools, analytics, and AI.

## First pilot scope: bathroom planning

The first pilot should let a user:

- Create a bathroom from measured dimensions and place doors/windows on walls.
- Add, move, rotate, and remove named fixture footprints with user-entered dimensions.
- See placement and clearance warnings while editing.
- Switch between an accurate 2D plan and a clear 3D preview.
- Try a few finish options and product variants.
- Save, reopen, and share/export a design for discussion with a renovation professional.

Keep footprints user-defined until real catalogue data is available. Do not bake sample bathroom dimensions, opening placements, or fixture sizes into the editor. Treat bathroom clearance/access feedback as a workflow policy, not a universal construction-code claim. Defer photorealistic rendering, broad vendor integrations, quoting/pricing engines, billing, company administration, and model training until user feedback justifies them.

## Milestones and exit gates

| Milestone | Build | Exit gate | Work / comments |
|---|---|---|---|
| 0. Product and domain decisions | Choose the first target user and pilot journey; test sketches/prototypes with homeowners and bathroom installers; decide supported room outlines, openings, fixture anchors, and first product categories. Define the versioned snapshot/command contract and shared geometry test vectors. | A representative bathroom can be described by the agreed model; the team can state what a useful first design/export looks like; contract rules and vectors are written down and testable. | **In progress.** FastAPI/Pydantic remains the API and authoritative validation boundary. TypeScript owns the React editor and responsive preview checks; the same v1 vectors will verify parity. ADR 0007 and the v1 contract are recorded. User/installer validation and final pilot acceptance criteria remain. |
| 1. Domain and 2D editor | Scaffold only required packages; implement geometry invariants, room outline, user-entered opening measurements, configurable fixture footprints and clearance zones, snapping, selection, keyboard alternatives, warnings, undo/redo, and local save/reopen. | A user can create and edit a measured room in 2D; domain tests prove units, bounds, openings, rotations, and placement rules; refreshing the app preserves the design and configured clearance warnings are visible. | **In progress.** Added a measured-room setup form; editable wall/type/offset/width/height/sill/swing fields for openings; named, user-sized and positioned fixtures; optional user-defined clearance zones with non-blocking warnings; and an explicit backup step before replacing unreadable local data. Python and TypeScript tests cover clearance reports. Browser build/journey still needs dependency installation and execution; user validation remains. |
| 2. 3D preview | Project the same snapshot into Three.js/React Three Fiber; add camera controls, walls/openings, fixture proxies, materials, picking, and resource cleanup. Replace proxies with a few optimized catalogue models. | Changes made in 2D and 3D resolve to the same canonical placements; representative desktop/browser devices meet agreed interaction and load-time budgets; 2D remains usable when 3D assets fail. | Not started. Depends on the canonical snapshot and 2D domain model. |
| 3. Persistent projects and pilot readiness | Add FastAPI routes, PostgreSQL persistence, revision-safe saves, authentication, ownership checks, asset storage, project export/read-only sharing, backups, and error reporting. Add the minimum usage-event catalogue and outbox only after its purpose and privacy rules are decided. | Users can safely save/reopen/share across sessions; conflicting edits are detected; unauthorized users cannot read or change another project's data; recovery and upload limits are tested. | Not started. The API and analytics workers use Python; browser behavior remains in TypeScript. |
| 4. Homeowner and installer pilot | Run the end-to-end workflow with a small group of homeowners and installers; observe where users stall; improve dimensions, placement, product metadata, and export from evidence. Review aggregate usage outcomes and event quality. | Pilot users can complete the target task without developer help; top usability failures are fixed or explicitly deferred; there is evidence about whether homeowners or companies are the primary buyer. | Not started. Pilot participants and recruitment are not yet established. |
| 5. Company workflow | Based on pilot demand, add workspace membership, customer/project organization, product variants and price provenance, quotation/export, and company-specific catalogue management behind application ports. | A real company can manage a customer design from intake through a reviewable proposal; tenant isolation, roles, audit needs, and pricing freshness are verified. | Not started. Scope depends on pilot evidence. |
| 6. In-app design assistant | Let users request a layout/material/product change; retrieve trusted catalogue items; return a typed command proposal; validate it through the normal application rules; show preview, assumptions, warnings, accept/edit/reject, undo, and outcome events. | The assistant never bypasses authorization or geometry checks; stale proposals are handled safely; pilot users find suggestions useful and can correct them; cost and latency are measured against a clear product benefit. | Not started. Python AI components may generate proposals; accepted design changes still pass through FastAPI authorization and domain validation. |
| 7. Analytics and learning expansion | Expand aggregate dashboards only for decisions that teams need. If there is a justified model-evaluation/training use, build a separate eligibility-filtered dataset with provenance, quality labels, retention, and deletion handling. | Analytics improve a defined decision or feature; any learning dataset has an approved purpose, documented source and schema versions, and tested deletion/retention behavior. | Not started. The architecture sets the outbox/privacy boundary; event collection and analytics implementation are deferred. |

Milestones are gates, not calendar estimates. Set dates only after the team size, pilot availability, commercial scope, and product-asset work are known.

## Decisions to settle before implementation

### One authority for geometry rules

Python is used for FastAPI, authoritative server validation, persistence workflows, and data/AI jobs. TypeScript is used for the React editor, typed UI state, renderer integration, and fast local previews. The cross-language geometry contract and vectors keep preview feedback aligned with API decisions. Python AI/analytics workloads do not bypass API authorization or commit design mutations. See [ADR 0007](adr/0007-fastapi-python-api-typescript-editor.md) and [Milestone 0 domain contract](MILESTONE_0_DOMAIN_CONTRACT.md).

### Project, space, and item representation

- Treat the renovation project as the container for one or more spaces; the first bathroom pilot may contain a single space.
- Keep room boundary, walls, openings, and surfaces generic. Start with the bathroom contract's rectangular outline, while keeping the versioned model migratable to additional outlines when real workflows require them.
- Represent placed things as design items with an optional catalogue/product reference. Keep bathroom-specific fixture categories and guidance in the bathroom workflow.
- Define wall thickness, door swing, window sill/height, item origin/pivot, mount surface, and orientation conventions for the pilot.
- Record dimensions in integer millimetres and maintain stable IDs and schema versions.
- Establish an asset ingestion checklist for units, origin, dimensions, texture size, polygon budget, licence, and product/catalogue version.

### Pilot success measures

Before inviting pilot users, select a few measurable outcomes, for example: time to produce a reviewable plan, completion rate, number of placement corrections, share/export rate, and the assistant's accept/edit/reject/undo outcomes once it exists. Avoid collecting events that do not answer a stated product question.

## Implementation practices

- Deliver a thin vertical slice at each milestone rather than building all infrastructure first.
- Keep 2D geometry and typed design commands authoritative; derive the 3D scene from saved snapshots.
- Use local persistence and user-entered fixture dimensions to validate editing before introducing catalogue or service operations.
- Build the API as a modular monolith with router, application, domain, and adapter boundaries. Split services only when measured team or operational needs justify it.
- Start with simple asset models and a fast editor preview. Profile actual browser/device performance before pursuing renderer optimizations or photorealism.
- Add analytics instrumentation before a broader pilot only when the event schema, collection purpose, access, retention, and user/workspace choices are defined.
- Keep AI assist out of the first editor prototype. First make the command/validation surface deterministic so AI suggestions can reuse it later.
- Use [DEVELOPMENT_AI_WORKFLOW.md](DEVELOPMENT_AI_WORKFLOW.md) and the repository's task-specific skills/scripts during implementation.

## First implementation slice

The first coding milestone should be narrow enough to finish end to end while exercising the reusable renovation project/space boundary:

1. Create a project with one bathroom represented by the agreed room outline.
2. Add a door and window with explicit wall placement and dimensions.
3. Place named, user-dimensioned fixture proxies in 2D.
4. Reject or explain an invalid placement with a domain-level result.
5. Undo/redo the last committed placement and persist/reopen the snapshot locally.
6. Add tests for the geometry rules and one browser-level journey.

After that slice is stable, connect the 3D renderer and use the validated project/space boundary for the next renovation workflow. Do not begin with company billing, a large catalogue, or model fine-tuning.
