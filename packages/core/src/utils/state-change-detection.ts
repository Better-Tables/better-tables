/**
 * Framework-agnostic state change detection utility for Better Tables
 *
 * Pure function to detect if table state has changed, eliminating the need
 * for manual ref tracking in useEffect hooks.
 *
 * @module utils/state-change-detection
 */

import type { FilterState, PaginationState, SortingState } from '@/types';

/**
 * Table state snapshot for change detection
 */
export interface TableStateSnapshot {
  /** Active filters */
  filters?: FilterState[];
  /** Pagination state */
  pagination?: PaginationState;
  /** Sorting configuration */
  sorting?: SortingState;
}

/**
 * Check if table state has changed between two snapshots
 *
 * Performs deep comparison of filters and sorting arrays, and shallow
 * comparison of pagination. This eliminates the need for manual ref tracking
 * in useEffect hooks.
 *
 * @param current - Current state snapshot
 * @param previous - Previous state snapshot
 * @returns True if any part of the state has changed
 *
 * @example
 * ```typescript
 * const current = { filters: [...], pagination: { page: 2, limit: 20 }, sorting: [...] };
 * const previous = { filters: [...], pagination: { page: 1, limit: 20 }, sorting: [...] };
 *
 * if (hasTableStateChanged(current, previous)) {
 *   // Refetch data
 * }
 * ```
 */
export function hasTableStateChanged(
  current: TableStateSnapshot,
  previous: TableStateSnapshot
): boolean {
  // Check filters
  if (current.filters !== previous.filters) {
    // If one is undefined/null and the other isn't, they're different
    if (!current.filters || !previous.filters) {
      return true;
    }

    // Deep comparison of filters array
    if (current.filters.length !== previous.filters.length) {
      return true;
    }

    // Compare each filter using JSON.stringify for deep equality
    // This is safe because FilterState is a serializable type
    const currentFiltersStr = JSON.stringify(current.filters);
    const previousFiltersStr = JSON.stringify(previous.filters);
    if (currentFiltersStr !== previousFiltersStr) {
      return true;
    }
  }

  // Check pagination (shallow comparison is sufficient)
  if (current.pagination !== previous.pagination) {
    // If one is undefined/null and the other isn't, they're different
    if (!current.pagination || !previous.pagination) {
      return true;
    }

    // Compare pagination properties
    if (
      current.pagination.page !== previous.pagination.page ||
      current.pagination.limit !== previous.pagination.limit
    ) {
      return true;
    }
  }

  // Check sorting
  if (current.sorting !== previous.sorting) {
    // If one is undefined/null and the other isn't, they're different
    if (!current.sorting || !previous.sorting) {
      return true;
    }

    // Deep comparison of sorting array
    if (current.sorting.length !== previous.sorting.length) {
      return true;
    }

    // Compare each sort using JSON.stringify for deep equality
    // This is safe because SortingState is a serializable type
    const currentSortingStr = JSON.stringify(current.sorting);
    const previousSortingStr = JSON.stringify(previous.sorting);
    if (currentSortingStr !== previousSortingStr) {
      return true;
    }
  }

  return false;
}
