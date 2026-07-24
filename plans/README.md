# Implementation Plans — Ledger

Advisor-maintained index of planned work. Executors: read the full plan
before starting, honor STOP conditions, and update your status row when
done (unless a reviewer owns the index). One-line rows here; detail lives
in each plan file and git history.

**Layout:** policies → where we are → open work → order notes → release
runbook → ops notes → done archive → deferred / rejected.

Audits (2026-07-12, 2026-07-17) are fully planned — nothing sits in a
loose backlog. Deferred items are at the bottom.

---

## Policies (standing)

- **Release (0.6.0):** one coordinated breaking upgrade. Pre-1.0: `0.x`
  minor is the breaking slot; breaking changesets use `minor`. No
  deprecation cycles, compat shims, or parallel v2 methods — remove the
  old surface outright. Users get a migration guide before publish
  (`MIGRATION.md` from plan 019; restore onto `main` if missing before
  the 0.6 train). Exception: URL wire-format *read* compat for old `c:`
  payloads (bookmarked URLs). If plan text softens this, this policy wins.
- **Prisma / adapters (2026-07-20):** full Drizzle-parity Prisma adapter —
  [061](061-prisma-adapter-full-parity.md) (supersedes 008). Kysely next
  on the same conformance suite — [062](062-kysely-adapter.md). Schedule
  via this ledger; the old “wait until everything else is done” hold is
  lifted.

---

## Where we are (2026-07-22)

**0.6 is shippable.** Waves A–D are merged to `main`. Open work is Wave E
plus leftover 048; Wave F (perf harness, 063) is **DONE** on its branch.
058 stays deferred; **060 landed**.

| Wave | Plans | Outcome |
|------|-------|---------|
| First audit | 001–032 (008 → 061) | Done — see archive |
| A — pre-0.6 | 033–036, 040, 046, 047 | [PR #83](https://github.com/Better-Tables/better-tables/pull/83) |
| B — quality | 037–039, 041–045, 051, 052 | [PR #85](https://github.com/Better-Tables/better-tables/pull/85); reconcile audit at `7b58ed8` verified all 17 criteria |
| C — features | 053–055, 049, 050 | Editable cells / auto columns / direct save ([PR #86](https://github.com/Better-Tables/better-tables/pull/86)); plugins ([PR #101](https://github.com/Better-Tables/better-tables/pull/101)); export UI ([PR #102](https://github.com/Better-Tables/better-tables/pull/102)). **048 still open** |
| D — hygiene + modules | 056, 057, 059, 060 | Typecheck order + contract cleanup ([PR #99](https://github.com/Better-Tables/better-tables/pull/99)); UI modules + actions opt-in ([PR #100](https://github.com/Better-Tables/better-tables/pull/100)); derived aggregates (`t.count`). **058 deferred** |
| Docs / demo | — | Handbook overhaul + `memoryAdapter` in core ([PR #88](https://github.com/Better-Tables/better-tables/pull/88)); marketing redesign ([PR #87](https://github.com/Better-Tables/better-tables/pull/87)) |

---

## Open work

### Wave C leftover

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [048](048-filter-group-builder-ui.md) | Visual nested AND/OR filter builder (contract already shipped; flat bar stays for 0.6) | 015–017 (done) | **TODO** (P3) |

### Wave D leftover

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [058](058-global-search.md) | Global search as filter sugar over `.searchable()` columns | none | **DEFERRED** (2026-07-21) — plan intact; `FetchDataParams.search` stays declared-but-unconsumed |

### Wave E — adapter expansion

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [061](061-prisma-adapter-full-parity.md) | Prisma at full Drizzle parity. Phase 1 = shared conformance suite (memory + drizzle). Later phases: reads, facets, schema, writes, export, aggregates | Phase 7 can use 060 (landed) | **TODO** (P2) |
| [062](062-kysely-adapter.md) | Kysely adapter (SQL-native composition; full aggregate parity) | 061 Phases 1 + 6; aggregates need 060 (done) | **TODO** |

008 is superseded by 061 — do not execute 008.

**060 DONE** (2026-07-22): `t.count` / `t.aggregate`, `FetchDataParams.derived`,
Drizzle correlated-subquery lowering + `FilterGroupNode` walk for
`filterSql`/derived specs (051 computed-TREE gap closed for that path;
legacy callback-`filter` still throws), memoryAdapter nested-array eval,
homepage `postsCount` dogfood. Design record: `plans/design/derived-columns.md`.

### Wave F — performance harness

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [063](063-performance-test-harness.md) | Perf test harness: interaction/query-count gates, growth-ratio gates, mitata trend benches, type-gate automation, Playwright latency baselines | 042/043 helpers (done) | **DONE** (2026-07-23) — all 7 steps + the four lag fixes on the plan branch; baselines in [design/perf-baselines.md](design/perf-baselines.md). The one FINDING (empty-filter add cost a navigation) is now FIXED via `getEffectiveFilters` |

---

## Order notes (open plans only)

- **061 Phase 1** anytime — conformance suite is valuable alone and required
  for 062. Phases merge independently; Phase 7 can implement aggregates against
  the 060 capability shape.
- **048** anytime after 0.6 — no file overlap with 061; follow plan 041
  handler idioms and plan 042 input-test patterns.
- **062** only after 061 Phases 1 + 6.
- **063 executed** (2026-07-23, all 7 steps + the four lag fixes) — see the
  Wave F row. Numbers: [design/perf-baselines.md](design/perf-baselines.md).
- Capability asymmetry (from 060 design): Prisma can sort-by-count but
  not filter-by-count; Kysely/Drizzle do both — declare honestly in
  `AdapterMeta.capabilities.aggregates`.

Standing product decisions that still constrain open work:

- Monolith path is primary (Next / TanStack Start); `httpAdapter` is for
  separated front/back only.
- Core tier = “plugins”; copied UI tier = “modules” (059).
- Aggregates: declare per-operation capability gaps honestly in
  `AdapterMeta` (061/062).

Historical DX decisions for editable cells, auto columns, and direct save
live in plans 053–055 — not repeated here.

---

## Pre-publish runbook (0.6)

1. Follow the maintainer runbook in `MIGRATION.md` (restore the file onto
   `main` first if absent).
2. Toolkit version: if `package.json` says `0.1.0` *and* a minor changeset
   exists, `changeset version` publishes `0.2.0`. Set `0.0.0` pre-release
   if you want `0.1.0` as the first published version.
3. One changeset train — do not partially publish.
4. Script name is `release` (not `changeset:release` — fixed in 039).

---

## Ops notes

- Root `lint` **mutates** (`biome check --write --unsafe .`). Check-only:
  `bunx biome check .` (0 errors; warnings remain, mostly `noConsole`).
- Fresh worktrees: `bun install`, then build core + toolkit before drizzle
  tests.
- Bun ≥1.3.11: `bunfig.toml` pins `linker = "hoisted"`. Under
  `turbo run typecheck --force` in a warm tree, a rotating package can
  still TS2307 on `@better-tables/core` (tsc vs tsdown race). Retry before
  believing it; CI has not shown it. Per-package `tsc --noEmit` is the
  ground truth.
- Lint is blocking in CI. Marketing typecheck runs `next typegen` first.
- MySQL ops are intentionally not RETURNING-deduped — dialect difference,
  not drift.
- Stale `apps/docs/.next` from the docs-app removal: safe to `rm -rf`.

---

## Done archive

Details and criteria live in each plan file. One line per plan.

### First audit (001–032)

| Plan | Title | Outcome |
|------|-------|---------|
| 001 | CI gates every package | All-package CI paths, Bun pin, summary gate |
| 002 | Explicit mutation-table routing | `defaultMutationTable`, throw on ambiguity |
| 003 | Join count inflation | `countDistinct` guard; total 4→3 |
| 004 | Validate URL state | Fail-closed shape guard + pagination clamp |
| 005 | Builder type inference | Real accessor/options types; `defineColumns` |
| 006 | Design: contract v2 | Registry + AND/OR design + type tests |
| 007 | Extract adapters-toolkit | Toolkit born; drizzle god-modules thinned |
| 008 | Prisma spike | **Superseded by 061** |
| 009 | DX hygiene sweep | README truth, peers, `sideEffects` |
| 010 | UI hooks + first harness | Signal plumbing + CI test-ui |
| 011 | Design: path-typed defs | Design doc + Paths prototype |
| 012–013 | Verification baseline | Typecheck green × packages; turbo wired |
| 014 | Literal-preserving `.id()` | Registry keystone |
| 015–017 | FilterNode stack | Core + state + drizzle group SQL (depth 3) |
| 018 | Instance API runtime | `betterTables()` / `defineTable` flagship |
| 019 | Migration guide | `MIGRATION.md` + compile-checked examples |
| 020 | Join pagination under-fill | Two-phase fan-out (+ order fix) |
| 021 | Filter-aware facets | Self-exclusion + distinct under joins |
| 022 | Relationship inference | SchemaError + suggestions |
| 023 | Shared subscription emitter | `Subscribable` base |
| 024 | Virtualization offsets | Lazy prefix; O(log n) lookup |
| 025 | UI render performance | Memo rows/observers |
| 026 | Strictness flags | `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| 027 | Null-filter semantics | Option A — includeNull |
| 028 | Timezone conversion | `@date-fns/tz`; UTC default |
| 029 | Marketing dogfood | 4 examples; DX findings harvested |
| 030 | Multi-table identity | Table-scoped fetch + ambiguity errors |
| 031 | Filter-authoring types | Per-type operator unions |
| 032 | UI integration gaps | Soft-nav chips, facets sidebar, `table=` |

### Wave A — [PR #83](https://github.com/Better-Tables/better-tables/pull/83)

| Plan | What |
|------|------|
| 033 | Verification-infra truth (turbo tests glob, lint/env pins) |
| 034 | `useTableData` refetch loop + date formatter coercion |
| 035 | HTTP adapter hardening (`authorize` / errors / facets wire) |
| 036 | Date `between` timestamp fallback |
| 040 | Adapter perf + facet top-100 default |
| 046 | Path-typed columns promoted to core |
| 047 | Typed write surface (`create`/`update`/`delete`Record) |

### Wave B — [PR #85](https://github.com/Better-Tables/better-tables/pull/85)

| Plan | What |
|------|------|
| 037 | CLI bundles `ui/src` (no mutable-`main` download) |
| 038 | Single-source operators + `ColumnType`; `is`/`isNot` |
| 039 | Docs truth + lean handbook |
| 041 | Client render perf (facet cache, URL debounce) |
| 042 | UI test coverage (~91 tests) |
| 043 | Cross-package integration harness (Playwright E2E deferred) |
| 044 | Drizzle module decomposition |
| 045 | Column-builder dedup |
| 051 | Robustness sweep (detectDriver + computed-TREE documented/deferred; TREE closed for `filterSql`/derived in 060) |
| 052 | CI/toolchain hygiene; blocking lint |

### Wave C — [PR #86](https://github.com/Better-Tables/better-tables/pull/86), [#101](https://github.com/Better-Tables/better-tables/pull/101), [#102](https://github.com/Better-Tables/better-tables/pull/102)

| Plan | What |
|------|------|
| 053 | `.editable()` inline cell editing |
| 054 | Schema-driven auto columns (`describeColumns`, `t.auto()`) |
| 055 | Direct save path (`cellEditAction`, joined-table writes) |
| 049 | Plugin hooks `beforeFetch`/`afterFetch` + `logPlugin()` |
| 050 | Export UI (`ExportButton`, `csvExport()`, 50k row cap) |

### Wave D — [PR #99](https://github.com/Better-Tables/better-tables/pull/99), [#100](https://github.com/Better-Tables/better-tables/pull/100), 060

| Plan | What |
|------|------|
| 056 | Deterministic typecheck (`dependsOn` build; site override) |
| 057 | Dead contract surface removed (reserved flags/types) |
| 059 | UI modules tier + actions as first opt-in module |
| 060 | Derived aggregates (`t.count` / `t.aggregate`); honest custom defaults |

### Notable non-plan merges

- Adapter correctness + `onInvalidFilter` strict mode + CI DB guard —
  [PR #97](https://github.com/Better-Tables/better-tables/pull/97),
  [PR #98](https://github.com/Better-Tables/better-tables/pull/98)
- Homepage prefers Neon when `DATABASE_URL` set —
  [PR #96](https://github.com/Better-Tables/better-tables/pull/96)
- SQLite driver detect by method signature (minification-safe) — `37b9b49`

First-audit findings are closed (ADAPTER-03–07, CORE-02–10, UI-05/06/08,
DX-10, `"use client"` unbundle, bun hoisted linker). Do not re-file.

---

## Deferred (revisit on request)

- **[058](058-global-search.md)** — written, valid, not started. Drift-check
  before pickup.
- **Column resizing / row expansion** — flags removed in 057; reintroduce
  flag + feature together.
- **Realtime UI** — UI flag removed; drizzle `subscribe` is real. Future
  059-style module (+ optional plugin).
- **Facets on derived columns** — fast-follow after 060 (landed).
- **Saved/named views** (`savedFilters()` plugin) — after plugin seam has
  a second real plugin; sketch in `table-definition-dx.md`.
- **Data import** — other half of export; large design, not near-term.
- **Other adapters** (post-062, on demand):
  - Supabase/PostgREST — strongest next candidate (own design pass).
  - TypeORM / Sequelize / MikroORM — declined for now.
  - MongoDB — post-1.0 (document vs FK semantics).
- **`memoryAdapter`** — landed in core (2026-07-20); 060 extends aggregates.
- **UI subpath exports** — rejected while `@better-tables/ui` stays private
  CLI-copy.

---

## Rejected (do not re-audit)

**2026-07-12:** exports map order; FilterState union shape; core resource
leaks; core `any` surface; JSONB/`sql.raw` defense; CSV formula escaping;
experimental prototypes stay test-only.

**2026-07-17:** `VirtualizedTable` default param; big-board 12.5k fetch
(deliberate); facet count coercion (already `mapWith(Number)`);
`timestamp_ms` gap (caught via `SQLiteTimestamp`); HTTP adapter is not a
duplicate contract; Actions secrets model clean; happy-dom advisory is
dev-only; fan-out / count agreement / mutation routing re-verified sound
post-020/030.
