/**
 * @fileoverview Pagination manager for handling table pagination state and operations.
 *
 * This module provides comprehensive pagination management including state tracking,
 * navigation operations, validation, and event-based subscriptions for reactive updates.
 *
 * @module managers/pagination-manager
 */

import type { PaginationConfig, PaginationParams, PaginationState } from '../types/pagination';

/**
 * Event types for pagination manager.
 *
 * Defines the different types of events that can be emitted by the pagination manager,
 * enabling reactive updates and state synchronization.
 *
 * @example
 * ```typescript
 * const unsubscribe = paginationManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'page_changed':
 *       console.log(`Page changed from ${event.previousPage} to ${event.page}`);
 *       break;
 *     case 'page_size_changed':
 *       console.log(`Page size changed from ${event.previousPageSize} to ${event.pageSize}`);
 *       break;
 *     case 'total_updated':
 *       console.log(`Total updated from ${event.previousTotal} to ${event.total}`);
 *       break;
 *     case 'pagination_reset':
 *       console.log('Pagination was reset');
 *       break;
 *   }
 * });
 * ```
 */
export type PaginationManagerEvent =
  | { type: 'page_changed'; page: number; previousPage: number }
  | { type: 'page_size_changed'; pageSize: number; previousPageSize: number }
  | { type: 'total_updated'; total: number; previousTotal: number }
  | { type: 'pagination_reset' };

/**
 * Pagination manager subscriber function type.
 *
 * Defines the callback function signature for pagination event subscribers.
 *
 * @param event - The pagination event that occurred
 *
 * @example
 * ```typescript
 * const handlePaginationChange: PaginationManagerSubscriber = (event) => {
 *   if (event.type === 'page_changed') {
 *     // Handle page change
 *     fetchData(event.page);
 *   }
 * };
 * ```
 */
export type PaginationManagerSubscriber = (event: PaginationManagerEvent) => void;

/**
 * Pagination validation result interface.
 *
 * Contains the result of validating pagination operations,
 * including success status and error information.
 *
 * @example
 * ```typescript
 * const validation = paginationManager.validatePage(5);
 * if (!validation.valid) {
 *   console.error(validation.error);
 * }
 * ```
 */
export interface PaginationValidationResult {
  /** Whether the pagination operation is valid */
  valid: boolean;
  /** Error message if the operation is invalid */
  error?: string;
}

/**
 * Core pagination manager class for managing pagination state and operations.
 *
 * Provides comprehensive pagination management including state tracking,
 * navigation operations, validation, and event-based subscriptions.
 * Supports configurable page sizes, validation rules, and reactive updates.
 *
 * @example
 * ```typescript
 * const paginationManager = new PaginationManager({
 *   defaultPageSize: 20,
 *   pageSizeOptions: [10, 20, 50, 100],
 *   maxPageSize: 1000,
 *   showPageSizeSelector: true,
 *   showPageNumbers: true,
 *   pageNumbersToShow: 7,
 *   showFirstLastButtons: true
 * });
 *
 * // Subscribe to changes
 * const unsubscribe = paginationManager.subscribe((event) => {
 *   console.log('Pagination changed:', event);
 * });
 *
 * // Navigate pages
 * paginationManager.goToPage(2);
 * paginationManager.nextPage();
 * paginationManager.prevPage();
 *
 * // Change page size
 * paginationManager.changePageSize(50);
 *
 * // Update total and reset
 * paginationManager.setTotal(1000);
 * paginationManager.reset();
 * ```
 */
export class PaginationManager {
  private paginationState: PaginationState = {
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
  private total = 0;
  private subscribers: PaginationManagerSubscriber[] = [];
  private config: PaginationConfig = {};

  /**
   * Create a new pagination manager instance.
   *
   * Initializes the pagination manager with configuration options and optional
   * initial state. The manager will validate all operations against the provided
   * configuration and emit events for state changes.
   *
   * @param config - Pagination configuration options
   * @param initialState - Optional initial pagination state
   *
   * @example
   * ```typescript
   * const paginationManager = new PaginationManager({
   *   defaultPageSize: 25,
   *   pageSizeOptions: [10, 25, 50, 100],
   *   maxPageSize: 500,
   *   showPageSizeSelector: true,
   *   pageNumbersToShow: 5
   * }, {
   *   page: 1,
   *   limit: 25
   * });
   * ```
   */
  constructor(config: PaginationConfig = {}, initialState?: Partial<PaginationState>) {
    this.config = {
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      maxPageSize: 1000,
      showPageSizeSelector: true,
      showPageNumbers: true,
      pageNumbersToShow: 7,
      showFirstLastButtons: true,
      ...config,
    };

    if (initialState) {
      this.updateState({
        ...this.paginationState,
        ...initialState,
        limit: initialState.limit || this.config.defaultPageSize || 10,
      });
    } else {
      this.updateState({
        ...this.paginationState,
        limit: this.config.defaultPageSize || 10,
      });
    }
  }

  /**
   * Get current pagination state.
   *
   * Returns a copy of the current pagination state including page number,
   * page size, total pages, and navigation flags.
   *
   * @returns Current pagination state
   *
   * @example
   * ```typescript
   * const state = paginationManager.getPagination();
   * console.log(`Page ${state.page} of ${state.totalPages}`);
   * console.log(`Has next: ${state.hasNext}, Has prev: ${state.hasPrev}`);
   * ```
   */
  getPagination(): PaginationState {
    return { ...this.paginationState };
  }

  /**
   * Get current pagination params for API requests.
   *
   * Returns the current page and limit parameters formatted for API requests.
   * This is the minimal data needed for server-side pagination.
   *
   * @returns Pagination parameters for API calls
   *
   * @example
   * ```typescript
   * const params = paginationManager.getPaginationParams();
   * const response = await fetch(`/api/data?page=${params.page}&limit=${params.limit}`);
   * ```
   */
  getPaginationParams(): PaginationParams {
    return {
      page: this.paginationState.page,
      limit: this.paginationState.limit,
    };
  }

  /**
   * Set total count and update pagination state.
   *
   * Updates the total number of items and recalculates pagination metadata
   * including total pages and navigation flags. Emits a 'total_updated' event.
   *
   * @param total - Total number of items across all pages
   *
   * @example
   * ```typescript
   * // After fetching data from API
   * const response = await fetch('/api/data');
   * const data = await response.json();
   *
   * paginationManager.setTotal(data.total);
   * // This will recalculate totalPages, hasNext, hasPrev, etc.
   * ```
   */
  setTotal(total: number): void {
    const previousTotal = this.total;
    this.total = total;
    this.updateState({ ...this.paginationState });
    this.notifySubscribers({ type: 'total_updated', total, previousTotal });
  }

  /**
   * Get total count
   */
  getTotal(): number {
    return this.total;
  }

  /**
   * Go to specific page.
   *
   * Navigates to the specified page number with validation. Throws an error
   * if the page number is invalid. Emits a 'page_changed' event on success.
   *
   * @param page - Page number to navigate to (1-based)
   * @throws {Error} If the page number is invalid
   *
   * @example
   * ```typescript
   * try {
   *   paginationManager.goToPage(3);
   *   console.log('Successfully navigated to page 3');
   * } catch (error) {
   *   console.error('Invalid page:', error.message);
   * }
   * ```
   */
  goToPage(page: number): void {
    const validation = this.validatePage(page);
    if (!validation.valid) {
      throw new Error(`Invalid page: ${validation.error}`);
    }

    const previousPage = this.paginationState.page;
    this.updateState({ ...this.paginationState, page });
    this.notifySubscribers({ type: 'page_changed', page, previousPage });
  }

  /**
   * Go to next page.
   *
   * Navigates to the next page if available. Does nothing if already on
   * the last page. Emits a 'page_changed' event if navigation occurs.
   *
   * @example
   * ```typescript
   * if (paginationManager.hasNext()) {
   *   paginationManager.nextPage();
   * }
   * ```
   */
  nextPage(): void {
    if (this.paginationState.hasNext) {
      this.goToPage(this.paginationState.page + 1);
    }
  }

  /**
   * Go to previous page.
   *
   * Navigates to the previous page if available. Does nothing if already on
   * the first page. Emits a 'page_changed' event if navigation occurs.
   *
   * @example
   * ```typescript
   * if (paginationManager.hasPrev()) {
   *   paginationManager.prevPage();
   * }
   * ```
   */
  prevPage(): void {
    if (this.paginationState.hasPrev) {
      this.goToPage(this.paginationState.page - 1);
    }
  }

  /**
   * Go to first page
   */
  firstPage(): void {
    this.goToPage(1);
  }

  /**
   * Go to last page
   */
  lastPage(): void {
    if (this.paginationState.totalPages > 0) {
      this.goToPage(this.paginationState.totalPages);
    }
  }

  /**
   * Change page size.
   *
   * Updates the number of items per page and recalculates the current page
   * to maintain the user's position in the dataset. Validates the page size
   * against configuration constraints. Emits a 'page_size_changed' event.
   *
   * @param pageSize - New page size (items per page)
   * @throws {Error} If the page size is invalid
   *
   * @example
   * ```typescript
   * try {
   *   paginationManager.changePageSize(50);
   *   console.log('Page size changed to 50');
   * } catch (error) {
   *   console.error('Invalid page size:', error.message);
   * }
   * ```
   */
  changePageSize(pageSize: number): void {
    const validation = this.validatePageSize(pageSize);
    if (!validation.valid) {
      throw new Error(`Invalid page size: ${validation.error}`);
    }

    const previousPageSize = this.paginationState.limit;

    // Calculate new page to maintain current position
    const currentIndex = (this.paginationState.page - 1) * this.paginationState.limit;
    const newPage = Math.floor(currentIndex / pageSize) + 1;

    this.updateState({
      ...this.paginationState,
      limit: pageSize,
      page: newPage,
    });

    this.notifySubscribers({ type: 'page_size_changed', pageSize, previousPageSize });
  }

  /**
   * Reset pagination to initial state.
   *
   * Resets the pagination manager to its initial state with page 1,
   * default page size, and zero total. Emits a 'pagination_reset' event.
   *
   * @example
   * ```typescript
   * // Clear all data and reset pagination
   * paginationManager.reset();
   * console.log('Pagination reset to initial state');
   * ```
   */
  reset(): void {
    this.updateState({
      page: 1,
      limit: this.config.defaultPageSize || 10,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    this.total = 0;
    this.notifySubscribers({ type: 'pagination_reset' });
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.paginationState.page;
  }

  /**
   * Get current page size
   */
  getPageSize(): number {
    return this.paginationState.limit;
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return this.paginationState.totalPages;
  }

  /**
   * Check if there's a next page
   */
  hasNext(): boolean {
    return this.paginationState.hasNext;
  }

  /**
   * Check if there's a previous page
   */
  hasPrev(): boolean {
    return this.paginationState.hasPrev;
  }

  /**
   * Get page numbers to show in pagination UI.
   *
   * Calculates which page numbers should be displayed in the pagination
   * UI based on the current page and configuration. Handles edge cases
   * for beginning and end of page ranges.
   *
   * @returns Array of page numbers to display
   *
   * @example
   * ```typescript
   * const pageNumbers = paginationManager.getPageNumbers();
   * // Returns something like [1, 2, 3, 4, 5] or [3, 4, 5, 6, 7]
   *
   * // Render pagination buttons
   * pageNumbers.forEach(pageNum => {
   *   renderPageButton(pageNum, pageNum === paginationManager.getCurrentPage());
   * });
   * ```
   */
  getPageNumbers(): number[] {
    const { page, totalPages } = this.paginationState;
    const numbersToShow = this.config.pageNumbersToShow || 7;
    const pages: number[] = [];

    if (totalPages <= numbersToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      const halfRange = Math.floor(numbersToShow / 2);
      let start = Math.max(1, page - halfRange);
      let end = Math.min(totalPages, page + halfRange);

      // Adjust if we're near the beginning or end
      if (end - start + 1 < numbersToShow) {
        if (start === 1) {
          end = Math.min(totalPages, start + numbersToShow - 1);
        } else if (end === totalPages) {
          start = Math.max(1, end - numbersToShow + 1);
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  /**
   * Get available page size options
   */
  getPageSizeOptions(): number[] {
    return this.config.pageSizeOptions || [10, 20, 50, 100];
  }

  /**
   * Get configuration
   */
  getConfig(): PaginationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...config };

    // Validate current state against new config
    if (this.config.maxPageSize && this.paginationState.limit > this.config.maxPageSize) {
      this.changePageSize(this.config.maxPageSize);
    }
  }

  /**
   * Validate page number
   */
  private validatePage(page: number): PaginationValidationResult {
    if (!Number.isInteger(page) || page < 1) {
      return { valid: false, error: 'Page must be a positive integer' };
    }

    if (this.paginationState.totalPages > 0 && page > this.paginationState.totalPages) {
      return {
        valid: false,
        error: `Page ${page} exceeds total pages ${this.paginationState.totalPages}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate page size
   */
  private validatePageSize(pageSize: number): PaginationValidationResult {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      return { valid: false, error: 'Page size must be a positive integer' };
    }

    if (this.config.maxPageSize && pageSize > this.config.maxPageSize) {
      return {
        valid: false,
        error: `Page size ${pageSize} exceeds maximum ${this.config.maxPageSize}`,
      };
    }

    const validSizes = this.config.pageSizeOptions || [10, 20, 50, 100];
    if (!validSizes.includes(pageSize)) {
      return {
        valid: false,
        error: `Page size ${pageSize} is not in allowed options: ${validSizes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Update internal state and recalculate metadata
   */
  private updateState(newState: Partial<PaginationState>): void {
    this.paginationState = {
      ...this.paginationState,
      ...newState,
    };

    // Recalculate metadata
    this.paginationState.totalPages = Math.ceil(this.total / this.paginationState.limit);
    this.paginationState.hasNext = this.paginationState.page < this.paginationState.totalPages;
    this.paginationState.hasPrev = this.paginationState.page > 1;

    // Ensure current page is within bounds
    if (
      this.paginationState.totalPages > 0 &&
      this.paginationState.page > this.paginationState.totalPages
    ) {
      this.paginationState.page = this.paginationState.totalPages;
      this.paginationState.hasNext = false;
    }
  }

  /**
   * Subscribe to pagination changes.
   *
   * Registers a callback function to be called whenever pagination state changes.
   * Returns an unsubscribe function to remove the subscription.
   *
   * @param callback - Function to call when pagination changes
   * @returns Unsubscribe function to remove the subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = paginationManager.subscribe((event) => {
   *   switch (event.type) {
   *     case 'page_changed':
   *       console.log(`Page changed to ${event.page}`);
   *       break;
   *     case 'page_size_changed':
   *       console.log(`Page size changed to ${event.pageSize}`);
   *       break;
   *     case 'total_updated':
   *       console.log(`Total updated to ${event.total}`);
   *       break;
   *     case 'pagination_reset':
   *       console.log('Pagination was reset');
   *       break;
   *   }
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  subscribe(callback: PaginationManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of pagination changes
   */
  private notifySubscribers(event: PaginationManagerEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (_error) {}
    });
  }

  /**
   * Clone the pagination manager with the same configuration.
   *
   * Creates a new pagination manager instance with the same configuration
   * and current state. Useful for creating backup instances or managing
   * multiple pagination contexts.
   *
   * @returns New pagination manager instance with copied state
   *
   * @example
   * ```typescript
   * const originalManager = new PaginationManager(config);
   * originalManager.setTotal(1000);
   * originalManager.goToPage(5);
   *
   * // Create a backup
   * const backupManager = originalManager.clone();
   * console.log('Backup created with same state');
   * ```
   */
  clone(): PaginationManager {
    const cloned = new PaginationManager(this.config, this.paginationState);
    cloned.setTotal(this.total);
    return cloned;
  }
}
