# Plan 041: Client performance — facet request dedup/cache, debounced URL serialization, stable filter-bar handlers

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/adapters/http-adapter.ts packages/ui/src/hooks/use-facets.ts packages/ui/src/hooks/use-table-url-sync.ts packages/ui/src/components/filters/filter-bar.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (request cache needs correct invalidation keying)
- **Depends on**: 035 recommended first (shares `http-adapter.ts`; land 035, then rebase)
- **Category**: perf
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

- **PERF-03**: `httpAdapter.send()` POSTs on every call with no request cache
  and no in-flight dedup; `useFacets` fires one `getFacetedValues`/
  `getMinMaxValues` per column on every filter change, so a K-facet sidebar =
  K network round-trips (each its own DB aggregate) per filter toggle, with
  identical `(method, columnId, params)` calls never coalesced.
- **PERF-04**: `use-table-url-sync` runs full lz-string serialization on
  **every** `state_changed` event; only the `history.replaceState` write is
  debounced. Rapid changes (multi-select facet toggling, quick pagination,
  drag-reorder, visibility churn) each pay a full compression pass even
  though the URL write is coalesced.
- **UI-09**: `filter-bar.tsx` rebuilds `handleUpdateFilter`/`handleRemoveFilter`
  on `[filters, onFiltersChange]`, so any real filter change re-renders every
  badge — partially defeating plan 025's `MemoizedFilterBadge` (the perf test
  passes only because it uses stable noops).

## Current state

Verified at `787a816`:

- `packages/core/src/adapters/http-adapter.ts:157-181` — `send()` POSTs every
  call; no cache/dedup. The three facet methods (`:193-222`) each call `send`.
- `packages/ui/src/hooks/use-facets.ts:132-166` — `fetchFacets` maps one
  adapter call per column via `Promise.all`, re-runs on `filters` change; the
  hook already interns `columnIds`/`filters` by content (`:110-129`) so the
  effect fires only on real change — but each fire is still K uncoalesced
  requests.
- `packages/ui/src/hooks/use-table-url-sync.ts:303-337` — the
  `manager.subscribe` handler builds `tableState` and calls
  `serializeTableStateToUrl(tableState)` at `:334` synchronously per event;
  the `debounce(..., 150)` at `:296-301` wraps only `adapter.setParams`.
- `packages/ui/src/components/filters/filter-bar.tsx` — `handleUpdateFilter`
  (search for it) and `handleRemoveFilter` (~`:214-218`) are `useCallback`s
  keyed on `[filters, onFiltersChange]` (and `[columns, hasReachedMaxFilters,
  filters, onFiltersChange]` for the add handler).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| UI tests | `cd packages/ui && bun test` | pass |
| Core tests | `cd packages/core && bun test` | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/core/src/adapters/http-adapter.ts` (request cache + in-flight dedup)
- `packages/ui/src/hooks/use-table-url-sync.ts` (debounce the serialize)
- `packages/ui/src/components/filters/filter-bar.tsx` (stable handlers)
- Tests in core + ui; `.changeset/*.md` (core patch); `plans/README.md`

**Out of scope**:
- A batch/multi-column wire protocol (records as a follow-up; would touch
  `http-protocol.ts` + `http-handler.ts` — coordinate with 035 if pursued,
  not here).
- `use-facets`'s existing interning (already correct).
- The Drizzle-side facet cap (plan 040).

## Git workflow

- Branch: `client-render-performance`; commits `Plan 041 Step N: …`.

## Steps

### Step 1: In-flight dedup + short-TTL cache in `httpAdapter.send`

Add to the closure a `Map<string, Promise<unknown>>` for in-flight requests
and a small TTL result cache, both keyed on the serialized request body
(`JSON.stringify(body)`). On `send`:
- If an identical request is in flight, return the same promise (dedup).
- If a cached result is within TTL, return it.
- Otherwise fetch, store the promise while in flight, cache the result on
  success (evict on error), and clear the in-flight entry in `finally`.
Make the TTL configurable via `HttpAdapterConfig` (e.g. `cacheTtlMs`, default
a small value like 2000; `0`/`false` disables). Do NOT cache aborted/failed
requests. Ensure a request carrying an `AbortSignal` (fetchData) is NOT
served from a shared cache in a way that breaks per-caller cancellation —
simplest: only dedup/cache the facet methods (no signal today) and leave
`fetchData` uncached, OR key includes a "cacheable" flag. Prefer caching the
three facet methods only.

**Verify**: `cd packages/core && bun test` — add a test with a counting fetch
stub: two concurrent identical `getFacetedValues` calls → fetch invoked once
(dedup); a third within TTL → still once (cache); after TTL → twice.

### Step 2: Debounce the URL serialization, not just the write

In `use-table-url-sync.ts`, move `serializeTableStateToUrl` INTO the debounced
callback: change `debounce` to accept the plain `tableState` and both
serialize and `adapter.setParams` inside it, so only the last event in the
150 ms window compresses. The subscribe handler builds `tableState` (cheap
object assembly) and passes it to the debounced fn; it must NOT call
`serializeTableStateToUrl` synchronously anymore.

**Verify**: `cd packages/ui && bun test` — the existing url-sync tests still
pass (they assert final URL output, which is unchanged). Add a test with a
counting wrapper around the serializer (inject or spy) asserting rapid
successive `state_changed` events within one window produce exactly one
serialize call. If the serializer can't be spied without a refactor, assert
instead that N rapid changes produce one `setParams` call with the final
state (already partly covered — extend it).

### Step 3: Stable filter-bar handlers

Rewrite `handleUpdateFilter`/`handleRemoveFilter` (and the add handler where
practical) so their identity does NOT change on every filter mutation: take
the filter key as an argument and read the current `filters` via a ref
(`useLatest(filters)` — the file already uses `useLatest` elsewhere per
plan 025) or via the functional-update form of `onFiltersChange` if the
parent supports it. The badges receive stable callbacks, restoring
`MemoizedFilterBadge`'s benefit.

**Verify**: `cd packages/ui && bun test` — existing filter-bar tests pass;
add a render-count assertion (the suite has `tests/helpers/render-count.tsx`)
that changing ONE filter does not re-render the other badges. This test
fails on the pre-fix code.

### Step 4: Changeset + gates + ledger

Changeset for `@better-tables/core` (patch — httpAdapter request
dedup/cache). `@better-tables/ui` is private (no changeset). Full gates;
update plan 041 row.

## Test plan

- Core: fetch-count dedup/cache test (Step 1).
- UI: single-serialize-per-window (Step 2); badge render-count isolation
  (Step 3, fails pre-fix).
- Patterns: `packages/ui/tests/hooks/use-facets.test.tsx`,
  `use-table-url-sync.test.tsx`, `tests/helpers/render-count.tsx`.

## Done criteria

- [ ] `httpAdapter` dedups in-flight + caches facet results with a configurable TTL; core dedup/cache test passes
- [ ] `use-table-url-sync` calls `serializeTableStateToUrl` only inside the debounced callback (grep: no synchronous serialize in the subscribe handler)
- [ ] filter-bar handlers are stable across filter changes; a render-count test proves other badges don't re-render
- [ ] `cd packages/ui && bun test` + `cd packages/core && bun test` → pass
- [ ] `bun run typecheck` exit 0; core changeset exists
- [ ] `plans/README.md` updated

## STOP conditions

- Caching `fetchData` (with its `AbortSignal`) breaks per-caller cancellation
  — restrict caching to the facet methods and note it; do not weaken abort
  semantics.
- Step 3's stable-handler rewrite requires changing `onFiltersChange`'s
  public contract (e.g. forcing a functional updater) — report; prefer the
  `useLatest` ref approach that keeps the prop contract.
- The url-sync serializer can't be observed for Step 2's test without a
  refactor beyond scope — fall back to the `setParams`-count assertion and
  note it.

## Maintenance notes

- The facet batch protocol (one POST fanned out server-side) is the bigger
  PERF-03 win but touches the wire format frozen by 035 post-publish — if
  pursued, do it in the 0.6 window alongside 035, not after.
- Reviewer scrutiny: Step 1's cache key must include the method + columnId +
  params so different facets don't collide; Step 3's ref approach must read
  the latest filters at call time, not a stale closure.
