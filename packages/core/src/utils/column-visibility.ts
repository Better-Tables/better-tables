/**
 * @fileoverview Utilities for managing column visibility state.
 *
 * Provides functions to compute default visibility states from column definitions,
 * calculate modifications from defaults, and merge modifications back with defaults.
 *
 * @module utils/column-visibility
 */

import type { ColumnDefinition, ColumnVisibility } from '../types/column';

/**
 * Get the default column visibility state from column definitions.
 *
 * Returns a ColumnVisibility object where each column ID maps to its default visibility state.
 * Defaults to `true` (visible) if `defaultVisible` is not specified.
 *
 * @param columns - Array of column definitions
 * @returns Column visibility state based on column defaults
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', defaultVisible: true },
 *   { id: 'email', defaultVisible: false },
 *   { id: 'age' } // defaults to true
 * ];
 *
 * const defaults = getDefaultColumnVisibility(columns);
 * // Returns: { name: true, email: false, age: true }
 * ```
 */
export function getDefaultColumnVisibility<TData = unknown>(
  columns: ColumnDefinition<TData>[]
): ColumnVisibility {
  const visibility: ColumnVisibility = {};

  columns.forEach((column) => {
    visibility[column.id] = column.defaultVisible !== undefined ? column.defaultVisible : true;
  });

  return visibility;
}

/**
 * Get only the modifications to column visibility from their defaults.
 *
 * Returns a ColumnVisibility object containing only columns that differ from their
 * default state. This is useful for URL serialization to avoid unnecessary data.
 *
 * @param columns - Array of column definitions
 * @param currentVisibility - Current column visibility state
 * @returns Only the modified visibility states
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', defaultVisible: true },
 *   { id: 'email', defaultVisible: false }
 * ];
 *
 * const current = { name: false, email: true }; // Both differ from default
 * const modifications = getColumnVisibilityModifications(columns, current);
 * // Returns: { name: false, email: true }
 *
 * const current2 = { name: true, email: false }; // Both match defaults
 * const modifications2 = getColumnVisibilityModifications(columns, current2);
 * // Returns: {}
 * ```
 */
export function getColumnVisibilityModifications<TData = unknown>(
  columns: ColumnDefinition<TData>[],
  currentVisibility: ColumnVisibility
): ColumnVisibility {
  const modifications: ColumnVisibility = {};
  const defaults = getDefaultColumnVisibility(columns);

  columns.forEach((column) => {
    const currentValue = currentVisibility[column.id];
    const defaultValue = defaults[column.id];

    // Only include if the value differs from the default
    if (currentValue !== undefined && currentValue !== defaultValue) {
      modifications[column.id] = currentValue;
    }
  });

  return modifications;
}

/**
 * Merge column visibility modifications with default states.
 *
 * Takes modifications (typically from URL) and merges them with the default
 * visibility states defined in the column definitions. Ignores modifications that
 * attempt to hide columns where `hideable === false`.
 *
 * @param columns - Array of column definitions
 * @param modifications - Visibility modifications to apply
 * @returns Complete column visibility state
 *
 * @example
 * ```typescript
 * const columns = [
 *   { id: 'name', defaultVisible: true },
 *   { id: 'email', defaultVisible: false },
 *   { id: 'id', hideable: false } // Non-hideable column
 * ];
 *
 * const modifications = { name: false, id: false }; // User tried to hide both
 * const visibility = mergeColumnVisibility(columns, modifications);
 * // Returns: { name: false, email: false, id: true }
 * // Note: 'id' remains true because hideable === false
 * ```
 */
export function mergeColumnVisibility<TData = unknown>(
  columns: ColumnDefinition<TData>[],
  modifications: ColumnVisibility
): ColumnVisibility {
  const defaults = getDefaultColumnVisibility(columns);
  const visibility: ColumnVisibility = { ...defaults };

  // Create a map of columns for quick lookup
  const columnMap = new Map(columns.map((col) => [col.id, col]));

  // Override with any modifications, but only for existing columns
  Object.entries(modifications).forEach(([columnId, value]) => {
    const column = columnMap.get(columnId);

    // Skip modifications for non-existent columns
    if (!column) {
      return;
    }

    // Skip modifications for non-hideable columns when trying to hide them
    // This prevents persisted state from hiding columns that shouldn't be hideable
    if (column.hideable === false && value === false) {
      return;
    }

    visibility[columnId] = value;
  });

  return visibility;
}
