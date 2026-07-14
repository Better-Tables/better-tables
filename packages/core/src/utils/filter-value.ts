/**
 * @fileoverview Generic `FilterState.values` membership check (plan 031
 * Step 2, finding 17) and stable per-filter identity (plan 031 Step 3,
 * finding 2).
 *
 * @module utils/filter-value
 *
 * @remarks
 * `FilterState` is a discriminated union whose `values` element type
 * differs per member (`string[]`, `number[]`, `boolean[]`, ...). Without
 * narrowing by `filter.type` first, `filter.values.includes(v)` doesn't
 * typecheck against an arbitrary `v: unknown` -- consumers were forced into
 * `(filter.values as unknown[]).includes(value)`, an unchecked escape hatch,
 * or a `switch` over every member just to answer "does this filter already
 * have this value selected?" (e.g. a filter-bar chip toggle). This module is
 * the "small utility" option plan 031 Step 2 prefers over a generic
 * `FilterState<TType>` form -- membership checking is the common operation
 * and needs no type gymnastics.
 */

import type { FilterState } from '../types/filter';

/**
 * Does `filter.values` already contain `value`? Works uniformly across
 * every {@link FilterState} member without narrowing by `filter.type`
 * first -- the exact workaround finding 17 flags.
 *
 * Uses `Object.is`-free `===` equality (same semantics as
 * `Array.prototype.includes` for primitives). For `date` filters, `values`
 * may hold `Date | string | number` -- pass the same representation you
 * stored (e.g. a `Date` instance to match a stored `Date`); this helper does
 * no date-aware coercion. For `json` filters, `values` holds `object |
 * string` -- object membership is by reference, matching
 * `Array.prototype.includes`'s own behavior.
 *
 * @example
 * ```typescript
 * const filter: FilterState = { columnId: 'status', type: 'option', operator: 'isAnyOf', values: ['active'] };
 * filterHasValue(filter, 'active'); // true -- no `if (filter.type === 'option')` narrowing needed
 * ```
 */
export function filterHasValue(filter: FilterState, value: unknown): boolean {
  return (filter.values as readonly unknown[]).includes(value);
}

/**
 * Stable key for a filter inside a list, for use as a React `key` or a
 * Map/Set identity (plan 031 Step 3, finding 2). Prefers the explicit
 * {@link BaseFilterState.id} when the filter has one; otherwise falls back
 * to the documented `columnId + position` convention (`index` from the
 * filter's own array, NOT a global counter), which survives two filters on
 * the same `columnId` inside one group as long as their relative order is
 * stable across renders (true for `FilterManager`'s array-replace semantics
 * -- see `setFilters`/`setFilterNode`).
 *
 * `id`-based keys are preferred because they survive REORDERING (a
 * `columnId + position` key doesn't -- swapping two same-column filters
 * swaps their keys too, which can misattribute in-flight UI state like an
 * open popover). Populate `id` (e.g. `crypto.randomUUID()`) wherever filters
 * are created if reordering matters for your UI.
 *
 * @example
 * ```typescript
 * filters.map((f, i) => <FilterChip key={filterKey(f, i)} filter={f} />)
 * ```
 */
export function filterKey(filter: FilterState, index: number): string {
  return filter.id ?? `${filter.columnId}#${index}`;
}
