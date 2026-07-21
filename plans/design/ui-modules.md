# Design: UI modules — an opt-in tier for the copied UI

> Design deliverable for **Step 1** of `plans/059-ui-modules-and-actions-extraction.md`.
> Decides the slot contract, the absent-module behavior, the module manifest
> schema, and the `add` command surface. It is validated against TWO
> consumers (the actions toolbar today, plan 050's ExportButton next) so the
> seam is real, not speculative.
>
> **Verified against** (2026-07-21, at `27c59b9` per the plan's drift check —
> no drift): `packages/ui/src/components/table/table.tsx` (props interface
> `:88`, `shouldShowRowSelection` `:721`, ActionsToolbar import `:49` and
> render `:1288-1301`, the `warnFilterTreeDropped` one-time-dev-warn pattern
> `:975-987`), `packages/ui/src/components/table/actions-toolbar.tsx`
> (`ActionsToolbarProps`), `packages/cli/src/lib/file-operations.ts`
> (`UI_SOURCE_FILES`, `generateFileMappings`, `getUiSourceFilePaths`),
> `packages/cli/src/commands/{init,docs}.ts`, `packages/cli/src/cli.ts`,
> `packages/cli/src/commands.ts`, `packages/cli/tests/ui-source-manifest.test.ts`,
> and plan 050's `ExportButton`/`useTableExport` requirements.

---

## Vocabulary rule (states the "Why this matters" decision for docs authors)

Better Tables has two extension surfaces. They must NOT share a word:

- **plugins** — core tier: `betterTables({ plugins: [...] })`, npm-distributed,
  data hooks (`beforeFetch`/`afterFetch`). Plan 049's territory. No UI.
- **modules** — copied-UI tier: `better-tables add <module>`, source copied
  into the consumer app (shadcn model). This document defines it.

Docs and code comments use "plugin" only for the core tier and "module" only
for the copied-UI tier. A capability like saved views may ship as a
plugin + module PAIR; name each half by its tier.

---

## 1. The seam: a `slots` prop on `BetterTable`

A module is source the CLI copies in. The core table cannot `import` a module
(the module may be absent), so an absent module must be a clean no-op. The
table therefore exposes named **slots** — the consumer injects a module's
component into a slot; an empty slot renders nothing.

```ts
// packages/ui/src/components/table/table.tsx (BetterTableProps addition)

export interface ActionsToolbarSlotProps<TData = unknown> {
  /** The actions passed to <BetterTable actions={...} />. Non-empty when this slot renders. */
  actions: TableAction<TData>[];
  /** Ids of the currently selected rows. */
  selectedIds: string[];
  /** The selected rows' data, in selection order. */
  selectedData: TData[];
  /** Called after an action's handler resolves (host may refetch/refresh). */
  onActionMake: (actionId: string) => void;
}

export interface ToolbarExtraSlotProps<TData = unknown> {
  /** Column definitions currently rendered (post-resolution). */
  columns: ColumnDefinition<TData, unknown>[];
  /** The active adapter (may be undefined for pure `data`-driven tables). */
  adapter?: TableConfig<TData>['adapter'];
  /** The current filter tree (flat array or group node) — what export must honor. */
  filters: FilterState[] | FilterGroupNode;
  /** The current sort state. */
  sorting: SortingState;
  /** Total row count if known (for row-cap/warn decisions). */
  totalCount?: number;
}

export interface BetterTableSlots<TData = unknown> {
  /**
   * Rendered where the inline ActionsToolbar renders today (toolbar row, left
   * of the FilterBar), ONLY when `actions.length > 0`. Installed by the
   * `actions` module: `slots={{ actionsToolbar: ActionsToolbar }}`.
   */
  actionsToolbar?: ComponentType<ActionsToolbarSlotProps<TData>>;
  /**
   * Rendered in the toolbar row for extra controls. Reserved for plan 050's
   * ExportButton (ships as the `export` module) and future toolbar content.
   */
  toolbarExtra?: ComponentType<ToolbarExtraSlotProps<TData>>;
}
```

`BetterTableProps` gains `slots?: BetterTableSlots<TData>`.

### Why component-injection slots and not children/render-props

The composition guides (`vercel-composition-patterns`) prefer children over
`renderX` props and warn against boolean-prop proliferation. Both concerns are
respected here, not violated:

- This is NOT a boolean mode flag — there is no `showActions`/`enableExport`
  boolean. Presence of a slot component IS the composition. (`architecture-avoid-boolean-props`.)
- Children composition can't express this seam: the table decides WHERE in its
  own toolbar the control renders and feeds it INTERNAL state the consumer
  never holds (live selection set, resolved columns, the current filter tree).
  That is dependency injection of a component into a known extension point —
  the slot/compound pattern (`state-decouple-implementation`,
  `state-context-interface`), which the guides endorse for exactly this shape.
- `ComponentType` (not a `renderActionsToolbar(props) => ReactNode` render
  prop) keeps the prop a stable component identity, avoids an inline-closure
  child re-mounting, and reads as "install this component here."

### Slot-props validation — consumer 1: actions toolbar

Today's inline render (`table.tsx:1288-1301`) passes `ActionsToolbar`:
`actions`, `selectedIds={Array.from(selectedRows)}`,
`selectedData={data.filter((row, i) => selectedRows.has(getRowId(row, i)))}`,
`onActionMake={() => {}}`. `ActionsToolbarProps`
(`actions-toolbar.tsx:15-20`) is exactly `{ actions, selectedIds, selectedData?, onActionMake }`.
`ActionsToolbarSlotProps` is a superset (it makes `selectedData` required and
non-optional, which the call site already always provides), so
`ActionsToolbar` satisfies `ComponentType<ActionsToolbarSlotProps<TData>>`
with ZERO changes to `actions-toolbar.tsx`. ✔

### Slot-props validation — consumer 2: plan 050 ExportButton

Plan 050 Step 2–3: `useTableExport` "takes the adapter (+ current
columns/filters/sorting), calls `adapter.exportData(...)`" and `<ExportButton>`
gates on `adapter.meta.features.export`. `ToolbarExtraSlotProps` supplies
`adapter`, `columns`, `filters`, `sorting` (and `totalCount` for 050's row-cap
UI) — everything `exportData` and the capability gate need. The export button
reads `adapter?.meta?.features?.export` off the injected `adapter` and hides
itself when absent — no extra slot field required. ✔

**Result: two slot points, no more** (same minimalism rule as plan 049). The
export sketch did NOT force a slot-shape change beyond confirming
`toolbarExtra` must carry `adapter`/`columns`/`filters`/`sorting`/`totalCount`
(all included above). If a future module needs the *live selection* in
`toolbarExtra`, that is a new design conversation, not a speculative field now.

---

## 2. Absent-module behavior

`actions` provided but `slots.actionsToolbar` absent → render nothing and
`console.warn` ONCE in dev, naming the fix. Reuse the existing keyed
one-time-dev-warn pattern (`table.tsx:975-987`, `warnFilterTreeDropped`):
production-gated (`process.env.NODE_ENV === 'production'` early-return), keyed
by table `id` in a `useRef` so re-pointing at a new `id` re-arms it.

Warn text (quoted verbatim in troubleshooting docs):

```
[better-tables] table "<id>": `actions` were provided but no `slots.actionsToolbar` is set, so the bulk-actions toolbar will not render. Install the actions module (`bunx better-tables add actions`) and pass `slots={{ actionsToolbar: ActionsToolbar }}`.
```

`toolbarExtra` has no such warn — nothing signals intent-to-export the way a
non-empty `actions` array signals intent-to-show-actions, so an empty
`toolbarExtra` is simply "no extra toolbar content."

Row selection is unaffected: `shouldShowRowSelection = actions.length > 0 || rowSelection`
(`table.tsx:721`) stays exactly as is. Passing `actions` still turns on the
checkbox column even when the toolbar module is absent (the selection is a core
feature; only the toolbar is a module). The warn tells the user why the toolbar
they expected is missing.

---

## 3. Module manifest schema (CLI)

`UI_SOURCE_FILES` (flat) becomes `UI_MODULES` (named groups). Every file under
`packages/ui/src` belongs to EXACTLY ONE module; the drift test enforces both
`union(modules) === real tree (minus exclusions)` AND pairwise disjointness.

```ts
// packages/cli/src/lib/file-operations.ts
const UI_MODULES = {
  core: {
    components: {
      table: [ /* today's table[] minus the 2 actions files */ ],
      filters: [ /* today's filters[] unchanged */ ],
    },
    hooks: [ /* unchanged */ ],
    lib: ['utils.ts'],
  },
  actions: {
    components: {
      table: ['action-confirmation-dialog.tsx', 'actions-toolbar.tsx'],
    },
  },
} as const;
```

- `core` is everything shipped today except the two actions files. It is always
  copied (by `init` and as the base of any `add`).
- `actions` is the two files at `table.tsx:1288`'s render target.
- A future `export` module (plan 050) adds
  `{ components: { table: ['export-button.tsx'] }, hooks: ['use-table-export.ts'] }`.

**Path-mapping generality**: `generateFileMappings(resolvedPaths, componentsOutputPath, moduleNames)`
walks the selected modules' `components.table` / `components.filters` / `hooks`
/ `lib` shapes with the SAME destination rules as today (table → `<components>/<out>/table/`,
filters → `<components>/<out>/filters/`, hooks → `resolvedPaths.hooks`, lib →
`resolvedPaths.lib`). `core` is implicitly included whenever any module set is
requested (you can't add `actions` without `core`'s `table.tsx` present, but
`add` assumes `core` was already copied by `init` — see §4). A per-module
`getModuleSourceFilePaths(name)` plus a `getAllUiSourceFilePaths()` (union) are
exported for the drift test; `getUiSourceFilePaths()` stays as an alias of the
union so existing importers don't break.

---

## 4. Command surface

- **`better-tables add <modules...>`** (variadic). Reuses init's config
  resolution (`getConfig(cwd)`) and `copyFile` machinery. Flags: `--cwd`,
  `--yes`, `--components-path <path>` — the last MUST match the init-time path
  (read from the same `getConfig`/`resolvedPaths` init uses; the user passes it
  the same way today, there is no persisted record of it). No shadcn re-check
  beyond the config read (shadcn primitives were installed at `init`).
  - Copies ONLY the named modules' files (not `core`) — `add` assumes `init`
    already laid down `core`. `add core` is accepted as a no-op/refresh.
  - Unknown module → print the valid module names and `process.exit(1)`.
- **`init`** copies `core` by default (NOT the flat everything-set it copies
  today — this is the user-visible behavior change). `--modules <names...>`
  opts modules in at init time (`init --modules actions`). The next-steps
  output gains a "Modules" line listing available modules with one-liners, e.g.
  `actions — bulk-action toolbar over selected rows: bunx better-tables add actions`.
  The copy-confirmation dir list is unchanged in shape (the same four
  directories can receive files); it does not enumerate individual files.
- **Shared helper**: `add` needs init's config resolution + copy loop. To stay
  under the plan's ~30-line-duplication STOP, extract a
  `resolveInitPaths(cwd)` → `{ config, resolvedPaths }` (thin wrapper over
  `getConfig` with the same error handling) and reuse `copyAllFiles`-style
  iteration by passing selected module names down to `generateFileMappings`.
  If that helper wants to grow past config+paths, STOP and report.

Registry (`commands.ts`) gains an `add` entry with a variadic `modules`
argument and the three flags; `add.ts` follows the `docs.ts`/`init.ts` factory
pattern but builds the variadic argument as `command.argument('<modules...>', …)`
(the shared factory-arg loop in `docs.ts` does not emit variadic syntax, so
`add.ts` adds its argument directly). `cli.ts` registers the `add` factory
alongside the existing three.

---

## 5. What stays put (non-goals, for the record)

- `TableAction` type stays in `@better-tables/core` — types are cheap and every
  tier references them; only the toolbar COMPONENTS move to a module.
- Row selection / checkbox column stay in `core` (unchanged behavior).
- No npm packaging of modules — modules are copied source, full stop.
- Core-tier plugins (049) are orthogonal and out of scope here.

---

## Open follow-ups (not this plan)

- Plan 050's `ExportButton` becomes the first `toolbarExtra` occupant and ships
  as an `export` module; refresh 050 against this record before executing.
- Plan 048's filter-group builder is a natural third module but REPLACES the
  filter bar rather than adding toolbar content — a different slot question,
  designed when 048 is planned.
