/**
 * @fileoverview Typed `buildFilter` helper (plan 031 Step 4, finding 1).
 *
 * @module builders/build-filter
 *
 * @remarks
 * Authoring a `FilterState` literal by hand forces you to restate the
 * column's `type` -- information the table definition already has -- and
 * gives you nothing to stop a wrong operator or value shape for that column
 * (finding 8, fixed at the `FilterState` level in Step 1; this step makes
 * building one from a `TableDefinition` inherit that safety without
 * restating `type` for most columns).
 *
 * ## What's reachable today, and what isn't
 *
 * `buildFilter` validates `columnId` against `Paths<TRow>` (bogus/typo'd
 * paths are a compile error) and infers a default `FilterState` family --
 * `'text'` / `'number'` / `'boolean'` / `'date'` / `'json'` -- from the
 * path's resolved value shape (`PathValue<TRow, P>`), then checks `operator`
 * and `values` against THAT family. This is everything reachable from
 * `$infer.Row` (`Paths`/`PathValue`) without a real per-column type
 * registry.
 *
 * It CANNOT distinguish `'option'`/`'multiOption'` from `'text'` (both
 * resolve to a raw `string` value), or `'email'`/`'url'`/`'phone'`/
 * `'currency'`/`'percentage'`/`'custom'` from their raw-shape siblings,
 * because `TableDefinition['columns']` (`types/factory.ts`) is typed
 * `ColumnDefinition<TRow, unknown>[]` -- a plain array, not a tuple keyed by
 * each column's `id` literal. Recovering that requires the typed
 * `ColumnRegistry`/`FilterStateFor<TReg>` plan 006 registry
 * (`types/experimental/contract-v2.ts`, `types/factory.ts`'s `$infer.FilterState:
 * unknown` -- "Reserved for plan 006's typed filter registry") that hasn't
 * landed: `ColumnBuilder`/`ColumnDefinition` ids are not literal-preserving
 * yet (see that experimental file's header comment), so a tuple of a
 * table's real columns collapses to `{ [x: string]: ... }` today. Until
 * then, pass the SECOND overload's explicit `type` argument for
 * `'option'`/`'multiOption'` columns and any of the other type-collapsed
 * cases -- it is still fully checked against `operator`/`values` for that
 * exact `type`, just not auto-inferred.
 *
 * At runtime, `buildFilter` looks up the column's REAL declared `type` in
 * `table.columns` FIRST (so an `'email'` column correctly gets `type:
 * 'email'`, not a generic `'text'` -- and this doesn't depend on the
 * operator having any values, unlike a values-based guess). It falls back
 * to the caller's explicit `type` argument (second overload) when the
 * column isn't registered in `table.columns`, and only as a last resort
 * guesses from `values[0]` (see {@link resolveType}'s doc for the full
 * precedence and why value-count-0 operators like `isTrue`/`isNull` make a
 * values-based guess unreliable on its own).
 */

import { COLUMN_TYPES as CORE_COLUMN_TYPES, type ColumnType } from '../types/column';
import type { TableDefinition } from '../types/factory';
import type {
  BaseFilterState,
  BooleanFilterState,
  CustomFilterState,
  DateFilterState,
  FilterState,
  JsonFilterState,
  MultiOptionFilterState,
  NumberFilterState,
  OptionFilterState,
  TextFilterState,
} from '../types/filter';
import type { Paths, PathValue } from '../types/paths';

/** Maps a {@link ColumnType} to its corresponding {@link FilterState} discriminated-union member. */
export type FilterStateForType<T extends ColumnType> = T extends 'text' | 'email' | 'url' | 'phone'
  ? TextFilterState
  : T extends 'number' | 'currency' | 'percentage'
    ? NumberFilterState
    : T extends 'date'
      ? DateFilterState
      : T extends 'boolean'
        ? BooleanFilterState
        : T extends 'option'
          ? OptionFilterState
          : T extends 'multiOption'
            ? MultiOptionFilterState
            : T extends 'json'
              ? JsonFilterState
              : CustomFilterState;

/**
 * The DEFAULT `ColumnType` family `buildFilter` infers from a path's raw
 * value shape (`PathValue<Row, P>`) when no explicit `type` is given.
 * Unambiguous for `boolean`/`number`/`Date`/plain-object values;
 * `string`-shaped values default to `'text'` -- see the module doc for why
 * `'option'`/`'multiOption'`/`'email'`/`'url'`/`'phone'`/`'currency'`/
 * `'percentage'`/`'custom'` are NOT inferable this way and need the
 * explicit-`type` overload.
 */
export type DefaultColumnTypeForValue<V> =
  NonNullable<V> extends boolean
    ? 'boolean'
    : NonNullable<V> extends number
      ? 'number'
      : NonNullable<V> extends Date
        ? 'date'
        : NonNullable<V> extends string
          ? 'text'
          : NonNullable<V> extends object
            ? 'json'
            : 'custom';

/** Optional common `FilterState` fields `buildFilter` accepts besides `columnId`/`type`/`operator`/`values`. */
export type BuildFilterOptions = Pick<BaseFilterState, 'id' | 'includeNull' | 'meta'>;

const COLUMN_TYPES: ReadonlySet<ColumnType> = new Set(CORE_COLUMN_TYPES);

/**
 * Runtime mirror of {@link DefaultColumnTypeForValue} -- keep the two in
 * sync. Only reached as a LAST RESORT (see {@link resolveType}): it inspects
 * `values[0]`, which is unreliable for 0-value-count operators
 * (`isTrue`/`isNull`/`isEmpty`/...) since `values` is `[]` for those --
 * `resolveType` prefers the real column definition's declared type
 * specifically to avoid depending on this.
 */
function defaultColumnTypeForValue(value: unknown): ColumnType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object' && value !== null) return 'json';
  return 'text';
}

/**
 * Resolve the `type` to stamp on the built `FilterState`.
 *
 * Precedence:
 * 1. The REAL column definition's declared type, when `table.columns` has
 *    one for `columnId` -- authoritative regardless of operator value
 *    count, and correctly distinguishes e.g. `'email'` from generic
 *    `'text'`.
 * 2. The caller's explicit `type` argument (the second overload), when the
 *    column isn't registered in `table.columns` (e.g. a raw row path never
 *    turned into a column).
 * 3. A best-effort guess from `values[0]` (the first overload's fallback --
 *    only reached for an unregistered column AND no explicit type; may be
 *    wrong for 0-value-count operators, see {@link defaultColumnTypeForValue}).
 */
function resolveType(
  table: TableDefinition<string, unknown>,
  columnId: string,
  explicitType: ColumnType | undefined,
  values: unknown
): ColumnType {
  const columnDef = table.columns.find((col) => col.id === columnId);
  if (columnDef) {
    return columnDef.type;
  }
  if (explicitType) {
    return explicitType;
  }
  return defaultColumnTypeForValue(Array.isArray(values) ? values[0] : undefined);
}

/**
 * Build a type-safe {@link FilterState} for a column on a `defineTable()`
 * table WITHOUT restating its type for the common cases (finding 1) --
 * `columnId` is checked against the table's real row paths, and
 * `operator`/`values` are checked against the inferred (or given) column
 * family. See the module doc for exactly what's reachable vs. what still
 * needs the explicit-`type` overload.
 *
 * @example
 * ```typescript
 * // Inferred: 'score' is a number path, so only NumberFilterOperator/number[] compile.
 * buildFilter(ticketsTable, 'score', 'greaterThan', [10]);
 *
 * // Explicit: 'customer.plan' is really an 'option' column (string-shaped,
 * // not inferable) -- state it once, get full option-operator safety back.
 * buildFilter(ticketsTable, 'customer.plan', 'option', 'isAnyOf', ['enterprise']);
 * ```
 */
export function buildFilter<TRow, P extends Paths<TRow>, TType extends ColumnType>(
  table: TableDefinition<string, TRow>,
  columnId: P,
  type: TType,
  operator: FilterStateForType<TType>['operator'],
  values: FilterStateForType<TType>['values'],
  options?: BuildFilterOptions
): FilterStateForType<TType>;
export function buildFilter<TRow, P extends Paths<TRow>>(
  table: TableDefinition<string, TRow>,
  columnId: P,
  operator: FilterStateForType<DefaultColumnTypeForValue<PathValue<TRow, P>>>['operator'],
  values: FilterStateForType<DefaultColumnTypeForValue<PathValue<TRow, P>>>['values'],
  options?: BuildFilterOptions
): FilterStateForType<DefaultColumnTypeForValue<PathValue<TRow, P>>>;
export function buildFilter(
  table: TableDefinition<string, unknown>,
  columnId: string,
  arg3: unknown,
  arg4: unknown,
  arg5?: unknown,
  arg6?: unknown
): FilterState {
  let explicitType: ColumnType | undefined;
  let operator: unknown;
  let values: unknown;
  let options: BuildFilterOptions | undefined;

  if (typeof arg3 === 'string' && COLUMN_TYPES.has(arg3 as ColumnType)) {
    // (table, columnId, type, operator, values, options?)
    explicitType = arg3 as ColumnType;
    operator = arg4;
    values = arg5;
    options = arg6 as BuildFilterOptions | undefined;
  } else {
    // (table, columnId, operator, values, options?)
    operator = arg3;
    values = arg4;
    options = arg5 as BuildFilterOptions | undefined;
  }

  const type = resolveType(table, columnId, explicitType, values);

  return {
    ...options,
    columnId,
    type,
    operator,
    values,
  } as FilterState;
}
