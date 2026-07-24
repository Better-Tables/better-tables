/**
 * @fileoverview "Does this filter actually constrain results?" — the predicate
 * that lets consumers ignore an incomplete filter (plan 063 follow-up).
 *
 * @module utils/filter-effect
 *
 * @remarks
 * The filter bar adds a chip the instant a column is picked, before the user
 * has entered a value (`filter-bar.tsx` builds `{ ..., values: [] }`). That
 * chip cannot narrow anything, yet — treated as a real filter — it changed
 * the filter list identity and so triggered a data refetch, a facet refresh,
 * AND a URL write (a full server round-trip in server-driven apps) before the
 * user typed anything. These helpers let the fetch/facet/URL layers key their
 * work on the filters that actually constrain results, so an empty chip is
 * free until it gets a value.
 */

import type { FilterGroupNode, FilterState } from '../types/filter';
import { getOperatorDefinition } from '../types/filter-operators';
import { flattenFilterNode, isFilterGroupNode } from './type-guards';

/**
 * Does `filter` actually constrain query results?
 *
 * - No-value operators (`isEmpty`, `isNotEmpty`, `isNull`, `isNotNull`,
 *   `isTrue`, `isFalse`, `isToday`, …; `valueCount === 0`) constrain results
 *   on their own — always effective.
 * - Every value-taking operator needs at least one value; a freshly added
 *   chip (`values: []`) does not have one, so it has no effect yet.
 *
 * Deliberately NOT the stricter {@link validateOperatorValues}: this only
 * asks "is there anything to apply", so a partially-entered multi-value
 * filter (e.g. one bound of a `between`) keeps its current behavior — the
 * scope here is the empty-chip case, not full input validation.
 */
export function filterHasEffect(filter: FilterState): boolean {
  const definition = getOperatorDefinition(filter.operator, filter.type);
  if (definition?.valueCount === 0) return true;
  return filter.values.length > 0;
}

/**
 * The subset of `filters` that actually constrains results — a flat list with
 * every no-effect leaf (see {@link filterHasEffect}) removed.
 *
 * A {@link FilterGroupNode} tree is returned unchanged: the flat filter bar
 * (the surface that produces empty chips) always emits `FilterState[]`, and
 * pruning no-effect leaves out of an AND/OR tree — dropping emptied groups,
 * unwrapping single-child groups — is the nested-builder's concern
 * (plan 048), not this helper's. Callers that only need a stable
 * "effective filters" signature can compare this output by content.
 */
export function getEffectiveFilters(
  filters: FilterState[] | FilterGroupNode
): FilterState[] | FilterGroupNode {
  if (Array.isArray(filters)) {
    return filters.filter(filterHasEffect);
  }
  return filters;
}

/**
 * A stable string key for the EFFECTIVE filters, safe to use as a React memo
 * dependency (so an incomplete chip doesn't refire fetch/facets — plan 063
 * follow-up). `undefined` → `'null'`.
 *
 * `JSON.stringify` alone is unsafe here: a `custom` filter's `values` is
 * `unknown[]`, so a `BigInt` value throws `TypeError` and a circular value
 * throws — during render, which would crash the consuming hook. This uses a
 * BigInt-aware replacer and, on any remaining serialization failure, falls
 * back to a structural signature (per effective leaf: `columnId`, `operator`,
 * value count) that still changes when the effective filters change without
 * touching the offending value.
 */
export function getEffectiveFilterKey(
  filters: FilterState[] | FilterGroupNode | undefined
): string {
  if (filters === undefined) return 'null';
  const effective = getEffectiveFilters(filters);
  try {
    return (
      JSON.stringify(effective, (_key, value) =>
        typeof value === 'bigint' ? `${value}n` : value
      ) ?? 'null'
    );
  } catch {
    const leaves = isFilterGroupNode(effective) ? flattenFilterNode(effective) : effective;
    return `shape:${leaves
      .map((leaf) => `${leaf.columnId}:${leaf.operator}:${leaf.values.length}`)
      .join('|')}`;
  }
}
