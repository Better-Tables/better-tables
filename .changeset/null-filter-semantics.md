---
"@better-tables/core": minor
"@better-tables/adapters-drizzle": minor
---

Strict filter validation (`FilterManager.validateFilter(filter, true)`) now
accepts `includeNull: true` with empty `values` as a valid filter meaning
"match null rows only" - previously the value-count checks rejected it
outright, even though the wire format and the include-unknown UI checkbox
already let users express exactly that intent.

- `includeNull: true` satisfies the value requirement for operators that
  need at least one value (`valueCount >= 1` or `'variable'`); with no
  values, the filter matches only `NULL` rows.
- `includeNull: true` is now rejected on operators whose own condition
  already expresses null/empty (`isEmpty`, `isNull` - identified via
  `FilterOperatorDefinition.supportsNull`, which previously had no reader)
  as redundant/contradictory.
- `@better-tables/adapters-drizzle`'s `FilterHandler` had a separate leaf
  pre-validation gate that silently dropped a null-only filter before it
  ever reached the router (returning all rows instead of just the `NULL`
  ones); it now recognizes the same null-only intent, so `includeNull` with
  empty values correctly degrades to a bare `IS NULL` condition end-to-end.
