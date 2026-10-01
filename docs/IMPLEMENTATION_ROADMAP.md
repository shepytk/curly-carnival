# Implementation Roadmap

## Product direction

Build a browser-based bathroom planner that lets a homeowner create a measured room, arrange a useful set of fixtures, compare finishes, and review the same design in 2D and 3D. Use renovation professionals as early reviewers and pilot partners. Add company workflows after the core planning journey has been tested with real projects.

The build order reduces product and technical risk in sequence: validate the room workflow, prove the design model, prove rendering, then add shared persistence, professional tools, analytics, and AI.

## Initial pilot scope

The first pilot should let a user:

- Create a bathroom from measured dimensions and place doors/windows on walls.
- Add, move, rotate, and remove a small curated set of fixtures with visible dimensions.
- See placement and clearance warnings while editing.
- Switch between an accurate 2D plan and a clear 3D preview.
- Try a few finish options and product variants.
- Save, reopen, and share/export a design for discussion with a renovation professional.

Keep the initial catalogue deliberately small and representative. Use dimensionally correct placeholder models until the editor and product metadata are proven. Defer photorealistic rendering, broad vendor integrations, quoting/pricing engines, billing, company administration, and model training until user feedback justifies them.

## Milestones and exit gates

| Milestone | Build | Exit gate |
|---|---|---|
| 0. Product and domain decisions | Choose the first target user and pilot journey; test sketches/prototypes with homeowners and bathroom installers; decide supported room outlines, openings, fixture anchors, and first product categories. Resolve where authoritative geometry validation lives across the TypeScript client and Python API. | A small representative bathroom can be described by the agreed model; the team can state what a useful first design/export looks like; the TS/Python validation contract is written down and testable. |
| 1. Domain and 2D editor | Scaffold only required packages; define versioned design snapshots and commands; implement geometry invariants, room outline, openings, dimensions, product placement, snapping, selection, keyboard alternatives, warnings, undo/redo, and local save/reopen. | A user can create and edit a measured room in 2D; domain tests prove units, bounds, openings, rotations, and placement rules; refreshing the app preserves the design. |
| 2. 3D preview | Project the same snapshot into Three.js/React Three Fiber; add camera controls, walls/openings, fixture proxies, materials, picking, and resource cleanup. Replace proxies with a few optimized catalogue models. | Changes made in 2D and 3D resolve to the same canonical placements; representative desktop/browser devices meet agreed interaction and load-time budgets; 2D remains usable when 3D assets fail. |
| 3. Persistent projects and pilot readiness | Add FastAPI routes, PostgreSQL persistence, revision-safe saves, authentication, ownership checks, asset storage, project export/read-only sharing, backups, and error reporting. Add the minimum usage-event catalogue and outbox only after its purpose and privacy rules are decided. | Users can safely save/reopen/share across sessions; conflicting edits are detected; unauthorized users cannot read or change another project's data; recovery and upload limits are tested. |
| 4. Homeowner and installer pilot | Run the end-to-end workflow with a small group of homeowners and installers; observe where users stall; improve dimensions, placement, product metadata, and export from evidence. Review aggregate usage outcomes and event quality. | Pilot users can complete the target task without developer help; top usability failures are fixed or explicitly deferred; there is evidence about whether homeowners or companies are the primary buyer. |
| 5. Company workflow | Based on pilot demand, add workspace membership, customer/project organization, product variants and price provenance, quotation/export, and company-specific catalogue management behind application ports. | A real company can manage a customer design from intake through a reviewable proposal; tenant isolation, roles, audit needs, and pricing freshness are verified. |
| 6. In-app design assistant | Let users request a layout/material/product change; retrieve trusted catalogue items; return a typed command proposal; validate it through the normal application rules; show preview, assumptions, warnings, accept/edit/reject, undo, and outcome events. | The assistant never bypasses authorization or geometry checks; stale proposals are handled safely; pilot users find suggestions useful and can correct them; cost and latency are measured against a clear product benefit. |
| 7. Analytics and learning expansion | Expand aggregate dashboards only for decisions that teams need. If there is a justified model-evaluation/training use, build a separate eligibility-filtered dataset with provenance, quality labels, retention, and deletion handling. | Analytics improve a defined decision or feature; any learning dataset has an approved purpose, documented source and schema versions, and tested deletion/retention behavior. |

Milestones are gates, not calendar estimates. Set dates only after the team size, pilot availability, commercial scope, and product-asset work are known.

## Decisions to settle before implementation

### One authority for geometry rules

The proposed client is TypeScript while the API is Python. Decide how authoritative rules remain consistent before implementing nontrivial placement logic. For the selected stack, define a versioned JSON command/snapshot contract and shared test vectors: the browser may show immediate previews, while the server must validate every committed design change. Contract tests should run the same input cases against both validators. If maintaining parity becomes expensive, revisit a shared domain-runtime choice before adding more rules.

### Room and product representation

- Decide whether the first pilot needs only rectangular rooms or a wall-segment outline with common notches/returns.
- Define wall thickness, door swing, window sill/height, fixture origin/pivot, mount surface, and orientation conventions.
- Record dimensions in integer millimetres and maintain stable IDs and schema versions.
- Establish an asset ingestion checklist for units, origin, dimensions, texture size, polygon budget, licence, and product/catalogue version.

### Pilot success measures

Before inviting pilot users, select a few measurable outcomes, for example: time to produce a reviewable plan, completion rate, number of placement corrections, share/export rate, and the assistant's accept/edit/reject/undo outcomes once it exists. Avoid collecting events that do not answer a stated product question.

## Implementation practices

- Deliver a thin vertical slice at each milestone rather than building all infrastructure first.
- Keep 2D geometry and typed design commands authoritative; derive the 3D scene from saved snapshots.
- Use local persistence and a small seeded catalogue to validate editing before introducing service operations.
- Build the API as a modular monolith with router, application, domain, and adapter boundaries. Split services only when measured team or operational needs justify it.
- Start with simple asset models and a fast editor preview. Profile actual browser/device performance before pursuing renderer optimizations or photorealism.
- Add analytics instrumentation before a broader pilot only when the event schema, collection purpose, access, retention, and user/workspace choices are defined.
- Keep AI assist out of the first editor prototype. First make the command/validation surface deterministic so AI suggestions can reuse it later.
- Use [DEVELOPMENT_AI_WORKFLOW.md](DEVELOPMENT_AI_WORKFLOW.md) and the repository's task-specific skills/scripts during implementation.

## First implementation slice

The first coding milestone should be narrow enough to finish end to end:

1. Create a project with one bathroom represented by the agreed room outline.
2. Add a door and window with explicit wall placement and dimensions.
3. Place one dimensioned vanity and one shower proxy in 2D.
4. Reject or explain an invalid placement with a domain-level result.
5. Undo/redo the last committed placement and persist/reopen the snapshot locally.
6. Add tests for the geometry rules and one browser-level journey.

After that slice is stable, generalize product types and connect the 3D renderer. Do not begin with company billing, a large catalogue, or model fine-tuning.
