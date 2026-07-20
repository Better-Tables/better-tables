# Plan 057: Remove the dead reserved surface from TableConfig/TableFeatures

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/core/src/types/table.ts packages/ui/src/components/table/table.tsx apps/marketing/content/docs/better-table.mdx apps/marketing/content/docs/selection-and-actions.mdx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (breaking type removals — sanctioned by the standing 0.6 release policy; risk is missing a stray consumer)
- **Depends on**: none. **Coordinate with**: 058 (owns `FetchDataParams.search` — do NOT touch it here), 059 (owns `actionsConfig`/`bulkActions` reintroduction decisions), 050 (owns export UI; `exportData`/`ExportParams` on the adapter contract STAY).
- **Category**: tech-debt
- **Planned at**: commit `27c59b9`, 2026-07-20

## Why this matters

`TableConfig`/`TableFeatures` in core declare a set of fields that **no code
reads**: `defaultFilters`, `actionsConfig`, `exportOptions`, `theme`,
`loadingState`, and the feature flags `bulkActions`, `export`,
`columnResizing`, `virtualScrolling`, `realTimeUpdates`, `rowExpansion`.
Because `BetterTableProps` extends `TableConfig`, all of them typecheck as
props — users set them, nothing happens, and the docs have to carry a
"contract-only, not working" disclaimer
(`apps/marketing/content/docs/better-table.mdx`, "Contract-only props"
section). The repo's standing release policy
(`plans/README.md`, "Maintainer policies"): *"No deprecation cycles, no
compat shims … replaced surface is removed outright"* — the 0.6 window is
the sanctioned moment to delete this surface. Each capability comes back
only when a real implementation lands (several already have plans: export →
050, actions-as-module → 059, search → 058).

## Current state

Verified at `27c59b9`. The single source of the dead fields is
`packages/core/src/types/table.ts`:

```
:66   defaultFilters?: FilterState[] | FilterGroupNode;
:78   actionsConfig?: ActionsConfig;
:81   exportOptions?: ExportConfig<TData>;
:87   theme?: TableTheme;
:90   features?: TableFeatures;
:96   emptyState?: EmptyStateConfig;      ← WIRED, keep
:99   loadingState?: LoadingStateConfig;
:102  errorState?: ErrorStateConfig;      ← WIRED, keep
```

`TableFeatures` (same file):

```
:139  bulkActions?: boolean;
:142  export?: boolean;
:145  columnResizing?: boolean;
:159  virtualScrolling?: boolean;
:162  realTimeUpdates?: boolean;
:168  rowExpansion?: boolean;
```

What the copied UI actually consumes (the ground truth for keep vs delete),
`packages/ui/src/components/table/table.tsx`:

```
:698  const {
        filtering = true,
        sorting: sortingEnabled = true,
        pagination: paginationEnabled = true,
        rowSelection = false,
        headerContextMenu,
        columnReordering = false,
      } = features;
:721  const shouldShowRowSelection = actions.length > 0 || rowSelection;
:1251 showColumnVisibility={features.columnVisibility !== false}
```

So the LIVE `TableFeatures` set is exactly: `filtering`, `sorting`,
`pagination`, `rowSelection`, `headerContextMenu`, `columnReordering`,
`columnVisibility`. Everything else in the interface is dead.

Other verified facts you will rely on:

- `grep -rn "defaultFilters\|exportOptions\|actionsConfig\|loadingState" packages/ui/src --include='*.ts*'`
  → zero non-comment matches. `theme` matches in
  `packages/ui/src/components/filters/filter-bar.tsx:62` are a **local**
  `FilterBarTheme` prop unrelated to `TableConfig.theme` (BetterTable never
  passes it — `grep -n "theme=" packages/ui/src/components/table/table.tsx`
  → nothing). Leave `FilterBarTheme` alone.
- The real initial-filters seam is the `initialFilters` prop
  (`table.tsx:169`), not `TableConfig.defaultFilters`.
- The real virtualization seam is the `virtualized` prop
  (`table.tsx:150`), not `features.virtualScrolling`.
- The real loading seam is the `loading` boolean prop (`table.tsx:160`),
  not `loadingState`.
- Adapter-contract surface that STAYS (do not remove): `exportData?()` and
  `ExportParams`/`ExportResult` (`packages/core/src/types/adapter.ts:537`,
  `:219`) — plan 050 ships the UI for the already-working drizzle
  implementation. `subscribe?()` (`adapter.ts:555`) also STAYS: the drizzle
  adapter genuinely implements it (subscriber list at
  `drizzle-adapter.ts:159`, `subscribe` at `:1337`, and mutations emit
  events via `this.emit(...)` at `:1161/:1196/:1227/:1259/:1290`). Only the
  UI-side `realTimeUpdates` flag is dead.
- `FetchDataParams.search` (`adapter.ts:55`) is dead too but is **owned by
  plan 058** (which turns search into a real feature) — out of scope here.
- Docs that must change with the removals:
  `apps/marketing/content/docs/better-table.mdx` — the `## Contract-only
  props` section and the feature-flags paragraph ("The `TableFeatures` type
  also declares `bulkActions`, `export`, `columnResizing`,
  `virtualScrolling`, `realTimeUpdates`, and `rowExpansion` — those flags
  are contract-only today…"); `selection-and-actions.mdx` — the trailing
  `ActionsConfig`-is-contract-only paragraph.
- Repo conventions: breaking changesets use `minor` on `@better-tables/core`
  pre-1.0 (release policy). Changeset files live in `.changeset/*.md` — see
  `.changeset/memory-adapter-filter-fixes.md` for the format.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Core tests | `cd packages/core && bun test` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| Marketing tests | `cd apps/marketing && bun test` | all pass |
| Typecheck (root) | `bun run typecheck` | exit 0 |
| Lint (scoped) | `bunx biome check packages/core packages/ui apps/marketing` | 0 errors |

## Scope

**In scope**:
- `packages/core/src/types/table.ts` (field + now-orphaned interface removals)
- `packages/core/src/types/index.ts` / `packages/core/src/index.ts` (drop
  exports that become orphaned, e.g. `TableTheme`, `LoadingStateConfig`,
  `ExportConfig`, `ActionsConfig` — verify each with grep before deleting)
- `packages/core/tests/**` (update any test that references removed fields)
- `packages/ui/src/**` only if a stray type import of a removed name exists
  (grep first; expected: none)
- `apps/marketing/content/docs/better-table.mdx`,
  `apps/marketing/content/docs/selection-and-actions.mdx`
- `.changeset/contract-surface-truth.md` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `FetchDataParams.search` — plan 058's opening move.
- `exportData`/`ExportParams`/`ExportResult`/`subscribe`/`DataEvent` on the
  adapter contract — real, working surface (see Current state).
- `AdapterFeatures` on `AdapterMeta` (`create/read/update/delete/
  bulkOperations/realTimeUpdates/export/transactions`) — those are honest
  adapter capability declarations consumed by the editing gate
  (`features.update`); leave them.
- `emptyState`/`errorState` configs and their interfaces — wired.
- `FilterBarTheme` in `filter-bar.tsx` — local component prop, reachable by
  consumers using `FilterBar` directly.
- The `actions` prop and `TableAction` type — live feature (plan 059 decides
  its packaging, not this plan).

## Git workflow

- Branch: current working branch unless the operator says otherwise.
- One commit per step group is fine; subject style: plain imperative
  (`Remove dead reserved surface from TableConfig/TableFeatures`).

## Steps

### Step 1: Confirm each field is still dead (guard against drift)

For each of: `defaultFilters`, `actionsConfig`, `exportOptions`,
`loadingState`, `bulkActions`, `columnResizing`, `virtualScrolling`,
`realTimeUpdates`, `rowExpansion`, plus `TableConfig`-level `theme`:

```bash
grep -rn "<name>" packages/ui/src packages/core/src --include='*.ts*' | grep -v "types/table.ts" | grep -v "\.test\."
```

Expected: only comment/docs hits, no functional reads (for `theme`, ignore
`filter-bar.tsx`'s local `FilterBarTheme`; for `features.export`, search
`features.export\|features?.export` to avoid matching `exportData`).

**Verify**: paste the grep results into your report; all functional-read
counts are zero.

### Step 2: Delete the dead fields

In `packages/core/src/types/table.ts` remove the fields listed in Current
state (`:66,:78,:81,:87,:99` and the six `TableFeatures` flags), including
their JSDoc blocks and any `@example` usages of them in the file-top JSDoc
(`:35` `defaultFilters`, `:39` `exportOptions`, `:41` `theme` appear in the
`TableConfig` doc example — update the example to only show live fields).

**Verify**: `cd packages/core && bun run typecheck` → the ONLY errors (if
any) are now-orphaned interfaces/imports inside core, which Step 3 removes.

### Step 3: Remove now-orphaned types and exports

For each of `ActionsConfig`, `ExportConfig`, `TableTheme`,
`LoadingStateConfig` (and anything else Step 2 orphaned):

```bash
grep -rn "<TypeName>" packages --include='*.ts*' | grep -v node_modules | grep -v dist
```

If the only remaining references are its own definition + barrel exports +
tests of the type's mere existence, delete the definition, the barrel
export, and update the tests. If a REAL consumer shows up, STOP (see STOP
conditions). Note: `LoadingStateConfig`'s interface is around
`types/table.ts:321`; `EmptyStateConfig` (~`:262`) and `ErrorStateConfig`
(~`:343`) stay.

**Verify**: `bun run typecheck` (root) → exit 0.

### Step 4: Update tests

`grep -rn "defaultFilters\|exportOptions\|actionsConfig\|loadingState\|virtualScrolling\|realTimeUpdates\|rowExpansion\|columnResizing\|bulkActions" packages/core/tests packages/ui/tests`
and fix every hit (most likely: type-shape tests asserting the config
compiles). Do not weaken behavioral assertions — only remove references to
deleted fields.

**Verify**: `cd packages/core && bun test` and `cd packages/ui && bun test`
→ all pass.

### Step 5: Update the docs

- `better-table.mdx`: delete the `## Contract-only props` section entirely;
  rewrite the `TableFeatures` paragraph to list ONLY the live flags
  (`filtering`, `sorting`, `pagination`, `rowSelection`,
  `headerContextMenu`, `columnReordering`, `columnVisibility`) with the
  note that bulk-action visibility is driven by `actions` being non-empty.
- `selection-and-actions.mdx`: delete the trailing "`ActionsConfig` … is
  contract-only" paragraph (the type no longer exists).
- Grep the whole docs content for removed names:
  `grep -rn "exportOptions\|actionsConfig\|loadingState\|defaultFilters\|virtualScrolling\|realTimeUpdates\|rowExpansion\|columnResizing" apps/marketing/content/docs/` → fix every hit.

**Verify**: the grep above returns zero hits; `cd apps/marketing && bun test`
passes; `cd apps/marketing && bun run typecheck` exits 0.

### Step 6: Changeset + ledger

Create `.changeset/contract-surface-truth.md`:

```md
---
"@better-tables/core": minor
---

Remove reserved-but-unimplemented config surface (0.6 policy: replaced
surface is removed outright, no compat shims): `TableConfig.defaultFilters`
(use the `initialFilters` prop), `.actionsConfig`, `.exportOptions`,
`.theme`, `.loadingState` (use the `loading` prop), and the `TableFeatures`
flags `bulkActions`, `export`, `columnResizing`, `virtualScrolling` (use the
`virtualized` prop), `realTimeUpdates`, `rowExpansion`. Each capability
returns only with a real implementation (export UI, actions module, etc.).
The adapter contract (`exportData`, `subscribe`, `AdapterFeatures`) is
unchanged.
```

Update this plan's row in `plans/README.md`.

**Verify**: `bunx biome check .changeset/` → clean.

## Test plan

- No new behavior — the tests are the existing suites staying green after
  the removals, plus updated type-shape tests in
  `packages/core/tests/types/` (pattern: `packages/core/tests/types/column.test.ts`).
- Add ONE negative type test (in `packages/core/tests/types/`, using
  `@ts-expect-error`) asserting `features: { virtualScrolling: true }` no
  longer typechecks — this pins the removal.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "defaultFilters\|actionsConfig\|exportOptions\|loadingState" packages/core/src/types/table.ts` → no matches
- [ ] `grep -n "bulkActions\|columnResizing\|virtualScrolling\|realTimeUpdates\|rowExpansion" packages/core/src/types/table.ts` → no matches; `grep -n "export?:" packages/core/src/types/table.ts` → no match inside `TableFeatures`
- [ ] `bun run typecheck` exits 0; core, ui, marketing test suites pass
- [ ] Docs greps (Step 5) return zero hits; the `@ts-expect-error` pin test exists and passes
- [ ] `.changeset/contract-surface-truth.md` exists
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds a REAL read of any listed field (the codebase drifted — e.g.
  plan 059/050 landed first and wired one). Remove only the still-dead ones
  and report which were skipped.
- Step 3 finds a real consumer of an orphaned type outside tests/barrels.
- Removing `theme` breaks `packages/ui` compilation (would mean a stray
  `TableConfig['theme']` import this recon missed).
- You find yourself wanting to delete anything from
  `packages/core/src/types/adapter.ts` — that file is out of scope.

## Maintenance notes

- Plans 050 (export UI), 058 (search), 059 (actions module) REINTRODUCE
  surface in these areas deliberately, shaped by their implementations —
  reviewers should not read those later additions as reverting this
  cleanup.
- `columnResizing` and `rowExpansion` are recorded in `plans/README.md`
  under "Deferred by decision" as future feature plans; if either is
  prioritized, its plan reintroduces the flag together with the feature.
- Reviewer scrutiny: the diff should be almost purely deletions +
  docs/tests; any ADDED runtime code is a red flag.
