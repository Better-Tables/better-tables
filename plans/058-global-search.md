# Plan 058: Ship global search as sugar over the filter pipeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/core/src/types/adapter.ts packages/core/src/types/factory.ts packages/core/src/factory.ts packages/ui/src packages/cli/src/lib/file-operations.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M-L
- **Risk**: MED (touches the fetch path and the copied-UI manifest; mitigated by reusing the existing filter pipeline instead of new query machinery)
- **Depends on**: none (parallel-safe with 057, which explicitly leaves `FetchDataParams.search` to this plan)
- **Category**: direction
- **Planned at**: commit `27c59b9`, 2026-07-20

## Why this matters

A search box is the single most-expected control on a data table, and the
contract has promised one since day one: `FetchDataParams.search?: string`
(`packages/core/src/types/adapter.ts:55`, "Global search query"). Nothing
consumes it — not the Drizzle adapter
(`grep -n "params.search" packages/adapters/drizzle/src/drizzle-adapter.ts`
→ nothing), not the memory adapter, not the UI (the only "search" in
`packages/ui/src/components/filters/filter-bar.tsx:74` is the
column-picker's internal search). The docs currently teach that
`.searchable()` "does not add the column to a separate global search"
(`apps/marketing/content/docs/filtering.mdx:64`).

The key insight this plan is built on: **global search needs no new query
machinery**. "Search for q" is exactly `OR(contains(col, q) for each
searchable column)` — a `FilterGroupNode` — ANDed with the existing
filters. Both first-party adapters already execute arbitrary
`FilterGroupNode` trees (Drizzle group translation landed in plan 017;
`memoryAdapter`'s `matchesNode` walks trees), relation-path columns already
JOIN through the filter path, and the HTTP wire already carries trees. So
search becomes: one pure helper in core, desugaring at the two entry points
that know the column definitions, one small UI input, URL sync of a plain
string.

## Current state

Verified at `27c59b9`:

- `packages/core/src/types/adapter.ts:54-55` —

  ```ts
    /** Global search query */
    search?: string;
  ```

  Adapter-level, unconsumed. This plan REMOVES it from the adapter contract
  (adapters never see "search"; they see filters) and adds sugar at the
  layers that own column definitions.

- `packages/core/src/types/factory.ts:207` —
  `export type TableScopedFetchDataParams = Omit<FetchDataParams, 'primaryTable'>;`
  — the params type for `tables.fetchData(tableDef, params)`. The instance
  fetch path, `packages/core/src/factory.ts:112-120`:

  ```ts
  instance.fetchData = (async (
    table: TableDefinition<string, unknown>,
    params?: TableScopedFetchDataParams
  ) => {
    return asTableAdapter(config.database).fetchData({
      ...params,
      primaryTable: table.tableName,
    });
  }) as unknown as BetterTablesInstance<TAdapter>['fetchData'];
  ```

  This is the choke point that HAS the table definition (`table.columns`) —
  the right place to desugar `search` for server-side callers.

- Filter shapes: `FilterState` / `FilterGroupNode` in
  `packages/core/src/types/filter.ts`; a bare `FilterState[]` is implicit
  AND, `{ kind: 'group', logic: 'or' | 'and', children }` nests
  (`packages/core/src/types/adapter.ts:42-52` documents that adapters must
  accept both shapes — core does NOT canonicalize).

- `.searchable()` semantics today: text-family filter sugar. Column defs
  carry `searchable?: boolean` (see `packages/core/src/types/column.ts`) and
  builders set it via `.searchable(config?)`. The homepage demo marks
  `profile.bio`, `profile.location` etc. searchable
  (`apps/marketing/src/lib/columns/user-columns.tsx`).

- UI composition points:
  - `packages/ui/src/components/table/table.tsx` — `BetterTableInner`
    renders `<FilterBar ...>` and builds adapter fetch params through
    `packages/ui/src/hooks/use-table-data.ts`.
  - The table store (`getOrCreateTableStore`, core `stores/table-store.ts`)
    holds `filters`; search should be SEPARATE state (it must not render as
    a removable chip in `active-filters.tsx`).
  - URL sync: `packages/ui/src/hooks/use-table-url-sync.ts` +
    `UrlSyncConfig` and `serializeTableStateToUrl` /
    `deserializeTableStateFromUrl` in core (`packages/core/src/utils/`).
    Simple values (page/limit) are plain string params — search follows
    that pattern (param name `search`, plain string, no `c:` compression).

- CLI copy manifest: `packages/cli/src/lib/file-operations.ts`
  `UI_SOURCE_FILES` — any new file under `packages/ui/src` MUST be added
  there; `packages/cli/tests/ui-source-manifest.test.ts` fails on any drift
  in either direction (this is deliberate — let it guide you).

- Docs to update (all under `apps/marketing/content/docs/`):
  `filtering.mdx:64` (the "does not add to a global search" note),
  `better-table.mdx` (props reference), `columns/index.mdx` (`.searchable()`
  row), `adapters/custom.mdx:37` (the "`search` param is declared on the
  contract but not yet consumed" sentence — the param will be GONE from the
  contract).

- Conventions: changesets in `.changeset/*.md` (`@better-tables/core`
  minor — contract change in the 0.6 window; `@better-tables/cli` patch for
  the manifest). Tests: core in `packages/core/tests/`, UI in
  `packages/ui/tests/` (component-test pattern:
  `packages/ui/tests/components/table-initial-filter-tree.test.tsx`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Core tests | `cd packages/core && bun test` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| CLI tests (manifest drift) | `cd packages/cli && bun test` | all pass |
| Drizzle sqlite tests | `cd packages/adapters/drizzle && bun test` | all pass (pg/mysql suites skip without env) |
| Typecheck | `bun run typecheck` | exit 0 |
| Live check | `cd apps/marketing && bun run dev` → type in the search box on `/` | rows narrow; URL gains `?search=` |

## Scope

**In scope**:
- `packages/core/src/types/adapter.ts` (remove `search` from
  `FetchDataParams`)
- `packages/core/src/types/factory.ts` + `packages/core/src/factory.ts`
  (add `search?: string` to the TABLE-SCOPED params; desugar in
  `instance.fetchData`)
- `packages/core/src/utils/` (new `build-search-filter-group.ts` + barrel
  export; URL serialization of `search`)
- `packages/core/src/stores/table-store.ts` + state types (a `searchQuery`
  field with setter, separate from `filters`)
- `packages/ui/src/components/filters/search-input.tsx` (new),
  `packages/ui/src/components/filters/index.ts`,
  `packages/ui/src/components/table/table.tsx`,
  `packages/ui/src/hooks/use-table-data.ts`,
  `packages/ui/src/hooks/use-table-url-sync.ts`
- `packages/cli/src/lib/file-operations.ts` (manifest)
- Tests in core/ui/cli/drizzle; docs pages listed above;
  `.changeset/global-search.md`; `plans/README.md`

**Out of scope** (do NOT touch):
- Adapter query builders — Drizzle and memory MUST work unchanged; if they
  don't, the design premise failed (see STOP conditions).
- `packages/core/src/adapters/http-*` — the wire carries filters; search
  never crosses it as a distinct field.
- Filter-bar chips (`active-filters.tsx`) — search is not a chip.
- Fuzzy matching, ranking, highlighting — out of v1; `contains` only.

## Git workflow

- Branch: current working branch unless the operator says otherwise; plain
  imperative commit subjects (`Add global search over the filter pipeline`).

## Steps

### Step 1: Core helper — `buildSearchFilterGroup`

New `packages/core/src/utils/build-search-filter-group.ts`:

```ts
export function buildSearchFilterGroup(
  columns: ReadonlyArray<Pick<ColumnDefinition, 'id' | 'type' | 'searchable'>>,
  query: string
): FilterGroupNode | null
```

Behavior: trim `query`; return `null` for empty. Include columns where
`searchable` is truthy AND `type` is in the text family
(`text | email | url | phone`). Return
`{ kind: 'group', logic: 'or', children: [{ columnId, type: 'text', operator: 'contains', values: [query] }, …] }`.
Return `null` when no columns qualify. Export from the core barrel.

**Verify**: `cd packages/core && bun test tests/utils/` → new unit tests
pass (cases: empty query → null; no searchable columns → null; mixed types
→ only text-family included; relation-path ids pass through untouched).

### Step 2: Move `search` from the adapter contract to the table-scoped sugar

1. Delete `search?: string` from `FetchDataParams`
   (`types/adapter.ts:54-55`).
2. In `types/factory.ts`, extend the table-scoped params:
   `export type TableScopedFetchDataParams = Omit<FetchDataParams, 'primaryTable'> & { search?: string };`
3. In `factory.ts` `instance.fetchData`: if `params.search` is non-empty,
   build the group from `table.columns` via `buildSearchFilterGroup`; when
   it returns non-null, AND it with existing filters:
   - no existing filters → pass the OR-group directly;
   - existing `FilterState[]` → `{ kind: 'group', logic: 'and', children: [...existing, orGroup] }`;
   - existing `FilterGroupNode` → `{ kind: 'group', logic: 'and', children: [existing, orGroup] }`.
   Strip `search` before delegating to the adapter (adapters must never
   receive it).

**Verify**: `bun run typecheck` → exit 0 (proves nothing else consumed the
adapter-level field). New core test: `betterTables({ database: memoryAdapter(rows) })`
+ a table def with one searchable text column — `tables.fetchData(def, { search: 'ali' })`
returns only matching rows, and combining `search` with an existing filter
narrows further (AND semantics).

### Step 3: Store state + UI input

1. Table store: add `searchQuery: string` + `setSearchQuery(q)` (kept
   SEPARATE from `filters` so chips don't render it). Follow the existing
   store-field pattern in `packages/core/src/stores/table-store.ts`.
2. New `packages/ui/src/components/filters/search-input.tsx`: a debounced
   input (reuse `packages/ui/src/hooks/use-debounce.ts`, default 300ms)
   bound to the store's `searchQuery`; placeholder "Search…"; renders only
   when at least one column qualifies per `buildSearchFilterGroup`'s rules
   (export a tiny `hasSearchableColumns(columns)` alongside the helper or
   compute inline).
3. `table.tsx`: render `<SearchInput/>` in the toolbar row next to
   `<FilterBar/>` when `filtering` is enabled and searchable columns exist.
4. `use-table-data.ts`: when building adapter fetch params, merge
   `searchQuery` into `filters` using `buildSearchFilterGroup` + the same
   AND-composition as Step 2 (client-side the adapter gets FILTERS ONLY —
   this is what keeps `httpAdapter` working with zero wire changes).
5. Add the new file to `UI_SOURCE_FILES` in
   `packages/cli/src/lib/file-operations.ts` (filters group, alphabetical).

**Verify**: `cd packages/cli && bun test` → the manifest drift test passes.
`cd packages/ui && bun test` → new component test passes: render
`BetterTable` with a searchable column + `memoryAdapter`-style data flow
(follow `packages/ui/tests/components/table-initial-filter-tree.test.tsx`
for scaffolding), type into the search input, assert the displayed rows
narrow and that NO chip appears in the active-filters region.

### Step 4: URL sync

- `UrlSyncConfig` gains `search?: boolean`.
- `serializeTableStateToUrl`/`deserializeTableStateFromUrl` +
  `use-table-url-sync.ts`: plain string param named `search` (match the
  page/limit plain-param pattern; no `c:` prefix), hydrating the store's
  `searchQuery` and included in the URL signature so back/forward works.

**Verify**: core serialization round-trip test (`search` in →
serialized param → deserialized out); UI url-sync test if the existing
suite covers flags (pattern: whatever `use-table-url-sync` tests exist —
if none cover flags, the core round-trip test suffices; note that in your
report).

### Step 5: Drizzle proof (no adapter changes)

Add ONE integration test in `packages/adapters/drizzle/tests/` (sqlite
suite pattern): a table-scoped `tables.fetchData(def, { search })` where the
searchable set includes a RELATION path (e.g. `customer.company`) — assert
matching rows return and the JOIN happened (existing sqlite suites show how
to seed + assert; model after the relationship-filtering tests).

**Verify**: `cd packages/adapters/drizzle && bun test` → passes with zero
`src/` changes in the drizzle package (`git status packages/adapters/drizzle/src` → clean).

### Step 6: Docs + changesets + ledger

- `filtering.mdx`: replace the ":64" note — `.searchable()` now ALSO opts
  the column into global search; add a short "Search" section showing the
  UI box, `tables.fetchData(def, { search })`, and the
  `buildSearchFilterGroup` recipe for raw-adapter callers.
- `better-table.mdx`: document the search box + store field + URL flag.
- `columns/index.mdx`: update the `.searchable()` row.
- `adapters/custom.mdx:37`: replace the "declared but not consumed"
  sentence — the adapter contract has NO search field; adapters receive
  filters.
- Changesets: `@better-tables/core` **minor** (removes
  `FetchDataParams.search`, adds table-scoped `search` sugar + helper +
  store field + URL flag); `@better-tables/cli` **patch** (manifest).
- Update this plan's row in `plans/README.md`.

**Verify**: `grep -rn "FetchDataParams" apps/marketing/content/docs/ | grep -i search`
→ no stale claims; `bunx biome check .changeset/` clean.

## Test plan

- Core: helper unit tests (Step 1); factory desugar + AND-composition tests
  against `memoryAdapter` (Step 2 — this doubles as the memory-adapter
  proof); URL round-trip (Step 4).
- UI: search-input interaction test (Step 3), no-chip assertion.
- CLI: manifest drift test already exists — it enforces Step 3.5.
- Drizzle: one relation-path search integration test (Step 5).
- Patterns: `packages/core/tests/utils/filter-serialization.test.ts`,
  `packages/ui/tests/components/table-initial-filter-tree.test.tsx`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "search" packages/core/src/types/adapter.ts` → no `search?:` field on `FetchDataParams`
- [ ] `tables.fetchData(def, { search })` narrows rows via `memoryAdapter` in a passing core test
- [ ] UI search box renders, narrows rows, produces no filter chip (passing UI test)
- [ ] Drizzle relation-path search test passes with `git status packages/adapters/drizzle/src` clean
- [ ] `cd packages/cli && bun test` passes (manifest updated)
- [ ] `bun run typecheck` exit 0; core/ui/drizzle suites pass
- [ ] Both changesets exist; docs greps clean; `plans/README.md` updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2's typecheck reveals a real consumer of adapter-level
  `params.search` (drift since `27c59b9`).
- The Drizzle relation-path search test FAILS without adapter changes —
  that falsifies the "search is pure filter sugar" premise (most likely a
  group-translation gap); report the failing SQL/error instead of patching
  the adapter ad hoc.
- The store change requires modifying `FilterManager`'s filter semantics —
  search state must stay OUTSIDE the filter tree; if it can't, the design
  needs review.
- Debounce/urlsync interactions cause update loops (watch
  `use-table-url-sync`'s hydration guard) — report rather than adding
  effect workarounds.

## Maintenance notes

- Search quality upgrades (per-column operator overrides, number/date
  coercion, ranking, ILIKE vs LIKE tuning) all happen INSIDE
  `buildSearchFilterGroup` or the adapters' existing `contains` handling —
  the composition contract (OR-group ANDed with filters) should not change.
- Plan 059's module system may later move the search input into an optional
  module; it composes the same way (it's one component + store field).
- Reviewer scrutiny: the AND-composition in both desugar sites must be
  identical (consider extracting `composeSearchIntoFilters(filters, group)`
  used by both factory and use-table-data); adapters receiving a `search`
  key is a contract leak.
