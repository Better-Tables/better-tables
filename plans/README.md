# Implementation Plans — Ledger

Advisor-maintained ledger. First audit 2026-07-12 (at `55dfd01`), second deep
audit 2026-07-17 (at `787a816`). Executors: read your plan fully before
starting, honor its STOP conditions, and update your status row when done
(unless a reviewer told you they maintain the index). Rows here stay to one
line — detailed execution history lives in each plan file and in git history.

Layout: **maintainer policies** → **current status** → **outstanding work**
(the 033–060 plan roster, execution order, runbook, maintainer
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
- **PRISMA DIRECTION (2026-07-20, replaces the 2026-07-13 PRISMA HOLD)**:
  the Prisma plan is now the COMPLETE Drizzle-parity adapter —
  plan [061](061-prisma-adapter-full-parity.md) (supersedes the 008 spike).
  Kysely follows on the same conformance suite
  ([062](062-kysely-adapter.md)). Execution scheduling stays with the
  maintainer via this ledger; the old "nothing until everything else is
  done" gate no longer applies.

---

## Current status (2026-07-18, Wave B merged to `main`)

- **All 32 plans from the first audit are DONE and merged** except 008
  (Prisma spike — ON HOLD by maintainer decision). See the done archive.
- **Wave A (033–036, 040, 046, 047) is DONE and merged to `main`** via
  [PR #83](https://github.com/Better-Tables/better-tables/pull/83)
  (`b9f9bef`, 2026-07-18). Pre-0.6-publish gates landed.
- **Wave B (037–039, 041–045, 051, 052) is DONE and merged to `main`** via
  [PR #85](https://github.com/Better-Tables/better-tables/pull/85)
  (`46c9f73`, 2026-07-18). Cubic AI review completed (pass, no findings)
  and required CI was green before merge. Wave C remains TODO.
- **Second deep audit produced plans 033–052** (written 2026-07-17);
  maintainer decisions folded into the relevant plans — see below.
- **Reconcile audit 2026-07-18 (at `7b58ed8`): all 17 merged plans VERIFIED
  against their done criteria at HEAD** — see "Reconcile audit" below. Wave C
  TODO plans drift-checked and refreshed; findings still valid.
- **Plan [053](053-editable-cells.md) written (2026-07-18)** — `.editable()`
  inline cell editing, the maintainer's chosen next feature; scoping
  decisions collected and folded in. It heads Wave C.
- **0.6 remains SHIPPABLE**; Wave A landed the pre-publish obligations
  (033 infra truth, 035 HTTP wire hardening, 040 facet top-100, 047 writes).
- **2026-07-20 (at `27c59b9`, branch `docs-overhaul-and-cli-init-fix`,
  [PR #88](https://github.com/Better-Tables/better-tables/pull/88))**: docs
  handbook overhaul shipped; legacy column-factory entry points REMOVED
  (release-policy removal — `defineColumns` kept as the standalone-columns
  utility); **`memoryAdapter` landed in core** (closes the deferred DIR-05
  in spirit — core-hosted rather than toolkit-native); homepage demo ported
  to flagship `defineTable` path builders. **Wave D planned (056–060)**:
  maintainer-requested plans for the typecheck race, dead reserved contract
  surface, global search, UI modules (actions extracted, opt-in), and
  filterable/sortable derived aggregate columns.

---

## Outstanding

Wave A and Wave B are merged. Remaining: Wave C (048–050) plus the held 008.
All 2026-07-17 audit findings are planned.

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
| [037](037-cli-bundled-ui-source.md) | Bundle `ui/src` into the CLI tarball; `init` copies from disk (kills the mutable-`main` download) | 033 (same file) | DONE (merged to main, PR #85) |
| [038](038-operator-column-type-single-source.md) | Single-source the operator + `ColumnType` tables (kill the 4-way drift); option equality canonicalized to `is`/`isNot` | none | DONE (merged to main, PR #85) |
| [039](039-documentation-truth.md) | Docs truth: READMEs + lean 0.6 `wiki.md` handbook on the flagship API, migrate+compile drizzle examples, dead-link fixes, toolkit README, runbook erratum, `@deprecated` nudge | none | DONE (merged to main, PR #85) |
| [041](041-client-render-performance.md) | Client perf: facet request dedup/cache, debounced URL serialization, stable filter-bar handlers (UI-09) | 035 (shares `http-adapter.ts`) | DONE (merged to main, PR #85) |
| [042](042-ui-test-coverage.md) | UI coverage: filter components + inputs + hooks, `table.tsx` interactions, deterministic timers | 033 | DONE (merged to main, PR #85; ~91 tests) |
| [043](043-integration-e2e-harness.md) | Cross-package integration test (real drizzle + real UI) + optional Playwright E2E over `/examples` | 033, 042 | DONE (merged to main, PR #85; Playwright E2E deferred) |
| [044](044-drizzle-module-decomposition.md) | Decompose the drizzle god modules: extract cache/export/meta; split `types.ts` behind a barrel | 038, 040 | DONE (merged to main, PR #85) |
| [045](045-column-builder-dedup.md) | De-duplicate the six column builders (shared operator setter; normalized accessor constraint) | 038 | DONE (merged to main, PR #85) |
| [051](051-robustness-sweep.md) | Robustness sweep: marketing singleton race, URL-decompression bound, resolver suggestion, detectDriver (investigate), computed-TREE (investigate), pg/mysql skip-guards | none | DONE (merged to main, PR #85) |
| [052](052-ci-toolchain-hygiene.md) | CI + toolchain: cache CI, clear Biome residue → **blocking lint**, postcss/turbo bumps, align bun pin ≥1.3.11, unused deps, `next typegen` | 033 | DONE (merged to main, PR #85) |

### Wave C — features / fast-follow (post-0.6-publish)

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [053](053-editable-cells.md) | **`.editable()` inline cell editing** — builder API, per-type in-cell editors (text/number/option/boolean/date), adapter+callback save, optimistic rollback, gating matrix, integration proof, dogfood example | 047, 042 (done) | DONE on `editable-cells` |
| [054](054-schema-driven-auto-columns.md) | **Auto columns from the schema** — `describeColumns` adapter capability (wire-proxied), `t.auto()` + no-factory `define` with explicit-wins merge, enum→option inference with humanized labels, facet-fallback dropdown options | 053 merged | DONE — executor-run in worktree, advisor-reviewed (criteria re-run, APPROVED), merged into `editable-cells` at `ec60f80` |
| [055](055-direct-save-path.md) | **Zero-boilerplate saves** — `tables.cellEditAction(def)` (serializable, `'use server'`-ready; the PRIMARY monolith path), `saveAction` prop, opt-in double-sided cell-oriented HTTP write proxy, **joined-table editing** (`resolveCellWriteTarget`; related-row writes proven in browser + integration test), dogfood on the direct path (custom route deleted) | 053, 054 | DONE — executor-run, advisor-reviewed (APPROVED), merged into `editable-cells` at `ec60f80` |
| [048](048-filter-group-builder-ui.md) | Visual filter group-builder UI (nested AND/OR) — fast-follow, contract already shipped | 015/016/017 (done) | TODO (reconciled 2026-07-18 — finding valid; see plan's reconcile note) |
| [049](049-plugin-hook-execution.md) | Execute the plugin hook seam (`beforeFetch`/`afterFetch`), validated by one real plugin | 018 (done) | TODO (reconciled 2026-07-18 — seam still stored-only; line refs refreshed) |
| [050](050-export-ui.md) | Export UI: `ExportButton`/`useTableExport` + `csvExport()` plugin + row-cap decision | 049, **059** | TODO (reconciled 2026-07-18; **2026-07-20: refresh against `plans/design/ui-modules.md` (created by 059 Step 1) before executing — `ExportButton` rides 059's `toolbarExtra` slot and ships as an `export` module; `TableConfig.exportOptions` is removed by 057, reintroduce only what the module needs as module-local props**) |
| 008 | Prisma adapter spike (read path) | — | **SUPERSEDED** by [061](061-prisma-adapter-full-parity.md) (2026-07-20 maintainer directive: full parity, not a spike; 008's research is inlined there) |

### Wave D — maintainer-requested (planned 2026-07-20 at `27c59b9`)

Written on maintainer request ("plans for each unimplemented contract, the
typecheck race, filterable computed/aggregate columns, and the plugin
rethink — action builder should be a plugin, not default-included").

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [056](056-toolkit-typecheck-ordering.md) | Deterministic root typecheck: `typecheck` gains `dependsOn: ["build", "^build"]` (same-package build/typecheck race — tsdown cleans `dist/` mid-`tsc`) | none | TODO |
| [057](057-contract-surface-truth.md) | Remove dead reserved surface: `TableConfig.defaultFilters/actionsConfig/exportOptions/theme/loadingState` + `TableFeatures.bulkActions/export/columnResizing/virtualScrolling/realTimeUpdates/rowExpansion` (0.6 removal policy; adapter contract untouched — `exportData`/`subscribe` are real) | none (coordinates with 050/058/059) | TODO |
| [058](058-global-search.md) | Global search as filter sugar: `buildSearchFilterGroup` OR-group over `.searchable()` columns, table-scoped `search` param (adapter-level field removed), `SearchInput` + URL sync — zero adapter changes | none | TODO |
| [059](059-ui-modules-and-actions-extraction.md) | **UI modules tier** (`better-tables add <module>`, module-shaped CLI manifest, `slots` seam in `table.tsx`) + actions toolbar extracted as the first opt-in module (maintainer decision: not default-included) | none; validates slot vs 050's ExportButton | TODO |
| [060](060-derived-aggregate-columns.md) | Server-derived aggregate columns: `t.count('posts')` renders/filters/sorts via correlated subqueries lowered into the drizzle computed-fields engine (tree-walk substitution closes 051 item 5 for specs); memoryAdapter nested-array aggregates; honest `filterable/sortable: false` defaults for `t.computed` | none (rebase order with 058 in `factory.ts`) | TODO |

### Wave E — adapter expansion (planned 2026-07-20 at `27c59b9`)

Maintainer directive: Prisma at full Drizzle parity (not the 008 spike),
then Kysely. Both ride a shared adapter conformance suite so "parity" is
executable, not aspirational.

| Plan | What | Depends on | Status |
|------|------|------------|--------|
| [061](061-prisma-adapter-full-parity.md) | **Prisma adapter, full parity** (supersedes 008): Phase 1 extracts an adapter conformance suite (memory+drizzle prove it), then emitter → reads/trees → filter-aware facets → DMMF `describeColumns` + typed factory → writes/`resolveCellWriteTarget`/events/export (lifts `export-format` to toolkit) → aggregates (sort-only; Prisma can't WHERE-by-count — capability-declared) → docs/CI/publish | none hard; Phase 7 gated on 060 | TODO |
| [062](062-kysely-adapter.md) | **Kysely adapter**: SQL-native composition (emitter + JOINs + `DataTransformer` + alias utils — the toolkit's other stress direction), runtime `db.introspection` for `describeColumns`, explicit `relationships` config for dot-paths, full writes/events/export, FULL aggregate parity (render+filter+sort) | 061 Phases 1+6; aggregates gated on 060 | TODO |

### Reconcile audit (2026-07-18, at `7b58ed8`)

Both merged waves were re-verified against their done criteria at HEAD by two
independent auditors (every cheap criterion re-run; key implementations and
~25 new tests spot-read for substance). **All 17 plans hold — no criteria
failures, no silent deviations.** Full gates at HEAD: typecheck 10/10 ·
core 1216/0 · toolkit 114/0 · ui 94/0 · cli 140/0 · drizzle 620/0 (+185
env-DB skips via 051's guards) · marketing 17/0 · `bun audit` clean
(closes 052's last skipped criterion) · `bunx biome check .` 0 errors.
Notes for the record (all acceptable, none require action):

- 034: its two "no `filters = []`" greps match only a JSDoc `@example` for a
  reference implementation — the real hook uses frozen `EMPTY_FILTERS`/
  `EMPTY_PARAMS`; the criterion was imprecise, the fix is correct.
- 036: the emitter interface lives in `filter-router.ts` (not `types.ts` as
  the plan's criterion assumed); `prefersDateSemantics` was correctly added
  there and to the drizzle emitter.
- 040's cache now lives in `adapter-cache.ts` (relocated by 044) with the
  eviction semantics intact.
- 043: Playwright E2E deferred per the plan's own escape hatch (recorded).
- 044: `drizzle-adapter.ts` shrank ~223 lines (criterion estimated ~350) —
  all structural deliverables present; cosmetic gap only.
- 045: id/accessor overrides remain as thin typed declarations (bodies
  delegated) — public signatures preserved as required.
- 051 items 4 (detectDriver) + 5 (computed-TREE) documented-and-deferred per
  their INVESTIGATE escape hatches; MIGRATION "Known gaps" records item 5.

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
- **053 is independent of 048/049/050** — it builds on the merged 047 write
  surface and 042 test harness; it can run first (it's the maintainer's
  chosen next feature). Its `commitEdit` seam is designed to accept 049's
  future `beforeSave`/`afterSave` hooks without rework.
- Within Wave A, 034/035/036/040/046/047 touch largely disjoint files and can
  run in parallel worktrees; 033 first is safest (test-cache correctness).
- **Wave D ordering**: 056 any time (one-line turbo change — do it first for
  a stable gate). 057 before or parallel with 058/059 (disjoint fields;
  057 deliberately does NOT touch `FetchDataParams.search` — 058 owns it —
  and does not touch `actions`/`TableAction` — 059 owns packaging). 058 and
  060 both extend the instance fetch path in `packages/core/src/factory.ts`
  — land in either order, rebase the second. **050 executes only after 059**
  (slot seam + module packaging) and after refreshing its plan text against
  `plans/design/ui-modules.md` (created by 059 Step 1 — a forward deliverable,
  not an existing prerequisite). 049 remains independent (core-tier hooks);
  its vocabulary rule — core tier = "plugins", copied-UI tier = "modules" —
  is defined in 059.
- **Wave E ordering**: 061 is phased and mergeable per phase; its Phase 1
  (conformance suite over memory+drizzle) is valuable standalone and is a
  prerequisite for 062 (along with Phase 6's export-format lift). 057/058
  first SHRINK the contract 061 must implement — schedule them ahead when
  possible. 060 gates 061 Phase 7 / 062 Step 6 (aggregates); both plans
  skip that phase cleanly if 060 hasn't landed. Note the capability
  asymmetry 061 surfaces: Prisma can sort-by-relation-count but not
  filter-by-count, while Kysely (and Drizzle) do all three — 060's design
  step weighs per-operation capability granularity for exactly this
  reason.

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
-   Local quality gates = **no git hooks**; Biome residue cleared and CI lint
  **blocking** (plan 052 — DONE, merged to main via PR #85).
- Bun pin **aligned to current ≥1.3.11** (plan 052).
- `wiki.md` → **lean hand-written 0.6 handbook**, old wiki archived out of the
  agent path (plan 039).
- Direction features to build this wave: **plugin hooks** (049) + **export UI**
  (050). In-memory adapter and saved views were **not selected** — see
  "Deferred by decision".

Magic-DX decisions (collected 2026-07-18 after 053 shipped; folded into plans 054/055):

- **The monolith is the PRIMARY story** (Next.js, TanStack Start): tables
  work directly with the mounted adapter/instance; `httpAdapter` is ONLY for
  genuinely separated frontend/backend deployments and docs/examples present
  it that way. The editable marketing example uses the direct path.
- **Cell-edit saves cross the client boundary via a generated action**:
  `tables.cellEditAction(def)` — serializable in/out, exported through a
  `'use server'` one-liner (Next) or `createServerFn` (TanStack Start). This
  partially UN-defers the 2026-07-17 "HTTP adapter is the bridge" decision —
  scoped to the cell-edit action only, not a full server-actions data bridge.
- **HTTP writes: opt-in on BOTH sides** (`writes: true` on handler + client),
  schema-derived allow-list via `describeColumns` (fail closed without it),
  server-side type coercion, authorize dev-warning. Deliberately reverses
  053's "writes are never proxied" boundary under double opt-in.
- **`.editable()` stays per-column** — table-level enable-all was REJECTED
  (auto-inferred columns are read-only until explicitly overridden).
- **Auto columns in both forms**: no-factory `define('users')` + `t.auto()`
  spread (explicit wins by id), resolved lazily at mount via the new
  `describeColumns` adapter capability.
- **Option dropdowns: enum → facets** — schema enums populate options with
  humanized labels; option columns without enum metadata lazily fetch
  `getFilterOptions`; declared options always win.
- **Enrichment ≠ `t.auto()`** (clarified 2026-07-18): explicitly declared
  columns self-infer missing config (`t.option('status')` gets its enum
  choices with no `.options()` and no `t.auto()`); `t.auto()` exists ONLY to
  include the rest of the table's columns, and auto-inclusion never becomes
  the default (declared subsets are deliberate — schemas contain columns
  that must not silently render).

`.editable()` decisions (collected 2026-07-18, folded into plan 053):

- **Save path = adapter + callback**: default through the 047 write surface,
  gated on `features.update` + resolvable field/rowId; `onCellEdit` callback
  overrides/enables (the httpAdapter path — writes stay un-proxied).
- **Optimistic updates with rollback** on save failure.
- **Trigger UX**: double-click or Enter opens; Enter/blur commits; Escape
  cancels; option/boolean commit on selection/toggle.
- **V1 types**: text (+email/url/phone), number (+currency/percentage),
  option, boolean, date. `multiOption`/`json` read-only in v1; `custom` via
  `editRenderer`.
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
  **Watch (2026-07-18)**: a residual variant persists under `turbo run
  typecheck --force` in a warm tree — a ROTATING package fails with TS2307
  "Cannot find module '@better-tables/core'" (tsc reading core's dist while
  tsdown rewrites it) while direct per-package `tsc --noEmit` and settled
  non-forced runs pass 10/10. Retry the run before believing a TS2307; CI
  (fresh install, cached but unforced) has not exhibited it.
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

- **DIR-05 in-memory adapter** — **LANDED 2026-07-20** (not as originally
  scoped): `memoryAdapter(rows)` ships from `@better-tables/core`
  (`packages/core/src/adapters/memory-adapter.ts`) rather than as a
  toolkit-native adapter — full filter/sort/pagination/facets/describeColumns
  over arrays. The toolkit-port-validation goal transfers to the (still held)
  Prisma spike. Plan 060 extends it with nested-array aggregates.
- **Column resizing** (`features.columnResizing`): flag removed by 057 (was
  contract-only, no implementation). Reintroduce flag + feature together via
  a future plan when prioritized.
- **Row expansion** (`features.rowExpansion`): same disposition as resizing —
  removed by 057; feature plan on request.
- **Realtime UI** (`features.realTimeUpdates`): the UI flag is removed by 057,
  but the ADAPTER half is real — drizzle implements `subscribe` and emits
  insert/update/delete on mutations (`drizzle-adapter.ts:1337`, emits at
  `:1161/:1196/:1227/:1259/:1290`). A future realtime capability ships as a
  059-style module (+ possibly a 049 plugin) riding `subscribe`.
- **Facets on derived columns** (count range slider via `getMinMaxValues`):
  explicitly deferred out of plan 060 — natural fast-follow once 060 lands.
- **Other ORM/data-client adapters** (2026-07-20 survey, on the "any other
  ORM?" question — revisit on demand; each would ride 061's conformance
  suite):
  - **TypeORM / Sequelize**: DECLINED for now — large but legacy/declining
    installed bases, decorator/legacy APIs make introspection awkward, and
    their users are Prisma/Drizzle migration candidates anyway.
  - **MikroORM**: DECLINED — capable but small audience relative to build
    cost; its users can follow the Kysely template if demand appears.
  - **Supabase** (`supabase-js`/PostgREST): the strongest NEXT candidate —
    huge app-dev audience, filter language maps well
    (`ilike`/`in`/`gte`), auth/RLS story composes with the HTTP adapter's
    allow-list model. Needs its own design pass (no JOIN aliasing;
    embedded-resource selects instead) — plan on request after 062.
  - **MongoDB (mongoose)**: DEFERRED — document model changes relation
    semantics (embedded arrays vs FK paths); memoryAdapter's nested-array
    aggregate semantics (060) are the closest precedent. Post-1.0
    question.
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
