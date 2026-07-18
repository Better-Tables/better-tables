# Plan 050: Surface data export — ExportButton/useTableExport + csvExport() plugin, with a row-cap decision

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/adapters/drizzle/src/drizzle-adapter.ts packages/core/src/types/adapter.ts packages/ui/src README.md plans/design/table-definition-dx.md`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (the `Number.MAX_SAFE_INTEGER` export fetch needs a cap decision)
- **Depends on**: 049 (the plugin seam — `csvExport()` rides `beforeFetch`/plugin methods)
- **Category**: direction
- **Planned at**: commit `787a816`, 2026-07-17
- **Reconciled 2026-07-18 at `7b58ed8`**: finding still valid, line refs
  updated for plan 044's decomposition — `exportData` is now at
  `drizzle-adapter.ts:1304` with the unbounded fetch
  (`limit: Number.MAX_SAFE_INTEGER`) at `:1311`, and the CSV/format
  conversion was EXTRACTED to `packages/adapters/drizzle/src/export-format.ts`
  (`convertToExportFormat`, imported at `:74`, used at `:1317`) — Step 1's cap
  change and the formula-escaping check now target those locations. "Current
  state" refs to `:1163`/`:1170` and in-class `convertToExportFormat` are
  stale; everything else holds.
- **Maintainer decision (2026-07-17)**: build the EXPORT half now (import is a
  separately-scoped, much larger design — explicitly deferred). Ship an
  `ExportButton`/`useTableExport` in `@better-tables/ui` plus a `csvExport()`
  plugin.

## Why this matters

Export is table-stakes for a data-table product, and the hard 80% is already
implemented but unreachable: `drizzle-adapter.ts:1163` has a real
`exportData(params)` (CSV/JSON/Excel → Blob/string), `ExportParams`/
`ExportResult` are fully typed (`types/adapter.ts:219-254`), and `exportData?()`
is an optional contract method (`:440`). But there is NO way for a user to
trigger it — `git grep` finds zero export controls in `packages/ui/src`, and
`README.md:465` still lists export as unshipped. The asymmetry (data layer
exports; UI can't) is exactly the one-directional pair to close. Caveat found
while reading: `exportData` fetches with
`pagination: { page: 1, limit: Number.MAX_SAFE_INTEGER }` (`drizzle-adapter.ts:1170`)
— an "Export all" on a large table pulls everything into memory, so this plan
must decide a cap/streaming policy.

## Current state

Verified at `787a816`:

- `packages/adapters/drizzle/src/drizzle-adapter.ts:1163` —
  `async exportData(params: ExportParams): Promise<ExportResult>`, fetching
  with `limit: Number.MAX_SAFE_INTEGER` (`:1170`), converting via
  `convertToExportFormat` (CSV formula-escaping intact).
- `packages/core/src/types/adapter.ts:219` `ExportParams`, `:254` `ExportResult`,
  `:440` `exportData?()`.
- `packages/ui/src` — no export button/hook/download helper (`grep` confirms).
- `README.md:465` — "Export functionality (CSV, Excel)" listed as not-done.
- Design doc names `csvExport()` as a plugin (`table-definition-dx.md:331`).
- Plan 044 may extract export conversion into `export-format.ts` — coordinate
  ordering (this plan can consume it either way).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| UI tests | `cd packages/ui && bun test` | pass |
| Core tests | `cd packages/core && bun test` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Preview | `cd apps/marketing && bun run dev` | export triggers a download |

## Scope

**In scope**:
- New UI: `packages/ui/src/hooks/use-table-export.ts` +
  `packages/ui/src/components/table/export-button.tsx` (browser download
  helper)
- `packages/core/src/` — a `csvExport()` plugin factory (rides plan 049's
  seam) exposing an `export()` method; a row-cap policy on the export fetch
- `README.md` (flip export to shipped), `MIGRATION.md`/docs as needed
- Tests in ui + core; `.changeset/*.md`; `plans/README.md`

**Out of scope**:
- Data IMPORT (CSV upload / column mapping / upsert) — explicitly deferred as
  a separate large design.
- Changing `exportData`'s adapter signature (only its unbounded fetch policy).
- Server-streaming export (note as follow-up if the cap decision points there).

## Git workflow

- Branch: `export-ui`; commits `Plan 050 Step N: …`.

## Steps

### Step 1: Decide the export row-cap policy

Pick and document one:
- **(A) Default cap + explicit override**: `exportData`/the export UI default
  to a bounded limit (e.g. 50k rows) with an explicit opt-in for "all"
  (accepting the memory cost). Safest default.
- **(B) Keep unbounded but warn**: leave `MAX_SAFE_INTEGER` but the UI shows a
  row-count warning above a threshold.
Recommendation: **(A)** — a documented default cap with an override — so the
default path can't OOM. Replace `limit: Number.MAX_SAFE_INTEGER` with the
resolved cap. If a consumer needs true full-export of huge tables, that's the
streaming follow-up.

**Verify**: `cd packages/adapters/drizzle && bun test` — a test that export
respects the cap and the override; the CSV formula-escaping still applies.

### Step 2: `useTableExport` hook + download helper

`use-table-export.ts`: takes the adapter (+ current columns/filters/sorting),
calls `adapter.exportData(...)`, and returns
`{ exportData: (format) => Promise<void>, exporting, error }` where
`exportData` triggers a browser download of the returned Blob/string
(create an object URL, click a synthetic anchor, revoke). Guard the case
where the adapter lacks `exportData` (optional method) — expose a capability
flag.

**Verify**: `cd packages/ui && bun test` — hook tests with a stub adapter
whose `exportData` returns a known Blob; assert the download helper is invoked
and errors surface. (Mock the DOM download in happy-dom.)

### Step 3: `<ExportButton>` component

A small shadcn-style button (format menu: CSV/JSON/Excel per the adapter's
advertised `export` capability in `adapter.meta.features.export`) that calls
`useTableExport`. Disabled/hidden when the adapter can't export.

**Verify**: `cd packages/ui && bun test` — renders, respects the capability
flag, triggers the hook on click.

### Step 4: `csvExport()` plugin on the 049 seam

Ship `csvExport()` as a `TableDefPlugin` factory (name `'csvExport'`) exposing
an `export()` method (and/or using `afterFetch` if it needs the current
result set) — the first real consumer of plan 049's hooks beyond its
validation plugin. Keep it thin: it delegates to the adapter's `exportData`.

**Verify**: `cd packages/core && bun test` — a test wiring
`betterTables({ plugins: [csvExport()] })` and asserting the plugin's export
path produces CSV.

### Step 5: README + changeset + browser verify + ledger

- `README.md:465` — move export to shipped; add a short usage snippet
  (`<ExportButton>` / `useTableExport` / `csvExport()`).
- Changeset: `@better-tables/core` (minor — `csvExport()` plugin + export
  cap) + `@better-tables/adapters-drizzle` (patch — export fetch cap).
  `@better-tables/ui` private (no changeset).
- Browser-verify in the marketing app: an export button downloads a CSV of
  the current (filtered) view.
- Update plan 050 row.

## Test plan

- Drizzle: export respects the cap + override; formula-escaping intact.
- UI: `useTableExport` triggers a download; `<ExportButton>` respects the
  capability flag and fires the hook.
- Core: `csvExport()` plugin produces CSV through the instance.
- Browser: manual verification of a real download in marketing.
- Patterns: existing drizzle export tests; `packages/ui/tests/components/*`.

## Done criteria

- [ ] Export fetch is bounded by a documented cap with an explicit override (no bare `MAX_SAFE_INTEGER`); test proves it
- [ ] `useTableExport` + `<ExportButton>` exist; hook triggers a browser download; button respects `adapter.meta.features.export`
- [ ] `csvExport()` plugin exists and produces CSV through `betterTables({ plugins })`
- [ ] `README.md` lists export as shipped with a usage snippet
- [ ] Changesets exist; `bun run typecheck` exit 0; ui + core tests pass; browser download verified
- [ ] `plans/README.md` updated

## STOP conditions

- The download helper can't be tested under happy-dom (no anchor/objectURL) —
  test the hook's data path and note the DOM-download step is browser-verified
  only.
- `csvExport()` needs a hook plan 049 didn't provide (e.g. an export-specific
  hook) — coordinate with 049's scope; don't add hook points unilaterally.
- Capping the export changes results for an existing consumer relying on
  full-export — flag it under the 0.6 window with a MIGRATION note.

## Maintenance notes

- Import is the deferred other half — when it's designed, it's a much larger
  plan (validation, column mapping, upsert). Record it as backlog, not here.
- Server-streaming export is the escape hatch if the row cap proves too small
  for real consumers — note it.
- Reviewer scrutiny: the cap default, the capability-flag gating, and that CSV
  formula-injection escaping survived any export-path refactor (also touched
  by plan 044).
