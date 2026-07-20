/**
 * @fileoverview Standalone-column utilities: `defineColumns` (the typed
 * collector for hand-built column arrays) and `validateColumns`.
 *
 * Columns are normally defined through `defineTable()` / `tables.define()`
 * path builders, which derive accessors and types from the adapter schema.
 * When you build columns by hand instead — instantiating `TextColumnBuilder`,
 * `NumberColumnBuilder`, etc. directly, typically for `defineTableRow()` or a
 * bare `<BetterTable columns={…}>` — `defineColumns` is the supported way to
 * collect them into a single correctly-typed array.
 *
 * @module builders/column-factory
 */

import type { ColumnDefinition } from '../types/column';

/**
 * Collect a heterogeneous set of built columns into an array typed for the
 * table boundary, erasing each column's individual value type to `unknown`.
 *
 * A `ColumnDefinition<TData, V>` is *invariant* in `V`: `accessor` returns `V`
 * (covariant) while `cellRenderer`/`filter`/`validation` consume `V`
 * (contravariant). Because of this, a heterogeneous array such as
 * `[ColumnDefinition<TData, string>, ColumnDefinition<TData, number>]` is **not**
 * assignable to `ColumnDefinition<TData, unknown>[]` — there is no single value
 * type that is simultaneously a supertype (for `accessor`) and a subtype (for
 * `cellRenderer`) of every column's value type. See plan 005 / Step 5.
 *
 * `defineColumns` sidesteps this by inferring each column's value type
 * *independently* (via a per-element tuple constraint) so every column is
 * type-checked against its own `V` at the call site, then performs the value-type
 * erasure to `unknown` in this single, audited place. Each element is still
 * verified to be a `ColumnDefinition<TData, …>`, so passing anything that is not
 * a column is a compile error — no `any` is involved.
 *
 * Usage is curried so `TData` is specified explicitly while each column's value
 * type stays inferred:
 *
 * @example
 * ```typescript
 * import { defineColumns, NumberColumnBuilder, TextColumnBuilder } from '@better-tables/core';
 *
 * export const userColumns = defineColumns<User>()([
 *   new TextColumnBuilder<User>().id('name').displayName('Name').accessor((u) => u.name).build(),
 *   new NumberColumnBuilder<User>().id('age').displayName('Age').accessor((u) => u.age).build(),
 * ]);
 * // userColumns: ColumnDefinition<User, unknown>[]
 * ```
 *
 * @template TData - The type of row data shared by every column
 * @returns A collector that accepts the tuple of built columns and returns the
 * value-type-erased array ready to hand to `<BetterTable columns={…} />` or
 * `defineTableRow()`.
 */
export function defineColumns<TData>() {
  return <const TColumns extends readonly unknown[]>(
    columns: readonly [...{ [K in keyof TColumns]: ColumnDefinition<TData, TColumns[K]> }]
  ): ColumnDefinition<TData, unknown>[] => {
    // Single, audited erasure: each element was individually verified above to be
    // a ColumnDefinition<TData, …>; we widen its value type to `unknown` here so
    // the heterogeneous set can flow through the invariant table boundary.
    return columns as unknown as ColumnDefinition<TData, unknown>[];
  };
}

/**
 * Utility function to validate column definitions.
 *
 * Performs comprehensive validation on an array of column definitions,
 * checking for required fields, duplicate IDs, and other common issues.
 *
 * @param columns - Array of column definitions to validate
 * @returns Validation result with success status and error messages
 */
export function validateColumns(columns: ColumnDefinition[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const usedIds = new Set<string>();

  for (const [i, column] of columns.entries()) {
    // Check required fields
    if (!column.id) {
      errors.push(`Column at index ${i} is missing required 'id' field`);
    }

    if (!column.displayName) {
      errors.push(`Column at index ${i} is missing required 'displayName' field`);
    }

    if (!column.accessor) {
      errors.push(`Column at index ${i} is missing required 'accessor' field`);
    }

    if (!column.type) {
      errors.push(`Column at index ${i} is missing required 'type' field`);
    }

    // Check for duplicate IDs
    if (column.id && usedIds.has(column.id)) {
      errors.push(`Duplicate column ID '${column.id}' found at index ${i}`);
    } else if (column.id) {
      usedIds.add(column.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
