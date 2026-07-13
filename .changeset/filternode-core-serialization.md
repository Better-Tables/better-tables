---
"@better-tables/core": minor
---

Filter groups (AND/OR trees) land in core: `FilterGroupNode`/`FilterNode` types (`kind: 'group'`, `logic: 'and' | 'or'`, recursive `children`), runtime guards `isFilterGroupNode`/`isFilterNodeShape`/`normalizeFilterNode`, and a versioned URL wire format.

**What's new:**

- `FetchDataParams.filters` now accepts `FilterState[] | FilterGroupNode` — a bare array is still implicit AND (unchanged ergonomics for the common case); a `FilterGroupNode` expresses OR or nesting, capped at depth 3.
- `AdapterMeta` gains optional `supportsFilterGroups?: boolean` / `maxGroupDepth?: number` capability flags (types only in this release; enforcement lands with the Drizzle translation in a follow-up plan).
- `serializeFiltersToURL(filters: FilterState[] | FilterGroupNode)` always emits the new `c2:`-prefixed, group-aware wire format. `deserializeFiltersFromURL` tries `c2:` first and falls back to the legacy `c:` prefix as a flat, implicit-AND `FilterState[]` — the one URL-compatibility exception the 0.6 release policy keeps, since shared/bookmarked URLs in the wild aren't API consumers. Its return type widens to `FilterState[] | FilterGroupNode`; callers that always pass known-flat payloads can narrow with `as FilterState[]`.
- Untrusted `c2:` payloads are validated and normalized fail-closed (never thrown): invalid leaves, unknown-logic nodes, and over-deep subtrees are dropped with a value-free warning; empty groups are dropped; single-child groups are unwrapped. A dropped sibling does not take down the rest of the tree.

**Bug fix (CORE-06) included in this change, not split out:** the URL-compression key renamer (`renameKeys`) previously recursed into a filter's `meta` and `values` — user-authored data — which could silently mangle a value whose own keys happened to collide with a compression short code (and, with this change, the new `kind`/`logic`/`children` codes too). It now renames those two keys but never descends into what they contain. Sorting/column-visibility/column-order serialization is unaffected.

**Migration:** the `c2:` prefix change is invisible to users — old `c:`-prefixed links still read correctly. The `filters` type widening is additive for adapter authors typed against `FetchDataParams`/`AdapterMeta`. Code that indexes a `deserializeFiltersFromURL` result as an array unconditionally (e.g. `result[0]`) needs to narrow first (`Array.isArray(result)` or `as FilterState[]` when the payload is known to be flat).
