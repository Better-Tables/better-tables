---
"@better-tables/core": patch
---

Fixed a correctness bug in `VirtualizationManager` where re-measuring a
row's dynamic height only updated that row's own cached position — every
previously-measured downstream row kept its stale `start`/`end`, producing
overlapping or gapped rows once dynamic row heights were mixed with
scrolling. `measureRow` now stores only the measured height; row positions
are always derived from a lazily-revalidated prefix-offsets structure, so a
stale cached position can no longer exist.

This also removes the two O(n) scans that came with the old cache: computing
a row's start position summed every preceding row's height from scratch, and
`findRowIndexByPosition`'s binary search called that summation on every
probe (effectively O(n log n) per scroll lookup on an uncached range).
Position lookups are now true O(log n), with the underlying prefix walk
amortized to O(n) once per invalidation instead of once per row/per probe.

No public API or event payload changes — `use-virtualization.ts` and
`virtualized-table.tsx` in `@better-tables/ui` needed no edits.
