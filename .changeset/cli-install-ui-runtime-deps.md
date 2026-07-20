---
"@better-tables/cli": patch
---

`better-tables init` now also checks for (and offers to install) the UI runtime dependencies the copied source imports directly: `zustand` and `@dnd-kit/*`.

A database adapter is no longer treated as required. Nothing in the copied UI imports one, and `@better-tables/core` ships `memoryAdapter`, so client-only and custom-adapter projects are no longer made to install `@better-tables/adapters-drizzle` (and its driver peer dependencies). `init` now points at both options in its next-steps output.
