---
"@better-tables/core": minor
---

Remove the pre-0.6 column-factory entry points and close the no-backend gap:

- **Removed**: `createColumnBuilder`, `createTypedColumnBuilder`, `typed`, `column`, `createColumnBuilders`, `quickColumn`, and the `ColumnFactory` type. Define columns through `defineTable()` / `tables.define()` path builders; for hand-built columns, instantiate the builder classes (`TextColumnBuilder`, …) directly and collect them with `defineColumns` (kept, no longer deprecated) for `defineTableRow()` or `<BetterTable columns={…}>`.
- **Added**: `memoryAdapter(rows, options?)` — a full in-memory `TableAdapter` (every filter operator, AND/OR trees, sorting, pagination, facets with self-exclusion, `describeColumns` inference for auto columns, in-place `updateRecord`). Client-only tables, playgrounds, tests, and docs examples run the whole pipeline with zero backend.
