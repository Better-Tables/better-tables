---
"@better-tables/core": minor
"@better-tables/ui": minor
---

The state layer now accepts and preserves `FilterNode` trees. `TableState.filters` (and `FilterManager`/`TableStateManager` storage) widens to `FilterState[] | FilterGroupNode`: a flat array behaves byte-for-byte as before (implicit AND), while a `FilterGroupNode` — e.g. hydrated from a `c2:` URL — is stored as the tree, normalized on set via the fail-closed rules from the serialization layer.

**New tree-aware accessors:** `getFilterNode()`/`setFilterNode()` on `FilterManager` and `TableStateManager` (plus a `setFilterNode` store action) expose the real stored value.

**Legacy flat accessors are documented display views:** `getFilters()` returns a stored tree's flat leaves (depth-first, for display/badge-count purposes — the AND/OR structure is not represented); a flat `setFilters()` deterministically REPLACES the whole stored value, never silently merging into an existing group. The reactive store's `filters` field and the `filters_changed` event stay flat (`FilterState[]`) — the filter bar remains flat in 0.6; groups are reachable programmatically and via `c2:` URLs.

**UI URL sync is tree-preserving:** `useTableUrlSync` hydrates a group-shaped `c2:` URL into state unflattened and serializes it back out as the same tree. A new `flattenFilterNode()` utility provides the depth-first leaf view (display only — never write its output back into state).

`TableConfig.defaultFilters` and `BetterTablesConfig.filters` widen to match.
