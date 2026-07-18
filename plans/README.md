# Implementation Plans — Ledger

Advisor-maintained ledger. First audit 2026-07-12 (at `55dfd01`), second deep
audit 2026-07-17 (at `787a816`). Executors: read your plan fully before
starting, honor its STOP conditions, and update your status row when done
(unless a reviewer told you they maintain the index). Rows here stay to one
line — detailed execution history lives in each plan file and in git history.

Layout: **maintainer policies** → **current status** → **outstanding work**
(the full 033–052 plan roster, execution order, runbook, maintainer
decisions) → **operational notes** → **done archive** → **considered and
rejected / deferred**.

**Every audit finding is now a plan.** The 2026-07-17 backlog was fully
converted into plans 038–052 (2026-07-17); nothing actionable is left in a
loose "backlog" list. Items the maintainer explicitly chose NOT to plan this
wave are in "Deferred by decision" at the bottom.

---

## Maintainer policies (standing)

- **RELEASE POLICY (2026-07-12)**: one coordinated breaking upgrade — `0.6.0`
  (pre-1.0: the 0.x minor is the breaking slot; breaking changesets use
  `minor`). No deprecation cycles, no compat shims, no parallel v2 methods;
  replaced surface is removed outright. The deliverable owed to users is a
  MIGRATION GUIDE before the 0.6 publish (done — `MIGRATION.md`). One
  exception: URL wire-format READ compatibility (old `c:` payloads still
  parse) is kept — bookmarked URLs aren't API consumers. If any plan text
  still contains softer compat language, this policy wins.
- **PRISMA HOLD (2026-07-13)**: no Prisma implementation until everything
  else is done; Drizzle abstraction/provider-readiness proceeds.

---

## Current status (2026-07-17, Wave A merged to `main`)

- **All 32 plans from the first audit are DONE and merged** except 008
  (Prisma spike — ON HOLD by maintainer decision). See the done archive.
- **Wave A (033–036, 040, 046, 047) is DONE and merged to `main`** via
  [PR #83](https://github.com/Better-Tables/better-tables/pull/83)
  (`b9f9bef`, 2026-07-18). Pre-0.6-publish gates landed. Wave B/C remain TODO.
- **Second deep audit produced plans 033–052** (written 2026-07-17);
  maintainer decisions folded into the relevant plans — see below.
- **0.6 remains SHIPPABLE**; Wave A landed the pre-publish obligations
  (033 infra truth, 035 HTTP wire hardening, 040 facet top-100, 047 writes).

---

## Outstanding

Twenty active plans (033–052 + the held 008). All 2026-07-17 audit findings
are now planned. Statuses are TODO unless noted.

### Wave A — pre-0.6-publish (do these before shipping 0.6)

These either fix a shipped bug, protect the publish gates, or must land inside
the breaking window.

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [033](033-verification-infra-truth.md) | Verification-infra truth: turbo `tests/**` glob (stale-cache fix), marketing test wiring, `lint:fix` repair ×5, unskip+reconcile drizzle error-handling (SQLite), `.env.example`, `@types/bun` pin, happy-dom ≥20 | none | DONE (merged to main, PR #83) |
| [034](034-usetabledata-loop-and-date-render.md) | Fix `useTableData` unbounded refetch loop + formatter coercion for ISO-string/epoch dates | none | DONE (merged to main, PR #83) |
| [035](035-http-adapter-hardening.md) | HTTP adapter: `authorize`/`constrainRequest`/`onError` seam, 500-vs-400, generic errors, `faceted` wire fix, `FacetQueryParams.signal`, demo route pinned, docs + tests | none; **wire format free only pre-publish** | DONE (merged to main, PR #83) |
| [036](036-date-between-timestamp-fallback.md) | Date `between`/`notBetween` timestamp fallback + pg/mysql `between` coverage + router unit tests | none | DONE (merged to main, PR #83) |
| [040](040-adapter-performance.md) | Adapter perf: transformer memoization, bounded LRU cache, **facet LIMIT default top-100** (behavior change — 0.6 window) | none | DONE (merged to main, PR #83) |
| [046](046-path-types-finalization.md) | Finalize path-typed columns: promote from `experimental/` → core, runtime `humanize()` auto-labels, document depth-3 override, retire stale prototypes | none | DONE (merged to main, PR #83) |
| [047](047-typed-write-surface.md) | Typed explicit-table writes (`createRecord/updateRecord/deleteRecord`) on the instance — **into the 0.6 train** | 018, 002 (done) | DONE (merged to main, PR #83) |

### Wave B — quality, hardening, hygiene (any time; several rebase over Wave A)

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [037](037-cli-bundled-ui-source.md) | Bundle `ui/src` into the CLI tarball; `init` copies from disk (kills the mutable-`main` download) | 033 (same file) | DONE (wave-b branch) |
| [038](038-operator-column-type-single-source.md) | Single-source the operator + `ColumnType` tables (kill the 4-way drift); option equality canonicalized to `is`/`isNot` | none | DONE (wave-b branch) |
| [039](039-documentation-truth.md) | Docs truth: READMEs + lean 0.6 `wiki.md` handbook on the flagship API, migrate+compile drizzle examples, dead-link fixes, toolkit README, runbook erratum, `@deprecated` nudge | none | DONE (wave-b branch) |
| [041](041-client-render-performance.md) | Client perf: facet request dedup/cache, debounced URL serialization, stable filter-bar handlers (UI-09) | 035 (shares `http-adapter.ts`) | DONE (wave-b branch) |
| [042](042-ui-test-coverage.md) | UI coverage: filter components + inputs + hooks, `table.tsx` interactions, deterministic timers | 033 | DONE (wave-b-quality-hardening, 91 tests) |
| [043](043-integration-e2e-harness.md) | Cross-package integration test (real drizzle + real UI) + optional Playwright E2E over `/examples` | 033, 042 | TODO |
| [044](044-drizzle-module-decomposition.md) | Decompose the drizzle god modules: extract cache/export/meta; split `types.ts` behind a barrel | 038, 040 | DONE (wave-b-quality-hardening) |
| [045](045-column-builder-dedup.md) | De-duplicate the six column builders (shared operator setter; normalized accessor constraint) | 038 | DONE (wave-b branch) |
| [051](051-robustness-sweep.md) | Robustness sweep: marketing singleton race, URL-decompression bound, resolver suggestion, detectDriver (investigate), computed-TREE (investigate), pg/mysql skip-guards | none | DONE (wave-b branch) |
| [052](052-ci-toolchain-hygiene.md) | CI + toolchain: cache CI, clear Biome residue → **blocking lint**, postcss/turbo bumps, align bun pin ≥1.3.11, unused deps, `next typegen` | 033 | DONE (wave-b branch) |

### Wave C — direction / fast-follow (post-0.6-publish)

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [048](048-filter-group-builder-ui.md) | Visual filter group-builder UI (nested AND/OR) — fast-follow, contract already shipped | 015/016/017 (done) | TODO |
| [049](049-plugin-hook-execution.md) | Execute the plugin hook seam (`beforeFetch`/`afterFetch`), validated by one real plugin | 018 (done) | TODO |
| [050](050-export-ui.md) | Export UI: `ExportButton`/`useTableExport` + `csvExport()` plugin + row-cap decision | 049 | TODO |
| 008 | Prisma adapter spike (read path) | 007 (done) + lift of the PRISMA HOLD | **ON HOLD** (maintainer) |

### Dependency & ordering notes

- **038 before 044 and 045** — 038 thins `buildAdapterMeta` and canonicalizes
  operators before 044 extracts the meta module and 045 dedups the operator
  setters (fewer re-touches).
- **040 before 044** — 040 adds cache eviction; 044 then extracts the cache
  into `adapter-cache.ts` in its final shape.
- **035 before 041** — both touch `http-adapter.ts`; land 035, rebase 041.
- **033 before 037/042/052** — 033 fixes the turbo test-cache (so new tests
  run) and touches `packages/cli/package.json` (037) + `test.yml` (052).
- **049 before 050** — `csvExport()` rides the plugin seam 049 builds.
- Within Wave A, 034/035/036/040/046/047 touch largely disjoint files and can
  run in parallel worktrees; 033 first is safest (test-cache correctness).

### Maintainer decisions folded into the wave (collected 2026-07-17)

Design-doc open questions — now RESOLVED (plans update the docs to match):

- `table-definition-dx.md` **(a)** path types live in **core** (plan 046) ·
  **(c)** depth cap stays **3 + per-call override** (046) · **(d)** option
  auto-labels use a **runtime `humanize()`** (046) · **(e)** RSC bridge —
  **defer the server-actions variant; the HTTP adapter is the bridge** (035
  hardens it; no separate plan).
- `core-contract-v2.md` **(b)** group-builder UI = **fast-follow post-publish**
  (plan 048) · **(c)** `search` stays a **separate top-level param** (no
  change — recorded as decided) · **(d)** write signatures take an
  **explicit typed table**, built **into 0.6** (plan 047).

Audit/scope calls:

- Operator equality spelling = **`is`/`isNot`** (plan 038).
- Facet queries default to **top-100 by count**, `limit: null` opts out
  (plan 040).
- Local quality gates = **no git hooks**; Biome residue cleared and CI lint
  **blocking** (plan 052 — DONE on wave-b branch).
- Bun pin **aligned to current ≥1.3.11** (plan 052).
- `wiki.md` → **lean hand-written 0.6 handbook**, old wiki archived out of the
  agent path (plan 039).
- Direction features to build this wave: **plugin hooks** (049) + **export UI**
  (050). In-memory adapter and saved views were **not selected** — see
  "Deferred by decision".
- Per-component `@better-tables/ui` subpath exports — **rejected** (see
  Deferred by decision).

### Pre-publish runbook (the literal next release steps)

- Follow the maintainer runbook at the bottom of `MIGRATION.md`: toolkit
  version choice, one changeset train, restore the git remote, first CI run.
- **Toolkit version nuance**: package.json says 0.1.0 AND a minor changeset
  exists → `changeset version` publishes 0.2.0. Set package.json to 0.0.0
  pre-release if 0.1.0 is wanted as the first published version.
- **Changesets accumulate for one 0.6 train** — do not partially publish.
- The runbook erratum (`changeset:release` → `release`) is fixed by plan 039.

---

## Operational notes (read before working in this repo)

- Root `lint` script MUTATES (`biome check --write --unsafe .`) — check-only
  is `bunx biome check .`. Per-package `lint:fix` is broken (`--apply`)
  until 033 lands.
- Fresh worktrees: `bun install` first; build core and toolkit before
  running drizzle tests.
- bun ≥1.3.11's isolated linker races turbo-spawned tasks (bogus TS2307s) —
  fixed by `bunfig.toml` pinning `linker = "hoisted"` + clean reinstall.
  (Plan 052 aligns the CI/`packageManager` pin up to ≥1.3.11.)
- CI: first real run happens when the git remote is restored. Lint step is
  **blocking** (plan 052 cleared Biome residue to 0 errors).
- mysql-operations intentionally un-deduped (no RETURNING support —
  documented dialect difference, not drift).
- `apps/docs/.next` survives on disk as untracked, gitignored cruft from the
  5319fb1 removal — safe to `rm -rf`. Marketing typecheck prepends
  `next typegen` (plan 052) so stale `.next/types` cannot poison `tsc`.
- Biome: `bunx biome check .` → **0 errors** (plan 052); 82 warnings remain
  (mostly `noConsole` in CLI/examples/tests).

---

## Done — first-audit plans (all merged; details in each plan file + git log)

| Plan | Title | Merged | One-line outcome |
|------|-------|--------|------------------|
| 001 | CI gates every package | `2d115a2` | All-package paths, Bun pinned 1.3.1, static-checks job, test-cli, test-summary gates all |
| 002 | Explicit mutation-table routing | `fb7654e` | `defaultMutationTable`, throw-on-ambiguity, honest meta.features, wrong-table regression test |
| 003 | Join count inflation (MySQL/SQLite) | `acfad9d` | `countDistinct` guard both dialects; empirical proof total 4→3 |
| 004 | Validate URL state, fail closed | `ce9f1ea` | `isFilterStateShape` boundary guard, value-free warnings, pagination clamping |
| 005 | Builder type inference end-to-end | `97cd354` | Accessor/options infer real types; `defineColumns`; zero demo casts (maintainer-executed) |
| 006 | Design: contract v2 (registry + AND/OR) | `7fbc6f2` | Design doc + prototype + 11 type tests (maintainer-executed) |
| 007 | Extract adapters-toolkit | `81ca876` | Toolkit born (86 tests); filter-handler 2169→388; dialects −855 lines; ADAPTER-04 fixed |
| 009 | DX hygiene sweep | `f46baa0`+ | README truth, React 19+ badge, CLI output restored, `sideEffects` everywhere, drizzle deps → peers |
| 010 | UI hooks correctness + first UI test harness | `cf80ce7` | Dead-ref code gone, `FetchDataParams.signal`, harness + 7 tests, CI test-ui job |
| 011 | Design: Better-Auth config + path-typed defs | `a82dd7a` | Design doc + Paths prototype; perf gate 199k inst/1.03s (10× headroom) |
| 012 | Repair verification baseline | `e30ba00` | Frozen install fixed (lockfile, commander-14); CLI green — landed via 013's chain |
| 013 | Finish verification baseline | `e30ba00` | Per-package typecheck green ×4, turbo `typecheck`, script unification, lint 162→71 |
| 014 | Literal-preserving `.id()` | `11c2ac2` | Registry keystone; `ColumnRegistry` resolves literal keys, zero new `any` |
| 015 | FilterNode core + `c2:` wire format | `39ba6d3` | Types/guards/normalize, versioned URL format w/ `c:` read fallback, CORE-06 killed |
| 016 | FilterNode state layer | `39ba6d3` | Tree-preserving state + URL sync, flat UI unchanged, drizzle reject-guard |
| 017 | Drizzle FilterNode group translation | post-`dde0070` | Generic walk in toolkit router (Prisma inherits); count/data agreement proven; depth cap 3 |
| 018 | `betterTables()` instance + `defineTable` runtime | 2026-07-13 | Flagship API; legacy shell removed outright; perf gate 289k inst/0.85s; deferred list → backlog/direction |
| 019 | 0.5→0.6 migration guide | 2026-07-13 | MIGRATION.md (10 breaking surfaces + runbook); every example compile-checked in CI; zero changeset gaps |
| 020 | Join pagination under-fill | `8e15c00` | Two-phase fan-out pagination; ORDER fix follow-up merged 2026-07-13 (phase-2 rows reordered to phase-1 key order, 3 regression tests) |
| 021 | Filter-aware facets | 2026-07-13 | Additive FacetQueryParams; self-exclusion + distinct under joins |
| 022 | Relationship inference honesty | 2026-07-13 | Zero-match throws SchemaError + suggestions; Strategy 3 FK-verified |
| 023 | Shared subscription emitter | `f657c6c` | `Subscribable` base; six managers migrated; log-never-swallow |
| 024 | Virtualization offset correctness | `e68b9fd` | Lazy prefix offsets; O(log n) position lookup (CORE-03/09) |
| 025 | UI render performance | 2026-07-13 | Memo rows/observers; effect churn cut; render harness (UI-05/06/08) |
| 026 | Strictness flags (DX-10) | `3ef0028` | noUncheckedIndexedAccess + exactOptionalPropertyTypes in core/ui/cli; 0 `!` |
| 027 | Null-filter semantics (Option A) | `8cad0b4` | includeNull satisfies value req; null-only leaves no longer dropped (CORE-10) |
| 028 | Real timezone conversion | `d06fee9` | `@date-fns/tz` conversion; UTC builder default honored (MIGRATION §11, CORE-04) |
| 029 | Marketing showcase dogfood | `68d9423` | 4 flagship-API examples browser-verified; harvested 17 DX findings (`findings/029-dx-findings.md`) |
| 030 | Multi-table identity done right | 2026-07-13 | Table-scoped `fetchData` w/ `primaryTable` injection; keying fix (SQL name ≠ JS key); SchemaError on ambiguity; auto-embed filter/sort relations; MIGRATION §12 (findings 9/10/11/14/16) |
| 031 | Filter-authoring type-safety | `e3a5e0a` | Per-type operator unions, `filterHasValue`, filter `id`, typed `buildFilter`; +text isNull revision (findings 1/2/8/17; 12 deferred) |
| 032 | UI integration gaps | `c0c2524` | Soft-nav chip rehydration, virtualized formatter + data hook, `useFacets` + `FacetedFilterSidebar`, `table=` prop (findings 5/6/7/15) |

Post-merge adversarial review of 020–028 (2026-07-13, three parallel
reviewers): 8/9 SOUND; the one confirmed bug (020 fan-out order) was fixed
and regression-locked — reflected in 020's row above.

### Non-plan work merged since the first audit (for completeness)

- `cc7d5a3` — maintainer backlog sweeps: CORE-02 (percentage format),
  CORE-04 locale slice, CORE-07 (state-update batching), ADAPTER-07
  (wrong-type values throw), ADAPTER-05 alias-scan slice, date-presets
  hygiene.
- `71959dc` — homepage demo fixed: drizzle-seed ≥0.1.3
  `maxRepeatedValuesCount` seed error resolved; `defaultPrimaryTable` +
  explicit columns adopted. Closes the 029 faker backlog item.
- `fbd7f9a` — SQLite timestamp date filters fixed (getTime crash, wrong
  units, dropped between). Plan 036 completes its missing fallback.
- `5319fb1` — `apps/docs` removed; note the promised docs-fold into
  marketing produced no `/docs` routes (see teaching-surface backlog item).
- `787a816` — 029-findings close: HTTP adapter (client/handler/protocol),
  virtualized `BetterTable`, usable inferred rows, UI filter-component
  rewrites. Audited by the 2026-07-17 wave (plans 034/035 target it).

### Resolved audit findings (don't re-file)

First-audit findings, all fixed: ADAPTER-03 (020) · ADAPTER-04 (007) ·
ADAPTER-05 (slice + 022) · ADAPTER-06 (021) · ADAPTER-07 (sweep) · CORE-02 ·
CORE-03/09 (024) · CORE-04 (sweep + 028) · CORE-06 (015) · CORE-07 · CORE-08
(023) · CORE-10 (027) · UI-05/06/08 (025) · DX-10 (026) · the `"use client"`
banner blocker (ui builds `unbundle: true`, per-file directives preserved in
41 dist files) · homepage faker seed (`71959dc`) · date-presets non-null
hygiene · bun isolated-linker flaky typecheck (bunfig hoisted pin).

---

## Deferred by decision (maintainer chose not to plan this wave — revisit on request)

- **DIR-05 in-memory adapter** (toolkit-native second adapter): grounded and
  valuable (backs UI tests/demos, de-risks Prisma), but not selected for this
  wave. Plan 043 uses `bun:sqlite` + Drizzle for its integration test instead;
  if that proves the toolkit ports are ORM-neutral, the in-memory adapter is
  the natural next spike.
- **DIR-03 saved/named views** (`savedFilters()` plugin over the existing
  FilterState serialization): deferred until the plugin seam (049) and a
  second real plugin exist to validate the storage-port shape. The design is
  sketched in `table-definition-dx.md:339-344`.
- **Per-component `@better-tables/ui` subpath exports**: REJECTED — the
  package is private and distributed by CLI copy, so npm-style subpaths serve
  only the in-repo marketing app, and plan 037 bundles ui source into the CLI
  regardless. Revisit only if `@better-tables/ui` is ever published to npm.
- **Data import (CSV upload / column mapping / upsert)**: the deferred other
  half of export (plan 050 ships export only) — a much larger design, not a
  near-term plan for a read-focused library.
- **Prisma adapter (008)**: ON HOLD per the standing PRISMA HOLD; the only
  thing that lifts it is finishing the rest of the board.

## Considered and rejected (so nobody re-audits)

From the 2026-07-12 audit:

- Package `exports` maps ordering — already correct (`types` first, ESM/CJS paired).
- `FilterState` discriminated-union design — sound; the `columnId` linkage
  gap was the real issue (addressed by 006/014's registry line).
- Core resource leaks — none found; ResizeObserver disconnected; registry GC-safe.
- Type escape hatches in core — notably clean; the `any` that mattered (ui
  boundary) was fixed in 005.
- JSONB/array `sql.raw` paths — adequately defended; only identifier quoting
  was weak (fixed in 007 step 3 / ADAPTER-04).
- CSV export injection — already handled (formula-prefix escaping + quote doubling).
- Experimental prototype (`packages/core/src/types/experimental/`) —
  test-only, NOT in the build; keep as the seed for the future tuple-derived
  registry (018's `ColumnId` flag).

From the 2026-07-17 audit:

- `VirtualizedTable`'s `virtualization = {}` default param — absorbed by
  `useVirtualization`'s primitive-keyed memo; not the `useTableData` bug (034).
- Big-board demo fetching 12.5k rows in one request — deliberate
  virtualization showcase, marketing-only.
- `getFacetedValues` count not `Number()`-coerced — Drizzle
  `count()`/`countDistinct()` carry `.mapWith(Number)`; already numbers.
- `timestamp_ms` gap in `isTimestampColumn` — not a bug; those columns carry
  `columnType: 'SQLiteTimestamp'` and are caught.
- HTTP adapter duplicating the adapter contract — it doesn't; it reuses
  `TableAdapter`/`FetchDataParams` and adds only a wire envelope.
- GitHub Actions injection/secrets exposure — clean (no `pull_request_target`,
  no PR-controlled `run:` interpolation, major-tag pins); optional hardening:
  SHA-pin `softprops/action-gh-release`.
- happy-dom critical advisory as a runtime risk — dev-only in the private ui
  package's test harness (bump ships in 033); no runtime path.
- Fan-out pagination, count/data predicate agreement, mutation/read
  ambiguity routing, `read-source.ts` path handling — re-read post-020/030
  and verified sound.
