import type { ColumnDefinition } from '../types/column';
import type { SortDirection, SortingConfig, SortingParams, SortingState } from '../types/sorting';

/**
 * Event types for sorting manager
 */
export type SortingManagerEvent =
  | { type: 'sort_added'; sort: SortingParams }
  | { type: 'sort_updated'; columnId: string; sort: SortingParams }
  | { type: 'sort_removed'; columnId: string }
  | { type: 'sorts_cleared' }
  | { type: 'sorts_replaced'; sorts: SortingState }
  | { type: 'direction_toggled'; columnId: string; direction: SortDirection };

/**
 * Sorting manager subscriber function type
 */
export type SortingManagerSubscriber = (event: SortingManagerEvent) => void;

/**
 * Sorting validation result
 */
export interface SortingValidationResult {
  /** Whether the sort is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Core sorting manager class for managing sorting state and operations
 */
export class SortingManager<TData = unknown> {
  private sortingState: SortingState = [];
  private columns: ColumnDefinition<TData>[] = [];
  private subscribers: SortingManagerSubscriber[] = [];
  private config: SortingConfig = {};

  constructor(
    columns: ColumnDefinition<TData>[],
    config: SortingConfig = {},
    initialSort: SortingState = []
  ) {
    this.columns = columns;
    this.config = {
      enabled: true,
      multiSort: false,
      maxSortColumns: 1,
      resetOnClick: false,
      ...config,
    };

    // If multi-sort is enabled but maxSortColumns is not set, default to 3
    if (this.config.multiSort && !config.maxSortColumns) {
      this.config.maxSortColumns = 3;
    }

    this.setSorting(initialSort);
  }

  /**
   * Get current sorting state
   */
  getSorting(): SortingState {
    return [...this.sortingState];
  }

  /**
   * Set sorting state (replaces all existing sorts)
   */
  setSorting(sorts: SortingState): void {
    if (!this.config.enabled) {
      return;
    }

    const validSorts = sorts.filter((sort) => {
      const validation = this.validateSort(sort);
      if (!validation.valid) {
        console.warn(`Invalid sort for column ${sort.columnId}: ${validation.error}`);
        return false;
      }
      return true;
    });

    // Enforce multi-sort limits
    const limitedSorts = this.config.multiSort
      ? validSorts.slice(0, this.config.maxSortColumns || 1)
      : validSorts.slice(0, 1);

    this.sortingState = limitedSorts;
    this.notifySubscribers({ type: 'sorts_replaced', sorts: limitedSorts });
  }

  /**
   * Toggle sorting for a column
   */
  toggleSort(columnId: string): void {
    if (!this.config.enabled) {
      return;
    }

    const existingSort = this.sortingState.find((s) => s.columnId === columnId);

    if (existingSort) {
      if (existingSort.direction === 'asc') {
        // Toggle to desc
        this.updateSort(columnId, 'desc');
      } else if (this.config.resetOnClick) {
        // Remove sort if reset on click is enabled
        this.removeSort(columnId);
      } else {
        // Toggle to asc
        this.updateSort(columnId, 'asc');
      }
    } else {
      // Add new sort
      this.addSort(columnId, 'asc');
    }
  }

  /**
   * Add or update sorting for a column
   */
  addSort(columnId: string, direction: SortDirection): void {
    if (!this.config.enabled) {
      return;
    }

    const sort: SortingParams = { columnId, direction };
    const validation = this.validateSort(sort);

    if (!validation.valid) {
      throw new Error(`Invalid sort for column ${columnId}: ${validation.error}`);
    }

    const existingIndex = this.sortingState.findIndex((s) => s.columnId === columnId);

    if (existingIndex >= 0) {
      // Update existing sort
      this.sortingState[existingIndex] = sort;
      this.notifySubscribers({ type: 'sort_updated', columnId, sort });
    } else {
      // Add new sort
      if (!this.config.multiSort) {
        // Single sort mode - replace all
        this.sortingState = [sort];
        this.notifySubscribers({ type: 'sorts_replaced', sorts: [sort] });
      } else {
        // Multi-sort mode - add to list
        if (this.sortingState.length >= (this.config.maxSortColumns || 1)) {
          // Remove oldest sort if at limit
          const removedSort = this.sortingState.shift();
          if (removedSort) {
            this.notifySubscribers({
              type: 'sort_removed',
              columnId: removedSort.columnId,
            });
          }
        }
        this.sortingState.push(sort);
        this.notifySubscribers({ type: 'sort_added', sort });
      }
    }
  }

  /**
   * Update sorting direction for a column
   */
  updateSort(columnId: string, direction: SortDirection): void {
    const index = this.sortingState.findIndex((s) => s.columnId === columnId);
    if (index >= 0) {
      const sort = { ...this.sortingState[index], direction };
      this.sortingState[index] = sort;
      this.notifySubscribers({ type: 'sort_updated', columnId, sort });
      this.notifySubscribers({
        type: 'direction_toggled',
        columnId,
        direction,
      });
    }
  }

  /**
   * Remove sorting for a column
   */
  removeSort(columnId: string): void {
    const index = this.sortingState.findIndex((s) => s.columnId === columnId);
    if (index >= 0) {
      this.sortingState.splice(index, 1);
      this.notifySubscribers({ type: 'sort_removed', columnId });
    }
  }

  /**
   * Clear all sorting
   */
  clearSorting(): void {
    this.sortingState = [];
    this.notifySubscribers({ type: 'sorts_cleared' });
  }

  /**
   * Get sorting for a specific column
   */
  getSort(columnId: string): SortingParams | undefined {
    return this.sortingState.find((s) => s.columnId === columnId);
  }

  /**
   * Check if column is currently sorted
   */
  isSorted(columnId: string): boolean {
    return this.sortingState.some((s) => s.columnId === columnId);
  }

  /**
   * Get sort direction for a column
   */
  getSortDirection(columnId: string): SortDirection | undefined {
    const sort = this.sortingState.find((s) => s.columnId === columnId);
    return sort?.direction;
  }

  /**
   * Get sort priority for a column (lower number = higher priority)
   */
  getSortPriority(columnId: string): number | undefined {
    const index = this.sortingState.findIndex((s) => s.columnId === columnId);
    return index >= 0 ? index : undefined;
  }

  /**
   * Get all sorted column IDs in order
   */
  getSortedColumnIds(): string[] {
    return this.sortingState.map((s) => s.columnId);
  }

  /**
   * Check if multi-sort is enabled
   */
  isMultiSortEnabled(): boolean {
    return this.config.multiSort || false;
  }

  /**
   * Get maximum number of sort columns
   */
  getMaxSortColumns(): number {
    return this.config.maxSortColumns || 1;
  }

  /**
   * Validate a sort against column definitions
   */
  validateSort(sort: SortingParams): SortingValidationResult {
    const column = this.columns.find((c) => c.id === sort.columnId);
    if (!column) {
      return { valid: false, error: `Column ${sort.columnId} not found` };
    }

    if (column.sortable === false) {
      return { valid: false, error: `Column ${sort.columnId} is not sortable` };
    }

    if (!['asc', 'desc'].includes(sort.direction)) {
      return {
        valid: false,
        error: `Invalid sort direction: ${sort.direction}`,
      };
    }

    return { valid: true };
  }

  /**
   * Subscribe to sorting changes
   */
  subscribe(callback: SortingManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of sorting changes
   */
  private notifySubscribers(event: SortingManagerEvent): void {
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in sorting manager subscriber:', error);
      }
    }
  }

  /**
   * Get sorting configuration
   */
  getConfig(): SortingConfig {
    return { ...this.config };
  }

  /**
   * Update sorting configuration
   */
  updateConfig(config: Partial<SortingConfig>): void {
    this.config = { ...this.config, ...config };

    // Validate current sorting state against new config
    if (!this.config.enabled) {
      this.clearSorting();
    } else if (!this.config.multiSort && this.sortingState.length > 1) {
      // Keep only the first sort if multi-sort is disabled
      const firstSort = this.sortingState[0];
      this.setSorting([firstSort]);
    } else if (this.sortingState.length > (this.config.maxSortColumns || 1)) {
      // Trim to max columns
      this.setSorting(this.sortingState.slice(0, this.config.maxSortColumns || 1));
    }
  }

  /**
   * Clone the sorting manager with the same configuration
   */
  clone(): SortingManager<TData> {
    return new SortingManager(this.columns, this.config, this.sortingState);
  }
}
