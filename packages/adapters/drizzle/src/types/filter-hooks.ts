/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { FilterState } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import type { ColumnOrExpression } from './core';

/**
 * Hooks for customizing filter handler behavior
 *
 * @description
 * Allows overriding or extending filter processing behavior for edge cases.
 * Hooks are called at specific points in the filter processing pipeline,
 * allowing custom implementations when the default behavior doesn't work.
 *
 * @example
 * ```typescript
 * import { inArray } from 'drizzle-orm';
 *
 * const hooks: FilterHandlerHooks = {
 *   buildLargeArrayCondition: (column, values, operator) => {
 *     // Custom implementation for very large arrays using parameterized queries
 *     if (operator === 'isAnyOf') {
 *       return inArray(column, values);
 *     }
 *     // Return null to use default behavior for other operators
 *     return null;
 *   }
 * };
 * ```
 */
export interface FilterHandlerHooks {
  /**
   * Called before building a filter condition.
   * Can modify the filter or return null to skip processing.
   *
   * @param filter - The filter state to process
   * @param primaryTable - The primary table name
   * @returns Modified filter, or null to skip processing
   */
  beforeBuildFilterCondition?: (filter: FilterState, primaryTable: string) => FilterState | null;

  /**
   * Called after building a filter condition.
   * Can modify the resulting SQL condition.
   *
   * @param condition - The SQL condition that was built
   * @param filter - The original filter state
   * @returns Modified SQL condition
   */
  afterBuildFilterCondition?: (
    condition: SQL | SQLWrapper,
    filter: FilterState
  ) => SQL | SQLWrapper;

  /**
   * Called when building conditions for very large arrays.
   * Can provide a custom implementation or return null to use default behavior.
   *
   * @param column - The column to compare against
   * @param values - Array of values
   * @param operator - The operator ('isAnyOf' or 'isNoneOf')
   * @returns Custom SQL condition, or null to use default behavior
   */
  buildLargeArrayCondition?: (
    column: ColumnOrExpression,
    values: unknown[],
    operator: 'isAnyOf' | 'isNoneOf'
  ) => SQL | SQLWrapper | null;
}