---
"@better-tables/core": patch
"@better-tables/cli": patch
---

Enabled `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in the TypeScript configs for `@better-tables/core` and `@better-tables/cli` (matching `@better-tables/adapters-drizzle`), and fixed all resulting type errors without adding any `!` non-null assertions. No behavior changes are intended; this is a type-safety hardening pass that makes array-index and optional-property invariants explicit at the call sites that already relied on them.
