/**
 * @fileoverview Utilities for managing column order state.
 *
 * Provides functions to compute default column order from column definitions,
 * calculate modifications from defaults, and merge modifications back with defaults.
 *
 * @module utils/column-order
 */

import type { ColumnDefinition, ColumnOrder } from '../types/column';

/**
 * Get the default column order from column definitions.
 *
 * Returns an array of column IDs in the order they are defined.
 *
 * @param columns - Array of column definitions
 * @returns Array of column IDs in definition order
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', ... },
 *   { id: 'email', ... },
 *   { id: 'age', ... }
 * ];
 *
 * const order = getDefaultColumnOrder(columns);
 * // Returns: ['name', 'email', 'age']
 * ```
 */
export function getDefaultColumnOrder<TData = unknown>(
  columns: ColumnDefinition<TData>[]
): ColumnOrder {
  return columns.map((column) => column.id);
}

/**
 * Get only the modifications to column order from the default order.
 *
 * Returns the modified order or an empty array if the current order matches the default.
 * This is useful for URL serialization to avoid storing unnecessary data.
 *
 * @param columns - Array of column definitions
 * @param currentOrder - Current column order
 * @returns Modified order or empty array if matches default
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', ... },
 *   { id: 'email', ... },
 *   { id: 'age', ... }
 * ];
 *
 * const current = ['email', 'name', 'age']; // Modified
 * const modifications = getColumnOrderModifications(columns, current);
 * // Returns: ['email', 'name', 'age']
 *
 * const current2 = ['name', 'email', 'age']; // Matches default
 * const modifications2 = getColumnOrderModifications(columns, current2);
 * // Returns: []
 * ```
 */
export function getColumnOrderModifications<TData = unknown>(
  columns: ColumnDefinition<TData>[],
  currentOrder: ColumnOrder
): ColumnOrder {
  const defaultOrder = getDefaultColumnOrder(columns);

  // Check if arrays are equal by comparing lengths and elements
  if (defaultOrder.length !== currentOrder.length) {
    return currentOrder;
  }

  const isEqual = defaultOrder.every((id, index) => id === currentOrder[index]);
  return isEqual ? [] : currentOrder;
}

/**
 * Merge column order modifications with the default order.
 *
 * Takes modifications (typically from URL) and merges them with the default order.
 * If modifications is empty, returns the default order.
 *
 * @param columns - Array of column definitions
 * @param modifications - Modified order to apply (empty array means use default)
 * @returns Complete column order
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', ... },
 *   { id: 'email', ... },
 *   { id: 'age', ... }
 * ];
 *
 * const modifications = ['email', 'name', 'age'];
 * const order = mergeColumnOrder(columns, modifications);
 * // Returns: ['email', 'name', 'age']
 *
 * const modifications2 = []; // Empty means use default
 * const order2 = mergeColumnOrder(columns, modifications2);
 * // Returns: ['name', 'email', 'age']
 * ```
 */
export function mergeColumnOrder<TData = unknown>(
  columns: ColumnDefinition<TData>[],
  modifications: ColumnOrder
): ColumnOrder {
  // If modifications is empty, return default order
  if (modifications.length === 0) {
    return getDefaultColumnOrder(columns);
  }

  // If modifications length doesn't match columns length, return default
  // This handles cases where columns were added/removed since order was saved
  const defaultOrder = getDefaultColumnOrder(columns);
  if (modifications.length !== columns.length) {
    return defaultOrder;
  }

  // Verify all column IDs from modifications are still valid
  const columnIds = new Set(columns.map((col) => col.id));
  const hasAllColumns = modifications.every((id) => columnIds.has(id));

  if (!hasAllColumns) {
    // Some columns no longer exist, return default order
    return defaultOrder;
  }

  return modifications;
}

// Note: Use arrayMove from @dnd-kit/sortable instead of this utility
// This was created but is not used anywhere in the codebase
