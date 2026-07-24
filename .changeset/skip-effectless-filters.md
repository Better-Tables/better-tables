---
"@better-tables/core": minor
---

Incomplete filters no longer trigger work. A filter chip added before its
value is chosen (`values: []`, the filter bar's `handleAddFilter` state) can't
narrow anything, yet it used to change the filter list and so trigger a data
refetch, a facet refresh, and a URL write — a full server round-trip in
server-driven apps — before the user typed anything.

- New `filterHasEffect(filter)` and `getEffectiveFilters(filters)` utilities:
  a filter constrains results when its operator takes no values
  (`isEmpty`/`isNull`/`isTrue`/…) or when it has at least one value.
- `serializeTableStateToUrl` now serializes only effective filters, so a
  valueless chip leaves the URL unchanged (no navigation).
- `@better-tables/ui`'s `useTableData` and `useFacets` key their refetch
  trigger on effective-filter content, so adding a valueless chip performs no
  fetch and no facet request. The full filter state is still passed to the
  adapter (self-exclusion is the adapter's job); only the refetch trigger
  changed.

Committing the first value pays exactly once (one fetch, one facet refresh,
one URL write), as before.
