---
name: room-design-feature
description: Implement a room-planning feature across domain, application, and UI layers.
---

Use this skill when a requested product behavior changes how users create, edit, save, validate, or share a room design.

1. Read the task's target files and `AGENTS.md`. Read `docs/ARCHITECTURE.md` only for the boundaries relevant to this change.
2. State the user-visible behavior and its owning domain rule. Identify the application use case and ports that need to change.
3. Keep canonical design data serializable and measured in integer millimetres. Keep transient selection/drag/camera state out of persisted design state.
4. Implement the smallest vertical slice through domain validation, application command/use case, adapter/UI, and focused tests as needed.
5. Validate at the application/domain boundary. Do not let UI code or renderer nodes bypass the use case.
6. Run focused checks, inspect the diff, and report concrete results.

Do not scaffold unrelated features or add an interface unless it isolates a boundary, external behavior, or useful test seam.
