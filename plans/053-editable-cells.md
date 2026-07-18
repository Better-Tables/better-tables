# Plan 053: `.editable()` — inline cell editing across the column builders and table UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md` unless
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7b58ed8..HEAD -- packages/core/src/builders packages/core/src/types packages/core/src/factory.ts packages/ui/src/components/table packages/ui/src/hooks packages/ui/src/components/ui apps/marketing/src/app/(marketing)/examples`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (first post-0.6 feature)
- **Effort**: L
- **Risk**: MED (new interaction surface; optimistic-update state; write-path wiring)
- **Depends on**: 047 (DONE — typed write surface), 042 (DONE — UI test harness patterns). Independent of 048/049/050.
- **Category**: direction / feature
- **Planned at**: commit `7b58ed8`, 2026-07-18
- **Implemented**: branch `editable-cells`, 2026-07-18 — Steps 1–8 complete
- **Maintainer decisions (2026-07-18)**, binding for this plan:
  1. **Save path = adapter + callback.** Default persistence goes through the
     adapter's `updateRecord` (table-scoped, plan 047), auto-enabled when
     `adapter.meta.features.update` is true AND a row id + writable field are
     resolvable. An `onCellEdit` callback overrides/enables it for
     `httpAdapter` and custom-persistence apps (the HTTP transport
     intentionally does not proxy writes). Cells render read-only when
     neither path is available.
  2. **Optimistic updates with rollback.** The cell shows the new value
     immediately; on save failure it rolls back and surfaces the error.
  3. **Trigger UX**: double-click (or Enter on a focused cell) opens the
     editor; Enter or blur commits; Escape cancels. Option/boolean editors
     open on the same trigger and commit on selection/toggle.
  4. **V1 editable types**: `text` (+ email/url/phone as text-shaped),
     `number` (+ currency/percentage), `option`, `boolean`, `date`.
     `multiOption`, `json` are read-only in v1; `custom` gets an
     `editRenderer` escape hatch.

## Why this matters

Better Tables can filter, sort, paginate, facet, virtualize, and (since plan
047) *write* — but a user looking at a wrong value in a cell still has to
leave the table to fix it. Inline editing is the highest-frequency
interaction in real back-office tables (the product's core audience per the
marketing examples: tickets, users, boards), and every building block already
exists: typed table-scoped `updateRecord` with capability flags, per-column
`ValidationRule`s, a `cellRenderer` seam in the cell path, and a full shadcn
primitive set (input, textarea, select, checkbox, switch, calendar, popover,
command). `.editable()` composes them into one declarative flag on the
column builder — enums get an in-cell dropdown, free text gets a textbox,
booleans a toggle, dates a calendar — with save, validation, optimistic
update, and rollback handled by the table.

## Current state

All excerpts verified at `7b58ed8` (post Waves A+B; all suites green:
core 1216/0, ui 94/0, drizzle 620/0+185 env-skips, toolkit 114/0, cli 140/0).

**No prior art in-repo**: `git grep -rn "editable" packages/core/src packages/ui/src` → 0 matches. Greenfield.

**Column definition & builders (core)**:
- `packages/core/src/types/column.ts:34` — `ColumnDefinition<TData, TValue, TId>`
  with `accessor: (data: TData) => TValue`, `type: ColumnType`,
  `cellRenderer?: (props: CellRendererProps<TData, TValue>) => ReactNode`,
  `validation?: ValidationRule<TValue>[]`, `meta?`, plus per-column flags
  (`sortable?`, `filterable?`, …) — `editable` slots in beside them.
- `packages/core/src/types/column.ts:126` — `ValidationRule<TValue>`:
  `{ id: string; validate: (value: TValue) => boolean | string; message?: string }`.
  Editing MUST reuse these (no second validation system).
- `packages/core/src/builders/column-builder.ts` — the base builder; `:303`
  `validation(rules)` sets `config.validation`; plan 045 added
  `protected applyOperators` (`:430`) — follow the same base-method +
  thin-subclass pattern for `.editable()`.
- `packages/core/src/builders/path-builders.ts` — `t.text(path)` etc. are
  thin typed wrappers compiling to the fluent builders; whatever lands on the
  base builder is automatically reachable from `t.*` chains. Path-built
  columns' ids are the path string (the row property), which is what makes
  the adapter save path resolvable (see "field mapping" below).

**Write surface (landed in 047)**:
- Adapter contract, `packages/core/src/types/adapter.ts:401` —
  `updateRecord?(id: string, data: Partial<TData>, options?: MutationOptions): Promise<TData>`;
  `:224-227` `MutationOptions { table?: string }`.
- Instance, `packages/core/src/factory.ts:152` — `instance.updateRecord`
  throws `'Adapter does not support updateRecord'` when absent and injects
  `{ table: table.tableName }`.
- Capability flag: `AdapterMeta.features.update: boolean`
  (`types/adapter.ts`, `AdapterFeatures`). `httpAdapter` advertises
  `update: false` by design — its consumers use the `onCellEdit` callback.

**Cell render path (ui)**:
- `packages/ui/src/components/table/table.tsx:301-310` — the cell renders
  `column.cellRenderer ? column.cellRenderer({ value, row, column, rowIndex })
  : getFormatterForType(column.type, value, column.meta)` (plus truncate/
  tooltip handling). This is where the editable wrapper mounts.
- `packages/ui/src/components/table/virtualized-table.tsx:144-146` — the
  virtualized default cell: `renderCell ? renderCell(...) :
  getFormatterForType(column.type, value, column.meta)`. Must get the same
  editable behavior.
- Row identity: `table.tsx:700-712` — `getRowId = rowConfig?.getId ||`
  (heuristic: `row.id` then `row._id`, `String()`-coerced). `updateRecord`
  takes that string id.
- Row-click interplay: `table.tsx:763-773` — `rowConfigOnClickRef` +
  `rowsClickable` — a single click may already select/navigate; this is why
  the maintainer chose double-click/Enter as the edit trigger.

**Editor primitives available** (`packages/ui/src/components/ui/`): `input`,
`textarea`, `select`, `checkbox`, `switch`, `calendar`, `popover`, `command`,
`field`, `label`, `tooltip`. Filter inputs
(`components/filters/inputs/*.tsx`) are FILTER value editors — do not reuse
them directly for cell editing (different value semantics), but mirror their
structure/tests (plan 042 gave each one a value-emission suite — the same
style applies to cell editors).

**Date semantics**: `getFormatterForType` handles Date + ISO/epoch display
(plan 034); write-side, the Drizzle adapter's timestamp columns accept `Date`
objects (plan `fbd7f9a`/036 territory). The date editor emits a `Date`.

**Field mapping — the one non-obvious design constraint**: `accessor` is a
FUNCTION, so a column doesn't inherently know which data field to write.
Resolution rule for the adapter save path (v1):

1. If `editable.field` is set in the column's editable config → write
   `{ [field]: newValue }`.
2. Else if the column id contains no dot → the id IS the field (true for
   path-built own-table columns like `t.text('name')` and conventional
   legacy ids).
3. Else (dot-containing id = relationship path, e.g. `customer.company`) →
   the adapter save path is UNAVAILABLE for that column (editing
   related-table rows is out of scope v1); the column is editable only via
   `onCellEdit`, and a dev-mode console.warn explains why.

**Conventions**: strictness flags (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`) are on in core/ui — conditional property
inclusion, no `!`. UI tests: happy-dom + `@testing-library/react`, fake
timers (no wall-clock waits — plan 042). Commits: `Plan 053 Step N: …`.
Changesets: core minor (new public API); ui is private (none).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Core tests | `cd packages/core && bun test` | pass (1216+) |
| UI tests | `cd packages/ui && bun test` | pass (94+) |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | pass (620+, 185 env-skips) |
| Typecheck | `bun run typecheck` | exit 0, 10/10 |
| Lint (check) | `bunx biome check .` | 0 errors (CI lint is BLOCKING now) |
| Preview | `cd apps/marketing && bun run dev` | examples render |

## Scope

**In scope**:
- `packages/core/src/types/column.ts` (`EditableConfig`, `ColumnDefinition.editable`,
  `EditRendererProps`)
- `packages/core/src/builders/column-builder.ts` (base `.editable()`) + the
  six type builders ONLY if a typed override is needed (prefer base-only)
- `packages/core/src/index.ts` (export new types)
- New: `packages/ui/src/components/table/editable-cell.tsx` + editors
  (either inline in that file or a small `editors/` dir beside it)
- New: `packages/ui/src/hooks/use-editable-cells.ts` (pending-edit overlay,
  save pipeline, rollback, error state)
- `packages/ui/src/components/table/table.tsx`,
  `virtualized-table.tsx` (mount the editable cell in the default cell
  paths; new props)
- `packages/ui/src/index.ts` (export new component/hook/types)
- `packages/cli/src/lib/file-operations.ts` — ONLY the `UI_SOURCE_FILES`
  manifest, if new files must be listed for `init` (check whether the
  manifest enumerates per-file; add the new files if so)
- Tests: `packages/core/tests/builders/`, `packages/ui/tests/components/`,
  `packages/ui/tests/hooks/`, extend
  `packages/ui/tests/components/integration-drizzle.test.tsx`
- One marketing example page update or addition (Step 8, dogfood)
- Docs: `wiki.md` handbook section + `README.md` snippet
- `.changeset/*.md` (core minor), `plans/README.md`

**Out of scope (v1 — record, don't build)**:
- `multiOption` and `json` editors (read-only in v1).
- Editing relationship-path columns via the adapter (dot-ids — callback-only
  per the field-mapping rule).
- Row creation, row deletion, bulk edit, whole-row edit mode.
- Server conflict resolution / realtime (last-write-wins v1; note in docs).
- A write proxy for `httpAdapter` (decided boundary — callback is the path).
- Changes to `FilterConfig`, filter inputs, or the plugin seam (049).

## Git workflow

- Branch: `editable-cells`; commits `Plan 053 Step N: <imperative summary>`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Core types + builder API

In `packages/core/src/types/column.ts`:

```ts
/** Per-column inline-edit configuration (see plan 053). */
export interface EditableConfig<TData = unknown, TValue = unknown> {
  /** Per-row gate — return false to render this row's cell read-only. */
  when?: (row: TData) => boolean;
  /**
   * Data field written by the adapter save path. Defaults to the column id
   * when it contains no dot; REQUIRED for adapter-saves on columns whose id
   * is not the storage field. Dot-path ids are callback-only (v1).
   */
  field?: string;
  /** Text editor renders a textarea instead of a single-line input. */
  multiline?: boolean;
  /** Placeholder for empty text/number editors. */
  placeholder?: string;
  /**
   * Custom editor (escape hatch, and the ONLY editor for `custom` columns).
   * Receives current value + commit/cancel; the table still owns save/
   * validation/rollback around it.
   */
  editRenderer?: (props: EditRendererProps<TData, TValue>) => ReactNode;
}

export interface EditRendererProps<TData = unknown, TValue = unknown> {
  value: TValue;
  row: TData;
  column: ColumnDefinition<TData, TValue>;
  /** Commit the new value (runs validation + save pipeline). */
  commit: (value: TValue) => void;
  /** Cancel editing, restore display. */
  cancel: () => void;
}
```

Add `editable?: boolean | EditableConfig<TData, TValue>;` to
`ColumnDefinition` (beside `sortable?`/`filterable?`). On the base builder
(`column-builder.ts`, following the `validation()`/`applyOperators` pattern):

```ts
/**
 * Enable inline editing for this column. `editable()` uses defaults;
 * pass a config for per-row gating, field mapping, or a custom editor.
 */
editable(config: boolean | EditableConfig<TData, TValue> = true): this {
  this.config.editable = config;
  return this;
}
```

Base-only (returns `this`) — verify chaining from every type builder and
from `t.*` path builders preserves inference (no per-subclass override
should be needed; if one is, follow the thin-wrapper pattern from plan 045).
Export the new types from `packages/core/src/index.ts`.

**Verify**: `bun run typecheck` exit 0. Add builder tests in
`packages/core/tests/builders/` (model on existing builder tests):
`.editable()` → `editable: true` in the built definition; `.editable({ when, field })`
carries through; a type test that `t.text('name').editable()` still infers
the literal id and value type; `editable` defaults to absent/undefined.

### Step 2: `useEditableCells` — overlay, save pipeline, rollback

New `packages/ui/src/hooks/use-editable-cells.ts`. Responsibilities:

1. **State**: `pendingEdits: Map<string /* rowId:columnId */, TValue>`
   (optimistic overlay), `savingCells: Set<string>`,
   `cellErrors: Map<string, string>`. Expose
   `getDisplayValue(rowId, columnId, accessorValue)` (overlay ?? accessor),
   `beginEdit`, `commitEdit`, `cancelEdit`, per-cell `{ editing, saving, error }`.
2. **Validation**: `commitEdit` runs the column's `validation` rules
   (`ValidationRule.validate` → `boolean | string`) BEFORE any save; a
   failure sets the cell error, keeps the editor open, and never calls the
   save path.
3. **Save resolution** (the maintainer's decision 1, in order):
   - If the table received `onCellEdit` → call it with
     `{ row, rowId, column, field, value, previousValue }`; await it (it may
     return a promise).
   - Else if the adapter supports writes (`adapter.meta.features.update` &&
     `typeof adapter.updateRecord === 'function'`) AND the field-mapping
     rule yields a field AND a rowId resolved → call
     `adapter.updateRecord(rowId, { [field]: value }, tableName ? { table: tableName } : undefined)`
     (the `table` option comes through from the `BetterTable table={def}`
     prop when present — thread it; plain-adapter usage omits it and relies
     on `defaultMutationTable`/single-table inference, exactly like plan
     047's direct-caller path).
   - Else → the cell should never have been editable (Step 4 gates it);
     defensive no-op + dev warn.
4. **Optimistic + rollback** (decision 2): set the overlay immediately on
   commit; on save success, keep the overlay until the next data refresh for
   that row (or clear it if the save's returned record confirms the value);
   on failure, DELETE the overlay (display reverts to the accessor value),
   set `cellErrors`, and invoke an optional `onCellEditError({ error, ...ctx })`
   prop. Never leave `saving` stuck on a thrown save (use `finally`).
5. **Concurrency**: one edit session at a time per table (opening a new
   editor commits-or-cancels the previous per the trigger rules); a second
   commit on the same cell while `saving` is ignored.

**Verify**: `cd packages/ui && bun test hooks/use-editable-cells.test.tsx` —
new suite (renderHook, stub adapter): overlay applies immediately;
success clears saving; failure rolls back overlay + sets error +
calls `onCellEditError`; validation failure never calls the adapter;
callback path wins over adapter path when both present; non-resolvable
field/rowId → not editable. All with immediately-resolving stubs and fake
timers (no wall-clock waits).

### Step 3: Per-type editors + `EditableCell`

New `packages/ui/src/components/table/editable-cell.tsx`:

- `EditableCell` wraps a cell: renders the DISPLAY (the existing
  formatter/cellRenderer output, passed as children or a render prop) until
  editing; on edit, swaps in the editor for `column.type`:
  - `text` / `email` / `url` / `phone` → `Input` (`Textarea` when
    `editable.multiline`); commit on Enter/blur, cancel on Escape.
  - `number` / `currency` / `percentage` → `Input type="number"`; emit a
    `number` (`Number(raw)`; reject NaN via a built-in numeric check before
    the column's own validation).
  - `option` → `Select` listing the column's declared options
    (`column.filter?.options` — the same source the filter UI uses; if the
    column declares none, fall back to read-only + dev warn). Commit on
    selection; write the option VALUE.
  - `boolean` → `Switch` (commit on toggle).
  - `date` → `Calendar` inside a `Popover`; commit on day selection; emit a
    `Date`.
  - `custom` (or any type when `editable.editRenderer` is set) →
    `editRenderer` with `EditRendererProps`.
  - Any other type (`multiOption`, `json`) → read-only (render display only)
    even if `.editable()` was set; dev warn once per column.
- **Gestures** (decision 3): double-click on the cell OR Enter while the
  cell has focus opens the editor (`tabIndex={0}` on editable cells; do not
  steal focus behavior from row click — stop propagation of the double-click
  so `onRowClick` doesn't also fire). Editor autofocuses. Enter commits
  (except textarea: Cmd/Ctrl+Enter commits, Enter newlines), blur commits,
  Escape cancels. Saving state shows a subtle spinner/opacity on the cell;
  error state shows a red ring + the message in a tooltip/title.
- Visual affordance: editable cells get a hover affordance (e.g. subtle
  background or pencil on hover) so editability is discoverable — match the
  repo's existing tailwind styling idiom in `table.tsx`.

**Verify**: `cd packages/ui && bun test components/editable-cell.test.tsx` —
per-type value-emission suites modeled EXACTLY on plan 042's filter-input
tests: text edit types "abc" + Enter → commit called with `'abc'`; Escape →
cancel, no commit; blur commits; number "12.5" → `12.5`, "abc" → error not
commit; option select → the option value; boolean toggle → flipped boolean;
date pick → a `Date` for the chosen day; multiline Enter inserts newline +
Cmd/Ctrl+Enter commits; editRenderer receives commit/cancel and its commit
flows through validation.

### Step 4: Wire into `table.tsx` and `virtualized-table.tsx`

- New `BetterTable` props (extend the props interface at `table.tsx:83+`):
  `onCellEdit?`, `onCellEditError?`, `editing?: boolean` (table-level master
  switch, default `true` — set `false` to render everything read-only
  without touching column defs).
- Cell path (`table.tsx:301-310`): when the column resolves as editable —
  `editing !== false` && column.editable && (per-row `when` passes) && a
  save path exists (callback provided, OR adapter-writable + field/rowId
  resolvable per Step 2's rules) — wrap the existing output in
  `EditableCell`. `cellRenderer` output remains the DISPLAY; editing still
  works around it (decision: custom display + standard editor compose).
- Virtualized path (`virtualized-table.tsx:144-146`): same wrap in the
  default-cell branch; a caller-supplied `renderCell` prop keeps full
  control (document that virtualized custom renderers opt out of built-in
  editing in v1).
- Resolve editability ONCE per column per render (memo), not per cell, and
  keep row-level `when` checks cheap — this table just had a perf pass
  (plans 025/041); do not regress the row-memoization (the editable wrapper
  must not introduce unstable per-row callback identities — use the stable
  handler + `useLatest` idiom `table.tsx` already uses, `:763-773`).

**Verify**: `cd packages/ui && bun test` — extend
`components/table-interactions.test.tsx` (plan 042): double-click an
editable cell → editor appears; commit → stub adapter's `updateRecord`
called with `(rowId, { field: value }, …)` and the cell shows the new value;
Escape → no call; a `when: () => false` row is not editable; `editing={false}`
disables all; non-editable columns unaffected. Also run
`components/table-row-render.test.tsx` + `table-effect-churn.test.tsx`
(the plan-025 perf locks) — they must still pass unchanged.

### Step 5: Capability gating + read-only fallbacks

Implement the resolution matrix once (small pure function, unit-testable —
put it in `use-editable-cells.ts` or a sibling util):

| Condition | Result |
|---|---|
| `editing === false` (table) | read-only |
| column has no `editable` | read-only |
| `when(row)` false | read-only (that row) |
| `onCellEdit` provided | editable (callback save) |
| adapter `features.update` && `updateRecord` && field resolvable (no-dot id or `field` config) && rowId resolvable | editable (adapter save) |
| otherwise | read-only + ONE dev-mode `console.warn` per column naming the missing piece (e.g. "httpAdapter does not proxy writes — pass onCellEdit", "relationship-path column: pass editable.field or onCellEdit") |

**Verify**: unit tests for the matrix (every row above); plus a test that
the warn fires once per column, not per cell render.

### Step 6: Integration proof (real adapter round-trip)

Extend `packages/ui/tests/components/integration-drizzle.test.tsx` (plan
043's harness — real `bun:sqlite` Drizzle adapter): make a column editable,
double-click a cell, type a new value, commit → assert the VALUE IS IN THE
DATABASE (query the sqlite fixture directly) and the cell displays it; then
a failing save (e.g. point `updateRecord` at a stub that rejects, or violate
a constraint) → assert rollback to the original display + error state.

**Verify**: `cd packages/ui && bun test components/integration-drizzle.test.tsx`
→ pass, including the new edit round-trip and rollback cases.

### Step 7: CLI manifest + exports

Check `packages/cli/src/lib/file-operations.ts` `UI_SOURCE_FILES`: if it
enumerates files (it does — static manifest), add `editable-cell.tsx`, the
editors dir (if separate), and `use-editable-cells.ts` so `better-tables
init` ships them. Export the new component/hook/types from
`packages/ui/src/index.ts` and new core types from core's index.

**Verify**: `cd packages/cli && bun test` → pass (the bundled-source tests
read real files; if any test pins the manifest list, update it);
`cd packages/cli && bun run build` → `ui-src` contains the new files
(`ls packages/cli/ui-src/components/table/ | grep editable`).

### Step 8: Dogfood example + docs + changeset + gates

1. Marketing: make one existing example page editable (the tickets or users
   table — e.g. `status` (option dropdown), `subject` (text), a boolean, a
   date) via `.editable()` on its column defs, saving through the Drizzle
   adapter (the demo DB is in-memory — perfect). Browser-verify: edit a
   status via the in-cell dropdown, see it persist across a refetch
   (filter/paginate away and back).
2. Docs: a "Inline editing" section in the `wiki.md` handbook (API, the
   save-resolution matrix, the httpAdapter/callback note, v1 limits) + a
   README feature snippet. Update the README feature list.
3. Changeset: `@better-tables/core` minor — `.editable()` builder API +
   `EditableConfig`/`EditRendererProps` types. (ui private — no changeset.)
4. Full gates: root `bun run typecheck`; core/ui/cli/drizzle-SQLite tests;
   `bunx biome check .` → 0 errors (lint is blocking in CI now).

**Verify**: all gates green; browser check done (screenshot or described
observation in your report); `plans/README.md` row updated.

## Test plan

- Core: builder API tests + type-inference tests (Step 1).
- UI unit: `use-editable-cells` save/rollback/validation matrix (Step 2);
  per-type editor value emission (Step 3); table wiring + gestures + perf
  locks unchanged (Step 4); gating matrix + single-warn (Step 5).
- Integration: real-adapter edit round-trip + rollback (Step 6).
- Patterns to model on: plan 042's input suites
  (`packages/ui/tests/components/inputs/*.test.tsx`),
  `table-interactions.test.tsx`, and 043's `integration-drizzle.test.tsx`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "editable" packages/core/src/types/column.ts` → `EditableConfig`, `EditRendererProps`, and `ColumnDefinition.editable` present; exported from core's index
- [ ] Base builder has `.editable()`; `cd packages/core && bun test` passes incl. new builder tests; `t.text('x').editable()` type test passes
- [ ] `packages/ui/src/components/table/editable-cell.tsx` + `use-editable-cells.ts` exist and are exported; editors cover text/number/option/boolean/date + `editRenderer`
- [ ] `cd packages/ui && bun test` passes incl.: per-type emission suites, save/rollback/validation hook suite, gating-matrix tests, table-interaction edit tests, AND the pre-existing perf-lock tests unchanged
- [ ] Integration test proves a committed edit lands in the sqlite fixture and a failed save rolls back
- [ ] `multiOption`/`json` with `.editable()` render read-only with one dev warn (test)
- [ ] CLI `ui-src` bundle includes the new files after `bun run build`; `cd packages/cli && bun test` passes
- [ ] Marketing example edits + persists in the browser (reported); wiki + README document the feature; core minor changeset exists
- [ ] Root `bun run typecheck` exit 0; `bunx biome check .` 0 errors
- [ ] No files outside the in-scope list modified (`git status`); `plans/README.md` row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The optimistic overlay fights the data hooks (a refetch completing after a
  commit clobbers or resurrects values in a way the Step 2 design can't
  reconcile cleanly) — report the race you observed; do not bolt on ad-hoc
  suppression of refetches.
- Wiring `EditableCell` breaks the plan-025 perf-lock tests
  (`table-row-render` / `table-effect-churn`) and the fix isn't a stable-
  identity adjustment — the feature must not regress render performance.
- The field-mapping rule proves wrong for path-built columns (column ids
  turn out NOT to be the storage field for plain own-table columns) —
  re-verify against `path-builders.ts` + a drizzle write and report before
  inventing a new mapping.
- Double-click conflicts irreconcilably with an existing gesture
  (row selection/navigation) in a way `stopPropagation` doesn't solve.
- `Select`/`Calendar` primitives can't render inside the virtualized row
  container (portal/overflow issues) — report; do not fork the primitives.
- You find yourself adding a write method to `httpAdapter` or proxying
  mutations — decided boundary, out of scope.

## Maintenance notes

- **v2 candidates** (record in the ledger when this lands): `multiOption`
  editor (command-multi-select), `json` editor, relationship-path editing
  via the adapter, row creation (pairs with `createRecord`), bulk edit,
  edit-history/undo. The plugin seam (plan 049) may later want a
  `beforeSave`/`afterSave` hook — design `commitEdit` so the save call is a
  single seam-friendly function.
- Reviewer scrutiny: the save-resolution matrix (Step 5) is the security/
  correctness heart — especially that `httpAdapter` (features.update=false)
  can never reach an adapter save; the optimistic rollback path; and that
  cell editability never leaks into columns that didn't opt in.
- Docs must be explicit that edits are last-write-wins in v1 (no version
  checks) — a conflict-detection story is a deliberate future decision.
