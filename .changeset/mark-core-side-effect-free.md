---
"@better-tables/core": patch
---

Added `"sideEffects": false` to `package.json`. The package has no top-level side-effecting imports (verified via grep), so bundlers can now safely tree-shake unused exports for consumers of `@better-tables/core`. No runtime behavior change.
