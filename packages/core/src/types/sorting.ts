/**
 * @fileoverview Sorting types and interfaces for table data ordering.
 *
 * This module defines types for sorting parameters, state, and configuration
 * used throughout the table system for managing data ordering.
 *
 * @module types/sorting
 */

/**
 * Sorting direction enumeration.
 *
 * Defines the two possible directions for sorting data.
 *
 * @example
 * ```typescript
 * const direction: SortDirection = 'asc'; // or 'desc'
 * ```
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sorting parameters for a single column.
 *
 * Defines how a single column should be sorted, including
 * the column identifier and sort direction.
 *
 * @example
 * ```typescript
 * const sortingParams: SortingParams = {
 *   columnId: 'name',
 *   direction: 'asc'
 * };
 * ```
 */
export interface SortingParams {
  /** Column identifier to sort by */
  columnId: string;

  /** Sort direction for the column */
  direction: SortDirection;
}

/**
 * Sorting state type definition.
 *
 * Represents the complete sorting state as an array of
 * sorting parameters, enabling multi-column sorting.
 *
 * @example
 * ```typescript
 * const sortingState: SortingState = [
 *   { columnId: 'name', direction: 'asc' },
 *   { columnId: 'age', direction: 'desc' }
 * ];
 * ```
 */
export type SortingState = SortingParams[];

/**
 * Sorting configuration options.
 *
 * Configures sorting behavior and capabilities for
 * the table sorting system.
 *
 * @example
 * ```typescript
 * const sortingConfig: SortingConfig = {
 *   enabled: true,
 *   multiSort: true,
 *   maxSortColumns: 3,
 *   defaultSort: [{ columnId: 'name', direction: 'asc' }],
 *   resetOnClick: false,
 *   comparator: (a, b, columnId, direction) => {
 *     // Custom sorting logic
 *     return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
 *   }
 * };
 * ```
 */
export interface SortingConfig {
  /** Whether sorting is enabled for the table */
  enabled?: boolean;

  /** Whether to allow sorting by multiple columns */
  multiSort?: boolean;

  /** Maximum number of columns that can be sorted simultaneously */
  maxSortColumns?: number;

  /** Default sort order applied on initialization */
  defaultSort?: SortingParams[];

  /** Whether to reset sorting when clicking a column header */
  resetOnClick?: boolean;

  /** Custom sort comparator function for advanced sorting logic */
  comparator?: <T>(a: T, b: T, columnId: string, direction: SortDirection) => number;
}
