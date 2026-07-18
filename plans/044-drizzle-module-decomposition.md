# Plan 044: Decompose the Drizzle god modules (extract cache/export/meta; split the types junk drawer)

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index. This is
> a pure refactor — public behavior and exports must be byte-identical; the
> existing SQLite suite is your characterization net.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/adapters/drizzle/src`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (high-traffic files; extract behind unchanged public surface)
- **Depends on**: 038 (thins `buildAdapterMeta` first), 040 (touches the cache — land 040's cache eviction, then extract)
- **Category**: tech-debt
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

Two Drizzle files are god modules with the highest churn in the repo,
creating real change-amplification (unrelated concerns collide in one review
surface and one test file):

- **DEBT-03**: `drizzle-adapter.ts` (1654 lines; 35/543 commits touch it)
  mixes read/facets, CRUD/bulk/export, an in-class cache, CSV/export
  conversion, and ~170 lines of static capability tables in one class.
- **DEBT-09**: `types.ts` (1398 lines; 34 commits) is a type junk drawer —
  driver maps, aggregate types, query-builder interfaces, adapter config,
  relationship types, computed-field types, filter hooks — all with high
  fan-in.

The lowest-risk, highest-value cut is extracting the three self-contained
seams from the adapter (cache, export conversion, meta tables — ~350 lines,
near-zero behavioral risk) and splitting `types.ts` along its existing
comment-delimited seams behind a barrel (import sites unchanged).

## Current state

Verified at `787a816`:

- `drizzle-adapter.ts` self-contained seams:
  - Cache: `:154` `private cache`; `:1378` `getCacheKey`; `:1439-1466`
    `setCache`/`isCacheExpired`/`invalidateCache` (plan 040 adds eviction here
    first).
  - Meta: `:1209-1359` `buildAdapterMeta` (+ `canResolveMutationTable`); plan
    038 thins this to derive from core.
  - Export/CSV: `:1597-1660` `convertToExportFormat`/`convertToCSV`/
    `getMimeType`.
- `types.ts` seam headers (comment-delimited, verified by grep):
  driver type-maps (`PostgresDatabaseType` `:51`, `MySql` `:63`, `SQLite`
  `:91`, `DatabaseTypeMap`/`DatabaseDriver` `:116-129`), core type aliases
  (`AnyTableType` `:142`, `AnyColumnType` `:153`, `ColumnOrExpression` `:173`,
  `PrimaryKeyInfo` `:196`), aggregate types (`AggregateFunction` `:227`,
  `AggregateResult` `:245`, `MinMaxResult` `:270`), inference helpers
  (`InferColumnType` `:281` … `GetTableColumnNames` `:332`),
  `DatabaseOperations` `:377`, and further down relationship/computed-field/
  filter-hook types.
- All these are imported across `drizzle-adapter.ts`,
  `drizzle-predicate-emitter.ts`, `relationship-*.ts`, `query-builders/`,
  `operations/` — a barrel re-export keeps every import path working.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `cd packages/adapters/drizzle && bun run build` | exit 0 |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | SQLite green (pg/mysql fail w/o env DBs) |
| Typecheck | `bun run typecheck` | exit 0 |
| Import-path check | `grep -rn "from './types'" packages/adapters/drizzle/src \| wc -l` | unchanged before/after |

## Scope

**In scope**:
- `packages/adapters/drizzle/src/drizzle-adapter.ts` (extract 3 seams)
- New: `adapter-cache.ts`, `export-format.ts`, `adapter-meta.ts` under
  `packages/adapters/drizzle/src/`
- `packages/adapters/drizzle/src/types.ts` → split into
  `types/{drivers,core,aggregates,inference,operations,relationships,computed-fields,filter-hooks}.ts`
  (names per the actual seams) + keep `types.ts` (or `types/index.ts`) as a
  re-export barrel
- Test file placements may move alongside extracted modules (optional)
- `plans/README.md` (no changeset — pure refactor, no public API change; if
  any public type export path changes, that WOULD need a changeset — avoid it)

**Out of scope**:
- Any behavior change (cache semantics, export output, meta values).
- `relationship-detector.ts` / `relationship-manager.ts` (DEBT-08 is a
  separate investigate item — plan 051).
- Changing which types are `export`ed or their public paths.

## Git workflow

- Branch: `drizzle-decomposition`; commits `Plan 044 Step N: …` (one commit
  per extraction so each is independently revertable).

## Steps

### Step 1: Extract the export/CSV conversion

Move `convertToExportFormat`/`convertToCSV`/`getMimeType` (`:1597-1660`) into
`export-format.ts` as standalone functions (they take data + format; pass any
needed config as args). The adapter's `exportData` calls them. Keep the CSV
formula-prefix escaping intact (it's a security control — plan ledger notes
CSV injection is handled).

**Verify**: `cd packages/adapters/drizzle && bun test` → export-related tests
pass unchanged; build exit 0.

### Step 2: Extract the cache

Move the cache into `adapter-cache.ts` as a small class (`AdapterCache` with
`get`/`set`/`invalidate`/`getKey`, carrying plan 040's LRU + eviction). The
adapter holds an instance. Keep the default-on + TTL + write-invalidation
semantics identical.

**Verify**: `bun test` → cache tests pass (incl. plan 040's eviction test);
build exit 0.

### Step 3: Extract the meta tables

Move `buildAdapterMeta` (post-038: derives supported operators/types from
core) + `canResolveMutationTable`'s meta-facing logic into `adapter-meta.ts`
as a function taking the inputs it needs (resolvable-mutation flag, supported
sets). The adapter calls it.

**Verify**: `bun test` → meta tests pass; `adapter.meta` shape identical
(add a snapshot-equality assertion if none exists).

### Step 4: Split `types.ts` behind a barrel

Create `src/types/` with seam-aligned files (drivers, core, aggregates,
inference, operations, relationships, computed-fields, filter-hooks). Move
each type group verbatim. Make `types.ts` (or `types/index.ts`, whichever
keeps `from './types'` resolving) re-export everything so NO import site
changes. If moving to `types/index.ts`, verify `./types` resolves to it.

**Verify**: `grep -rn "from './types'" src | wc -l` unchanged;
`bun run typecheck` → exit 0; `bun test` → pass.

### Step 5: Confirm no public surface drift + ledger

Diff the package's built `.d.ts` public exports before/after (or check
`src/index.ts`'s re-exports are unchanged). Confirm `git diff` shows only
moves, no logic edits. Update the plan 044 row.

**Verify**: `bun run build` exit 0; the package's public export list is
unchanged (grep `src/index.ts`); full drizzle SQLite suite green.

## Test plan

- No new behavior tests — the existing drizzle SQLite suite (586+) is the
  characterization net; it must stay green through every extraction.
- Add only: a `adapter.meta` equality snapshot (Step 3) and reuse plan 040's
  cache eviction test (Step 2) if not already present.

## Done criteria

- [ ] `adapter-cache.ts`, `export-format.ts`, `adapter-meta.ts` exist; `drizzle-adapter.ts` line count dropped ~350
- [ ] `src/types/` split exists; `types.ts`/`types/index.ts` re-exports all; `grep -rn "from './types'" src | wc -l` unchanged
- [ ] `bun run typecheck` exit 0; `cd packages/adapters/drizzle && bun test` SQLite green
- [ ] `bun run build` exit 0; public export list (`src/index.ts`) unchanged — NO changeset needed
- [ ] `git diff` shows moves, not logic changes
- [ ] `plans/README.md` updated

## STOP conditions

- Any extraction changes a test's expectation (behavior, not location) — STOP;
  an extraction leaked a logic change.
- Splitting `types.ts` forces an import-path change at any site (barrel didn't
  cover it) — resolve via the barrel; if a type must change its public path,
  STOP (that needs a changeset + is out of this pure-refactor's intent).
- The public `.d.ts`/`src/index.ts` export set changes — STOP and reconcile.

## Maintenance notes

- Do 038 and 040 before this so the extracted `adapter-meta`/`adapter-cache`
  are already in their final logical shape (fewer re-touches).
- These extractions should lower future churn on `drizzle-adapter.ts`; if a
  concern still can't be edited without touching the orchestrator, that's a
  signal the seam wasn't clean — note it.
- Reviewer scrutiny: confirm it's moves-only (byte-for-byte logic), and that
  the CSV formula-escaping survived the export extraction intact.
