---
"@better-tables/adapters-drizzle": patch
---

Computed-field filters inside a `FilterGroupNode` tree are now rejected with
an explicit `QueryError` instead of being treated as real schema columns
(plan 051 — tree-walking substitution remains deferred; see the 0.6 migration notes (file since removed)
"Known gaps").
