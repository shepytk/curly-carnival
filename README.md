# Room Design Studio

A browser-based home renovation planning platform for homeowners and renovation professionals. It helps users turn measured spaces and renovation ideas into reviewable plans, compare materials and products, and share decisions with contractors. Bathroom planning is the first workflow, built on a reusable project and space-planning foundation.

## Project status

Milestone 1 has started. The repository now includes the v1 geometry contract, Python authoritative geometry rules, TypeScript editor checks and command session, and the 2D bathroom editor source. See [IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) for milestone gates and progress. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries, interfaces, and rendering guidance. See [IN_APP_DESIGN_ASSISTANT_WORKFLOW.md](docs/IN_APP_DESIGN_ASSISTANT_WORKFLOW.md) for the customer-facing design assistant workflow, and [DEVELOPMENT_AI_WORKFLOW.md](docs/DEVELOPMENT_AI_WORKFLOW.md) for coding-agent instructions, skills, and cost-saving scripts.

## Product goals

- Help homeowners plan renovation projects from measured spaces through design decisions and contractor handoff.
- Give renovation professionals a clear, reusable way to review customer plans.
- Keep project, space geometry, design choices, and product data independent of the UI and rendering engine.
- Make design actions deterministic, testable, undoable, and suitable for AI-assisted suggestions.
- Support multiple renovation workflows on one versioned project and space model; begin with bathroom planning.

## Initial technology choices

| Area | Choice |
|---|---|
| Web application | React, TypeScript, Vite |
| 2D plan editor | Konva.js (wrapped behind an application-owned interface) |
| 3D preview | Three.js through React Three Fiber |
| API and authoritative validation | Python, FastAPI, Pydantic |
| Persistence | PostgreSQL, SQLAlchemy and Alembic |
| Analytics and AI jobs | Python for event processing, analytics, evaluation, and data-science integrations |
| Asset storage | S3-compatible object storage |
| Testing | Node test runner for TypeScript domain checks, Python `unittest` for geometry, Playwright for browser journeys |

The rendering libraries are adapters, not the source of truth. The renovation project and space model uses integer millimetres and plain serializable data. Bathroom-specific guidance belongs in its workflow policies; additional renovation workflows can reuse the foundation without making bathroom fixtures part of the platform's core model. The front end can change rendering libraries without changing the domain model or use cases.

## First pilot release: bathroom planning

The platform is intended to support home renovation across rooms and project stages. This first pilot deliberately proves one workflow end to end before adding other room types.

1. Create a rectangular bathroom and enter its dimensions.
2. Add doors and windows by entering their wall, dimensions, offset, sill, and swing.
3. Add named fixture footprints using user-entered dimensions, positions, and rotation.
4. Edit dimensions and positions with visible validation.
5. Switch between 2D plan and 3D preview.
6. Save and reopen projects.
7. Undo and redo design changes.
8. Export or share a read-only design snapshot.

Company accounts, quotations, a broad manufacturer catalogue, realistic lighting, and AI-assisted design are later capabilities. They should extend the same use-case and port boundaries rather than bypassing them.

## Repository layout (target)

```text
apps/
  web/
    src/editor/         TypeScript editor session, preview checks, and renderer adapters
  api/
    app/domain/         Python authoritative design model and geometry rules
    app/application/    FastAPI use cases and ports
    app/adapters/       SQLAlchemy, object storage, and external adapters
  workers/              Python event analytics and AI/data-science jobs
docs/
  ARCHITECTURE.md
  IN_APP_DESIGN_ASSISTANT_WORKFLOW.md
  DEVELOPMENT_AI_WORKFLOW.md
  adr/                 Architecture decision records
contracts/
  design/v1/            Snapshot/command schemas and shared geometry test vectors
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
- The Python API domain is authoritative for committed geometry; TypeScript editor checks provide responsive feedback. Shared versioned test vectors keep both implementations aligned, and the API revalidates every mutation.

## Local development

Install the web dependencies and start Vite:

```bash
pnpm install
pnpm dev
```

Run the dependency-free geometry and session tests with Node 24+ and Python 3.12+:

```bash
pnpm check
```

Run the Playwright browser journey after dependencies and a browser are installed:

```bash
pnpm test:e2e
```

The FastAPI HTTP application and persistent project adapter are planned for Milestone 3; the Python domain validator exists now and remains independent from FastAPI.

## Contribution workflow

- Keep each change focused on a feature or architecture decision.
- Add or update an ADR when changing a core boundary or technology choice.
- Add domain tests for geometry and invariant changes; add adapter tests for integration behavior.
- Run formatting, linting, static checks, and relevant tests before merging.
- Treat AI-produced patches and design suggestions as untrusted input and validate them through the same use cases as human actions.

## License

License to be selected before public distribution.
