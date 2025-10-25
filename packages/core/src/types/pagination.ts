/**
 * @fileoverview Pagination types and interfaces for better-tables data management.
 *
 * This module defines types for pagination parameters, state, and configuration
 * used throughout the table system for managing large datasets.
 *
 * @module types/pagination
 */

/**
 * Pagination parameters for data requests.
 *
 * Defines the basic pagination information needed to request
 * a specific page of data from a data source.
 *
 * @example
 * ```typescript
 * const paginationParams: PaginationParams = {
 *   page: 2,
 *   limit: 20
 * };
 * ```
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;
}

/**
 * Pagination state with additional metadata.
 *
 * Extends basic pagination parameters with computed metadata
 * about the pagination state for UI rendering.
 *
 * @example
 * ```typescript
 * const paginationState: PaginationState = {
 *   page: 2,
 *   limit: 20,
 *   totalPages: 10,
 *   hasNext: true,
 *   hasPrev: true
 * };
 * ```
 */
export interface PaginationState extends PaginationParams {
  /** Total number of pages available */
  totalPages: number;

  /** Whether there is a next page available */
  hasNext: boolean;

  /** Whether there is a previous page available */
  hasPrev: boolean;
}

/**
 * Pagination configuration options.
 *
 * Configures pagination behavior and UI components for
 * the table pagination system.
 *
 * @example
 * ```typescript
 * const paginationConfig: PaginationConfig = {
 *   defaultPageSize: 20,
 *   pageSizeOptions: [10, 20, 50, 100],
 *   maxPageSize: 1000,
 *   showPageSizeSelector: true,
 *   showPageNumbers: true,
 *   pageNumbersToShow: 5,
 *   showFirstLastButtons: true
 * };
 * ```
 */
export interface PaginationConfig {
  /** Default number of items per page */
  defaultPageSize?: number;

  /** Available page size options for user selection */
  pageSizeOptions?: number[];

  /** Maximum page size allowed */
  maxPageSize?: number;

  /** Whether to show page size selector dropdown */
  showPageSizeSelector?: boolean;

  /** Whether to show page number buttons */
  showPageNumbers?: boolean;

  /** Number of page number buttons to display */
  pageNumbersToShow?: number;

  /** Whether to show first/last page navigation buttons */
  showFirstLastButtons?: boolean;
}
