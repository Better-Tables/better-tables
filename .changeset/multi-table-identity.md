---
"@better-tables/adapters-drizzle": minor
---

Fixed four multi-table-schema correctness issues found while dogfooding the flagship API against a realistic multi-table app (plan 029):

- **Schema-extraction keying bug (auto-detect was broken for the common case).** `extractSchemaFromDB` — used by `drizzleAdapter(db)`'s auto-detect path — keyed `result.tables` by the schema object's JS key but `result.relations` by the underlying SQL table name. Whenever a table's SQL name differed from its JS export key (`export const tickets = sqliteTable('support_tickets', ...)`), the two maps disagreed and relationship lookups silently failed ("No relationship found from tickets to customer") even though the relation was correctly defined. Both maps are now keyed identically.

- **Multi-table reads with no disambiguating signal now throw** (mirrors the existing `defaultMutationTable` mutation-routing throw). `fetchData`, `getFilterOptions`, `getFacetedValues`, and `getMinMaxValues`, called on a schema with more than one table with neither `columns` nor `primaryTable` provided, previously fell back to silently assuming the first table in the schema (a single, easy-to-miss `console.warn`) — returning plausible-but-wrong rows. They now throw a `SchemaError` instead:

  ```typescript
  const adapter = drizzleAdapter(db); // schema: { users, profiles, ... }
  await adapter.fetchData({ pagination: { page: 1, limit: 20 } });
  // SchemaError: Multiple tables in schema — set 'primaryTable' (per call),
  // 'defaultPrimaryTable' (in drizzleAdapter options), or pass 'columns'
  // that disambiguate, to select which table to query
  ```

  New adapter option `options.defaultPrimaryTable` (mirrors `defaultMutationTable`) sets an adapter-wide default for this case. Schemas with exactly one table are unaffected — no configuration needed. Pair this with `@better-tables/core`'s new `tables.fetchData(table, params)` (this release) to avoid the issue entirely by construction.

- **Relations referenced only in `filters`/`sorting` are now embedded in the result.** Filtering or sorting by a relation column not present in `columns` (e.g. `filters: [{ columnId: 'customer.plan', ... }]` without `customer` in `columns`) correctly joined the table to evaluate the condition, but never selected or nested it — the filter narrowed the result set, and the matching relation data silently disappeared from the response. It's now embedded in every returned row the same way an explicitly-requested relation column already is, with no over-fetching of relations that are neither filtered, sorted, nor selected.

- **Relations clobbering tables at construction now throws, naming the key.** A relations map keyed by table name, spread OVER a tables map — `{ ...tables, ...relationsKeyedByTableName }` — silently overwrote each colliding key's real table object with a same-named `Relations` object; the table then just vanished from the adapter's schema at runtime, well after the actual mistake and with no clear signal why. `DrizzleAdapter`'s constructor now throws a `SchemaError` naming the colliding key(s) immediately. The normal, fully-supported pattern of including relations under a *different* key alongside their table (e.g. `{ users, usersRelations }`) is unaffected.

See the [Drizzle adapter docs](https://better-tables.com/docs/adapters/drizzle) for both `defaultMutationTable` (the mutation throw this mirrors) and `defaultPrimaryTable` (the new read throw).
