# Plan 063: Performance test harness — deterministic gates, benchmarks, interaction-latency baselines

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Skip updating
> `plans/README.md` — the reviewer maintains the index. Steps land
> independently — a partial landing (Steps 1–3 without 5–6) is still a valid
> outcome; report what shipped. This plan builds MEASUREMENT, not fixes:
> if a characterization step exposes a product defect, record the number,
> file it as a follow-up finding in your report, and do not fix it inline.
>
> **Drift check (run first)**:
> `git diff --stat dcd90c1..HEAD -- packages/ui/src/hooks/use-table-url-sync.ts packages/ui/src/hooks/use-facets.ts packages/ui/src/hooks/use-table-data.ts packages/core/src/adapters/http-adapter.ts packages/ui/tests/helpers apps/marketing/src/lib/nextjs-url-adapter.ts .github/workflows/test.yml`
> — if the hooks or helpers moved materially, re-verify the Current-state
> excerpts before executing.

## Status

- **Priority**: P2
- **Effort**: L (six independent steps; each is S–M alone)
- **Risk**: MEDIUM (new CI surface; wall-time flake risk — mitigated by
  gating on counts/ratios and keeping timing tiers report-only at first)
- **Depends on**: nothing hard. Reuses plan 042's fake-timer idioms, plan
  043's `drizzle-sqlite-fixture`, plan 025/041's render-count test style.
- **Category**: perf / tests
- **Planned at**: `dcd90c1`, 2026-07-23
- **Trigger**: maintainer-reported lag on pagination clicks and filter adds
  in the demos; performance is a stated product pillar, so it needs tests,
  not anecdotes.

## Why this matters

Every perf fix so far (025 memoized rows, 040 transformer/cache/facet cap,
041 facet dedup + URL-serialize debounce, PR #105's RSC round-trip cuts) was
found by **hand profiling** and is protected only by point characterization
tests. There is no harness that would catch the next regression class:

- **Nothing measures runtime speed anywhere.** No mitata/tinybench, no
  `performance.now` measurement code, no bench script in any package
  (verified repo-wide). The drizzle "perf" test
  (`tests/adapter-perf-cache-facets.test.ts`) asserts cache/limit
  *correctness*, not cost.
- **The type-perf gate is manual.** The fixtures exist
  (`packages/core/tests/types/filter-perf-fixture.ts:15-18`,
  `table-def-perf-fixture.ts:23-26`) with budgets recorded only in
  `plans/design/table-definition-dx.md:767-812` (≤ 2.5 s check / ≤ 2 M
  instantiations; last recorded 199,114 / 1.00 s). No test, script, or CI
  step runs them — the "perf gate" checklist item in past plans was a human
  running `tsc --extendedDiagnostics` by hand.
- **No test pins the *cost* of an interaction.** Render-count tests cover
  component memoization in isolation, but nothing asserts "one pagination
  click = exactly 1 fetch, 1 URL write, 0 facet refetches." The facet
  cache-bypass described below is invisible to every existing suite.
- **CI runs zero perf steps** (`.github/workflows/test.yml` — build, test,
  lint only), despite already provisioning MySQL/Postgres service
  containers that a scale suite could reuse later.
- **No E2E exists** (043's Playwright step was deferred), so the thing the
  maintainer actually *feels* — click-to-updated-rows latency in the demos —
  has never been measured by automation.

## Current state (verified 2026-07-23 at `dcd90c1`)

> **Update (2026-07-23, this branch):** the four lag causes below were fixed
> ahead of this plan, on `claude/performance-testing-strategy-m35acc`.
> Tier-1/Tier-4 characterization must pin the POST-fix contract:
> server-affecting URL writes are leading-edge immediate with a 150 ms
> trailing coalesce window (a discrete pagination click/filter commit pays
> ZERO added latency; a rapid burst produces the first write plus at most
> one trailing write per window); `<BetterTable loading>` keeps current rows
> mounted (dimmed, `aria-busy`) during a refetch and reserves the skeleton
> for an empty initial load, and the demos feed it `isPending` from a
> transition around `router.replace`; `useFacets` issues ONE batched
> `getFacets` POST on batch-capable adapters (singular per-column calls
> remain only for in-process adapters), and `httpAdapter`'s TTL cache/dedup
> now applies to signalled reads with per-caller abort semantics; demo
> seeding warms at server boot (`instrumentation.ts`) and re-warms on demo
> reset. The paragraphs below describe the PRE-fix behavior for the record.

What a pagination click / filter change cost before those fixes, and where
the felt lag came from — the regression classes the harness must keep
covered:

- **Interaction pipeline is synchronous to `state_changed`**: click →
  `table-pagination.tsx:101/166/180` → store → managers
  (`pagination-manager.ts:275-284`) → `state_changed`
  (`table-state-manager.ts:718-735`, no debounce) → two subscribers:
  zustand re-render + URL sync.
- **A fixed 150 ms debounce sits in front of every server-driven refetch**:
  `use-table-url-sync.ts:402` debounces the URL write; in the demos the URL
  write IS the refetch trigger (`nextjs-url-adapter.ts:63-71`
  `router.replace` on server-affecting params → RSC re-render → direct
  Drizzle `fetchData`). A pagination click therefore idles 150 ms before
  the network even starts.
- **The demos show no feedback during the round-trip**: no demo passes
  `loading` (`users-table-client.tsx:70-108`), so stale rows sit unchanged
  until new props land. The library path has the opposite defect:
  `loading=true` unmounts all rows to a full skeleton
  (`table.tsx:1272-1294`, set synchronously at `use-table-data.ts:130`).
  No `useTransition`/`useDeferredValue`/optimistic rendering exists
  anywhere (repo-wide grep).
- **Filter changes fan out**: one refetch plus K facet requests — one POST
  per option column + one per range column, unbatched
  (`use-facets.ts:152-166`; the facets demo issues 4), and **the 2 s TTL
  cache is bypassed** because `useFacets` always passes an abort signal,
  routing to the uncached `send` (`http-adapter.ts:301,316,328`). In the
  facets sidebar the facet POSTs additionally cannot start until the RSC
  round-trip returns new `activeFilters` (`facets-sidebar.tsx:42,50-56`) —
  counts trail the click by round-trip + POST.
- **Cold start pays seeding inline**: first demo request (or "Reset demo")
  seeds 5,000 users (`users/sqlite/db.ts:80-97`) or 12,000+ tickets
  (`support/db.ts:111-123`, bulk-inserted in 500-row batches) before
  answering.
- **Existing measurement assets to reuse**: local-counter render tests
  (`table-row-render.test.tsx:74`, `active-filters-render.test.tsx:105`,
  `filter-bar-render.test.tsx:52` delta-style, `table-effect-churn.test.ts:61`),
  an **unused** `createRenderCounter` Profiler helper
  (`tests/helpers/render-count.tsx:16`), `installResizeObserverMock`
  (`:56`), the bun:sqlite fixture (`drizzle-sqlite-fixture.ts:59`, seeds
  3 users), and env-gated MySQL/PG suites with a CI no-silent-skip guard
  (`ci-integration-guard.test.ts:34`).

## Research — measurement techniques considered

Decision principle (already implicit in this repo's type gate and render
tests): **gate on deterministic counts and machine-independent ratios;
track wall time as trends; never hard-fail a PR on shared-runner
milliseconds.**

| Technique | Verdict | Why |
|---|---|---|
| React Profiler / local render counters (existing idiom) | **Adopt** — Tier 1 | Deterministic, proven in-repo; extend from "is X memoized" to "what does one interaction cost" |
| Adapter/network **operation counting** (drizzle `logger` hook, counting fetch stubs) | **Adopt** — Tier 1 | Exact integers; catches N+1, duplicate fetches, cache bypass — the regression classes that actually happened here |
| `EXPLAIN QUERY PLAN` shape assertions (SQLite) | **Adopt (few canaries)** — Tier 1 | Deterministic index-usage guard; PG variant stays env-gated with the existing integration suites |
| **Growth-ratio** tests (same op at 1k vs 10k rows, bound the ratio) | **Adopt** — Tier 2 | Ratios cancel machine speed; catches accidental O(n²) with wide, CI-safe slack |
| **mitata** micro-benchmarks under Bun | **Adopt** — Tier 3 (trend) | Bun's documented recommendation; GC control; JSON output feeds trend tracking. Absolute numbers are NOT PR gates |
| `tsc --extendedDiagnostics` instantiation counts | **Adopt (automate existing gate)** | Instantiations are deterministic; budget already agreed (≤ 2 M); time gets loose slack only |
| Playwright + in-page `PerformanceObserver` event timing (lab-INP per scripted interaction) | **Adopt, report-only first** — Tier 4 | The only tier that measures the *felt* click→paint/rows latency incl. the 150 ms debounce + RSC trip; Chromium-only; p75 of N reps |
| `github-action-benchmark` (`customSmallerIsBetter` JSON, gh-pages history, alert threshold) | **Adopt** for trends | Tool-agnostic JSON fits mitata + our counters; free; comment-on-regression without flaky red PRs |
| CodSpeed (instruction-count instrumentation) | **Reject for now** | Harness is vitest ≥ 3.2 / Node; this repo is `bun test`-native on JSC. Revisit only if vitest ever enters the repo |
| bencher.dev | **Alternative, not now** | Better statistics than gh-action-benchmark but an external SaaS dependency; note as fallback if gh-pages trends prove too noisy |
| Lighthouse timespan / full CWV audits | **Reject** | Page-level and heavyweight; the product is a library — scripted-interaction timing is the right granularity |
| react-scan / React DevTools profiling | **Document only** | Interactive diagnosis tools; not CI-gateable. Mention in the perf doc for contributors |
| Strict wall-time thresholds inside `bun test` on PRs | **Reject** | Shared-runner variance; the only absolute ceilings allowed are catastrophic ones (≥ 3× budget) |

## Design — four tiers

- **Tier 1 — interaction & query cost gates** (blocking, every PR, zero
  wall-clock): exact counts per user interaction (fetches, facet requests,
  URL serializations, renders/commits, effect fires) and per adapter
  operation (SQL statements, plan shapes).
- **Tier 2 — growth-ratio gates** (blocking, generous ratio bounds): scale
  behavior of `fetchData`, transformer, and filter application at 1k vs 10k
  rows in bun:sqlite.
- **Tier 3 — micro-benchmarks** (non-blocking trends): mitata suites for
  core managers, URL codec, toolkit transformer, drizzle SQL build; JSON →
  gh-pages trend with alert comments on main.
- **Tier 4 — E2E interaction latency** (opt-in, report-first): Playwright
  over the built marketing demo measuring click→next-paint and
  click→rows-updated, producing the baseline numbers that quantify the
  reported lag (and, later, verify its fixes).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build deps | `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit --filter=@better-tables/adapters-drizzle` | exit 0 |
| UI tests | `cd packages/ui && bun test` | pass |
| Adapter tests | `cd packages/adapters/drizzle && bun test` | SQLite green |
| Core tests | `cd packages/core && bun test` | pass |
| Benches (after Step 4) | `bun run bench` (root, via turbo) | JSON emitted per package |
| Type gate (after Step 5) | `cd packages/core && bun test tests/types/type-perf-gate.test.ts` | pass, prints numbers |
| E2E perf (after Step 6) | `cd apps/marketing && bun run test:e2e:perf` | JSON report written |
| Typecheck | `bun run typecheck` | exit 0 |

## Steps

### Step 1: Interaction-cost gates (UI)

New `packages/ui/tests/components/interaction-cost.test.tsx` (split into
two files if large: pagination / filters). Use the plan-042 fake-timer
idiom, the local-counter render idiom, and a **counting stub adapter**
(extend `tests/helpers/stub-adapter.ts` with per-method call counters —
`fetchData`, `getFacetedValues`, `getMinMaxValues` — plus a counting
serializer spy for URL sync, following plan 041's `setParams`-count
fallback if the serializer can't be spied cleanly).

Characterize, then assert EXACTLY (comment each number with why):

- One pagination click: 1 `fetchData` (after debounce flush), 0 facet
  calls, 1 URL write; sibling-row re-renders within the plan-025 bounds;
  bridge effects fire once (`table-effect-churn` idiom).
- One page-size change: 1 fetch, 1 URL write, page recompute preserved.
- Adding a filter with empty `values` (`filter-bar.tsx:216`): characterize
  whether a fetch fires at all — whatever the current contract is, pin it
  and note it in the report (an empty-value fetch is a finding, not a fix).
- Committing a filter value: 1 fetch, exactly ONE batched `getFacets` call
  on a batch-capable adapter (assert the request list carries K option +
  R range columns with a 3-facet fixture; K+R singular calls only for an
  adapter without `getFacets`), 1 URL write, auto-show effect fires at most
  once.
- A single pagination click: the URL write is SYNCHRONOUS (leading edge) —
  assert 1 write with timers frozen. A rapid double click inside the 150 ms
  window: first write immediate, second coalesced to one trailing write
  (2 total, each a real page change).

Wire the so-far-unused `createRenderCounter`
(`tests/helpers/render-count.tsx:16`) around the whole `<BetterTable>` to
assert total commits per interaction ≤ a small pinned number — or, if the
local-counter idiom proves strictly clearer, delete the dead helper (do one
or the other; don't leave it unused).

**Verify**: `cd packages/ui && bun test` 0 fail; new assertions are exact
integers, no timing.

### Step 2: Query-count + plan-shape gates (adapter)

New `packages/adapters/drizzle/tests/query-count.test.ts`:

- Helper: build the bun:sqlite drizzle db with a counting `logger`
  (`drizzle-orm` `Logger.logQuery`) — add it to the existing test helpers.
  If the logger seam misses statements on any path, STOP and report.
- Assert exact statements per operation (characterize first, comment each):
  plain `fetchData` (expect data + count = 2); `fetchData` with a 1:N
  relation (two-phase fan-out from plan 020 — expect 3, or the verified
  number); one facet call = 1; `getMinMaxValues` = 1; a cached repeat
  `fetchData` = 0 (LRU hit, plan 040).
- 2–3 `EXPLAIN QUERY PLAN` canaries: create an index in the fixture on a
  commonly filtered column; assert the filtered query's plan says
  `USING INDEX` (and a PK join does not full-scan). Keep these narrowly
  scoped to schema the fixture owns.

**Verify**: `cd packages/adapters/drizzle && bun test` green with no env
vars (SQLite only). Counts are exact integers.

### Step 3: Growth-ratio gates (adapter + toolkit)

New `packages/adapters/drizzle/tests/scale-growth.test.ts` + a toolkit
twin for the transformer:

- Seed bun:sqlite with 1k and 10k rows (single transaction; keep seeding
  < ~1 s). Measure with `performance.now()`, median of 5 runs, one warm-up
  discarded.
- Assert RATIOS, not absolutes: page-1 `fetchData` (LIMIT'd) at 10k ≤ 8×
  the 1k time (should be near-flat); filtered count query ≤ 15× (linear-ish
  with slack); toolkit `transformToNestedStructure` on 10k flat rows ≤ 15×
  its 1k time (an O(n²) regression shows up as ~100×).
- One absolute catastrophic ceiling each (e.g. page fetch at 10k < 2 s) —
  wide enough to never flake, tight enough to catch pathology.
- Mark the file with a raised bun test timeout; keep total runtime of the
  file under ~10 s so the PR gate stays fast.

**Verify**: run the file 5× locally back-to-back — 0 flakes. If a ratio
flakes in CI after tuning (see STOP), demote that assertion to Tier 3.

### Step 4: mitata micro-bench suites (trend tier)

- Add `mitata` to the workspace catalog (devDependency).
- Per-package `bench/` dirs, excluded from `bun test` globs and turbo
  `test` inputs: `packages/core/bench/` (filter/sort/pagination manager
  ops on 10k-row arrays, FilterNode build/serialize at depth 3, URL state
  serialize incl. lz-string at 1/10/50 filters),
  `packages/adapters/toolkit/bench/` (transformer 1k/10k, flat vs 1:N),
  `packages/adapters/drizzle/bench/` (SQL generation only — no DB — for
  filter trees, joins, facets).
- Per-package script `"bench": "bun bench/index.ts"`; root `"bench":
  "turbo run bench"` with a `bench` turbo task (`cache: false`,
  `dependsOn: ["build"]`). Each run writes
  `bench-results/<pkg>.json` (mitata JSON output; if the pinned mitata's
  JSON API differs from its docs, wrap with a ~30-line
  `scripts/bench-report.ts` that shapes `{name, unit: "ns", value}` —
  `customSmallerIsBetter` format).
- `bun:jsc` `heapStats` deltas may be added as extra JSON entries for the
  transformer bench (memory trend), but only if trivially stable.

**Verify**: `bun run bench` exits 0 and writes JSON for all three
packages; runtime < ~2 min total; `git status` shows results are
gitignored (add `bench-results/` to `.gitignore`).

### Step 5: Automate the type-perf gate

New `packages/core/tests/types/type-perf-gate.test.ts`:

- Spawn `bunx tsc --noEmit --extendedDiagnostics` for each fixture (the
  exact commands already in the fixture headers); parse `Instantiations`
  and `Check time`.
- **Hard gate**: instantiations ≤ 2,000,000 per fixture (the agreed budget,
  `plans/design/table-definition-dx.md:791`). **Loose gate**: check time
  ≤ 7.5 s (3× the 2.5 s local budget — slow-runner slack; the 2.5 s number
  remains the local target and is printed, not enforced).
- Print the measured numbers so CI logs double as a trend record; also
  append them to the Step-4 JSON (unit: instantiations) so the trend graph
  tracks them.
- Allow skip via `SKIP_TYPE_PERF=1` for fast local loops, but ensure it
  runs in CI (the guard idiom from `ci-integration-guard.test.ts:34` —
  in GitHub Actions the skip env must not be set).

**Verify**: `cd packages/core && bun test` green; deliberately lowering the
budget to 100k makes it fail (then restore).

### Step 6: E2E interaction-latency harness (report-first)

Lands plan 043's deferred Playwright step, perf-scoped, in
`apps/marketing`:

- `@playwright/test` devDep (Chromium only), `playwright.config.ts`, specs
  under `apps/marketing/e2e/` — OUTSIDE the `bun test` glob so
  `static-checks` stays untouched. Script `test:e2e:perf` runs
  `next build` + `next start` (production; dev-mode numbers are
  meaningless), warms each demo page once (absorbs the in-memory seed cost
  — 5k users / 12k+ tickets), then measures.
- Scripted interactions ×15 reps (first 3 discarded), CDP CPU throttle 4×:
  1. homepage pagination "next" click,
  2. add + commit a text filter,
  3. facets-sidebar toggle.
  For each: `performance.mark` at dispatch → await a rows-changed DOM
  assertion (wall time), and a buffered `PerformanceObserver('event')`
  entry for input→next-paint. Report p50/p75 per interaction as
  `customSmallerIsBetter` JSON.
- **No budgets yet.** The harness asserts only mechanics (rows actually
  changed, N reps collected). Budgets get chosen in a follow-up once
  baseline variance is known.
- CI: a separate `workflow_dispatch` + push-to-main job (never a PR gate),
  uploading the JSON as an artifact. If browsers can't run in this CI, keep
  it local-only and say so (mirrors 043's stance) — do NOT half-wire it.

**Verify**: `bun run test:e2e:perf` locally produces a JSON report with
p50/p75 for all three interactions; numbers land in the Step-7 baseline
doc.

### Step 7: CI wiring, trend tracking, baseline record

- `.github/workflows/test.yml`: Tier 1/2 additions ride the existing
  package test jobs automatically (they're plain `bun test` files). Add a
  `perf-trend` job on push-to-`main` only: `bun run bench` (+ Step 5's JSON)
  → `benchmark-action/github-action-benchmark` with
  `tool: customSmallerIsBetter`, gh-pages storage, `alert-threshold: 150%`,
  `comment-on-alert: true`, `fail-on-alert: false` (flip to true only after
  ~2 weeks of stable history; leave a dated TODO).
- Write `plans/design/perf-baselines.md`: the captured numbers from every
  tier, the diagnosis narrative for the reported lag (quantified against
  the Current-state suspects: 150 ms debounce floor, RSC round-trip time,
  facet cascade, no-feedback window), and the follow-up fix candidates
  (below) each tied to its number.
- Changesets: none expected (tests/bench/CI only). If Step 1's counting
  hooks required touching a published package's source, STOP — that
  belongs in a fix plan.

**Verify**: full gates (`bun run typecheck` 11/11, all package suites, root
check-only lint `bunx biome check .`); CI green on the branch including the
new files; trend job proven by a manual `workflow_dispatch` run or a dry
run with `save-data-file: false` noted in the report.

## Follow-up fixes — LANDED ahead of this plan (2026-07-23)

The four fix candidates this plan originally queued all landed on
`claude/performance-testing-strategy-m35acc` before harness execution:
(a) refetch feedback — `<BetterTable loading>` keeps rows mounted
(dim + `aria-busy`; skeleton only for empty initial load) and every demo
client passes `isPending` from a transition-wrapped `router.replace`
(shared across siblings via `UrlNavigationPendingProvider` where the
navigator and the table are different components); (b) URL writes are
leading-edge immediate with a 150 ms trailing coalesce
(`coalesceUrlWrites` in `use-table-url-sync.ts`) — no debounce floor on
discrete interactions; (c) `TableAdapter.getFacets` batch (wire method +
handler fan-out + `useFacets` batch path) and a signal-compatible
TTL cache/dedup in `httpAdapter` (per-caller abort, refcounted underlying
cancel); (d) demo seeding warmed at boot (`instrumentation.ts`) and after
"Reset demo". Tier 4 baselines now VERIFY these fixes and guard them
against regression, rather than motivating them.

## Scope

**In scope**: new test files in ui/drizzle/toolkit/core `tests/`; counting
extensions to `packages/ui/tests/helpers/stub-adapter.ts` and drizzle test
helpers; per-package `bench/` + scripts + turbo `bench` task + catalog
mitata; `scripts/bench-report.ts` (new root `scripts/` dir);
`packages/core/tests/types/type-perf-gate.test.ts`; `apps/marketing/e2e/`
+ Playwright config + devDep; `.github/workflows/test.yml` trend job;
`.gitignore` (`bench-results/`); `plans/design/perf-baselines.md`.

**Out of scope**: ALL product-source changes (fix candidates above);
vitest/CodSpeed migration; MySQL/Postgres perf suites (reuse the env-gated
pattern later if wanted); bundle-size gates for published packages
(cheap but orthogonal — deferred); marketing content/UX changes;
virtualization stress E2E (optional follow-up).

## Git workflow

Branch `performance-test-harness` from main. Commits `Plan 063 Step N: …`.
No push without maintainer instruction.

## Done criteria

- [ ] Interaction-cost tests pin exact fetch/facet/URL-write/render counts for pagination click, page-size change, filter add, filter value commit, and coalesced double-click (`cd packages/ui && bun test` green)
- [ ] Query-count tests pin exact SQL statements per adapter operation incl. a cache-hit 0 and ≥ 2 EXPLAIN plan canaries (`cd packages/adapters/drizzle && bun test` green, no env vars)
- [ ] Growth-ratio tests bound 10k/1k ratios for fetch, filtered count, and transformer; 5 consecutive local runs 0 flakes
- [ ] `bun run bench` emits `customSmallerIsBetter` JSON for core, toolkit, drizzle; `bench-results/` gitignored
- [ ] Type-perf gate runs in `bun test` with hard instantiation budget (≤ 2 M) and loose time ceiling; prints numbers; cannot silently skip in CI
- [ ] Playwright perf spec measures p50/p75 for the three demo interactions against a production build, or is explicitly recorded as local-only with the reason
- [ ] `perf-trend` CI job on main uploads results with alert comments (`fail-on-alert: false` + dated TODO)
- [ ] `plans/design/perf-baselines.md` records all baseline numbers + quantified lag diagnosis + follow-up fix list
- [ ] Full gates: `bun run typecheck` exit 0; all package suites green; no product `src/**` modified

## STOP conditions

- The drizzle `logger` seam does not see every statement for a covered
  operation (e.g. a driver path bypasses it) — report before hand-wrapping
  drivers.
- Tier 1 characterization reveals a genuine defect (duplicate fetch per
  click, K×M facet fan-out, empty-filter fetch storm) — pin the current
  number with a `// FINDING:` comment, report it for a fix plan, continue.
- A growth-ratio assertion flakes in CI after 3 bound-widening attempts —
  demote to trend-only JSON and report.
- mitata's JSON output API under pinned Bun 1.3.11 doesn't match its docs —
  fall back to a ~50-line `Bun.nanoseconds` runner emitting the same JSON,
  and report the substitution.
- Playwright cannot install/launch Chromium in CI — keep the harness
  local/opt-in with a README note; do not force a broken job green.
- Any step needs a change to published-package `src/**` — that's a fix, not
  a measurement; report instead.

## Maintenance notes

- **Noise discipline**: PR gates stay counts + ratios + catastrophic
  ceilings only. Wall-time budgets live in the trend tier until two weeks
  of history justify promotion (dated TODO in the workflow).
- **Updating budgets**: a legitimate count change (e.g. an intentional
  extra query) updates the pinned number in the same PR with a comment
  citing the plan/PR that changed it — the test is the changelog.
- **CodSpeed revisit condition**: only if the repo ever adopts vitest;
  bencher.dev is the fallback if gh-pages trends prove too noisy to read.
- **Future tie-ins**: the 061 conformance suite can reuse the counting
  logger + scale fixtures per adapter; a user-facing `perfPlugin()` (049
  hook seam: `beforeFetch`/`afterFetch` timing) would productize the same
  measurements — separate plan if wanted.
- Reviewer scrutiny: Step 1's exact counts must be characterized against
  REAL current behavior (not aspirational); Step 3's seeding must stay
  inside the test-runtime budget; Step 6 must measure the production
  build, never `next dev`.
