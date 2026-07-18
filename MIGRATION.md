# Migrating from 0.5 to 0.6

Better Tables 0.6 is a coordinated breaking release. There is no deprecation
window and no compatibility shims — every replaced API is removed outright.
This guide takes a working 0.5 app to 0.6 in one sitting. Every example below
is compile-checked in CI (`packages/core/tests/types/migration-guide-examples.test.ts`
and `packages/adapters/drizzle/tests/migration-guide-examples.test.ts`), so
if it's wrong the build tells us before it tells you.

The one exception to "no compatibility": old `c:`-prefixed filter URLs still
read correctly. See [What did NOT change](#what-did-not-change).

## TL;DR

| Surface | What changed | Section |
|---|---|---|
| Table setup | Per-table `betterTables({database, columns, ...})` shell is gone. Now: one app-level `betterTables()` instance + `defineTable()` per table. | [§1](#1-table-setup-betterTables--defineTable) |
| Column builders | `.accessor()` now infers and rebinds the value type instead of widening to `TValue`. `.options()` takes a `const`-inferred array and rejects option values outside the accessor's union. | [§2](#2-column-builder-type-inference) |
| `<BetterTable columns={...} />` | No longer accepts value-type-erased (`any`) column arrays. Wrap raw builder-array literals in `defineColumns<TData>()(...)`. | [§3](#3-definecolumns-at-the-ui-boundary) |
| `.id()` | Now literal-preserving (`'name'` instead of `string`). Only breaks code that compared a builder's *pre-chain* static type to its *post-chain* type (e.g. `expectTypeOf` assertions). | [§4](#4-column-ids-are-now-literal-preserving) |
| `FetchDataParams.filters` / URL filters | Widened to `FilterState[] \| FilterGroupNode` — AND/OR filter trees. `deserializeFiltersFromURL` now returns that widened union. | [§5](#5-filter-groups-fetchdataparamsfilters--url-filters) |
| `FilterManager` / `TableStateManager` | Filter storage widened the same way. `getFilters()` is now a flattened display view of a possibly-tree-shaped store; `setFilters()` deterministically replaces the whole stored value. | [§6](#6-filter-state-layer-getfilters--setfilters-semantics) |
| Drizzle multi-table mutations | `createRecord`/`updateRecord`/`deleteRecord`/`bulkUpdate`/`bulkDelete` now throw on a multi-table schema unless `defaultMutationTable` is configured. | [§7](#7-drizzle-defaultmutationtable-is-now-required-for-multi-table-mutations) |
| Drizzle dependencies | `drizzle-orm` and `better-sqlite3` moved from `dependencies` to `peerDependencies` (drivers optional). Install them yourself. | [§8](#8-drizzle-drizzle-orm-and-better-sqlite3-are-now-peer-dependencies) |
| `@better-tables/adapters-toolkit` | New package; the Drizzle adapter is restructured on top of it. Public `DrizzleAdapter`/`drizzleAdapter()` surface is unchanged — only direct instantiators of `DataTransformer` are affected. | [§9](#9-adapters-toolkit-extraction-internal-restructure) |
| React | 19+ only. | [§10](#10-react-19) |
| Date column `timeZone` | Now actually converts (`@date-fns/tz`) instead of being accepted-but-ignored, including the builder's pre-existing `'UTC'` default on `.format()`/`.dateTime()`/`.timeOnly()`. | [§11](#11-date-formatting-timezone-is-now-actually-applied) |
| Reading a specific table | New recommended pattern: `tables.fetchData(usersTable, params)` — injects `primaryTable` and returns a typed row, no cast. Drizzle's `database.fetchData`/facet reads now throw on a multi-table schema when nothing disambiguates the table (mirrors §7's mutation throw). | [§12](#12-reading-a-specific-table-tablesfetchdata-and-the-drizzle-multi-table-read-throw) |

## 1. Table setup: `betterTables` + `defineTable`

The per-table shell is gone. `betterTables()` is now an app-level instance
you create once; each table is defined separately with `defineTable()`.

```typescript
// 0.5
import { betterTables } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

const tables = betterTables({
  database: drizzleAdapter(db),
  columns: [
    { id: 'name', displayName: 'Name', type: 'text' },
    { id: 'email', displayName: 'Email', type: 'text' },
  ],
  pagination: { page: 1, limit: 20 },
});

const result = await tables.adapter.fetchData({ columns: ['name', 'email'] });
```

```typescript
// 0.6
import { betterTables, defineTable } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({
  database: drizzleAdapter(db), // carries $types (schema catalog) — see "New capabilities" below
  defaults: { pageSize: 20 },
});

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [t.text('name'), t.text('email')],
}));
// also supported: tables.define('users', (t) => ({ ... })) — method form

// Recommended: query THROUGH the table definition (see §12) — primaryTable
// is injected automatically and the result is typed to usersTable's own row,
// no cast:
const result = await tables.fetchData(usersTable, { columns: ['name', 'email'] });
// `tables.database.fetchData(...)` (the raw adapter) still works too, and is
// still the only path for cross-table queries that don't belong to one
// defineTable() — see §12 for when it throws on a multi-table schema.
```

Why: the per-table shell couldn't express a multi-table app without the
untyped `createColumnBuilders({ users: {} as User, ... })` placeholder
pattern. The instance now owns the adapter once; `defineTable()` derives
column ids and types from your schema instead of you hand-writing them.

**What's gone:** the config shape with a `columns` key (any object literal
matching it is now a compile error), the `.adapter`/`.columns`
getter/setters, `getConfig()`/`updateConfig()`, and the `ExtractAdapterRecord`
type helper. `tables.database` replaces `.adapter` as the one thing from the
old return value still worth keeping.

**Migrate column-by-column, not all at once:** a path builder (`t.text('name')`)
and a hand-written fluent builder
(`cb.text().id('name').accessor(u => u.name).build()`) produce the *identical*
`ColumnDefinition` object. You can mix both styles in the same `columns`
array while you migrate — only the *instance* shape (this section) is a flag
day; individual column definitions are not.

## 2. Column builder type inference

Two related tightenings to the fluent builders that back both `t.*()` path
builders and hand-written `cb.text()`-style columns.

**`.accessor()` now rebinds the value type** instead of leaving it at the
class-level generic default:

```typescript
// 0.5 — explicit generic needed to work around widening
const nameCol = new ColumnBuilder<User, string>('text')
  .id('name')
  .accessor((u) => u.name)
  .build();
```

```typescript
// 0.6 — inference does the right thing; explicit generic is no longer needed
const nameCol = new ColumnBuilder<User, string>('text') // 0.6
  .id('name')
  .accessor((u) => u.name) // TValue is now `string`, inferred from the accessor
  .build();
```

A `ColumnBuilder<TData, string>` annotation that already matched the
accessor's real return type still compiles unchanged — only *workaround*
annotations become unnecessary, not broken.

**`.options()` now checks option values against the accessor's declared
union**, and `cellRenderer`'s `value` is the narrowed literal type instead of
plain `string`:

```typescript
// 0.5
const roleCol = new OptionColumnBuilder<User>()
  .id('role')
  .accessor((u) => u.role) // User['role'] = 'admin' | 'editor' | 'viewer'
  .options([{ value: 'bogus', label: 'Bogus' }]) // compiled — no check
  .cellRenderer(({ value }) => (value as string).toUpperCase()) // cast needed
  .build();
```

```typescript
// 0.6
const roleCol = new OptionColumnBuilder<User>()
  .id('role')
  .accessor((u) => u.role)
  .options([
    { value: 'admin', label: 'Admin' },
    // { value: 'bogus', label: 'Bogus' }, // now a compile error
  ])
  .cellRenderer(({ value }) => value.toUpperCase()) // value: 'admin' | 'editor' | 'viewer' — no cast
  .build();
```

Why: this closes a real correctness hole — a typo'd option value used to
compile and fail silently at runtime. Drop any `cellRenderer` cast that
worked around the old widened type; it will now be a narrower literal union
and the cast is redundant (or, if it narrowed to something the real value
can't be, a compile error pointing at a genuine bug).

## 3. `defineColumns()` at the UI boundary

`<BetterTable columns={...} />` no longer accepts a value-type-erased
(`ColumnDefinition<TData, any>[]`) array. Wrap a raw array literal of built
columns in `defineColumns<TData>()(...)`:

```typescript
// 0.5
import { BetterTable } from '@better-tables/ui';

<BetterTable columns={[nameCol, ageCol, roleCol]} data={users} />
```

```typescript
// 0.6
import { defineColumns } from '@better-tables/core';
import { BetterTable } from '@better-tables/ui';

const columns = defineColumns<User>()([nameCol, ageCol, roleCol]);

<BetterTable columns={columns} data={users} />
```

Why: a heterogeneous array of differently-value-typed columns
(`ColumnDefinition<TData, string>`, `ColumnDefinition<TData, number>`, ...) is
not directly assignable to `ColumnDefinition<TData, unknown>[]` — `TValue` is
invariant (`accessor` produces it, `cellRenderer`/`filter` consume it), so no
single erased type is simultaneously a supertype and a subtype of every
column. The old `any` boundary silently discarded this problem;
`defineColumns()` verifies each column individually at its own call site and
erases in one audited place instead. If you're building your `columns` array
programmatically (not a literal at the call site — e.g. `.map()` over a
config array), keep using `ColumnDefinition<TData, unknown>[]` directly, since
`defineColumns()`'s per-element tuple inference needs a literal array.

## 4. Column ids are now literal-preserving

`.id('name')` used to widen to `string`; it's now a literal type
(`'name'`), in either call order (`.id().accessor()` or `.accessor().id()`),
including dotted relation paths (`'profile.location'`).

This is additive for almost everyone — existing two-parameter generic
annotations (`ColumnBuilder<TData, TValue>`) keep compiling unchanged. The
one break: code that captured a builder variable *before* chaining `.id(...)`
and compared its static type against the result *after* chaining (e.g. an
`expectTypeOf` assertion in a test suite):

```typescript
// 0.5 — pre-chain and post-chain static types matched (both `string`)
const before = new ColumnBuilder<User, string>('text');
const after = before.id('name');
expectTypeOf(before).toEqualTypeOf(after); // passed

// 0.6 — `before` is still typed with the default `TId = string`;
// `after` is now typed with `TId = 'name'`. Same runtime object, different
// static types. Compare the POST-chain type, or re-annotate `before`.
```

Why: this is the keystone for the `usersTable.$infer` surface in §1 — a
typed `columnId -> value` registry needs ids that survive as literals, not
`string`.

## 5. Filter groups: `FetchDataParams.filters` + URL filters

`FetchDataParams.filters` (and the URL wire format) now accept a recursive
AND/OR tree, not just a flat array:

```typescript
// 0.5
const params: FetchDataParams = {
  filters: [
    { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
  ],
};
```

```typescript
// 0.6 — a flat array still means implicit AND; this is unchanged
const flatParams: FetchDataParams = { // 0.6
  filters: [
    { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
  ],
};

// 0.6 — new: an explicit OR/nested tree via FilterGroupNode
import type { FilterGroupNode } from '@better-tables/core';

const groupParams: FetchDataParams = { // 0.6
  filters: {
    kind: 'group',
    logic: 'or',
    children: [
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
      { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
    ],
  } satisfies FilterGroupNode,
};
```

The URL wire format bumped from `c:` to `c2:` to carry the tree shape
(invisible to you — see [What did NOT change](#what-did-not-change)).
`deserializeFiltersFromURL`'s return type widened to match:

```typescript
// 0.5
const filters: FilterState[] = deserializeFiltersFromURL(urlString);
filters[0]?.columnId; // fine — always a flat array

// 0.6
const filters = deserializeFiltersFromURL(urlString); // FilterState[] | FilterGroupNode
filters[0]?.columnId; // 0.6 — compile error: filters might not be an array

// Narrow before indexing:
if (Array.isArray(filters)) {
  filters[0]?.columnId; // 0.6 — fine
}
// Or, if you know your app never serializes groups:
(filters as FilterState[])[0]?.columnId; // 0.6
```

`serializeFiltersToURL`/`deserializeFiltersFromURL` handle filters in
isolation. If you're syncing the WHOLE table's URL state (filters +
sorting + pagination + column visibility + column order), use
`serializeTableStateToUrl`/`deserializeTableStateFromUrl`
(`utils/url-serialization.ts`) instead — one call each way, filters
included, same `c2:` wire format under the hood.

Depth is capped at 3 (mirrors `defineTable()`'s path-depth cap). An adapter
that doesn't support groups (`AdapterMeta.supportsFilterGroups` absent or
`false`) rejects a non-AND tree with a typed error rather than silently
flattening it into a narrower (wrong) result set. The bundled Drizzle adapter
supports groups — see [new capabilities](#new-capabilities-you-get).

Why: OR queries were structurally impossible in 0.5 (the adapter pipeline was
a single flat `and(...)`). This is the first cross-filter OR in the codebase.

## 6. Filter state layer: `getFilters()`/`setFilters()` semantics

`TableState.filters`, `FilterManager`, and `TableStateManager` all widen the
same way as §5 — internally they can now hold a tree, not just an array.
Two accessor behaviors are worth knowing if you call these directly (the
reactive store's `filters` field and `filters_changed` event, and the filter
bar UI, stay flat `FilterState[]` in 0.6 — groups aren't reachable from the
UI yet, only programmatically and via `c2:` URLs):

```typescript
// 0.5 — getFilters() always returned exactly what was stored
filterManager.setFilters([{ columnId: 'status', type: 'text', operator: 'equals', values: ['active'] }]);
filterManager.getFilters(); // same array back

// 0.6 — getFilters() is a flattened DISPLAY view (depth-first leaves) of
// whatever is stored, which may now be a tree. setFilters() deterministically
// REPLACES the whole stored value — it never merges into an existing group.
filterManager.setFilters([{ columnId: 'status', type: 'text', operator: 'equals', values: ['active'] }]); // 0.6
filterManager.getFilters(); // 0.6 — flat leaves; AND/OR structure isn't represented here

// New: read/write the real tree-shaped value directly
filterManager.getFilterNode(); // 0.6 — FilterState[] | FilterGroupNode, the actual stored value
filterManager.setFilterNode({ kind: 'group', logic: 'or', children: [/* ... */] }); // 0.6
```

For pure flat-array usage (the common case), nothing changes — a flat array
in is a flat array out.

## 7. Drizzle: `defaultMutationTable` is now required for multi-table mutations

`createRecord`, `updateRecord`, `deleteRecord`, `bulkUpdate`, and
`bulkDelete` no longer silently target whichever table happened to be first
in your schema object. This was a real data-loss bug: an update-by-id on a
multi-table schema could land on the wrong table.

```typescript
// 0.5 — silently targeted the first key of `schema` (e.g. `users`, by luck)
const adapter = drizzleAdapter(db); // schema: { users, profiles }
await adapter.updateRecord('123', { bio: 'new bio' }); // could hit `users`, not `profiles`
```

```typescript
// 0.6 — throws a SchemaError until you say which table mutations target
const adapter = drizzleAdapter(db); // 0.6
await adapter.updateRecord('123', { bio: 'new bio' });
// SchemaError: Multiple tables in schema — set 'defaultMutationTable' in
// drizzleAdapter options to enable create/update/delete

// Fix: configure it explicitly
const fixedAdapter = drizzleAdapter(db, { // 0.6
  options: { defaultMutationTable: 'profiles' },
});
await fixedAdapter.updateRecord('123', { bio: 'new bio' }); // targets `profiles`
```

**Schemas with exactly one table are unaffected** — no configuration needed,
that table is used automatically. `adapter.meta.features.create/update/delete/bulkOperations`
now honestly reflect whether mutation routing is actually resolvable, instead
of being hardcoded `true`; a UI that gates mutation buttons on `adapter.meta.features`
will correctly stop offering them until you set `defaultMutationTable`.

## 8. Drizzle: `drizzle-orm` and `better-sqlite3` are now peer dependencies

```json
// 0.5 — @better-tables/adapters-drizzle's package.json
{
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "better-sqlite3": "^12.4.6"
  }
}
```

```json
// 0.6
{
  "peerDependencies": {
    "drizzle-orm": ">=0.44.0 <0.46.0",
    "better-sqlite3": "catalog:",
    "mysql2": "^3.12.0",
    "postgres": "^3.4.0"
  },
  "peerDependenciesMeta": {
    "better-sqlite3": { "optional": true },
    "mysql2": { "optional": true },
    "postgres": { "optional": true }
  }
}
```

If your app was relying on `@better-tables/adapters-drizzle` to transitively
install `drizzle-orm` and `better-sqlite3`, add them to your own
`dependencies` now — `drizzle-orm` at a version satisfying `>=0.44.0 <0.46.0`.
Install only the driver package(s) you actually use (`better-sqlite3`,
`mysql2`, or `postgres`); the other two are no longer forced on you.

Why: bundling a second copy of `drizzle-orm` could type/instance-mismatch
against your own copy, and Postgres/MySQL-only users were being forced to
compile the `better-sqlite3` native addon for no reason.

## 9. `adapters-toolkit` extraction (internal restructure)

`@better-tables/adapters-drizzle` is now built on top of a new package,
`@better-tables/adapters-toolkit` — the ORM-agnostic pieces (relationship
aliasing, primary-table resolution, filter-operator routing, SQL identifier
escaping, and more), pulled out so a future adapter (Prisma, held pending)
doesn't reimplement them. **This has no intended public API change** — you
don't need to depend on the toolkit directly, and `DrizzleAdapter`/
`drizzleAdapter()`'s constructor and method signatures are unchanged.

The one exception: if you were instantiating `DataTransformer` directly
(re-exported from the toolkit) rather than going through `DrizzleAdapter`,
it now takes a third constructor argument — a schema-introspection port.

## 10. React 19

The `React 18+` badge in the old README was already inaccurate — the
workspace catalog has pinned `react: ^19.2.3` for a while, so every published
peer range already resolved to React-19-only. 0.6 doesn't newly require React
19; it's just now stated correctly. If you were somehow running on React 18
against that mismatched claim, this is the moment to upgrade.

## 11. Date formatting: `timeZone` is now actually applied

Date column formatting (`DateColumnBuilder.format()`/`.dateTime()`/
`.timeOnly()`, and the underlying `formatDateWithConfig`/`formatDateRange`
helpers) previously accepted a `timeZone` option but silently ignored it —
dates always rendered in the viewer's local time zone. 0.6 applies it as a
real conversion via `@date-fns/tz`, including day-boundary-sensitive
relative phrasing ("today", "yesterday").

**This is a breaking display change**, and it reaches further than columns
that explicitly configured `timeZone`: `.format()`, `.dateTime()`, and
`.timeOnly()` all default `timeZone` to `'UTC'` when you don't pass one, and
that default now converts too. If you have a date column using one of those
three methods without an explicit `timeZone`, it will flip from rendering in
the viewer's local time zone to rendering in UTC. To keep the old
viewer-local behavior, don't set `timeZone` on `.dateOnly()`/`.relative()`
(unaffected), or explicitly pass the zone you want on the others. An
unrecognized IANA zone name doesn't throw — it warns once via
`console.warn` and falls back to unconverted rendering.

## 12. Reading a specific table: `tables.fetchData()` and the Drizzle multi-table read throw

Marketing-showcase dogfooding turned up a real footgun: `database.fetchData({
pagination })` on a multi-table schema silently returned the FIRST table's
rows (customer rows typed and shaped as tickets, a correct-looking `total`,
and a single easy-to-miss `console.warn`) whenever a call didn't disambiguate
which table to query. §7 already fixed the analogous problem for
mutations — this section brings reads up to the same bar, and adds the
ergonomic fix on top: query THROUGH the table you defined, so the mistake
becomes unreachable.

**New: `tables.fetchData(table, params)`.** Query through a `defineTable()`
result instead of the raw adapter:

```typescript
// 0.6 — recommended
const result = await tables.fetchData(usersTable, {
  pagination: { page: 1, limit: 20 },
});
// result: FetchDataResult<User> — usersTable's own row type, no cast
```

`primaryTable` is injected from `usersTable.tableName` automatically —
`TableScopedFetchDataParams` (the params type this method accepts) omits
`primaryTable` entirely, so there's nothing to pass, and nothing to get
wrong. The old pattern required both a manual `primaryTable` (easy to
forget on a multi-table schema) and a manual cast at every call site:

```typescript
// 0.5 / still works, but no longer the recommended path
const result = (await tables.database.fetchData({
  primaryTable: 'users', // easy to omit; wrong-table risk if it's wrong or missing
  pagination: { page: 1, limit: 20 },
})) as FetchDataResult<User>; // manual cast — the adapter can't know which table you meant
```

`tables.getFacetedValues(table, columnId, params)`/`getMinMaxValues(...)`/
`getFilterOptions(...)` are the same idea for facet reads: `columnId` is
typed against `table.$infer.ColumnId`, so a wrong-table column id is a
compile error. These can't inject `primaryTable` (the adapter contract's
`FacetQueryParams` has no such field) — the type safety is the win here, not
a new runtime guarantee.

**Drizzle: multi-table reads with no disambiguating signal now throw.**
`database.fetchData`/`getFilterOptions`/`getFacetedValues`/`getMinMaxValues`
on a schema with more than one table, called with neither `columns` nor
`primaryTable`, now throw a `SchemaError` instead of silently assuming "the
first table" (the same fix §7 already applied to mutations):

```typescript
// 0.5 — silently returned `users` rows on a { users, profiles, ... } schema
const adapter = drizzleAdapter(db);
await adapter.fetchData({ pagination: { page: 1, limit: 20 } }); // wrong table, one console.warn
```

```typescript
// 0.6 — throws a SchemaError until something disambiguates the table
const adapter = drizzleAdapter(db); // 0.6
await adapter.fetchData({ pagination: { page: 1, limit: 20 } });
// SchemaError: Multiple tables in schema — set 'primaryTable' (per call),
// 'defaultPrimaryTable' (in drizzleAdapter options), or pass 'columns' that
// disambiguate, to select which table to query

// Fixes: pass `columns` that resolve to one table, pass `primaryTable`
// per call, configure a `defaultPrimaryTable` adapter-wide, or (recommended)
// query through `tables.fetchData(usersTable, params)` above.
const fixedAdapter = drizzleAdapter(db, { // 0.6
  options: { defaultPrimaryTable: 'users' },
});
await fixedAdapter.fetchData({ pagination: { page: 1, limit: 20 } }); // targets `users`
```

**Schemas with exactly one table are unaffected** — no configuration needed.
`PrimaryTableResolver`'s own no-columns fallback (the `console.warn` you may
have seen before) is unchanged for callers that don't go through these five
entry points.

**Also fixed alongside this:** filtering or sorting by a relation column that
isn't in `columns` (e.g. `filters: [{ columnId: 'customer.plan', ... }]` with
`customer` not requested via `columns`) used to silently drop that relation
from the result rows even though it correctly narrowed the result set. It's
now embedded in every returned row, the same as if you'd requested one of its
fields via `columns` — with no over-fetching of relations you didn't filter,
sort, or select.

**Deployment note: lazy-init a module-scope instance wrapping a native
binding.** If `betterTables()`/`drizzleAdapter()` are constructed eagerly at
module scope (`export const tables = betterTables({ database: drizzleAdapter(db) })`)
and `db` wraps a native binding (e.g. `better-sqlite3`), that constructor
runs at IMPORT time. Under `next build`, Next.js's page-data collection phase
imports route modules in a constrained environment that doesn't always tolerate
a native binding's eager side effects, and the build can fail or hang.
Wrap construction in a lazy getter instead, so the native binding is only
touched when a request actually needs it:

```typescript
// Breaks under `next build`'s page-data collection
export const tables = betterTables({ database: drizzleAdapter(db) });
```

```typescript
// 0.6 — lazy getter
let _tables: ReturnType<typeof betterTables> | undefined;
export function getTables() {
  if (!_tables) {
    _tables = betterTables({ database: drizzleAdapter(getDb()) });
  }
  return _tables;
}
```

## 14. Instance writes take an explicit table

Reads already used `tables.fetchData(table, params)`. Writes now match:

```ts
// Before (0.5 / early 0.6 interim): implicit mutation table via
// defaultMutationTable / first schema table
await database.createRecord({ subject: '…' });

// After: table-scoped instance writes (plan 047)
await tables.createRecord(ticketsTable, { subject: '…' });
await tables.updateRecord(ticketsTable, id, { subject: '…' });
await tables.deleteRecord(ticketsTable, id);
```

The low-level `database.createRecord(data)` path remains for single-table
schemas and for callers who set `defaultMutationTable`. The instance surface
is the recommended multi-table write API.

## 13. Facet value queries default to top-100 by count

`getFacetedValues` / `getFilterOptions` now return at most **100** distinct
values, ordered by count descending. This is a behavior change in the 0.6
window — high-cardinality facets no longer ship every distinct value by
default.

To restore the previous return-everything behavior:

```ts
await adapter.getFacetedValues('city', { limit: null });
```

Pass a positive `limit` to override the default cap for a single call.

## What did NOT change

Migration guides that only list breakage overstate the pain. In 0.6:

- **The fluent builders remain valid.** `cb.text().id('name').accessor(...).build()`
  still works exactly as in 0.5 (with the type-inference tightening in
  [§2](#2-column-builder-type-inference)) — they're not just kept for
  compatibility, they're what `t.*()` path builders compile to underneath.
- **Flat filter arrays remain valid.** `filters: [...]` is still the
  ergonomic default everywhere; you only reach for `FilterGroupNode` when you
  actually need OR or nesting.
- **Old `c:`-prefixed filter URLs still read correctly.** This is the one
  compatibility exception the 0.6 release policy keeps — bookmarked/shared
  URLs in the wild aren't API consumers, so `deserializeFiltersFromURL` tries
  the new `c2:` prefix first and falls back to parsing `c:` as a flat,
  implicit-AND array. Newly serialized URLs always write `c2:`.
- **Single-table Drizzle schemas need no `defaultMutationTable` configuration**
  ([§7](#7-drizzle-defaultmutationtable-is-now-required-for-multi-table-mutations)) —
  the one table is used automatically. The same is true for reads
  ([§12](#12-reading-a-specific-table-tablesfetchdata-and-the-drizzle-multi-table-read-throw)).
- **The filter bar UI stays flat.** You don't need to touch anything in your
  UI layer to pick up 0.6 — the reactive store's `filters` field and
  `filters_changed` event are unchanged, flat `FilterState[]`.

## New capabilities you get

Four things 0.6 unlocks that weren't possible before, each linking to the
full design rather than repeating it here:

- **Schema-derived, path-typed columns.** `defineTable<typeof tables>()('users', (t) => ({ columns: [t.text('profile.location')] }))`
  autocompletes real table names and dot-notation relation paths straight
  from your adapter's schema — a typo is a compile error, not a runtime
  throw. See `plans/design/table-definition-dx.md`, "Step 2: The path-typed
  column builder redesign".
- **AND/OR filter groups, translated to real SQL.** The bundled Drizzle
  adapter now translates a `FilterGroupNode` tree into correct nested
  `AND`/`OR` `WHERE` clauses (`adapter.meta.supportsFilterGroups: true`,
  `maxGroupDepth: 3`), including trees that mix direct and cross-table
  (joined) leaves, with pagination totals that agree with the filtered
  result set. Reachable today via the programmatic API and `c2:` URLs; a
  visual group-builder UI is a later plan. See
  `plans/design/core-contract-v2.md`, "Step 1 — Filter groups".
- **`$infer` on every table definition.** `usersTable.$infer.Row` and
  `usersTable.$infer.ColumnId` give you the row type and valid column ids
  without hand-maintained type declarations. (`$infer.FilterState` is
  currently a reserved `unknown` placeholder — a typed
  `columnId -> valueType` filter registry is designed but not yet wired
  through `defineTable()`; see `plans/design/core-contract-v2.md`, "Step 2 —
  Typed column registry".)
- **Type-safe filter authoring.** A wrong operator for a column's `type`
  (`{ type: 'option', operator: 'contains' }`) is now a compile error, not
  a runtime-only `validateFilter` failure — `FilterState`'s per-type
  members (`TextFilterState`, `OptionFilterState`, ...) narrow `operator`
  to the operators actually legal for that type. `buildFilter(table,
  columnId, operator, values)` goes further for a known `defineTable()`
  column: `columnId` is checked against the table's real row paths, and
  `operator`/`values` are inferred from the path's value shape for
  `number`/`boolean`/`date`/`json`/generic-`text` columns (no restating
  `type`); `buildFilter(table, columnId, type, operator, values)` covers
  `'option'`/`'multiOption'` and the other cases a raw string/number/etc.
  shape can't disambiguate on its own (still fully checked against that
  `type`). `filterHasValue(filter, value)` checks `filter.values` for a
  value without narrowing by `filter.type` first, and an optional
  `FilterState.id` gives filters a stable identity that survives two
  filters on the same `columnId` inside one `FilterGroupNode` and
  round-trips through URL serialization. See
  `packages/core/src/builders/build-filter.ts`.
- **Null-only filters.** A filter with `includeNull: true` and no `values`
  is now a valid strict-mode filter meaning "match rows where this column
  is null" — the same shape the include-unknown UI checkbox already
  produced when checked before a value was entered. It's rejected on
  `isEmpty`/`isNull`-style operators, whose own condition already means
  null, as redundant. See `plans/027-null-filter-semantics.md`.

## Known gaps

- **Computed-field filters inside filter groups.** Drizzle adapter
  `fetchData`/`getFacetedValues` can substitute computed-field filters
  (`filter`/`filterSql`) only on a flat `FilterState[]` (implicit AND).
  A computed-field leaf inside a `FilterGroupNode` tree is rejected with a
  `QueryError` naming the column — it is not silently treated as a real
  schema column. Until tree-walking substitution lands, pass computed-field
  filters as a flat array or flatten at the call site. (Plan 051 — deferred
  to the computed-fields owner.)

---

## Release runbook (maintainer-facing)

The sections above are the user-facing guide. This section is for whoever
runs the actual 0.6 publish — see `plans/README.md`'s release-policy block
and "Carry-forward notes for the 0.6 release" for the source of truth; this
is a condensed checklist, not a replacement.

1. **Toolkit version.** `packages/adapters/toolkit/package.json` currently
   says `0.1.0`, and a `minor` changeset exists for it — `changeset version`
   will publish it as `0.2.0`. If `0.1.0` is meant to be the toolkit's first
   published version, set `package.json` to `0.0.0` before running
   `changeset version`.
2. **Publish as one train.** All accumulated changesets in `.changeset/`
   publish together: `bun run changeset:version`, review the resulting
   version bumps and changelog entries, then `bun run changeset:release` (or
   the repo's equivalent `release` script). Do not partially publish.
3. **Restore the git remote before publishing.** The repository currently has
   no git remote configured — that's deliberate during local plan-driven
   development, but the first real CI run (and the publish itself) needs it
   restored first
   (`git remote add origin git@github.com:Better-Tables/better-tables.git`).
4. **Lint gate.** The CI lint step is `continue-on-error` until Biome residue
   hits 0 across the repo. As of the last audit, `apps/marketing` and
   `packages/ui` are Biome-clean; remaining residue is
   mostly in `core`/`cli`/`adapters`. Flip `continue-on-error` off only after
   confirming `bunx biome check .` is clean at the root.
5. **Typecheck exclusions.** None currently recorded as debt —
   `apps/marketing` has a working `typecheck` script, and
   `packages/ui` has a `bun test` harness. No package is silently excluded
   from the gate.
