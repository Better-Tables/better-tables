---
"@better-tables/core": minor
---

Added a table-scoped read surface on the `betterTables()` instance: `tables.fetchData(table, params)`, `tables.getFacetedValues(table, columnId, params)`, `tables.getMinMaxValues(table, columnId, params)`, and `tables.getFilterOptions(table, columnId, params)`.

Query THROUGH a `defineTable()` result instead of the raw adapter:

```typescript
// Before: manual primaryTable (easy to omit on a multi-table schema) + a manual cast
const result = (await tables.database.fetchData({
  primaryTable: 'users',
  pagination: { page: 1, limit: 20 },
})) as FetchDataResult<User>;

// After: no primaryTable to pass or get wrong, no cast
const result = await tables.fetchData(usersTable, {
  pagination: { page: 1, limit: 20 },
});
```

`tables.fetchData` injects `primaryTable: table.tableName` automatically — `TableScopedFetchDataParams` (its params type) omits `primaryTable` from the caller-facing surface entirely, so a caller can't supply a contradictory one. The return type is `FetchDataResult<TRow>`, inferred from the table definition passed in — the table's own row type, not the whole-schema union `database.fetchData` returns.

The facet methods (`getFacetedValues`/`getMinMaxValues`/`getFilterOptions`) type `columnId` against the table's `$infer.ColumnId`, catching a wrong-table column id at compile time; they can't inject `primaryTable` themselves since the adapter-contract `FacetQueryParams` has no such field, so their runtime resolution is unchanged from calling `database.getFacetedValues(...)` directly.

`tables.database.fetchData(...)` (the raw adapter) remains fully supported — it's still the only path for queries that don't belong to one `defineTable()` result. Combined with `@better-tables/adapters-drizzle`'s new multi-table read throw (this release), the wrong-table mistake `tables.fetchData` exists to prevent becomes unreachable through the recommended surface, while `database.fetchData` fails loudly instead of silently on an ambiguous schema.

See [Architecture](https://better-tables.com/docs/architecture) for the flagship read surface, and the [Drizzle adapter docs](https://better-tables.com/docs/adapters/drizzle) for `defaultPrimaryTable`.
