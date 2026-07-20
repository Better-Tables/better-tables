# Plan 059: UI modules — an opt-in module tier for the copied UI, with actions as the first extraction

> **Executor instructions**: DESIGN + BUILD plan. Step 1 produces a short
> design record and validates the slot contract against TWO consumers
> before any extraction. Run every verification command and confirm the
> expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/ui/src/components/table/table.tsx packages/cli/src/lib/file-operations.ts packages/cli/src/commands packages/cli/tests/ui-source-manifest.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (changes what `init` ships by default; the slot seam must not break existing consumers of the copied UI)
- **Depends on**: none to start. **Coordinate with**: 049 (core "plugins" tier — different layer, shared vocabulary rules below), 050 (its `ExportButton` must ride this plan's slot seam — see Maintenance), 057 (removes `TableConfig.actionsConfig`/`features.bulkActions`; this plan decides what, if anything, returns as module-local props).
- **Category**: direction
- **Planned at**: commit `27c59b9`, 2026-07-20
- **Maintainer decision (2026-07-20)**: the actions toolbar ("action
  builder") should be a plugin, NOT part of the default `init` set. The
  plugin system deserves deep thought — this plan is that design plus its
  first proof.

## Why this matters

Better Tables has two extension surfaces that are currently conflated under
the word "plugin":

1. **Core data plugins** — `betterTables({ plugins: [...] })`, an
   instance-level, npm-distributed seam (`beforeFetch`/`afterFetch`; plan
   049 executes it). No UI involved.
2. **UI capability groups** — components the CLI copies into the consumer's
   app (shadcn model). Today this tier has no structure: `init` copies ONE
   flat set (`UI_SOURCE_FILES`), so every consumer gets the bulk-actions
   toolbar, whether or not they want row actions, and every future
   capability (export button, saved views, filter-group builder from plan
   048) would bloat the default further.

This plan gives tier 2 a real shape — **modules**: named, independently
copyable groups with a typed seam in the core table so an absent module is
a clean no-op, plus a `better-tables add <module>` command. The actions
toolbar is the first extraction because it is the maintainer's explicit
call, it has a small blast radius (2 files, 2 integration points), and it
forces the seam design to be real rather than speculative. Plan 050's
`ExportButton` becomes the second consumer, which is what keeps the seam
honest (same lock-against-real-consumers rule plan 049 uses at the core
tier).

**Vocabulary rule** (to prevent permanent confusion): core tier keeps the
name **plugins** (npm packages, data hooks). The copied-UI tier is
**modules** (`better-tables add <module>`). Docs and code comments must use
these words consistently.

## Current state

Verified at `27c59b9`:

- The actions feature's full UI integration is two files plus three lines
  in `packages/ui/src/components/table/table.tsx`:

  ```
  :49    import { ActionsToolbar } from './actions-toolbar';
  :721   const shouldShowRowSelection = actions.length > 0 || rowSelection;
  :1292  {actions.length > 0 && (
  :1293    <ActionsToolbar ... />
  ```

  The two module files: `packages/ui/src/components/table/actions-toolbar.tsx`
  (renders bulk-action buttons over the current selection) and
  `packages/ui/src/components/table/action-confirmation-dialog.tsx`
  (confirm dialog used by the toolbar).

- `TableAction` (the `actions` prop's item type) lives in core types —
  `grep -rn "TableAction" packages/core/src/types/table.ts` (`actions?: TableAction<TData>[]`
  on `TableConfig`, ~`:74`). Types are cheap; they STAY in core regardless
  of where the components live.

- Row selection is a core table feature (`features.rowSelection`,
  checkbox column) — it stays in the core module. Note the coupling at
  `:721`: passing `actions` implies selection. That behavior is preserved.

- CLI copy machinery: `packages/cli/src/lib/file-operations.ts` —
  `UI_SOURCE_FILES` is a flat manifest (components.table[],
  components.filters[], hooks[], lib[]); `generateFileMappings()` walks it;
  `packages/cli/tests/ui-source-manifest.test.ts` pins the manifest to the
  real `packages/ui/src` tree **in both directions** (missing file or
  unlisted file both fail). Any restructure must keep that drift test's
  guarantee.

- CLI command structure: `packages/cli/src/commands/` has `init.ts`,
  `docs.ts`, `help.ts`; commands are registered via a typed registry
  (`packages/cli/src/lib/command-factory.ts`, see `docs.ts:25-31` for the
  pattern of building a command from the registry definition). A new `add`
  command follows the same pattern.

- `init` flow (init.ts): shadcn check → required-packages check (core,
  zustand, @dnd-kit/*) → config resolve → copy via `copyAllFiles` →
  next-steps output. `--components-path`, `--yes`, `--cwd`, `--skip-shadcn`
  flags exist.

- Core-tier plugin sketch (for vocabulary alignment only — do not build it
  here): `plans/design/table-definition-dx.md:309-352` and plan 049.

- Design records live in `plans/design/` (existing examples:
  `table-definition-dx.md`, `core-contract-v2.md`) — Step 1 adds one.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| CLI tests | `cd packages/cli && bun test` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Manual init smoke | scratch dir: `bun /path/to/repo/packages/cli/src/index.ts init -y --cwd <scratch>` | copies core module only |
| Manual add smoke | `... add actions --cwd <scratch>` | copies the 2 actions files |

## Scope

**In scope**:
- `plans/design/ui-modules.md` (create — Step 1's design record)
- `packages/ui/src/components/table/table.tsx` (slot seam)
- `packages/ui/src/components/table/index.ts` (exports)
- `packages/cli/src/lib/file-operations.ts` (module-shaped manifest)
- `packages/cli/src/commands/add.ts` (create) + command registry +
  `packages/cli/src/commands/init.ts` (default set + output text)
- `packages/cli/tests/**` (manifest drift test per module; add-command
  tests)
- `packages/ui/tests/**` (slot behavior)
- Docs: `apps/marketing/content/docs/ui-and-cli.mdx`,
  `selection-and-actions.mdx`, `troubleshooting.mdx`
- `apps/marketing/src/components/home/users-table-client.tsx` (dogfood: the
  homepage uses actions — it wires the slot)
- `.changeset/*.md`; `plans/README.md`

**Out of scope** (do NOT touch):
- Core-tier plugins (`betterTables({ plugins })`) — plan 049's territory.
- Building the export/saved-views/filter-builder modules — later plans ride
  this seam (050, 048).
- `TableAction` type relocation — stays in core.
- Row-selection behavior/checkbox column — core, unchanged.
- npm packaging of UI modules — modules are copied source, full stop.

## Git workflow

- Branch: current working branch unless the operator says otherwise; plain
  imperative commit subjects (`Plan 059 Step N: …` is fine for multi-step).

## Steps

### Step 1: Design record — slot contract + module manifest (validate against TWO consumers)

Write `plans/design/ui-modules.md` (1–2 pages) deciding, with rationale:

1. **The seam**: a `slots` prop on `BetterTable`:

   ```ts
   interface BetterTableSlots<TData> {
     /** Renders when actions.length > 0. Installed by the actions module. */
     actionsToolbar?: ComponentType<ActionsToolbarSlotProps<TData>>;
     /** Reserved for plan 050's ExportButton and future toolbar controls. */
     toolbarExtra?: ComponentType<ToolbarExtraSlotProps<TData>>;
   }
   ```

   The slot-props types must give the module everything the current inline
   render at `table.tsx:1293` passes to `ActionsToolbar` (read that call
   site and enumerate: actions, selection state/count, clear-selection,
   selected row data, …). **Validation rule**: sketch BOTH the actions
   toolbar and plan 050's ExportButton against the slot types; if the
   export button can't express its needs (it needs current
   filters/sorting/columns to hand to `exportData`), adjust
   `ToolbarExtraSlotProps` NOW. Do not add more slot points than these two
   — same minimalism rule as plan 049.

2. **Absent-module behavior**: `actions` provided but no
   `slots.actionsToolbar` → render nothing, `console.warn` once in dev
   naming the fix (`better-tables add actions` + wire the slot). Follow the
   existing one-time-dev-warn pattern in `table.tsx` (`warnFilterTreeDropped`,
   ~`:976` — keyed, production-gated).

3. **Module manifest schema** in the CLI:

   ```ts
   const UI_MODULES = {
     core: { /* today's UI_SOURCE_FILES minus the 2 actions files */ },
     actions: {
       components: { table: ['actions-toolbar.tsx', 'action-confirmation-dialog.tsx'] },
     },
   } as const;
   ```

   Every file in `packages/ui/src` belongs to EXACTLY ONE module; the drift
   test enforces the union and the disjointness.

4. **Command surface**: `better-tables add <module…>` (reuses init's
   config/paths/conflict machinery; no shadcn re-check beyond config read);
   `init` copies `core` only and prints available modules;
   `init --modules actions` opts in at init time. `add` with an unknown
   module lists valid ones and exits 1.

5. **Vocabulary**: the plugins-vs-modules rule from "Why this matters",
   stated for docs authors.

**Verify**: the design record exists and contains the two slot-props
sketches (actions + export). If the export sketch forced a slot-shape
change, the record says what changed and why.

### Step 2: Slot seam in the copied UI

Implement `slots` per the design record: add the prop to
`BetterTableProps`, replace the direct import/render
(`table.tsx:49`, `:1292-1293`) with the slot render + the one-time dev
warn. Keep `shouldShowRowSelection` (`:721`) exactly as is. Move nothing
yet — `ActionsToolbar` still exists; the default behavior change is ONLY
that the table renders it via slot.

**Verify**: `cd packages/ui && bun test` — new tests: (a) actions + slot
wired → toolbar renders on selection; (b) actions + NO slot → nothing
renders, exactly one dev warn; (c) no actions → no warn. Pattern:
`packages/ui/tests/components/table-initial-filter-tree.test.tsx`.

### Step 3: Module-shaped CLI manifest + drift test

Restructure `UI_SOURCE_FILES` → `UI_MODULES` (design record schema), update
`generateFileMappings(resolvedPaths, componentsOutputPath, modules)` to take
the selected module names, and rewrite
`packages/cli/tests/ui-source-manifest.test.ts` to assert: union of all
modules' files === the real tree (both directions, same exclusions), AND
modules are pairwise disjoint. Keep `getUiSourceFilePaths()` (or a
per-module successor) exported for the test.

**Verify**: `cd packages/cli && bun test` → drift + new manifest tests
pass.

### Step 4: `add` command + init default change

- New `packages/cli/src/commands/add.ts` per the registry pattern
  (`docs.ts` as exemplar): args `<modules…>`, flags `--cwd`, `--yes`,
  `--components-path` (must match the init-time path — read it from the
  same config resolution init uses).
- `init`: copies `core` only by default; `--modules <names>` opts modules
  in; next-steps output lists available modules with one-liners
  ("actions — bulk-action toolbar over selected rows: `bunx better-tables add actions`").
- Update `init`'s copy-confirmation dir list if it enumerates files.

**Verify**: CLI tests for: default init excludes the 2 actions files; `add
actions` maps exactly those 2 files into `<components>/better-tables-ui/table/`;
unknown module exits 1 listing valid names. Manual smoke (scratch dir) per
Commands table.

### Step 5: Dogfood the homepage

`apps/marketing/src/components/home/users-table-client.tsx` passes
`actions` today — wire the slot there
(`slots={{ actionsToolbar: ActionsToolbar }}` with a direct import; the
marketing app consumes `@better-tables/ui` workspace-style, so the import
stays package-internal).

**Verify**: `cd apps/marketing && bun test` passes;
`cd apps/marketing && bun run dev` → on `/`, selecting rows still shows the
bulk-actions toolbar and actions still execute.

### Step 6: Docs + changesets + ledger

- `ui-and-cli.mdx`: new "Modules" section — what modules are, the
  plugins-vs-modules vocabulary, `add` usage, the module list (core,
  actions).
- `selection-and-actions.mdx`: opening install step
  (`bunx better-tables add actions`) + the slot wiring line; note that
  plain row selection needs no module.
- `troubleshooting.mdx`: "actions don't render" entry (module not added /
  slot not wired — quote the dev warn text).
- Changesets: `@better-tables/cli` **minor** (`add` command; init default
  set change). The `@better-tables/ui` package is private/copied — no
  changeset, but note the slot prop in the cli changeset body since that's
  the user-visible surface.
- Update this plan's row + add a note to plan 050's row in
  `plans/README.md`: "ExportButton rides 059's `toolbarExtra` slot —
  refresh 050 against the design record before executing."

**Verify**:
`grep -rn "add actions" apps/marketing/content/docs/ | wc -l` ≥ 2;
`bunx biome check .changeset/` clean.

## Test plan

- UI: slot render / absent-slot warn / no-actions cases (Step 2).
- CLI: module manifest union+disjoint drift tests (Step 3); add-command
  behavior incl. unknown module (Step 4); init default-set test (Step 4).
- Dogfood: homepage manual smoke with selection + action execution
  (Step 5).
- Patterns: `packages/cli/tests/ui-source-manifest.test.ts`,
  `packages/cli/tests/init.test.ts`,
  `packages/ui/tests/components/table-initial-filter-tree.test.tsx`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/design/ui-modules.md` exists with both slot-consumer sketches
- [ ] `grep -n "import { ActionsToolbar }" packages/ui/src/components/table/table.tsx` → no match (slot render instead)
- [ ] Default `init` copy set excludes `actions-toolbar.tsx` and `action-confirmation-dialog.tsx` (CLI test asserts)
- [ ] `add actions` copies exactly those two files (CLI test asserts)
- [ ] Manifest drift test enforces union === tree AND module disjointness
- [ ] Homepage bulk actions still work via the slot (marketing tests + manual smoke)
- [ ] `bun run typecheck` exit 0; ui + cli + marketing suites pass
- [ ] Changeset exists; docs updated; `plans/README.md` rows for 059 AND 050 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The ExportButton sketch in Step 1 cannot be expressed against
  `toolbarExtra` without a THIRD slot point — report the needed shape
  instead of adding slots speculatively.
- Step 2 reveals `ActionsToolbar` reaches into table internals not passable
  through props (hidden store coupling) — enumerate what it reads and
  report; do not widen the slot to expose raw store handles without review.
- The `add` command needs to duplicate more than ~30 lines of init's
  config/paths logic — extract a shared helper instead; if that helper
  refactor grows beyond `file-operations.ts`/a new `lib/` file, report.
- Anything requires changing `packages/core` runtime (this plan should
  touch types-consuming UI/CLI only; `TableAction` stays where it is).

## Maintenance notes

- Plan 050 MUST be refreshed against `plans/design/ui-modules.md` before
  execution (its ExportButton becomes the `toolbarExtra` slot's first
  occupant and ships as an `export` module; its csvExport() core plugin
  half still rides 049).
- Plan 048's filter-group builder is a natural third module — when planned,
  it follows the same manifest+add path; the slot question there is
  different (it replaces the filter bar rather than adding toolbar
  content) — design that then, not now.
- Future core-tier hooks (049) and UI modules stay ORTHOGONAL: a capability
  like saved views may ship as plugin + module pair; keep the vocabulary
  rule.
- Reviewer scrutiny: the absent-module path (no crash, one warn), drift
  test disjointness, and that `init` output actually tells users modules
  exist (discoverability is the cost of opt-in).
