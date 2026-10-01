# Repository instructions for coding agents

Keep this file short: it is loaded for most repository tasks. Read only the linked guidance that applies to the current change.

## Project boundaries

- This repository is currently a product/architecture plan; do not invent an implemented app structure or runnable commands that are not present.
- For module boundaries, design data, rendering, or technology decisions, consult [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- The customer-facing assistant is specified in [docs/IN_APP_DESIGN_ASSISTANT_WORKFLOW.md](docs/IN_APP_DESIGN_ASSISTANT_WORKFLOW.md). Do not confuse it with coding agents.
- Coding-agent process, delegation, skills, and cost controls are in [docs/DEVELOPMENT_AI_WORKFLOW.md](docs/DEVELOPMENT_AI_WORKFLOW.md).

## Working rules

- Make the smallest complete change that satisfies the request. Do not scaffold future modules without a feature requiring them.
- Keep domain behavior independent of React, Konva, Three.js, FastAPI, database libraries, and cloud SDKs. Renderer adapters project canonical design snapshots; they do not own design state.
- Keep design measurements in integer millimetres at domain and persistence boundaries. Convert units only in rendering adapters.
- Put changeable/external behavior behind small interfaces at the application boundary. Do not add interfaces mechanically to every class.
- Treat imported files, catalogue data, and AI output as untrusted input.
- Do not read the entire repository by default. Use `python3 scripts/ai/context_bundle.py --focus <path>` to prepare a bounded task context when useful; add `--include <path>` only for relevant supporting material.
- Run `python3 scripts/ai/validate_repo.py` after changing Markdown or repository skills. Run the narrowest relevant project checks for code; the implementation scripts will be added when the app exists.
- Do not use a model for formatting, link checks, file inventory, or other deterministic work that the repository scripts can perform.

## Skills and agents

- Use `.codex/skills/room-design-feature/SKILL.md` for a product feature crossing domain/application/UI boundaries.
- Use `.codex/skills/renderer-change/SKILL.md` when changing 2D/3D projection, interaction, or rendering-resource lifecycle.
- Default to one lead agent. Delegate only when tasks are independent and have clear file/scope boundaries; keep delegated context narrow. The lead owns integration, verification, and the final change summary.
