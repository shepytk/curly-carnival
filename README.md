# Room Design Studio

A web based room and bathroom planner for homeowners and renovation professionals. Users can define a room, arrange fixtures and furniture to scale, compare finishes, and review the design in 2D and 3D. Professional workflows such as product catalogues, customer projects, quotations, and sharing can be added on top of the same design model.

## Project status

This repository currently contains the product, architecture, and development-agent plans. The implementation has not started. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries, interfaces, rendering guidance, and delivery phases. See [IN_APP_DESIGN_ASSISTANT_WORKFLOW.md](docs/IN_APP_DESIGN_ASSISTANT_WORKFLOW.md) for the customer-facing design assistant workflow, and [DEVELOPMENT_AI_WORKFLOW.md](docs/DEVELOPMENT_AI_WORKFLOW.md) for coding-agent instructions, skills, and cost-saving scripts.

## Product goals

- Make accurate room planning approachable for homeowners.
- Give renovation companies a reusable customer-design workflow.
- Keep room geometry and design data independent of the UI and rendering engine.
- Make design actions deterministic, testable, undoable, and suitable for AI-assisted suggestions.
- Support 2D planning and a 3D preview from one canonical design model.

## Initial technology choices

| Area | Choice |
|---|---|
| Web application | React, TypeScript, Vite |
| 2D plan editor | Konva.js (wrapped behind an application-owned interface) |
| 3D preview | Three.js through React Three Fiber |
| API | Python, FastAPI, Pydantic |
| Persistence | PostgreSQL, SQLAlchemy and Alembic |
| Asset storage | S3-compatible object storage |
| Testing | Vitest/React Testing Library, pytest, Playwright |

The rendering libraries are adapters, not the source of truth. The design model uses integer millimetres and plain serializable data. The front end can change rendering libraries without changing the domain model or use cases.

## Planned first release

1. Create a rectangular bathroom and set dimensions.
2. Add doors, windows, and basic wall openings.
3. Place a small initial catalogue of bathroom products.
4. Edit dimensions and positions with visible validation.
5. Switch between 2D plan and 3D preview.
6. Save and reopen projects.
7. Undo and redo design changes.
8. Export or share a read-only design snapshot.

Company accounts, quotations, a broad manufacturer catalogue, realistic lighting, and AI-assisted design are later capabilities. They should extend the same use-case and port boundaries rather than bypassing them.

## Repository layout (target)

```text
apps/
  web/                 React application and UI composition
  api/                 FastAPI composition root and HTTP endpoints
packages/
  domain/              Design entities, value objects, invariants
  application/         Use cases, commands, ports, validation results
  editor-contracts/    Shared API/editor schemas and generated types
  renderer-2d/         Konva adapter
  renderer-3d/         Three.js / React Three Fiber adapter
  design-serialization/ Versioned project import/export
docs/
  ARCHITECTURE.md
  IN_APP_DESIGN_ASSISTANT_WORKFLOW.md
  DEVELOPMENT_AI_WORKFLOW.md
  adr/                 Architecture decision records
AGENTS.md              Repository-wide coding-agent instructions
.codex/skills/         Task-specific, reusable agent skills
scripts/ai/            Deterministic context and validation helpers
```

The exact workspace tooling (for example pnpm workspaces) is to be selected when implementation starts. Avoid adding packages before an actual feature needs them.

## Architecture rules

- Domain code contains no React, Konva, Three.js, FastAPI, SQLAlchemy, or cloud SDK imports.
- UI components render state and dispatch use cases; they do not implement design rules.
- Renderers consume immutable design snapshots and emit user intents. They do not own or persist design state.
- Application use cases coordinate domain behavior through interfaces (ports).
- Infrastructure adapters implement ports for persistence, asset storage, clocks, IDs, and external services.
- API DTOs and database records are translated at adapter boundaries; they are not domain entities.
- Persist project format versions and provide explicit migrations for older saved designs.
- All geometry changes go through validated commands and produce undoable results.

## Local development

The codebase is not scaffolded yet. Once the first implementation phase starts, the web app and API will document their install, run, lint, typecheck, and test commands here. The architecture plan deliberately does not claim runnable commands before those packages exist.

## Contribution workflow

- Keep each change focused on a feature or architecture decision.
- Add or update an ADR when changing a core boundary or technology choice.
- Add domain tests for geometry and invariant changes; add adapter tests for integration behavior.
- Run formatting, linting, static checks, and relevant tests before merging.
- Treat AI-produced patches and design suggestions as untrusted input and validate them through the same use cases as human actions.

## License

License to be selected before public distribution.
