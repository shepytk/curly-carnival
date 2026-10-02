# Development AI Workflow

This workflow is for AI coding agents helping build and maintain this repository. It is separate from the [in-app design assistant](IN_APP_DESIGN_ASSISTANT_WORKFLOW.md), which is a customer-facing product feature.

## Working loop

1. **Classify the task.** Identify the requested behavior, affected boundaries, and a concrete definition of done. For a typo or isolated fix, proceed directly. Make a short plan when work crosses modules, changes a public contract, or needs staged implementation.
2. **Gather only relevant context.** Start with `AGENTS.md`, the target files, and the skill for the task. Read `docs/ARCHITECTURE.md` when changing module boundaries, geometry/data contracts, or renderer responsibilities. Read the customer-facing AI workflow only when changing that product feature. Use the context-bundle script for a bounded diff/context packet.
3. **Use deterministic tools first.** Inspect files, search references, format, typecheck, run focused tests, and validate repository docs with scripts. Do not ask an AI to perform work a local command can do exactly.
4. **Implement one coherent slice.** Change the owning layer and its necessary adapters/tests together. Avoid speculative abstractions, unrelated cleanup, generated boilerplate, and broad rewrites. Keep AI output subject to the same type checks, domain validation, and security rules as human-written code.
5. **Verify proportionally.** Run the repository-doc validator for instruction/docs edits. For implementation changes, run focused tests and static checks first, then broader checks when risk or the required CI gate warrants them. Inspect the final diff and repository status.
6. **Review and report.** Summarize what changed, the checks run and their results, and any unresolved issue. Never claim a check passed unless it actually ran successfully.

## Agentic workflow

### Default: one lead agent

The lead agent owns the task from context gathering through implementation and final verification. One agent is cheaper and usually clearer for small edits, tightly coupled work, or a change contained within one layer.

### Delegate only independent work

For a larger change, the lead may delegate one bounded task such as:

- Read-only architecture or impact analysis of a named interface.
- Independent review of a completed diff for correctness, boundary leaks, and missing tests.
- Work on a separate, non-overlapping module after the contract is agreed.

Each delegation must name the exact question or files, expected output, and whether edits are allowed. Do not ask two agents to solve the same problem, send every agent the entire repository, or parallelize work that depends on unsettled design decisions. The lead reconciles feedback, resolves conflicts, runs the final checks, and owns the result. If agent/delegation support is unavailable, follow the same stages serially.

### Review gates

- A second-agent review is optional for low-risk local edits.
- Use an independent review for changes to geometry invariants, persistence/migrations, authorization, file uploads, renderer resource lifecycle, or cross-layer contracts when a second reviewer is available.
- Reviewers report findings with file/line evidence and severity; they do not silently rewrite the implementation unless explicitly assigned an edit task.
- Deterministic tests and validators remain the source of truth for mechanically checkable requirements.

## Skills

Repository skills live under `.codex/skills/<skill-name>/SKILL.md`. Each skill has a short name/description that signals when it applies, then task-specific steps and links to supporting material. Keep skills narrow and load only the relevant one; do not copy the full architecture plan into every skill.

Current skills:

- `room-design-feature`: a vertical slice that changes room-planning behavior across layers.
- `renderer-change`: 2D/3D projection and rendering lifecycle work.

Add a skill only after a workflow has repeated or has enough specific knowledge to improve consistency. Prefer a script for deterministic operations. Keep skill instructions concise, and use links for optional details so unrelated tasks do not pay the context cost.

## Cost controls

- **Avoid unnecessary model calls.** Use shell commands, repository search, linters, tests, and the scripts below for deterministic work.
- **Limit context.** Do not paste or read the whole repository. Use `python3 scripts/ai/context_bundle.py --focus <path>` for a bounded packet; use `--include <path>` for one extra relevant document. Adjust `--max-chars` only when needed.
- **Avoid duplicate work.** One implementation owner; use a reviewer or subagent only for a distinct question or independent review.
- **Avoid repeated explanations.** Keep stable rules in `AGENTS.md` or a task-specific skill; link to the architecture document instead of repeating it in prompts.
- **Run local checks before asking a model to diagnose.** Preserve the command and error output, then provide only the failing output plus affected code/context.
- **Prefer targeted tests.** Start with the tests that cover the edited behavior; expand only when the initial result exposes a concrete risk or CI requires it.
- **Do not send credentials or private customer data.** The context helper excludes common secret files and oversized/binary artifacts. Inspect its output before sharing it with any external model or service.

## Reusable scripts

These scripts use only the Python standard library and do not call a model or network service:

```bash
# Build a compact context packet from changed files and repository instructions.
python3 scripts/ai/context_bundle.py

# Build context around one or more explicit target files.
python3 scripts/ai/context_bundle.py --focus apps/api/app/domain/room.py --include docs/ARCHITECTURE.md

# Validate local Markdown links and repository skill manifests.
python3 scripts/ai/validate_repo.py
```

The context builder reports its character count and approximate token count, skips common credentials, binary/large files and dependency lockfiles, and enforces a configurable output limit. It prints to stdout only; inspect the packet before copying it into a prompt.

## Completion checklist

- The request is implemented at the layer that owns the behavior.
- Relevant tests/checks ran, or the reason they could not run is stated.
- Diff contains no unrelated changes, leaked credentials, or unreviewed generated files.
- Documentation and interfaces match the implemented behavior.
- Final handoff states change, verification, and any remaining limitation.
