# Performance baselines — plan 063 harness (captured 2026-07-23)

First numbers from every tier of the plan 063 harness, captured on the
`claude/performance-testing-strategy-m35acc` branch AFTER the four
interaction-lag fixes landed (same branch, commit `728aa68`). Machine:
CI-class Linux x64 container (Xeon ~2.1 GHz, Bun 1.3.11); wall-time values
are indicative, not comparable across machines — trends live on gh-pages
via the `perf-trend` job, counts are pinned in the blocking suites.

## Tier 1 — deterministic interaction / query costs (PR-blocking)

Pinned in `packages/ui/tests/components/interaction-cost.test.tsx` and
`packages/adapters/drizzle/tests/query-count.test.ts`:

| Interaction / operation | Cost (exact) |
|---|---|
| Table mount (library wiring) | 1 fetch, 1 batched facet call (K=2 values + R=1 minmax in ONE request), 0 URL writes |
| Pagination click | 1 fetch, 0 facet calls, 1 **synchronous** URL write (leading edge — no 150 ms floor) |
| Rapid double pagination click | 2 fetches, 2 URL writes (leading + one coalesced trailing) |
| Page-size change | 1 fetch, 1 immediate URL write |
| Filter commit | 1 fetch, 1 batched facet refresh, 1 immediate URL write |
| Filter add with EMPTY values | **FINDING**: 1 fetch + 1 facet refresh + 1 URL write before any value is chosen — a real RSC navigation in server-driven apps; candidate fix: skip fetch/serialize until a value commits |
| Facets without `getFacets` (in-process adapters) | exactly K+R singular calls |
| `fetchData` (plain) | 2 SQL statements (data + count) |
| `fetchData` + many-to-one column | 2 statements (single-query join path) |
| `fetchData` + one-to-many column | 3 statements (plan 020 two-phase fan-out + count) |
| `getFacetedValues` / `getMinMaxValues` | 1 statement each |
| Repeated identical `fetchData` | 0 statements (plan 040 LRU hit); write → invalidate → 2 again |
| EXPLAIN canaries | filtered status query + its count: `SEARCH … USING (COVERING) INDEX`, never `SCAN tickets`; many-to-one join probes `agents` by INTEGER PRIMARY KEY; facet GROUP BY walks the covering index with no temp b-tree |

## Tier 2 — growth ratios (PR-blocking, 10k/1k, median of 5)

5 consecutive local runs, zero flakes:

| Operation | Measured ratio (bound) |
|---|---|
| Page-1 LIMIT'd `fetchData` | 0.37–0.74 (≤ 8) — flat, as expected |
| Filtered fetch + count (un-indexed column) | 1.02–1.50 (≤ 15) |
| Transformer, flat 10k rows | 3.9–5.7 (≤ 15) |
| Transformer, one-to-many fan-out 10k rows | 5.6–7.9 (≤ 15) |

## Tier 3 — micro-bench trends (mitata p50, ns/iter; non-blocking)

`bun run bench` (~40 s total; 17 entries feed the gh-pages trend):

| Bench | p50 |
|---|---|
| core/pagination.goToPage | 166 ns |
| core/sorting.toggleSort | 242 ns |
| core/filter.setFilters (50 leaves) | 7.2 µs |
| core/filter-node build+serialize (depth 3) | 104 µs |
| core/url-state.serialize 1 / 10 / 50 filters | 16 µs / 91 µs / 486 µs |
| toolkit/transformToNested flat 1k / 10k | 0.65 ms / 8.4 ms |
| toolkit/transformToNested one-to-many 1k / 10k | 1.9 ms / 21.7 ms |
| drizzle/fetchData no-filters / 20-leaf / depth-3 tree / relational | 111 µs / 773 µs / 410 µs / 984 µs |

Type-perf gate (blocking in `bun test`, budgets ≤ 2 M instantiations hard /
7.5 s loose): filter fixture **1,344** instantiations / 0.27 s; table-def
fixture **145,080** / 1.22 s. Measured via the per-fixture tsconfigs (real
package options + `skipLibCheck` + `types: ["node"]`) — NOT comparable to
the old manual bare-file numbers (~199 k), which mostly counted stdlib
checking that default options don't skip.

## Tier 4 — E2E interaction latency (report-only baselines)

`bun run test:e2e:perf` (production `next start`, in-memory SQLite demo,
Chromium, CDP CPU throttle 4×, 15 reps − 3 warm-ups, in-page
click→rows-updated):

| Interaction | p50 | p75 |
|---|---|---|
| Homepage pagination click | 339 ms | 368 ms |
| Homepage sort header click | 293 ms | 307 ms |
| Facets sidebar filter toggle | 149 ms | 155 ms |

Reading: at 4× throttle these round-trips (RSC render + fetch + hydrate +
paint) are the remaining cost — the pre-fix 150 ms debounce floor and the
no-feedback freeze are gone (rows now dim via `aria-busy` during the
trip). Budgets deliberately NOT set yet; revisit after the gh-pages trend
accumulates (~2 weeks) and pick p75 budgets with observed variance
(workflow TODO dated 2026-08-06).

## Follow-up candidates from the numbers

1. Empty-values filter add costs a full navigation (Tier 1 FINDING above).
2. Pagination p75 (368 ms throttled) is dominated by the whole-page RSC
   re-render; a `<Suspense>`/partial-prerender boundary around the demo
   table could shrink the server render — measure before pursuing.
3. url-state serialize at 50 filters (486 µs) is lz-string-bound; only
   worth touching if real apps carry that many filters.
