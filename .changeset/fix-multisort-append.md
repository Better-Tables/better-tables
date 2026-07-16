---
"@better-tables/core": patch
---

fix(core): `toggleSort` no longer accumulates columns in single-sort mode

`TableStateManager.toggleSort` always appended when sorting a new column, and
had no `multiSort` concept at all — the `multiSort` flag lived on the separate
`SortingManager` (which this path never uses) and, in the UI, only fed the
header context menu's display. So a table configured `sorting={{ multiSort:
false }}` still accumulated sort keys: clicking "Status" with `createdAt`
already sorted produced

```
[{ columnId: 'createdAt', direction: 'asc' }, { columnId: 'status', direction: 'asc' }]
```

and the table stayed ordered by whatever was sorted first, making header clicks
look broken.

`TableStateConfig` now takes `sorting: { multiSort?: boolean }` (default
`false`), and `toggleSort` respects it: in single-sort mode the state only ever
holds the toggled column, so sorting by a new column replaces the previous one.
`multiSort: true` accumulates as before, and cycling one column
(asc → desc → unsorted) leaves the others in place. `<BetterTable>` passes its
`sorting.multiSort` prop through when it creates the store.
