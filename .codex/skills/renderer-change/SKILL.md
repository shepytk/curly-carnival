---
name: renderer-change
description: Change the 2D or 3D projection, interaction, or resource lifecycle of the room editor.
---

Use this skill when editing Konva or Three.js / React Three Fiber adapters, camera/viewport behavior, picking, gizmos, materials, or model loading.

1. Read the renderer adapter and relevant editor contracts. Consult `docs/ARCHITECTURE.md` rendering practices for the specific concern being changed.
2. Treat the versioned design snapshot as the source of truth. The scene graph is derived output; renderers emit semantic intents and never persist mutations.
3. Preserve the coordinate contract: canonical integer millimetres, convert units at the rendering boundary, and keep plan axes/elevation mapping explicit.
4. Use stable design IDs. Reuse geometry/material resources, avoid allocations in render loops, and dispose loaded GPU resources when ownership ends.
5. Keep expensive solving and I/O outside animation frames. Measure performance before adding workers, caching layers, or lower-level code.
6. Test projection/interaction behavior and cleanup at the narrowest useful level; use screenshots only for stable, high-value views.

Report any renderer limitation that forces a change to the domain or application contract before extending that contract.
