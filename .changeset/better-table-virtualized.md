---
"@better-tables/core": patch
---

feat(ui)/docs(core): `<BetterTable virtualized />` — virtualization without a second component

Virtualization used to mean giving up `<BetterTable>`: the only windowing
surface was the separate `<VirtualizedTable>` primitive, which has no
adapter/filter/sort/pagination/URL-sync of its own, so a large dataset meant
hand-building a sort toolbar (and doing without a filter bar entirely) just to
feed its flat `data` prop — finding 6.

`<BetterTable>` now takes a `virtualized` prop:

```tsx
<BetterTable table={ticketsTable} data={allTickets} virtualized />
<BetterTable table={ticketsTable} data={allTickets}
  virtualized={{ height: 640, rowHeight: 56 }}
  features={{ filtering: true, sorting: true, pagination: false }} />
```

Windowing is purely a rendering detail — filtering, sorting, selection, column
visibility/reordering and URL sync are untouched, and rows still go through the
same memoized row component with the same props, so the per-row memoization
contract is unchanged (this is what previously made folding virtualization into
`<BetterTable>` look risky). Off-screen space is held open by two spacer rows
rather than by absolutely positioning each row, which is what keeps native table
column alignment intact. The header is pinned while the body scrolls.

`TableFeatures.virtualScrolling` — which was declared but never read by any
component, so setting it silently did nothing — is now `@deprecated` and points
at this prop. `<VirtualizedTable>` remains as a low-level primitive for cases
`<BetterTable>` doesn't cover (non-table layouts via `renderRow`, per-row
dynamic height measurement).
