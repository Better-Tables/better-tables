---
'@better-tables/adapters-drizzle': patch
---

Make computed-field `filterSql`/`sortSql` work across related tables

Two layers were broken for a computed-field SQL fragment referencing a related
table (e.g. `` sql`${profiles.github} is not null` `` on a `users` table):

1. **Postgres relational path.** Drizzle's `db.query.<table>.findMany({ where })`
   scopes predicates to the primary table, so the condition was emitted against
   the wrong table (`"users"."github"`). Opaque conditions now always decline
   the relational path. Postgres-only; MySQL/SQLite always use manual joins.
2. **Join planning.** On the manual-join path the fragment's text is opaque, so
   no JOIN was planned for the tables it touches and the query failed with the
   referenced table missing from FROM. The adapter now walks the fragment's
   query chunks — the interpolated `Column`/`Table` entities survive — and
   plans the same JOIN a regular cross-table filter gets, in the data, count,
   and fan-out pagination queries alike.

Rules: a table interpolated as a whole `Table` chunk (a correlated subquery
like `` sql`exists (select 1 from ${profiles} where …)` ``) supplies its own
FROM scope and is never force-joined; an already-joined relation is reused, not
double-joined; a column reference to a table with no direct relationship throws
a descriptive error instead of emitting broken SQL.

Also fixed on the sorting side: sorting by a `sortSql`-backed computed field
that was not simultaneously requested as a column threw a `RelationshipError`
from join-count metadata, and sorting by a computed field with no `sortSql`
threw instead of degrading — it is now dropped with a `[better-tables]` warning
(there is nothing to ORDER BY in SQL), matching the dropped-filter convention.

All of it is covered end to end through `fetchData` by an ungated SQLite suite
(`computed-field-cross-table-sql.test.ts`) and a Postgres integration mirror of
the originally reported failure, each verified to fail without its fix.
