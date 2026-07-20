---
"@better-tables/adapters-drizzle": patch
---

Computed-field filters inside a `FilterGroupNode` tree are now rejected with
an explicit `QueryError` instead of being treated as real schema columns
(plan 051). Substitution still only walks a flat `FilterState[]`, so pass
computed-field filters as a flat filter array (implicit AND) or flatten the
tree at the call site — tree-walking substitution remains a known gap.
