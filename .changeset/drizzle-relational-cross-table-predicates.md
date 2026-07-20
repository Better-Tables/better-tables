---
'@better-tables/adapters-drizzle': patch
---

Route computed-field `filterSql` off the Postgres relational query path

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

Scope: this makes the manual-join path the one that runs, which is a
prerequisite for a `filterSql` predicate to be emitted against the correct
table. It does **not** make an arbitrary related-table reference work — opaque
SQL contributes nothing to JOIN planning, so a bare `sql\`${profiles.github} is
not null\`` still fails when nothing else pulls `profiles` into the query (it
failed before this change too, just with a different error). `filterSql` must be
self-contained: reference the primary table, or use a correlated subquery. The
`filterSql` JSDoc now documents this with a working `EXISTS` example.

Also moves the guard below the `db.query` capability check, so a database built
without relations keeps its previous silent fallback instead of surfacing a
`RelationshipError` from an unvalidated context.
