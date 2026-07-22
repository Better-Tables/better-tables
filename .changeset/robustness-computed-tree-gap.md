---
"@better-tables/adapters-drizzle": patch
---

Legacy callback-`filter` computed fields inside a `FilterGroupNode` throw an
explicit `QueryError` instead of being treated as schema columns (plan 051).
Tree-walking substitution for `filterSql` / plan-060 derived aggregates landed
separately — see the derived-aggregate-columns changeset.
