# ADR 0007: FastAPI/Python API with a TypeScript editor

- Status: Accepted
- Date: 2026-10-02
- Scope: interactive design API, browser editor, analytics and AI workloads

## Context

The product needs a geometry-sensitive browser editor and a reliable API, followed by analytics and AI capabilities. FastAPI was the selected API choice from the original proposal. TypeScript is the browser application's language and provides typed editor state, rendering integration, and immediate interaction feedback.

## Decision

- Keep FastAPI and Pydantic for the API, transport validation, use-case orchestration, and authoritative design validation before commit. Preserve the existing OpenAPI setup as the HTTP contract.
- Use React and TypeScript for the browser UI, renderer adapters, typed client contracts, and responsive local geometry feedback.
- Keep domain/application boundaries independent from FastAPI, React, renderer libraries, persistence, and AI providers.
- Define design snapshots and commands as versioned language-neutral JSON contracts. Keep TypeScript transport types synchronized through the repository's existing OpenAPI/type-generation workflow; do not manually duplicate endpoint DTOs.
- Maintain a shared geometry test-vector suite and run it against the Python authoritative validator and TypeScript client checks. If results differ, treat it as a defect; the API is authoritative for committed changes.
- Use Python for asynchronous/offline event aggregation, analytics, model evaluation, and approved learning-data preparation. These jobs cannot mutate a project directly.
- Any AI-suggested change is a typed proposal. The browser submits an accepted command to FastAPI, which repeats authorization and domain validation before persistence.
- Begin as a modular application and worker process; do not split services without operational or scaling evidence.

## Consequences

### Benefits

- FastAPI/Pydantic uses Python's typing and validation ecosystem and keeps the API close to planned data, analytics, and AI workloads.
- OpenAPI gives the TypeScript frontend a language-neutral API contract and generated transport types.
- TypeScript gives the editor strong compile-time checks, structured state, and direct integration with React, Konva, and Three.js.
- Client-side checks can respond immediately while the API remains the trust and persistence boundary.

### Costs and constraints

- Geometry validation has Python and TypeScript implementations; parity vectors and contract tests are required as rules evolve.
- Browser-side validation is advisory. Never trust it for authorization or persistence.
- Keep generated transport types distinct from domain entities and renderer models.
- AI/analytics processing may be Python, but all project changes pass through FastAPI use cases.

## Revisit when

Revisit if cross-language geometry parity becomes a material source of defects or maintenance cost, or if measured workload needs justify changing the API boundary. Preserve a single authoritative commit path and versioned external contracts in any migration.
