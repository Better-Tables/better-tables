/**
 * Sorting direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sorting parameters for a single column
 */
export interface SortingParams {
  /** Column ID to sort by */
  columnId: string;

  /** Sort direction */
  direction: SortDirection;
}

/**
 * Sorting state
 */
export type SortingState = SortingParams[];

/**
 * Sorting configuration
 */
export interface SortingConfig {
  /** Whether to enable sorting */
  enabled?: boolean;

  /** Whether to allow multi-column sorting */
  multiSort?: boolean;

  /** Maximum number of columns to sort by */
  maxSortColumns?: number;

  /** Default sort order */
  defaultSort?: SortingParams[];

  /** Whether to reset sorting on column click */
  resetOnClick?: boolean;

  /** Custom sort comparator */
  comparator?: <T>(a: T, b: T, columnId: string, direction: SortDirection) => number;
}
