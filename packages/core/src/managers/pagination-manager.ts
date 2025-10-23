import type { PaginationState, PaginationParams, PaginationConfig } from '../types/pagination';

/**
 * Event types for pagination manager
 */
export type PaginationManagerEvent =
  | { type: 'page_changed'; page: number; previousPage: number }
  | { type: 'page_size_changed'; pageSize: number; previousPageSize: number }
  | { type: 'total_updated'; total: number; previousTotal: number }
  | { type: 'pagination_reset' };

/**
 * Pagination manager subscriber function type
 */
export type PaginationManagerSubscriber = (event: PaginationManagerEvent) => void;

/**
 * Pagination validation result
 */
export interface PaginationValidationResult {
  /** Whether the pagination is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Core pagination manager class for managing pagination state and operations
 */
export class PaginationManager {
  private paginationState: PaginationState = {
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
  private total: number = 0;
  private subscribers: PaginationManagerSubscriber[] = [];
  private config: PaginationConfig = {};

  constructor(config: PaginationConfig = {}, initialState?: Partial<PaginationState>) {
    this.config = {
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      maxPageSize: 1000,
      showPageSizeSelector: true,
      showPageNumbers: true,
      pageNumbersToShow: 7,
      showFirstLastButtons: true,
      ...config
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
   * Get current pagination state
   */
  getPagination(): PaginationState {
    return { ...this.paginationState };
  }

  /**
   * Get current pagination params for API requests
   */
  getPaginationParams(): PaginationParams {
    return {
      page: this.paginationState.page,
      limit: this.paginationState.limit,
    };
  }

  /**
   * Set total count and update pagination state
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
   * Go to specific page
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
   * Go to next page
   */
  nextPage(): void {
    if (this.paginationState.hasNext) {
      this.goToPage(this.paginationState.page + 1);
    }
  }

  /**
   * Go to previous page
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
   * Change page size
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
   * Reset pagination to initial state
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
   * Get page numbers to show in pagination UI
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
      return { valid: false, error: `Page ${page} exceeds total pages ${this.paginationState.totalPages}` };
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
      return { valid: false, error: `Page size ${pageSize} exceeds maximum ${this.config.maxPageSize}` };
    }

    const validSizes = this.config.pageSizeOptions || [10, 20, 50, 100];
    if (!validSizes.includes(pageSize)) {
      return { valid: false, error: `Page size ${pageSize} is not in allowed options: ${validSizes.join(', ')}` };
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
    if (this.paginationState.totalPages > 0 && this.paginationState.page > this.paginationState.totalPages) {
      this.paginationState.page = this.paginationState.totalPages;
      this.paginationState.hasNext = false;
    }
  }

  /**
   * Subscribe to pagination changes
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
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in pagination manager subscriber:', error);
      }
    });
  }

  /**
   * Clone the pagination manager with the same configuration
   */
  clone(): PaginationManager {
    const cloned = new PaginationManager(this.config, this.paginationState);
    cloned.setTotal(this.total);
    return cloned;
  }
} 