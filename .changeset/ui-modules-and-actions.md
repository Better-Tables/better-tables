---
"@better-tables/cli": minor
---

Add an opt-in **module** tier to the copied UI. `init` now copies the `core` module by default (the table, filters, hooks, and utilities) and accepts `--modules <names>` to opt in at init time; a new `better-tables add <module>` command copies opt-in modules on demand. The first opt-in module is `actions` — the bulk-actions toolbar (`actions-toolbar.tsx` + `action-confirmation-dialog.tsx`), which is no longer part of the default `init` set.

Modules plug into the table through a new `slots` prop on `<BetterTable>` (`@better-tables/ui`, copied source — no npm surface): `slots={{ actionsToolbar: ActionsToolbar }}` installs the actions toolbar. Passing `actions` without wiring the slot renders nothing and warns once in dev, naming the fix. The manifest drift test now enforces that every UI source file belongs to exactly one module (union === tree, modules disjoint).

Vocabulary: the copied-UI tier is "modules" (`better-tables add`); the core `betterTables({ plugins })` tier stays "plugins". They are different layers.
