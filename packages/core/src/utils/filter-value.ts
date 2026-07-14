/**
 * @fileoverview Generic `FilterState.values` membership check (plan 031
 * Step 2, finding 17).
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
