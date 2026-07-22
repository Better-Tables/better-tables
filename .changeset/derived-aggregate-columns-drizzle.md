---
"@better-tables/adapters-drizzle": minor
---

Lower `FetchDataParams.derived` aggregate specs to correlated subqueries via the
computed-fields pipeline (SELECT / WHERE / ORDER BY). `filterSql`-backed fields
and derived aggregates walk `FilterGroupNode` trees in place (OR semantics preserved);
legacy callback-`filter` computed fields still throw with updated guidance.
