# Plan 029 DX findings — marketing showcase dogfood

Format per finding: **tried** (the intuitive thing) → **happened** (verbatim
error/behavior) → **workaround** (what shipped, marked `// DX-FINDING-N:` at
the site) → **proposed fix**.

Source files referenced below are all under `apps/marketing/src/lib/demo/support/`
and `apps/marketing/src/components/sections/` unless noted otherwise.

---

## Resolution ledger

**All 17 findings are closed.** Every `// DX-FINDING-N:` marker is gone from the
codebase — the workarounds they annotated were deleted, not re-documented. The
findings below are kept verbatim as the historical record of what the dogfood
actually hit; this ledger says where each one landed.

| # | Status | Where it landed |
|---|---|---|
| 1 | Fixed | `buildFilter(table, path, [type,] op, values)` (031). Presets author leaves against real paths/operators. Option columns still take an explicit `'option'` — a string-shaped path can't be inferred as option. |
| 2 | Fixed | `BaseFilterState.id` + `filterKey(filter, index)` (031). |
| 3 | Fixed | Core's own `serializeTableStateToUrl` (filters + sorting + pagination, built-in compression). The app hand-rolls nothing; `lz-string` lives only inside core. |
| 4 | Fixed | Example is `betterTables()` + `defineTable()` + path builders; the homepage demo uses `defineTableRow()` + the typed read surface. The marketing site's own code samples now teach the flagship API too (they taught `createColumnBuilder` with explicit `.id()/.accessor()/.build()`). |
| 5 | Fixed | `table` prop (032). Adopted once #12 landed — it was blocked on the row type, not on the prop. |
| 6 | Fixed | **`<BetterTable virtualized />`** — windowing under the existing filter/sort/selection/URL-sync machinery, so there's no second component to reach for. The big board migrated off `<VirtualizedTable>` and *gained* a filter bar and header sort it never had. `TableFeatures.virtualScrolling` (declared, never read by anything) is deprecated in favour of the prop. The `renderCell`-ignores-column-formatter addendum was fixed in 032. |
| 7 | Fixed | `useFacets` + `<FacetedFilterSidebar>` (032), plus `httpAdapter`/`createAdapterRouteHandler` — the facets sidebar's whole server side is now 3 lines, and its ~160-line hand-built fetch/race-guard/`Map` plumbing is gone. |
| 8 | Fixed | Per-type operators (031). `equals` on an option filter is a compile error. |
| 9 | Fixed | Ambiguous multi-table reads throw (030), and `tables.fetchData(table, …)` injects `primaryTable` so the ambiguity is unreachable by construction. |
| 10 | Fixed | `computeAutoEmbedColumns` (030) — a relation touched by `filters`/`sorting` embeds itself. Explicit `columns` is now only needed for data no filter mentions (e.g. client-side visibility toggling). |
| 11 | Fixed | `drizzleAdapter()` throws on a `Relations` object clobbering a same-named table (030). The homepage demo still *had* the clobbering shape and was fixed here — it only worked because #14's extractor fallback rescued the tables via each relation's `.table` ref. |
| 12 | Fixed | Relation-aware rows drop inverse back-references and keep forward relations as a clean intersection. **This is the linchpin**: `$infer.Row` became usable, so the hand-shaped `TicketWithRelations` was deleted, `ticketColumns = ticketsTable.columns` needs no cast at all, and #5/#16 unblocked. |
| 13 | Fixed by pattern | The lazy getter is still required — `next build`'s page-data collection still imports route modules, so a module-scope native binding still breaks it. What changed: `createAdapterRouteHandler` takes a lazy factory, and clients use `httpAdapter`, so no DB binding is reachable from a client module at all. `db.ts` documents the constraint rather than flagging it. |
| 14 | Fixed | `extractSchemaFromDB` keys tables and relations consistently (030). The example is zero-config `drizzleAdapter(db)` again, despite SQL names (`support_tickets`) differing from JS keys (`tickets`). |
| 15 | Fixed | Soft-nav rehydration (032), **plus the clearing direction fixed here**: the `hasFilters` guard correctly protected SSR-seeded `initialFilters` on mount but also blocked *clearing*, so a soft nav that removed filters left stale chips while the data correctly refetched unfiltered. Now the clear is allowed only after the first hydration. |
| 16 | Fixed | Table-scoped read surface (030). Every fetcher in the app is cast-free. |
| 17 | Fixed | `filterHasValue(filter, value)` (031). |

### Found while closing these (not in the original 17)

| What | Status |
|---|---|
| `betterTables()` rejected any adapter without `$types`. `SchemaAwareAdapter` is all-optional (`{ $types?: T }`), so constraining to it tripped TypeScript's weak-type check — excluding exactly the REST/in-memory/`httpAdapter` adapters its own docs promised. Invisible because the test mock declared `& SchemaAwareAdapter<…>`. | Fixed (constraint relaxed to `object`; regression test covers a plain adapter and `httpAdapter`) |
| No client-callable adapter: a server-only adapter can't be reached from the browser, so every app hand-wrote a fetch shim + route. | Fixed (`httpAdapter` + `handleAdapterRequest` + `createAdapterRouteHandler`) |
| Number `equals`/`notEquals` routed to the string handler — `Invalid filter value type: expected string` on a numeric column. | Fixed (router dispatch + regression test) |
| `sorting={{ multiSort: false }}` appended a second sort key instead of replacing, so every table stayed ordered by whatever was sorted first. `TableStateManager.toggleSort` had no `multiSort` concept — the flag lived on the unused `SortingManager` and only drove the header menu's display. | Fixed (`TableStateConfig.sorting.multiSort`, threaded from the `<BetterTable sorting>` prop; regression tests both modes) |

---

## 1. Filter-group literal shape: `kind`/`logic` lost against the intuitive guess, and a leaf must restate its column's type

**Tried:** The maintainer's WIP (`relationship-trail.ts`, pre-fix) wrote the
shape that reads most naturally from the English description "a group of
filters ANDed together":

```ts
{
  type: 'group',
  operator: 'and',
  children: [
    { type: 'filter', columnId: 'customer.plan', operator: 'equals', values: ['enterprise'] },
  ],
}
```

**Happened:** `tsc --noEmit` on the untouched WIP:

```
src/lib/demo/support/relationship-trail.ts(66,11): error TS2322: Type '"filter"' is not assignable to type '"custom"'.
src/lib/demo/support/relationship-trail.ts(72,11): error TS2322: Type '"filter"' is not assignable to type '"custom"'.
src/lib/demo/support/relationship-trail.ts(89,11): error TS2322: Type '"filter"' is not assignable to type '"custom"'.
src/lib/demo/support/relationship-trail.ts(95,11): error TS2322: Type '"filter"' is not assignable to type '"custom"'.
```

The error is unhelpful about the *actual* fix: `FilterGroupNode` uses
`{ kind: 'group', logic: 'and' | 'or', children: FilterNode[] }`, and each
leaf is a bare, discriminated `FilterState` — `{ columnId, type, operator,
values }` — with NO `type: 'filter'` wrapper at all. The `"filter"` is not
assignable to `"custom"` message comes from TS trying to match the literal
against `CustomFilterState.type` (the last member it attempted in the
`FilterNode` union), which points at the wrong member entirely and gives no
hint that the real problem is `type`/`kind` naming, not the literal value.

**Workaround shipped:** `relationship-trail.ts`'s `supportScenarioPresets`
and `fetch-tickets.test.ts`'s filter literals rewritten to the real shape,
each leaf restating its column's data type:

```ts
{
  kind: 'group',
  logic: 'and',
  children: [
    { columnId: 'customer.plan', type: 'option', operator: 'is', values: ['enterprise'] },
  ],
}
```
(marked `// DX-FINDING-1` at each preset literal site in `relationship-trail.ts`)

**Proposed fix:** Two independent issues bundled in one finding:
(a) naming — `kind`/`logic` for the group, bare `FilterState` for leaves, is
a defensible design (avoids a `type: 'filter'` vs `type: 'text'` collision
on the SAME field name), but nothing about the compiler error communicates
it; a custom error message (or at minimum a doc comment surfaced via
hover) pointing `{ type: 'group', ... }` users at `FilterGroupNode`'s real
shape would help. (b) restating the column's type on every filter leaf is
pure duplication — the column definition already knows it (`t.option('customer.plan')`
declares `type: 'option'` once). This is exactly what the design doc's
planned `$infer`/registry work (`plans/design/core-contract-v2.md` "Step 2 —
Typed column registry", currently a reserved `unknown` on `$infer.FilterState`)
would fix: a `buildFilter(ticketsTable, 'customer.plan', 'is', ['enterprise'])`
helper that infers `type` from the column and rejects a bogus `columnId` or
value shape at compile time, instead of every call site hand-rolling the
full `FilterState` object and hoping the `type` field matches.

---

## 2. `filter.id` doesn't exist — `FilterState` has no stable per-filter identity

**Tried:** `relationship-trail.ts`'s `buildRelationshipTrail` mapped over
active filters and returned `id: filter.id` as each trail step's React key,
and `fetch-tickets.test.ts` constructed filter literals with an `id` field
(`{ id: 'plan-filter', columnId: 'customer.plan', ... }`) as if `FilterState`
carried one.

**Happened:**

```
src/lib/demo/support/relationship-trail.ts(38,20): error TS2339: Property 'id' does not exist on type 'FilterState'.
  Property 'id' does not exist on type 'TextFilterState'.
src/lib/demo/support/relationship-trail.ts(109,9): error TS2353: Object literal may only specify known properties, and 'id' does not exist in type 'BooleanFilterState'.
```

`BaseFilterState` (`packages/core/src/types/filter.ts`) has exactly
`columnId`, `operator`, `values`/type-specific `values`, `includeNull?`,
`meta?` — no `id`. Identity is `columnId`, which is fine for the common
"one filter per column" case but breaks down the moment two filters target
the same column inside one group (e.g. a `between`-style range expressed as
two leaves on the same `columnId`, or two OR branches both filtering
`status`) — there is no way to tell them apart or give React a stable key
without falling back to array index.

**Workaround shipped:** `buildRelationshipTrail` now derives a display key
from `${filter.columnId}-${index}` (index within the flattened trail array)
instead of a nonexistent `filter.id` (`// DX-FINDING-2` in
`relationship-trail.ts`). This is stable enough for a read-only list that
re-renders from a fresh flattened array every time, but would misbehave
(wrong React reconciliation) if the trail ever became independently
reorderable/editable — the underlying gap is real, not just cosmetic.

**Proposed fix:** Either (a) add an optional `id?: string` to
`BaseFilterState` that the filter-bar UI and URL serialization populate and
preserve (most direct), or (b) document the `columnId + array position`
convention as the sanctioned identity key for any UI iterating filters, since
right now every consumer has to reinvent the same workaround.

---

## 3. Hand-rolled URL compression (`lz-string`) duplicates a built-in the WIP didn't find

**Tried:** `serialize-preset.ts` imported `lz-string` directly to compress a
scenario preset's sorting state into a URL param (filters already went
through `serializeFiltersToURL`, but sorting had no equivalent the author
could find, so they hand-rolled one).

**Happened:**

```
src/lib/demo/support/serialize-preset.ts(3,22): error TS2307: Cannot find module 'lz-string' or its corresponding type declarations.
```

`lz-string` isn't a dependency of `apps/marketing` (nor of any package it
depends on) — it doesn't compile.

**Workaround shipped:** Deleted the `lz-string` import and the hand-rolled
`serializeSortingToUrl` entirely. `@better-tables/core` already exports
`serializeTableStateToUrl` / `deserializeTableStateFromUrl`
(`packages/core/src/utils/url-serialization.ts`, re-exported via
`utils/index.ts` → the package root) which does exactly "serialize a whole
preset (filters + sorting [+ pagination, columnVisibility, columnOrder])" —
using the package's OWN compression (`compressAndEncode`/`decompressAndDecode`,
also core-internal, not lz-string) for sorting/columnVisibility/columnOrder
and `serializeFiltersToURL`'s `c2:` format for filters. `serialize-preset.ts`
now calls `serializeTableStateToUrl({ filters: preset.filters, sorting: preset.sorting, pagination: { page: 1, limit: 10, ... } })`
directly — zero new dependencies (`// DX-FINDING-3` at the call site).

**Proposed fix:** This is a discoverability gap, not a missing capability —
the built-in was sitting right there, exported, doing exactly the job. Two
contributing factors worth fixing: (a) `MIGRATION.md` and the wiki's "URL
State Management" section both foreground `serializeFiltersToURL`/
`deserializeFiltersFromURL` (filters only) and never mention
`serializeTableStateToUrl`/`deserializeTableStateFromUrl` (the whole-state
version) by name — a maintainer who knew the filter-only function existed
had no equally-visible pointer to the state-only function one level up; (b)
`useTableUrlSync` (the hook `tickets-table-client.tsx` already uses) clearly
calls something like this internally for the live table, but nothing in its
docs says "the same serializer is available standalone for building
preset/share links outside the hook." Cross-linking these three in the docs
would have made the external dependency unnecessary from the start.

---

## 4. The WIP used the OLD entry style (`createColumnBuilder` + `defineColumns` + a hand-rolled adapter wrapper), not the 018 flagship `betterTables()` + `defineTable()` + path builders

**Tried:** `columns.tsx` (pre-migration) built columns with
`createColumnBuilder<TicketWithRelations>()` (a bare fluent builder factory
with no schema awareness) and `adapter.ts` hand-wrapped `drizzleAdapter(db)`
in a memoized async getter, mirroring the pattern already used by the
pre-existing (non-WIP) `/lib/adapter.ts` + `/lib/columns/user-columns.tsx`
for the homepage demo.

**Happened:** No compile error — this is the important part of the finding.
`createColumnBuilder`/`defineColumns` are still fully supported (0.6 kept
the fluent builders on purpose, see `MIGRATION.md` "What did NOT change"),
so nothing forced a second look at the newer API. The WIP compiled its
*column definitions* fine; it was only the filter-literal and lz-string
issues (findings 1-3) that broke the build.

**Why the old style was the first instinct:** grepping the marketing app
before this plan started, `betterTables()`/`defineTable()` had ZERO usages
anywhere in `apps/marketing` — the pre-existing homepage demo
(`lib/columns/user-columns.tsx`, `lib/adapter.ts`) already used the old
`createColumnBuilder` shell, and the WIP was written by pattern-matching the
neighboring file, not by discovering the 018 API fresh. The flagship path
is also not the auto-suggest default: nothing in the file the author was
extending pointed at it, and there is no lint rule or codemod flagging
`createColumnBuilder` as superseded. `<BetterTable>` itself doesn't help
either — it still takes a plain `columns` prop (a `ColumnDefinition[]`), not
a `TableDefinition`, so passing `ticketsTable.columns` vs. a `createColumnBuilder`
array look identical at the call site; there's no type-level nudge toward
the table-definition form.

**Workaround / migration shipped:** `columns.tsx` and a new
`apps/marketing/src/lib/demo/support/db.ts` now define
`export const supportTables = betterTables({ database: drizzleAdapter(supportDb) })`
(server-only file, real `better-sqlite3` import) and `columns.tsx` builds
`ticketsTable = defineTable<typeof supportTables>()('tickets', (t) => ({ columns: [t.text('subject')...] }))`
using ONLY `import type { supportTables } from './db'` — confirmed this
type-only import pattern really does keep the DB driver out of the client
bundle (verified via `bun run build --filter=@better-tables/site`; see
report). `<BetterTable columns={ticketsTable.columns} data={...}>` — passing
`.columns` explicitly, since `<BetterTable>` still only accepts a
`ColumnDefinition[]`, not the `TableDefinition` object itself (see finding 5).

**Proposed fix:** (a) A lint rule or `@deprecated`-style JSDoc nudge on
`createColumnBuilder`/`defineColumns` pointing at `defineTable` for new
schema-backed tables (they're NOT actually deprecated — mixing styles is
explicitly supported — but a "prefer this for new code" signal would have
changed the WIP's first instinct). (b) At minimum, update the marketing
site's OWN pre-existing homepage demo (`lib/columns/user-columns.tsx`) to
the flagship API so there's a same-repo example to pattern-match, since
that's what actually happened here — the WIP copied the nearest neighbor,
which was itself pre-018.

---

## 5. `<BetterTable>` takes `columns`, not a table definition

**Tried:** After building `ticketsTable = defineTable<...>()(...)`, the
natural next step is `<BetterTable table={ticketsTable} data={...} />` —
`ticketsTable` already carries `tableName`, `columns`, and `$infer`; passing
the whole object reads as the obvious API.

**Happened:** No such prop. `BetterTableProps<TData>` (`packages/ui/src/components/table/table.tsx`)
only has `columns: ColumnDefinition<TData, unknown>[]` — a raw array, with
no accepted shape that wraps a `TableDefinition`.

**Workaround shipped:** Every `<BetterTable>` call site passes
`columns={ticketsTable.columns}` explicitly (`tickets-table-client.tsx`,
`query-groups-workspace.tsx`, `facets-workspace.tsx`) — one extra property
access, not a blocker, but it means `defineTable()`'s return value is only
partially consumed by the UI layer; `tableName` and `$infer` go unused at
the render boundary.

**Proposed fix:** Add an optional `table?: TableDefinition<string, TData>`
prop to `BetterTableProps` as sugar for `columns={table.columns}` (and
potentially default `id`/`name` from `table.tableName`), keeping `columns`
for the existing fluent-builder-array callers. Non-breaking, additive.

---

## 6. `VirtualizedTable` has no adapter/filter/sort/pagination integration — it is a bare renderer, not a virtualized `<BetterTable>`

**Tried:** For the `big-board` example (10k+ rows), the natural ask is
"the same `<BetterTable>` I already have, just virtualized" — e.g. a
`virtualized` prop or `features.virtualization` flag.

**Happened:** No such option exists on `<BetterTable>`. The only
virtualization surface is the separate `<VirtualizedTable>` component
(`packages/ui/src/components/table/virtualized-table.tsx`), whose props are
`data: T[]`, `columns: ColumnDefinition<T>[]`, `rowHeight`,
`dynamicRowHeight`, `renderCell`, `onScroll`, etc. — a pure client-side
"render this array, windowed" component with **no** `adapter`, `filters`,
`sorting`, `pagination`, or URL-sync props at all. The wiki's own
description ("integrates seamlessly with the state management ... from
`@better-tables/core`") oversells this: seamless at the row-height/scroll
calculation layer (`VirtualizationManager`), not at the data/filter/sort
layer.

**Workaround shipped:** `big-board/page.tsx` (RSC) fetches ALL rows once
server-side via `bulkTicketsTable`'s adapter (`tables.database.fetchData({ pagination: { page: 1, limit: 12000 } , sorting })`),
passes the flat array as a prop into a client component that renders
`<VirtualizedTable>` directly. Sorting is hand-built: a plain header button
row (not `<BetterTable>`'s header-context-menu sort UI) that pushes a
`sorting` URL param and re-triggers the server fetch — there is no filter
bar at all in this example, because wiring one up would mean reimplementing
`<BetterTable>`'s entire filter-state management by hand just to feed
`VirtualizedTable`'s flat `data` prop (`// DX-FINDING-6` in
`big-board-workspace.tsx`).

**Proposed fix:** Either (a) let `<BetterTable>` accept a `renderMode:
'virtualized'` (or similar) that swaps its internal `<Table>` for
`<VirtualizedTable>` under the same filter/sort/pagination/URL-sync
machinery it already owns, or (b) if `<VirtualizedTable>` is meant to stay a
separate low-level primitive on purpose, document it explicitly as
"bring your own filtering/sorting/pagination" so the next person doesn't
spend time looking for the integration that isn't there.

**Addendum, found while actually rendering the date column:** `renderCell`
receives the RAW cell value (`item[column.id]`), not a value already run
through the column's own configured formatter — the `createdAt` column's
`.dateTime({ timeZone: 'America/New_York' })` config is silently ignored
unless the caller's `renderCell` explicitly reformats it. `<BetterTable>`
applies column formatters automatically; `<VirtualizedTable>` does not. The
fix was a one-liner once found — `getFormatterForType(column.type, value,
column.meta)` (`packages/core/src/lib/format-utils.ts`, the SAME formatter
`<BetterTable>` uses internally, and already exported publicly) — but
nothing surfaces that this is necessary; a raw `Date.toString()`
(`"Wed Dec 31 2025 19:05:30 GMT-0500 (Eastern Standard Time)"`) renders with
no error, so the only way to notice is to actually look at the page.

---

## 7. Facets have no UI consumer yet — the whole sidebar is hand-built against a route handler

**Tried:** For the `facets` example, look for a `<FacetSidebar>` or
similar component in `@better-tables/ui` that takes an adapter + active
filters and renders counts.

**Happened:** Nothing exists. `getFacetedValues`/`getMinMaxValues` (`TableAdapter`,
`packages/core/src/types/adapter.ts`) are adapter METHODS with no client
component built on top of them anywhere in `packages/ui` — confirmed by
`grep`, zero references outside type definitions and the drizzle adapter's
own implementation/tests. This example is genuinely the first real runtime
consumer of `getFacetedValues`/`getMinMaxValues` end-to-end (route handler →
fetch → render), as the plan itself anticipated.

**Workaround shipped:** `src/app/api/facets/route.ts` calls
`supportTables.database.getFacetedValues(columnId, { filters })` and
`getMinMaxValues` directly, per column, and returns raw
`{ values: [string, number][] }` JSON (a `Map` isn't JSON-serializable, so
the route converts it — `// DX-FINDING-7a`). `facets-sidebar.tsx` (client)
fetches this route on every filter change and renders checkboxes + counts
by hand — no shared styling, keyboard nav, or loading-skeleton conventions
to reuse from the rest of `@better-tables/ui`, so this sidebar looks and
behaves differently from the built-in filter bar right next to it
(`// DX-FINDING-7b`).

**Proposed fix:** A `<FacetedFilterSidebar columnIds={[...]} adapter={...}
filters={...} />` component (or a `useFacets()` hook that at least
standardizes the fetch/self-exclusion/loading-state plumbing, even without
prescribing markup) would remove most of this file. Self-exclusion
correctness (the facet for the column being filtered ignores its own
filter) was confirmed to work through the route handler with ZERO extra
code on the app side — that part of the contract (§ adapter docs) held up
exactly as documented; the gap is entirely "nothing renders it," not "the
data contract is wrong."

---

## 8. Operator validity isn't type-checked against the filter's declared `type` — `equals` compiles for an option filter, then fails at RUNTIME validation

**Tried:** After fixing finding 1's shape, the natural operator for "match
this option value" reads as `equals` (it's the first, most familiar operator
name, and it's a valid `FilterOperator` — TypeScript accepts
`{ columnId: 'customer.plan', type: 'option', operator: 'equals', values: ['enterprise'] }`
with no complaint).

**Happened:** Compiles clean. At runtime, `FilterManager.validateFilter`
rejects it: `OptionColumnBuilder.options()` sets the column's allowed
`filter.operators` to `['is', 'isNot', 'isAnyOf', 'isNoneOf']`
(`packages/core/src/builders/option-column-builder.ts`) — `equals` isn't in
that list, so the validator returns
`{ valid: false, error: 'Operator equals not allowed for column customer.plan' }`.
`FilterOperator` (`packages/core/src/types/filter.ts`) is ONE flat union
across every column type, so nothing at the type layer connects `type:
'option'` to "only `is`/`isNot`/`isAnyOf`/`isNoneOf` are legal here" — MIGRATION.md
§2 specifically closed this exact class of hole for `.options()` VALUES
(`{ value: 'bogus' }` is now a compile error) but the sibling hole for
OPERATORS remains open.

**Workaround shipped:** Every preset/filter literal in this app now uses
`is`/`isAnyOf` for option columns instead of `equals` (`// DX-FINDING-8` at
each site in `relationship-trail.ts`).

**Proposed fix:** A discriminated `FilterState` variant keyed by both `type`
AND a per-type operator union (e.g. `OptionFilterState['operator']:
'is' | 'isNot' | 'isAnyOf' | 'isNoneOf'` instead of the whole flat
`FilterOperator`) would turn this into the SAME kind of compile-time catch
`.options()` already gets for values — `equals` would simply not be a legal
operator for a `type: 'option'` literal, no runtime round-trip needed to
find out.

---

## 9. Silent wrong-table data: `fetchData()` with no `columns`/`primaryTable` on a multi-table schema returns a DIFFERENT table's rows, mislabeled, with only a console.warn

**Tried:** `fetchTickets()` (and every other call site in this app) calls
`adapter.fetchData({ pagination, filters, sorting })` with no `columns` and
no `primaryTable` — this is the exact shape the pre-existing (non-WIP)
homepage demo already used successfully for a SINGLE-table-shaped call
(`fetchUsers`), so it read as the established, working pattern for this
codebase.

**Happened:** Against the support schema (`{ customers, assignees, tickets }`,
in that key order), a parameterless `fetchData({ pagination: { page: 1,
limit: 3 } })` call returns **customer rows**, not ticket rows:

```
[better-tables] No columns were provided to determine the primary table;
assuming "customers" (the first table in the schema). Pass the
`primaryTable` option to set it explicitly.
[
  { "id": 1, "name": "Northwind Labs", "company": "Northwind Labs", "plan": "enterprise", "region": "na" },
  { "id": 2, "name": "Brightline Health", ... },
  { "id": 3, "name": "Atlas Freight", ... }
]
total 6
```

`total: 6` (the customer count, not the 20-ticket seed) and every field name
(`name`, `company`, `plan`, `region`) belongs to `SupportCustomer`, not
`SupportTicket` — cast through `FetchDataResult<TicketWithRelations>` at the
call site (`fetch-tickets.ts`'s existing `as FetchDataResult<TicketWithRelations>`),
this is silently WRONG DATA typed as the right shape, with no runtime error
and only a single `console.warn` (easy to miss in a server log, and never
surfaced to the UI) as the only signal anything went wrong. This reproduced
with the real `DrizzleAdapter`/relations wiring, not a test artifact — see
the reproduction in the commit history of this file's companion test changes.
`PrimaryTableResolver.resolve(params.columns, params.primaryTable)`
(`packages/adapters/drizzle/src/drizzle-adapter.ts:425`) falls back to
"first table in the schema object" when BOTH are omitted, and "first table"
is JS key-insertion order of whatever `schema` object was handed to
`drizzleAdapter()`/`DrizzleAdapter` — an implementation detail with no
relationship to which table the caller actually means to query.

**Workaround shipped:** Every `fetchData()` call in this app now passes
`primaryTable: 'tickets'` (or `'bulkTickets'`) explicitly
(`// DX-FINDING-9` in `fetch-tickets.ts` and the facets/big-board fetch
helpers) — `FetchDataParams.primaryTable` already exists and is documented
as "recommended for clarity" (`packages/core/src/types/adapter.ts`), it was
simply never wired up in the WIP's original `fetchTickets()`, and nothing
forced that omission to surface.

**Proposed fix:** This is a correctness/safety gap, not a documentation gap
— `primaryTable` being merely "recommended" for a multi-table schema is the
wrong default risk profile for something that silently returns a different
table's data with no error. Options, roughly in order of how much they'd
have caught this specific bug: (a) make `primaryTable` REQUIRED (a thrown
`SchemaError`, mirroring MIGRATION.md §7's `defaultMutationTable` precedent
for mutations) whenever the schema has more than one table and neither
`columns` nor `primaryTable` disambiguates it — single-table schemas stay
zero-config, exactly like §7; (b) at minimum, promote the `console.warn` to
something a caller can't silently ignore in production (a typed warning on
`FetchDataResult.meta`, or throwing in a `strict`/dev mode) since a
`console.warn` on a server has no reliable path to a developer's attention
before it reaches production; (c) `betterTables()` + `defineTable()` already
know which table each query is FOR — `tables.database.fetchData(...)` called
in the context of a specific `TableDefinition` should be able to thread
`primaryTable` through automatically instead of leaving every call site to
remember it by hand.

---

## 10. A relation is silently ABSENT from the result unless its dot-path is named in `columns` — even though filtering/sorting by it worked

**Tried:** After fixing finding 9 (`primaryTable: 'tickets'`), filter by
`customer.plan` and read `ticket.customer?.plan` off the result to assert
it — filtering already proved the JOIN happens (only enterprise-plan
tickets came back), so reading the joined field off the row reads as safe.

**Happened:** `result.total` and the filtered row COUNT were correct, but
every row's `.customer` key was simply missing (`undefined`), not even
`null`:

```
expect((ticket as TicketWithRelations).customer?.plan).toBe('enterprise');
// Expected: "enterprise"
// Received: undefined
```

Passing `columns: ['subject', 'status', 'customer.plan', 'assignee.name']`
on the SAME query fixed it — every row then carried a full `customer: {...}`
and `assignee: {...}` object (not just the requested field; the whole
related row). So the adapter's JOIN is driven independently by two
different things: `filters`/`sorting` dot-paths trigger the JOIN for
WHERE/ORDER BY purposes, but `columns` dot-paths control whether that
joined data is actually SELECTed and embedded in the output rows. Omitting
`columns` (the WIP's original `fetchTickets()`, and the pre-existing
homepage demo's `fetchUsers()`) filters/sorts correctly across relations but
silently drops every relation from the result payload — which, rendered
through `TicketWithRelations`-typed cell accessors like
`accessorWithDefault((ticket) => ticket.assignee?.name)`, would have shown
blank "Assignee" cells for every row, no error, while the SLA/status/subject
columns rendered fine and the row COUNT looked correct.

**Workaround shipped:** `fetch-tickets.ts` now passes an explicit `columns`
array covering every column id `ticketColumns` can render (not just the
default-VISIBLE ones — column visibility toggling is client-side only, so
every possible column's data has to be present in the initial fetch) —
`// DX-FINDING-10` at the call site.

**Proposed fix:** This compounds finding 9's silence problem. At minimum,
`columns` should be equally "recommended for clarity" in the SAME
documentation breath as `primaryTable` (right now `columns` reads as purely
optional/performance-related — "specific columns to include" — with no hint
that omitting it also silently drops relation data, not just extra
top-level fields). Better: if a `filters`/`sorting` entry references a
relation path, the adapter already knows that relation is relevant to the
query — embedding it in the result by default (or at minimum warning, the
same way finding 9's primary-table fallback does) would make "I can filter
by it" and "I can read it off the result" consistent instead of one working
and the other silently no-op-ing.

---

## 11. `{ ...tables, ...relationsKeyedByTableName }` silently clobbers real table objects with same-named `Relations` objects — breaks `$types` for every affected table

**Tried:** `db.ts` built the schema object handed to `drizzle(sqlite, {
schema })` the same way both the WIP and the PRE-EXISTING (non-WIP)
homepage demo (`apps/marketing/src/lib/db/index.ts`) already did:

```ts
export const supportRelationsSchema = {
  customers: customersRelations,
  assignees: assigneesRelations,
  tickets: ticketsRelations,
};
// ...
drizzle(sqlite, { schema: { ...supportSchema, ...supportRelationsSchema } });
```

This shape is exactly what `@better-tables/adapters-drizzle`'s OWN
`DrizzleAdapterConfig.relations` option wants (a `Relations` object per
table, KEYED BY THE TABLE'S NAME — confirmed working via a probe passing
`relations: supportRelationsSchema` directly to `DrizzleAdapterConfig`), so
it reads as the one shape to reuse for both `drizzle()`'s own `schema` and
the adapter's `relations` option.

**Happened:** No error, no warning — just silently wrong types (and, if
anything had used drizzle's own relational query API, silently wrong
runtime queries too). `supportSchema` and `supportRelationsSchema` use the
SAME keys (`customers`, `assignees`, `tickets`) — object spread means the
LATER spread wins, so `{ ...supportSchema, ...supportRelationsSchema }`
overwrites the real `customers`/`assignees`/`tickets` TABLE objects with
their same-named `Relations` OBJECTS. Only `bulkTickets` (no matching
relations entry, so nothing to clobber it) survived as a real table.
Confirmed by forcing a type error to print the resolved catalog:

```
type Names = keyof typeof supportTables.$types.tables;
const x: Names = 'bogus-force-error';
// error TS2322: Type '"bogus-force-error"' is not assignable to type '"bulkTickets"'.
```

`defineTable<typeof supportTables>()('tickets', ...)` then failed with
`Argument of type '"tickets"' is not assignable to parameter of type
'"bulkTickets"'` — `tickets` had silently stopped being a valid table name
as far as `$types` was concerned, with no signal anywhere pointing at the
schema-merge line as the cause; the error surfaces at the `defineTable`
call site, several files away from the actual mistake.

**Workaround shipped:** `db.ts` and the test file's `fullSchema` now spread
the relation objects under THEIR OWN export names
(`{ ...supportSchema, customersRelations, assigneesRelations, ticketsRelations }`)
for `drizzle()`'s schema config, while `supportRelationsSchema`
(table-name-keyed) is kept as a SEPARATE export used only where the adapter
actually wants that shape (`DrizzleAdapterConfig.relations`) —
`// DX-FINDING-11` at both call sites.

**Proposed fix:** This is a `drizzle-orm` schema-shape footgun more than a
`@better-tables` one, but it's worth naming because it's exactly the kind of
mistake this plan's own two-shapes-for-two-purposes design invites: our
adapter's `relations` option wants table-name-keyed `Relations`, drizzle's
native `schema` wants own-named `Relations` — the SAME underlying objects,
two DIFFERENT container shapes, and nothing stops a caller from building one
shared object and handing it to both. A `drizzleAdapter()`/`DrizzleAdapter`
input-validation check that detects "a schema key holds a `Relations`
object where a table was expected" (the runtime `extractSchemaFromDB`
already classifies each value by shape) and throws a clear `SchemaError`
naming the colliding key would have caught this at construction, instead of
several call sites and files away at a `defineTable()` compile error whose
message doesn't mention schema construction at all.

Minor addendum (test-only): the drizzle package's own `bun:sqlite` test
fixtures cast to `DrizzleDatabase<TDriver>`, but that type is NOT exported
from the public `@better-tables/adapters-drizzle` package root (only
`DrizzleAdapterConfig` is) — an app-level test can't import it the same way
the package's own internal tests do, and had to derive the equivalent type
via `DrizzleAdapterConfig<TSchema, TDriver>['db']` instead
(`fetch-tickets.test.ts`).

---

## 12. `$infer.Row` (and `RowOf<...>`) includes recursive relation back-references the app never requested — a schema-derived row type that doesn't match what a specific `columns` selection actually returns

**Tried:** `export const ticketColumns = ticketsTable.columns;` — expecting
`ticketsTable.columns` (typed against `RowOf<SupportTables, 'tickets'>`,
`defineTable()`'s schema-derived row inference) to line up with
`TicketWithRelations`, the hand-declared row type `fetch-tickets.ts` and
every UI component already use for the SAME data.

**Happened:**

```
error TS2322: Type 'TicketWithRelations[]' is not assignable to type
'{ id: number; ...; customer: { name: string; id: number; company: string;
plan: "starter" | "pro" | "enterprise"; region: ...; } | { ...; tickets:
({ ... } | { ... })[]; } | ... 1 more ...; ... }[]'.
  Type 'TicketWithRelations' is not assignable to type '{ ...; customer: ...
}'.
    Types of property 'customer' are incompatible.
      Type '{ ... } | null | undefined' is not assignable to type
      '{ ... } | { ...; tickets: (...)[]; }'.
```

`tickets` and `customers` have a two-way relation
(`customersRelations: { tickets: many(tickets) }`,
`ticketsRelations: { customer: one(customers, ...) }`). `RelationAwareRow`
(`RowOf`'s underlying computation, default depth 3) walks relations
recursively: `tickets.customer.tickets.customer...`, producing a row type
where `customer` is a UNION between "customer without a back-reference" and
"customer WITH its own `tickets: Ticket[]` back-reference" depending on
recursion depth — a nested shape `fetch-tickets.ts` never actually produces
(it only requests `customer.plan`/`.company`/`.region` via `columns`, never
`customer.tickets`) and that the app's hand-declared `TicketWithRelations`
(`customer?: SupportCustomer | null`, no back-reference) doesn't match.
`$infer.Row`/`RowOf` describe "everything reachable from this table through
relations," not "the shape THIS query, with THIS `columns` selection,
actually returns" — there is no way to narrow it to match a specific fetch.

**Workaround shipped:** One explicit, audited erasure —
`ticketsTable.columns as unknown as ColumnDefinition<TicketWithRelations,
unknown>[]` (`columns.tsx`, `// DX-FINDING-12`) — bridging the
schema-derived column type to the app's own hand-shaped fetch/render type.
The underlying runtime objects are identical either way; only the static
type disagrees.

**Proposed fix:** Two independent angles: (a) cap relation-back-reference
recursion more aggressively by default, or make it opt-in (most row
consumers want the FORWARD relations they filtered/selected by, not
reverse "what points back at me" edges); (b) more fundamentally, thread the
ACTUAL `columns` selection through to a narrowed return type — e.g. a
`RowFor<TableDefinition, TSelectedColumns>` that only includes the relations
a specific `columns` array actually requests — so `$infer.Row` (or a fetch
call's return type, see finding 16) reflects what a query really returns
instead of the full relation-aware superset every time.

---

## 13. MIGRATION.md's module-scope `export const tables = betterTables({...})` pattern breaks `next build` when the adapter wraps a native DB binding

**Tried:** MIGRATION.md §1's example verbatim: `db.ts` constructed
`supportDb`/`supportTables` as top-level `export const`s (`drizzle()` itself
is synchronous, so this reads as safe — only the CREATE TABLE/seed INSERTs
are async, handled by a separate `ensureSupportDatabaseSeeded()`).

**Happened:** `bun run build --filter=@better-tables/site` failed at
`next build`'s "Collecting page data" step:

```
Error [SchemaError]: Unable to detect database driver from Drizzle instance.
Please ensure you're passing a valid Drizzle database instance, or
explicitly specify the driver:

Example:
  drizzleAdapter(db, { driver: 'postgres' })
  drizzleAdapter(db, { driver: 'mysql' })
  drizzleAdapter(db, { driver: 'sqlite' })
    at ... .next/server/app/api/tickets/route.js
Error: Failed to collect page data for /api/tickets
```

Root cause: `/api/tickets/route.ts` imports this module transitively, and
Next's build-time page-data-collection phase IMPORTS every route module to
statically analyze it — meaning a module-scope `new Database(':memory:')`
(better-sqlite3's native N-API binding) runs DURING THE BUILD, in that
collection phase's execution context, not at real request time. Something
about that context makes the resulting `Database` instance not look like a
real SQLite driver to `detectDriver()`
(`packages/adapters/drizzle/src/utils/driver-detector.ts`) — auto-detection
came back empty (`null`), even though the identical construction works fine
at real request time.

**Workaround shipped:** `db.ts` defers BOTH the native `Database`
construction AND the `betterTables()`/`drizzleAdapter()` calls into a lazy,
memoized async getter (`getSupportTables()`) instead of top-level `export
const`s — request-time construction never touches the build-time collection
phase at all (`// DX-FINDING-13`). `defineTable<SupportTables>()` in
`columns.tsx` still works against this lazy shape because it only needs
`SupportTables` as a TYPE (`ReturnType<typeof buildSupportTables>`, a type
alias exported alongside the lazy getter) — `defineTable` never touches the
runtime instance, so it doesn't matter that the real value now only exists
behind an async function.

**Why this wasn't caught by pattern-matching an existing file:** it
couldn't have been — the pre-existing (non-WIP) homepage demo
(`apps/marketing/src/lib/db/index.ts`) was ALREADY a lazy async singleton,
not the eager module-scope shape MIGRATION.md's own example shows. In
hindsight that convention wasn't a stylistic choice, it was already working
around this exact issue — but nothing says so anywhere (no comment in that
file references build-time collection, native bindings, or this failure
mode), so the flagship migration's natural first move (follow the doc
example literally) reintroduced the eager shape and broke the build.

**Proposed fix:** (a) MIGRATION.md's `betterTables()` example should note
the constraint explicitly: the `database` adapter is constructed eagerly at
`import` time under this pattern, which is fine for a real connection pool
(lazy-connects on first query) but NOT safe for an adapter whose
CONSTRUCTOR does synchronous, environment-sensitive work (opening a native
binding) — recommend the lazy-getter shape for exactly that case, the same
way this app's own pre-existing code already (silently) did. (b)
Independently, `detectDriver()`'s behavior under Next's build-time
page-data-collection phase is worth its own investigation upstream — a
`better-sqlite3` instance that detects correctly at request time but not
during that phase suggests something about the phase's execution
environment (bundling, worker isolation, or module resolution) that could
affect other native-binding-backed adapters the same way, independent of
this demo's specific lazy-vs-eager choice.

---

## 14. Auto-detected relationships silently mismatch when the SQL table name differs from the JS schema key — a `RelationshipError` for a relation that IS declared

**Tried:** `drizzleAdapter(db)` with no options, auto-detecting schema and
relationships from `db`'s internal state — the documented, "everything
auto-detected" default path (`factory.ts`'s own example:
`const adapter = drizzleAdapter(db); // Fully typed, no 'as any' needed!`).

**Happened:** Loading `/examples/relationship-filtering` in a real browser
(not just `tsc`/`bun test` — this only showed up at actual runtime):

```
Could not load ticket data: Failed to fetch data: No relationship found
from tickets to customer
```

...even though `ticketsRelations = relations(tickets, ({ one }) => ({
customer: one(customers, {...}), assignee: one(assignees, {...}) }))`
unambiguously declares exactly that relation, and the SAME relations object
worked correctly when passed EXPLICITLY (see finding 9/10's test fixture,
which passes `relations: supportRelationsSchema` directly to
`DrizzleAdapterConfig` rather than relying on auto-detection).

Root cause: this schema declares
`export const tickets = sqliteTable('support_tickets', {...})` —
the SQL table name (`'support_tickets'`) differs from the JS export key
(`tickets`), a common, idiomatic Drizzle pattern (namespacing SQL tables
while keeping short, ergonomic JS import names — this app does it for
EVERY table: `support_customers`/`customers`, `support_assignees`/`assignees`,
`support_tickets`/`tickets`). `extractSchemaFromDB`
(`packages/adapters/drizzle/src/utils/schema-extractor.ts`) keys
`result.tables` by the SCHEMA OBJECT KEY (`'tickets'`) when it walks the
plain table entries, but keys `result.relations` by
`Symbol.for('drizzle:Name')` (`'support_tickets'`, the real SQL name) when
it walks a `relations()` entry — confirmed directly:

```ts
(tickets as unknown as Record<symbol, unknown>)[Symbol.for('drizzle:Name')]
// => 'support_tickets'
```

The two extracted maps end up keyed INCONSISTENTLY with each other
(`tables['tickets']` vs. `relations['support_tickets']`), so relationship
lookup for primary table `'tickets'` finds nothing under that key, and the
adapter reports the relation as missing even though it's declared and
correctly attached to the right table object.

**Workaround shipped:** `db.ts` passes `schema`/`relations` EXPLICITLY to
`drizzleAdapter(db, { schema: supportSchema, relations: supportRelationsSchema })`
instead of relying on auto-detection from `db` — this bypasses the
symbol-based re-derivation entirely; both options are used AS GIVEN, keyed
by schema object key throughout, with no mismatch (`// DX-FINDING-14`).

**Proposed fix:** `extractSchemaFromDB`'s two branches should key
`result.tables` and `result.relations` the SAME way — either both by schema
object key (simplest; the JS key is always what callers actually reference
in `columns`/`filters`/`primaryTable` anyway) or both by the resolved SQL
name consistently. Given SQL-name-vs-JS-key divergence is a common,
encouraged pattern (this app uses it universally), defaulting to schema-key
consistency seems safer. This is arguably the highest-value fix in this
findings file: it makes the FULLY automatic, zero-config `drizzleAdapter(db)`
path — the one the docs lead with — silently wrong for a normal, common
schema shape, with an error message ("No relationship found from tickets to
customer") that reads as "you forgot to declare this relation," actively
misleading a caller who correctly declared it.

---

## 15. Filter chips don't reappear after a client-side (soft) navigation to a new filter URL, even though the fetched data and other UI both update correctly

**Tried:** Any client-side URL change to a table's `filters` param via
`urlAdapter.setParams(...)` (Next.js `router.push` — a soft navigation, not
a full page load) while the page stays mounted: (a) clicking a scenario
preset button on `/examples/relationship-filtering` for "Enterprise
escalations" (`customer.plan is enterprise AND status is escalated`, an AND
`FilterGroupNode`); (b) clicking a facet checkbox on `/examples/facets`
("escalated" under Status — a single FLAT `FilterState`, no group at all).
Expect the built-in `<BetterTable>` filter bar to show the matching chip(s),
the same way a fresh page load at the resulting URL does.

**Happened:** Confirmed for BOTH cases via a real browser. After clicking
"Enterprise escalations": the table data was correctly filtered (3 of 20
tickets), the hand-built "Query trail" sidebar correctly showed
"customer.plan is enterprise" — but the `<BetterTable>` filter bar showed no
chips, just "Add filter", as if nothing were active. After clicking the
"escalated" facet checkbox on the FACETS page (confirming this is NOT
group-specific): `window.location.href` correctly gained
`?filters=c2:...&page=1`, the table correctly narrowed to 3 escalated
tickets, the OTHER facets correctly self-excluded/re-narrowed (Priority:
high 1, urgent 2; Customer plan: enterprise 3; Reopens: 3–4) — but the
`<BetterTable>` filter bar again showed "No filters active." In both cases,
navigating to the EXACT SAME URL via a fresh/hard page load DID show the
correct chip(s), confirming the URL and the deserialized filter state are
both correct — only the SOFT-navigation path fails to update the filter
bar's own chip display.

**Root cause, not group-specific:** confirmed independent of whether the
filter is flat or a `FilterGroupNode` — this is a general soft-navigation /
`useTableUrlSync` re-hydration gap, not something plan 029's group-filtering
work introduced or is specific to.

**Workaround shipped:** None applied to the app code — this is a report-only
finding since I could not isolate a root cause precise enough to safely work
around without risking a wrong fix (e.g. forcing a hard navigation for every
preset/facet click would fix the chip display but defeat the point of
`useTableUrlSync` and would need packages/ui changes to do properly anyway,
which is out of scope). Documented here so the maintainer can reproduce:
click "Enterprise escalations" on `/examples/relationship-filtering`, OR
click any facet checkbox on `/examples/facets`, and compare against a hard
reload of the resulting URL.

**Proposed fix:** Worth a targeted investigation in `useTableUrlSync`'s
hydration effect (`packages/ui/src/hooks/use-table-url-sync.ts`) —
specifically whether its effect dependency array re-runs `hydrateFromUrl` on
every `searchParams` change from a Next.js `router.push`-driven soft
navigation, or only on mount. If it only runs on mount, `initialFilters`
correctly seeds the FIRST render (matching the hard-reload case) but nothing
re-syncs the store on subsequent client-side URL changes to the SAME
mounted table id — which would explain exactly this symptom, independent of
whether the filters are flat or a group.

---

## 16. No way to get a table-scoped, typed `fetchData()` — every call returns `FetchDataResult<unknown>`, needing a manual cast to the table's own inferred row type

**Tried:** After `ticketsTable = defineTable<SupportTables>()('tickets', ...)`,
the natural expectation is that fetching through the SAME flagship instance
returns data already typed as `ticketsTable.$infer.Row` — the whole point of
`defineTable()` computing that type in the first place.

**Happened:** `supportTables.database` is a single, generic
`SchemaAwareAdapter`-typed adapter instance shared by EVERY table in the
schema (`customers`, `assignees`, `tickets`, `bulkTickets`) — `.fetchData()`
has no per-call generic parameter tying a specific call to a specific
table's row type, so it always returns `FetchDataResult<unknown>`. Every
fetch helper in this app (`fetch-tickets.ts`, `fetch-bulk-tickets.ts`,
the pre-existing `fetch-users.ts`) ends with a manual
`as FetchDataResult<TicketWithRelations>` (or the equivalent for its own
row type) to recover a usable type — `defineTable()` computed the exact
right type (`$infer.Row`) but there's no ergonomic path from "I have a
`TableDefinition`" to "calling fetchData through it returns that type."

**Workaround shipped:** Manual `as FetchDataResult<TRow>` casts at every
fetch call site (`// DX-FINDING-16` in `fetch-tickets.ts`,
`fetch-bulk-tickets.ts`, `fetch-users.ts`).

**Proposed fix:** A typed convenience on `TableDefinition` itself --
e.g. `ticketsTable.fetchData(tables, params)` (or
`tables.database.fetchData<TRow>(params)` with an explicit generic) that
returns `FetchDataResult<TableDefinition['$infer']['Row']>` without a manual
cast, reusing the SAME `$infer.Row` computation `defineTable()` already did
at definition time instead of asking every call site to restate the target
type by hand.

---

## 17. `FilterState.values` (a discriminated union field) can't be used generically without narrowing by `type` first — even for simple value-equality checks

**Tried:** Given an array of `FilterState[]`, check whether a specific
`(columnId, value)` pair is already an active filter:
`activeFilters.some((f) => f.columnId === columnId && f.values.includes(value))`.

**Happened:**

```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'never'.
```

`FilterState` is a discriminated union (`TextFilterState | NumberFilterState
| ... `), and each member's `values` field has a DIFFERENT element type
(`string[]`, `number[]`, `boolean[]`, `(Date | string | number)[]`, ...).
Without narrowing `f` by `f.type` first, TypeScript can only offer the
INTERSECTION of every member's `values` element type for a generic
`.includes()` call, which collapses to `never` — even though every branch's
runtime behavior (array membership check against a caller-supplied string)
is identical and type-safe in practice for the option/text columns this
sidebar cares about.

**Workaround shipped:** `(f.values as unknown[]).includes(value)`
(`facets-sidebar.tsx`, `// DX-FINDING-17`) — a narrow, deliberate cast
rather than a `switch` over every `FilterState` member just to satisfy the
type checker for a single generic comparison. The SAME root issue (a leaf
literal's `values` array needing a specific member type inferred from a
non-literal `type` variable) also required
`{ columnId, type: config.type, operator: 'is', values: [value] } as FilterState`
when constructing a NEW filter from a generic `FacetColumnConfig` — see
finding 1 for the broader "restating the column's type" pattern this
compounds.

**Proposed fix:** A generic `FilterState<TType extends ColumnType =
ColumnType>` helper, or a standalone `filterHasValue(filter: FilterState,
value: unknown): boolean` utility exported from the library, would remove
the need for every consumer to independently rediscover this cast for what
is a common, simple operation (checking whether a filter already targets a
given value).

---

## Summary

| # | Area | Kind |
|---|---|---|
| 1 | Filter-group literal shape (`kind`/`logic`, bare typed leaves) | Confirmed WIP bug, error message misleading |
| 2 | `filter.id` doesn't exist | Confirmed real gap (no stable per-filter identity) |
| 3 | Hand-rolled `lz-string` vs. built-in `serializeTableStateToUrl` | Discoverability gap, not a missing capability |
| 4 | Old `createColumnBuilder`/`defineColumns` entry style vs. flagship `betterTables`/`defineTable` | Discoverability + no in-repo example to copy |
| 5 | `<BetterTable>` takes `columns`, not a `TableDefinition` | Minor friction, additive fix available |
| 6 | `VirtualizedTable` has no adapter/filter/sort/pagination integration | Real gap, needs explicit scope decision |
| 7 | No UI consumer for `getFacetedValues`/`getMinMaxValues` | Real gap; data contract itself verified correct |
| 8 | Operator/type mismatch not caught at compile time (`equals` on an option filter) | Real gap, same shape as an already-fixed `.options()` hole |
| 9 | `fetchData()` silently returns the WRONG TABLE'S rows when `primaryTable`/`columns` are both omitted on a multi-table schema | **Correctness/safety bug** -- silent wrong data, only a `console.warn` |
| 10 | A relation is silently ABSENT from result rows unless its dot-path is named in `columns`, even though filtering/sorting by it works | **Correctness/safety bug** -- silent missing data, no warning at all |
| 11 | `{ ...tables, ...relationsKeyedByTableName }` silently clobbers real table objects, breaking `$types` for every affected table | drizzle-orm schema-shape footgun, invited by two shapes wanting the same object; no validation catches it |
| 12 | `$infer.Row`/`RowOf` includes recursive relation back-references never requested via `columns`, mismatching the app's own hand-shaped row type | Schema-derived type describes "everything reachable," not "what this query returns" |
| 13 | MIGRATION.md's module-scope `betterTables()` pattern breaks `next build` when the adapter wraps a native DB binding (build-time page-data collection runs the constructor) | **Real gap** -- doc pattern unsafe for this class of adapter; pre-existing demo code already worked around it silently |
| 14 | Auto-detected relationships silently mismatch (`tables` keyed by schema key, `relations` keyed by SQL table name) whenever a table's JS export name differs from its SQL name | **Highest-value fix candidate** -- breaks the fully-automatic `drizzleAdapter(db)` path for a common, encouraged schema pattern, with a misleading error message |
| 15 | Filter chips don't reappear after a soft (client-side) navigation to a new filter URL, though data and other UI both update correctly | Confirmed for BOTH a group preset and a flat facet click -- general soft-nav gap, not group-specific |
| 16 | No table-scoped, typed `fetchData()` -- every call returns `FetchDataResult<unknown>`, needing a manual cast to the table's own `$infer.Row` | Ergonomics gap; `defineTable()` already computed the right type |
| 17 | `FilterState.values` (discriminated union) can't be used generically (e.g. `.includes()`) without narrowing by `type` first | Minor type-ergonomics friction, same shape as finding 1 |
