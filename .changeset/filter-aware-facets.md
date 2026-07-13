---
"@better-tables/core": minor
"@better-tables/adapters-drizzle": minor
---

Facet queries (`getFilterOptions`, `getFacetedValues`, `getMinMaxValues`) can now be scoped to the caller's active filters instead of always describing the whole table. All three methods gain an optional second `params?: FacetQueryParams` argument (`{ filters?: FilterState[] | FilterGroupNode }`) — omitting it is unchanged, whole-table behavior, so this is additive for existing callers and adapter implementations.

**Self-exclusion**: when computing facets for column `X`, every active filter leaf targeting `X` itself is dropped before the facet query runs (the standard faceting convention: a filtered multi-select facet keeps showing its sibling options/counts instead of collapsing to only what's already selected). This applies uniformly to a flat `FilterState[]` and to a `FilterGroupNode` tree — pruning a tree drops `X`-leaves recursively, discards groups that become empty, and unwraps groups left with a single child.

**Distinct facet counts under joins**: `getFacetedValues`/`getFilterOptions` counts now use `countDistinct(primaryKey)` instead of a plain `count()` when the facet or its filters require a join, preventing one-to-many joins from inflating a facet's count (mirroring the existing pagination `total` guard). `getMinMaxValues` needs no such guard — `MIN`/`MAX` of a fan-out-duplicated value is unaffected by the duplication.

The Drizzle adapter implements the new `params` on all three methods; other adapters compile unchanged (the parameter is optional) but will keep returning whole-table facets until they adopt it.

No core store or UI hook calls these three methods yet — dynamic facet loading isn't wired up anywhere in `@better-tables/ui` today (filter inputs use `column.filter.options`, statically defined at column-build time), so there are no call sites to thread live filter state through in this change.
