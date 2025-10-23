/**
 * Pagination parameters for requests
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;
}

/**
 * Pagination state with additional metadata
 */
export interface PaginationState extends PaginationParams {
  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Default page size */
  defaultPageSize?: number;

  /** Available page size options */
  pageSizeOptions?: number[];

  /** Maximum page size allowed */
  maxPageSize?: number;

  /** Whether to show page size selector */
  showPageSizeSelector?: boolean;

  /** Whether to show page numbers */
  showPageNumbers?: boolean;

  /** Number of page numbers to show */
  pageNumbersToShow?: number;

  /** Whether to show first/last page buttons */
  showFirstLastButtons?: boolean;
}
