---
'@better-tables/adapters-drizzle': patch
---

Fix Postgres queries failing when a computed field's `filterSql` was applied

Drizzle's relational query API (`db.query.<table>.findMany({ where })`) scopes
predicates to the primary table, so a condition built on a related table's
column is emitted against the wrong table — `profiles.github` becomes
`"users"."github"` and the query fails at runtime. Filters and sorts naming a
related column already fell back to manual joins; computed-field `filterSql`
conditions did not.

Those conditions reach the query builder as raw SQL in `additionalConditions`,
never passing through `buildQueryContext`, so the existing guard could not see
them — and the SQL is opaque, so there is no way to tell whether it references a
joined table. Any `additionalConditions` now declines the relational path. This
only affected PostgreSQL: MySQL and SQLite always use manual joins.

Also moves the guard below the `db.query` capability check, so a database built
without relations keeps its previous silent fallback instead of surfacing a
`RelationshipError` from an unvalidated context.
