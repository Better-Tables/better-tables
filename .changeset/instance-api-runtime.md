---
"@better-tables/core": minor
---

The `betterTables()` + `defineTable()` runtime lands: a real, Better-Auth-style
app-level instance and path-typed column builders, replacing the legacy
per-table `betterTables()` shell outright (0.6 breaking release policy — no
deprecation cycle, no overload).

**New shape:**

```typescript
import { betterTables, defineTable } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({
  database: drizzleAdapter(db), // carries $types (schema catalog) when the adapter is schema-aware
  defaults: { pageSize: 20 },
  plugins: [], // seam stored, hooks execution is a follow-up
});

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name'),
    t.text('profile.location'), // dot-path autocomplete through relations, typo is a compile error
    t.option('role').options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
    ]),
    t.number('age').range(18, 100),
    t.computed('fullName', (u) => `${u.firstName} ${u.lastName}`),
  ],
}));
// also supported: tables.define('users', (t) => ({...})) -- method form

type Row = typeof usersTable.$infer.Row;
type Ids = typeof usersTable.$infer.ColumnId;
```

`t.text/number/date/boolean/option/multiOption(path)` are thin typed wrappers
around the existing fluent builders (`.range()`, `.options()`,
`.cellRenderer()`, etc. keep chaining) — a path builder and its hand-written
fluent equivalent produce the byte-identical `ColumnDefinition`. `.id()`,
`.accessor()`, and a default `.displayName()` (via a new runtime `humanize()`
helper — `'created_at'` → `'Created At'`, not `Capitalize`) are all derived
from the path. `t.custom()` and raw `ColumnDefinition` literals remain
supported alongside path builders in the same `columns` array.

**What's removed:** the legacy `betterTables({database, columns, filters,
pagination, ...})` per-table shell and `ExtractAdapterRecord` are gone. The
old config shape (anything with a `columns` key) is now a compile error.
Migrate by moving `columns` into a `defineTable()` call and wiring the
adapter through the new instance, per the example above.

**Deferred (tracked as follow-ups, not in this release):** `t.count()`/
`t.sum()`/other aggregate builders (need adapter execution work — the
underlying `ArrayRelationPaths`/`NumericPathsUnder` types are already
promoted to `types/paths.ts` for when that lands), `t.json().path()`,
zero-config runtime enum options, the RSC data-bridge helper
(`tables.handler()`), and plugin hook execution. `usersTable.$infer.FilterState`
stays a reserved `unknown` placeholder pending the typed filter registry
(plan 006 follow-up).

Also promotes `Paths`/`PathValue`/`PathsOfType`/`ArrayRelationPaths`/
`NumericPathsUnder`/`AdapterTypes`/`SchemaAwareAdapter`/`SchemaOf` out of
`types/experimental/` into `types/paths.ts` as public, documented types.
