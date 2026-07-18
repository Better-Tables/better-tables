# Plan 040: Adapter performance — transformer memoization, bounded cache, facet LIMIT

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP condition, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/adapters/toolkit/src/data-transformer.ts packages/adapters/drizzle/src/utils/drizzle-schema-utils.ts packages/adapters/toolkit/src/relationship-manager.ts packages/adapters/drizzle/src/drizzle-adapter.ts packages/adapters/drizzle/src/query-builders/base-query-builder.ts packages/core/src/types/adapter.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (facet LIMIT is a behavior change; cache eviction changes memory profile)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decision (2026-07-17)**: facet value queries default to
  **top-100 by count desc**, with an explicit opt-out (`limit: null`) and a
  per-call `limit` override. Behavior change lands in the 0.6 window,
  documented in MIGRATION.

## Why this matters

Three algorithmic/architectural costs on the adapter's hot path:

- **PERF-01**: the flat→nested transformer recomputes per-row and
  per-related-record values that are pure functions of the static schema —
  `resolveColumnPath`, `getPrimaryKeyName`, `getColumnNames`,
  `getTableColumns` (which runs `Object.entries` + fresh allocations every
  call, uncached). For R rows × C relationship columns × up to N related
  rows, that's O(R·C) path re-resolves and O(R·N) schema re-introspections
  per page of every relational query.
- **PERF-05**: the Drizzle query-result cache is unbounded — default-on,
  5-min TTL that only blocks stale *hits* (never deletes), cleared wholesale
  only on writes. On a long-lived server with URL-varied filters it accretes
  one entry per param combination and never shrinks.
- **PERF-06**: facet value queries (`buildAggregateQuery`,
  `buildFilterOptionsQuery`) have no LIMIT — a high-cardinality facet
  (customer/email/city) computes and ships every distinct value on every
  refresh, over HTTP (compounding PERF-03).

## Current state

Verified at `787a816`:

- `packages/adapters/toolkit/src/data-transformer.ts:128-133` —
  `for (const [, records] of groupedData) { ... buildNestedRecord(records, ...) }`
  (per output row). Inside: `:462`, `:546`, `:729`
  `relationshipManager.resolveColumnPath(columnId, primaryTable)`
  (invariant across rows); `:878` `getPrimaryKeyName(relatedTableSchema)`
  **inside** the `for (const record of records)` loop of
  `processOneToManyColumn`; `:816`, `:943` `getColumnNames(...)` per related
  record.
- `packages/adapters/drizzle/src/utils/drizzle-schema-utils.ts:106-135` —
  `getTableColumns` runs `Object.entries(tableObj)` and allocates a fresh
  `ColumnInfo[]` every call; not memoized.
- `packages/adapters/toolkit/src/relationship-manager.ts:109`
  `resolveColumnPath` — `joinPathCache` covers only multi-level paths, not
  1-/2-part.
- `packages/adapters/drizzle/src/drizzle-adapter.ts`: `:154`
  `private cache: Map<...>`; `:1439-1448` `setCache` (TTL default 300000,
  on unless `options.cache.enabled === false`); `:1454-1457` `isCacheExpired`
  (blocks stale hit, never deletes); `:1460-1462` `invalidateCache` =
  `cache.clear()`. No max-size / LRU / sweep.
- `packages/adapters/drizzle/src/query-builders/base-query-builder.ts:561`
  (`buildAggregateQuery` → `.groupBy(column).orderBy(column)`) and `:606`
  (`buildFilterOptionsQuery`) — no `.limit()`.
  `FacetQueryParams` is at `packages/core/src/types/adapter.ts:191-200`
  (only `filters?`).
- There is an existing core perf gate (~208k instructions / 1.0s budget per
  the ledger) — find and re-run it after changes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build deps | `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit` | exit 0 |
| Toolkit tests | `cd packages/adapters/toolkit && bun test` | pass |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | SQLite green |
| Perf gate | (locate the core benchmark test the ledger cites, run it) | within budget |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/adapters/toolkit/src/data-transformer.ts`
- `packages/adapters/drizzle/src/utils/drizzle-schema-utils.ts`
- `packages/adapters/toolkit/src/relationship-manager.ts` (1-/2-part path cache — optional if the transformer precompute covers it)
- `packages/adapters/drizzle/src/drizzle-adapter.ts` (cache eviction)
- `packages/adapters/drizzle/src/query-builders/base-query-builder.ts` (facet LIMIT)
- `packages/core/src/types/adapter.ts` (`FacetQueryParams.limit`)
- tests in toolkit + drizzle; `.changeset/*.md`; `MIGRATION.md` (facet note); `plans/README.md`

**Out of scope**:
- Client-side facet dedup/caching over HTTP (plan 041).
- Rewriting the transformer's algorithm — only hoist/memoize invariants.
- Changing count/data query agreement (verified sound; don't touch).

## Git workflow

- Branch: `adapter-performance`; commits `Plan 040 Step N: …`.

## Steps

### Step 1: Memoize `getTableColumns` by table identity

In `drizzle-schema-utils.ts`, wrap `getTableColumns` in a
`WeakMap<object, ColumnInfo[]>` keyed on the table object — return the cached
array (treat it as immutable; do not mutate the returned array downstream —
verify callers don't). Pure schema-derived data, so behavior is identical.

**Verify**: drizzle SQLite tests pass; add a micro-assertion that two calls
with the same table return the same reference.

### Step 2: Precompute per-query invariants in the transformer

In `transformToNestedStructure` (the function containing the `:128` group
loop), resolve each requested column's `ColumnPath` and each related table's
primary-key name / column-name list ONCE before the group loop, into maps
keyed by columnId / table. Pass those into `buildNestedRecord` /
`processColumn` / `processOneToManyColumn` instead of re-resolving per row and
per related record (`:462/:546/:729/:816/:878/:943`). Keep the resolution
logic identical — only move it out of the loops.

**Verify**: toolkit tests pass unchanged (the nested output must be
byte-identical — these are pure hoists). If any test output changes, STOP.

### Step 3: Bound the Drizzle cache

Add an LRU cap + expired-entry deletion:
- Introduce a max-entries option (default e.g. 500) on the cache config.
- On `setCache`, if at capacity, evict the least-recently-used entry.
- On read (`getFromCache`/`isCacheExpired`), delete the entry when expired
  instead of leaving it resident, and mark it most-recently-used on a hit.
Keep the public cache semantics (a valid hit still returns the cached value;
writes still `invalidateCache`).

**Verify**: drizzle tests pass; add a test that inserting > max distinct
param keys keeps `cache.size` ≤ max, and that an expired entry is deleted on
access.

### Step 4: Facet LIMIT default top-100

- `packages/core/src/types/adapter.ts` — add to `FacetQueryParams`:
  `limit?: number | null` (JSDoc: default top-100 by count desc; `null`
  disables the cap; number overrides).
- `base-query-builder.ts` `buildAggregateQuery` / `buildFilterOptionsQuery`
  — order by count desc and apply `.limit(resolvedLimit)` unless `limit`
  is `null`. Default `resolvedLimit = 100`. Preserve the existing
  filter self-exclusion / distinct-under-joins behavior.
- Thread `limit` from `FacetQueryParams` through the adapter's facet methods
  to the query builders.

**Verify**: drizzle SQLite tests pass; add a test seeding > 100 distinct
values → default returns 100 ordered by count desc; `limit: null` returns
all; `limit: 5` returns 5.

### Step 5: MIGRATION note + changesets + perf gate + ledger

- `MIGRATION.md`: a short section — facet value queries now default to
  top-100 by count; pass `limit: null` for the old return-everything
  behavior.
- Changesets: `@better-tables/core` (minor — `FacetQueryParams.limit`),
  `@better-tables/adapters-toolkit` + `@better-tables/adapters-drizzle`
  (patch — transformer/cache/facet perf + facet cap).
- Re-run the core perf gate; confirm within budget. Update the plan 040 row.

## Test plan

- Toolkit: transformer output unchanged (Step 2 is a pure hoist — existing
  suite is the guard); same-reference `getTableColumns` (Step 1).
- Drizzle: cache bound + expired deletion (Step 3); facet limit default /
  null / override (Step 4).
- Perf gate re-run confirms no regression (should improve on relational
  fetches).
- Patterns: `packages/adapters/drizzle/tests/*` facet + cache suites.

## Done criteria

- [ ] `grep -n "WeakMap" packages/adapters/drizzle/src/utils/drizzle-schema-utils.ts` → match
- [ ] Transformer resolves paths/pk-names before the group loop (grep for the precompute maps); toolkit tests pass with identical output
- [ ] Drizzle cache has a max-size + LRU eviction + expired-delete; a size-cap test passes
- [ ] `FacetQueryParams.limit` exists; facet default = top-100, `null` = all, number overrides (tests pass)
- [ ] `MIGRATION.md` documents the facet default; changesets for core+toolkit+drizzle exist
- [ ] Perf gate within budget; `bun run typecheck` exit 0
- [ ] No out-of-scope files modified; `plans/README.md` updated

## STOP conditions

- Step 2's hoist changes any transformer test's output — the resolution
  isn't actually row-invariant somewhere; report before forcing it.
- The facet LIMIT interacts badly with the self-exclusion/distinct join logic
  (counts change unexpectedly under joins) — report; the cap must not alter
  which rows are counted, only how many distinct values are returned.
- Cache eviction changes a cache-hit test's expectation in a way that implies
  a correctness change rather than just capacity.

## Maintenance notes

- PERF-03 (plan 041) adds client-side facet dedup/caching over HTTP — it
  composes with the top-100 cap (smaller payloads to dedup).
- The `getCacheKey` uses `JSON.stringify(params)` which includes the
  non-enumerable `AbortSignal` as `{}` — harmless for keying, but if the key
  shape is ever revisited, drop signal explicitly.
- Reviewer scrutiny: Step 2 must be a pure hoist; Step 4's `orderBy(count desc)`
  must not break existing facet ordering expectations in the UI (option lists
  are typically re-sorted client-side, but confirm).
