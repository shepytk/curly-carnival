# In-App Design Assistant Workflow

## Purpose

This document defines the customer-facing AI assistant built into the room planner. It helps homeowners and renovation professionals create or modify a design, understand fit constraints, and discover suitable products. It does not describe AI coding agents or developer tooling.

The assistant proposes changes through the same application boundary as a human action. It must not write directly to database records, mutate the scene graph, or return executable code.

## Request context

Give the AI only the project information needed for the requested change:

- Versioned, bounded design snapshot and current revision.
- Allowed command schema and catalogue search results.
- User intent and relevant constraints (for example, keep the window clear).
- Explicit policy on whether the user is asking for suggestions or asking to apply a change.

Avoid passing unrelated customer data or secrets. Resolve product availability and dimensions from the trusted catalogue, not model-generated facts.

## Output contract

The AI adapter returns a typed proposal, not a domain mutation:

```ts
interface DesignProposal {
  proposalId: string;
  basedOnRevision: number;
  summary: string;
  assumptions: string[];
  commands: DesignCommand[];
  warnings: ValidationIssue[];
}
```

`DesignCommand` is a discriminated union of allowlisted operations such as `PlaceProduct`, `MoveProduct`, `AssignMaterial`, and `UpdateRoomDimensions`. Commands include explicit IDs or references, dimensions, and placement anchors. Reject unknown command types, extra executable fields, malformed units, and references absent from authorized catalogue/project data.

## Execution flow

1. Application reads the current authorized snapshot and revision.
2. AI adapter receives a minimized context and returns a schema-validated proposal.
3. Application checks proposal revision, actor permissions, catalogue references, and domain invariants.
4. Application returns a preview and structured validation messages.
5. User accepts or edits the proposal.
6. Application revalidates and executes the accepted commands in a single undoable transaction, guarded by expected revision.
7. Renderer updates from the resulting snapshot; normal save/history behavior applies.

Stale proposals must be rejected or explicitly rebased and reviewed. Do not silently apply commands against a changed project. Commands should be idempotent where practical and carry a proposal/action ID for retry protection.

## Safety and quality

- Keep provider-specific prompts, model selection, retries, and telemetry in an `AIProposalProvider` adapter.
- Keep authorization, business rules, command validation, persistence, and history in application/domain code.
- Enforce token/time limits and bounded catalogue/snapshot context.
- Report assumptions and warnings; never present estimated dimensions or prices as verified catalogue data.
- Log proposal metadata and accepted command IDs without unnecessarily storing private prompt content.
- Allow deterministic replay of accepted commands for support and regression tests.
- Test malformed output, stale revision, invalid product references, conflicting placements, provider timeout, retries, and user rejection.
