/**
 * @fileoverview Sorting manager for handling table sorting state and operations.
 *
 * This module provides comprehensive sorting management including single and multi-column
 * sorting, validation, event-based subscriptions, and configuration management.
 *
 * @module managers/sorting-manager
 */

import type { ColumnDefinition } from '../types/column';
import type { SortDirection, SortingConfig, SortingParams, SortingState } from '../types/sorting';

/**
 * Event types for sorting manager.
 *
 * Defines the different types of events that can be emitted by the sorting manager,
 * enabling reactive updates and state synchronization.
 *
 * @example
 * ```typescript
 * const unsubscribe = sortingManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'sort_added':
 *       console.log(`Sort added for column ${event.sort.columnId}`);
 *       break;
 *     case 'sort_updated':
 *       console.log(`Sort updated for column ${event.columnId}`);
 *       break;
 *     case 'sort_removed':
 *       console.log(`Sort removed for column ${event.columnId}`);
 *       break;
 *     case 'sorts_cleared':
 *       console.log('All sorts cleared');
 *       break;
 *     case 'direction_toggled':
 *       console.log(`Direction toggled for ${event.columnId} to ${event.direction}`);
 *       break;
 *   }
 * });
 * ```
 */
export type SortingManagerEvent =
  | { type: 'sort_added'; sort: SortingParams }
  | { type: 'sort_updated'; columnId: string; sort: SortingParams }
  | { type: 'sort_removed'; columnId: string }
  | { type: 'sorts_cleared' }
  | { type: 'sorts_replaced'; sorts: SortingState }
  | { type: 'direction_toggled'; columnId: string; direction: SortDirection };

/**
 * Sorting manager subscriber function type.
 *
 * Defines the callback function signature for sorting event subscribers.
 *
 * @param event - The sorting event that occurred
 *
 * @example
 * ```typescript
 * const handleSortingChange: SortingManagerSubscriber = (event) => {
 *   if (event.type === 'sort_added') {
 *     // Handle new sort
 *     updateTableData();
 *   }
 * };
 * ```
 */
export type SortingManagerSubscriber = (event: SortingManagerEvent) => void;

/**
 * Sorting validation result interface.
 *
 * Contains the result of validating sorting operations,
 * including success status and error information.
 *
 * @example
 * ```typescript
 * const validation = sortingManager.validateSort({ columnId: 'name', direction: 'asc' });
 * if (!validation.valid) {
 *   console.error(validation.error);
 * }
 * ```
 */
export interface SortingValidationResult {
  /** Whether the sorting operation is valid */
  valid: boolean;
  /** Error message if the operation is invalid */
  error?: string;
}

/**
 * Core sorting manager class for managing sorting state and operations.
 *
 * Provides comprehensive sorting management including single and multi-column sorting,
 * validation against column definitions, event-based subscriptions, and configuration
 * management. Supports both client-side and server-side sorting patterns.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const sortingManager = new SortingManager(columns, {
 *   enabled: true,
 *   multiSort: true,
 *   maxSortColumns: 3,
 *   resetOnClick: false
 * });
 *
 * // Subscribe to changes
 * const unsubscribe = sortingManager.subscribe((event) => {
 *   console.log('Sorting changed:', event);
 * });
 *
 * // Add sorts
 * sortingManager.addSort('name', 'asc');
 * sortingManager.addSort('age', 'desc');
 *
 * // Toggle sorting
 * sortingManager.toggleSort('name');
 *
 * // Check state
 * console.log('Is sorted:', sortingManager.isSorted('name'));
 * console.log('Sort direction:', sortingManager.getSortDirection('name'));
 * ```
 */
export class SortingManager<TData = unknown> {
  private sortingState: SortingState = [];
  private columns: ColumnDefinition<TData>[] = [];
  private subscribers: SortingManagerSubscriber[] = [];
  private config: SortingConfig = {};

  /**
   * Create a new sorting manager instance.
   *
   * Initializes the sorting manager with column definitions, configuration options,
   * and optional initial sorting state. The manager will validate all sorting
   * operations against the column definitions and emit events for state changes.
   *
   * @param columns - Array of column definitions to validate sorts against
   * @param config - Sorting configuration options
   * @param initialSort - Optional initial sorting state
   *
   * @example
   * ```typescript
   * const sortingManager = new SortingManager(columns, {
   *   enabled: true,
   *   multiSort: true,
   *   maxSortColumns: 3,
   *   resetOnClick: false
   * }, [
   *   { columnId: 'name', direction: 'asc' },
   *   { columnId: 'age', direction: 'desc' }
   * ]);
   * ```
   */
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
   * Get current sorting state.
   *
   * Returns a copy of the current sorting state including all active sorts
   * in priority order (first sort has highest priority).
   *
   * @returns Current sorting state
   *
   * @example
   * ```typescript
   * const sorts = sortingManager.getSorting();
   * console.log('Active sorts:', sorts);
   * // Output: [{ columnId: 'name', direction: 'asc' }, { columnId: 'age', direction: 'desc' }]
   * ```
   */
  getSorting(): SortingState {
    return [...this.sortingState];
  }

  /**
   * Set sorting state (replaces all existing sorts).
   *
   * Replaces the current sorting state with the provided sorts. Validates
   * all sorts against column definitions and enforces multi-sort limits.
   * Emits a 'sorts_replaced' event.
   *
   * @param sorts - New sorting state to set
   *
   * @example
   * ```typescript
   * sortingManager.setSorting([
   *   { columnId: 'name', direction: 'asc' },
   *   { columnId: 'age', direction: 'desc' }
   * ]);
   * ```
   */
  setSorting(sorts: SortingState): void {
    if (!this.config.enabled) {
      return;
    }

    const validSorts = sorts.filter((sort) => {
      const validation = this.validateSort(sort);
      if (!validation.valid) {
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
   * Toggle sorting for a column.
   *
   * Cycles through sort states for a column: none → asc → desc → none (if resetOnClick).
   * If the column is not currently sorted, adds it with 'asc' direction.
   * If already sorted, toggles the direction or removes the sort based on configuration.
   *
   * @param columnId - Column identifier to toggle sorting for
   *
   * @example
   * ```typescript
   * // First click: sort asc
   * sortingManager.toggleSort('name');
   *
   * // Second click: sort desc
   * sortingManager.toggleSort('name');
   *
   * // Third click: remove sort (if resetOnClick is enabled)
   * sortingManager.toggleSort('name');
   * ```
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
   * Add or update sorting for a column.
   *
   * Adds a new sort or updates an existing sort for the specified column.
   * Validates the sort against column definitions and enforces multi-sort limits.
   * In single-sort mode, replaces all existing sorts. In multi-sort mode, adds to the list.
   *
   * @param columnId - Column identifier to sort by
   * @param direction - Sort direction ('asc' or 'desc')
   * @throws {Error} If the sort is invalid
   *
   * @example
   * ```typescript
   * try {
   *   sortingManager.addSort('name', 'asc');
   *   sortingManager.addSort('age', 'desc');
   *   console.log('Sorts added successfully');
   * } catch (error) {
   *   console.error('Invalid sort:', error.message);
   * }
   * ```
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
   * Update sorting direction for a column.
   *
   * Updates the sort direction for an existing sort. Does nothing if the column
   * is not currently sorted. Emits both 'sort_updated' and 'direction_toggled' events.
   *
   * @param columnId - Column identifier to update
   * @param direction - New sort direction ('asc' or 'desc')
   *
   * @example
   * ** Change existing sort from asc to desc
   * ```typescript
   * sortingManager.updateSort('name', 'desc');
   * ```
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
   * Remove sorting for a column.
   *
   * Removes the sort for the specified column if it exists. Does nothing
   * if the column is not currently sorted. Emits a 'sort_removed' event.
   *
   * @param columnId - Column identifier to remove sorting for
   *
   * @example
   * ```typescript
   * sortingManager.removeSort('name');
   * console.log('Sort removed for name column');
   * ```
   */
  removeSort(columnId: string): void {
    const index = this.sortingState.findIndex((s) => s.columnId === columnId);
    if (index >= 0) {
      this.sortingState.splice(index, 1);
      this.notifySubscribers({ type: 'sort_removed', columnId });
    }
  }

  /**
   * Clear all sorting.
   *
   * Removes all active sorts and resets the sorting state to empty.
   * Emits a 'sorts_cleared' event.
   *
   * @example
   * ```typescript
   * sortingManager.clearSorting();
   * console.log('All sorts cleared');
   * ```
   */
  clearSorting(): void {
    this.sortingState = [];
    this.notifySubscribers({ type: 'sorts_cleared' });
  }

  /**
   * Reorder the current sorts while preserving column IDs and directions.
   *
   * Validates that the new order contains the same column IDs as the current state,
   * then replaces the sorting state with the new order. Preserves the existing
   * direction for each column, ensuring that reordering cannot accidentally flip
   * a column from desc to asc. Useful for drag-and-drop reordering of multi-column sorts.
   *
   * @param newOrder - Array of sorting parameters in the desired order
   * @throws {Error} If the new order doesn't match current sorts exactly
   *
   * @example
   * ```typescript
   * // Current: [{ columnId: 'name', direction: 'asc' }, { columnId: 'age', direction: 'desc' }]
   * // Reorder to: [{ columnId: 'age', direction: 'desc' }, { columnId: 'name', direction: 'asc' }]
   * sortingManager.reorderSorts([
   *   { columnId: 'age', direction: 'desc' },  // Direction will be preserved from current state
   *   { columnId: 'name', direction: 'asc' }    // Direction will be preserved from current state
   * ]);
   * ```
   */
  reorderSorts(newOrder: SortingState): void {
    if (!this.config.enabled) {
      return;
    }

    // Validate that new order contains exactly the same column IDs (in any order)
    const currentIds = new Set(this.sortingState.map((s) => s.columnId));
    const newIds = new Set(newOrder.map((s) => s.columnId));

    // Check that sizes match (prevents duplicate columns)
    if (currentIds.size !== newIds.size || currentIds.size !== newOrder.length) {
      throw new Error('New sort order must contain exactly the same column IDs as current sorts');
    }

    // Check that all IDs match
    if (![...currentIds].every((id) => newIds.has(id))) {
      throw new Error('New sort order must contain exactly the same column IDs as current sorts');
    }

    // Create a map of current column IDs to their sort params (to preserve directions)
    const currentSortMap = new Map(this.sortingState.map((sort) => [sort.columnId, sort]));

    // Build the reordered list, preserving the existing direction for each column
    const reorderedSorts: SortingState = [];
    for (const sort of newOrder) {
      const existingSort = currentSortMap.get(sort.columnId);
      if (existingSort) {
        // Preserve the existing direction, only use the new order
        const validation = this.validateSort(existingSort);
        if (validation.valid) {
          reorderedSorts.push(existingSort);
        } else {
        }
      }
    }

    // If no valid sorts, clear sorting
    if (reorderedSorts.length === 0) {
      this.clearSorting();
      return;
    }

    // Apply the new order with preserved directions
    this.sortingState = reorderedSorts;
    this.notifySubscribers({ type: 'sorts_replaced', sorts: reorderedSorts });
  }

  /**
   * Get sorting for a specific column
   */
  getSort(columnId: string): SortingParams | undefined {
    return this.sortingState.find((s) => s.columnId === columnId);
  }

  /**
   * Check if column is currently sorted.
   *
   * Determines whether the specified column has an active sort,
   * regardless of direction.
   *
   * @param columnId - Column identifier to check
   * @returns True if the column is currently sorted
   *
   * @example
   * ```typescript
   * if (sortingManager.isSorted('name')) {
   *   console.log('Name column is sorted');
   * }
   * ```
   */
  isSorted(columnId: string): boolean {
    return this.sortingState.some((s) => s.columnId === columnId);
  }

  /**
   * Get sort direction for a column.
   *
   * Returns the current sort direction for the specified column,
   * or undefined if the column is not currently sorted.
   *
   * @param columnId - Column identifier to get direction for
   * @returns Sort direction ('asc' or 'desc') or undefined
   *
   * @example
   * ```typescript
   * const direction = sortingManager.getSortDirection('name');
   * if (direction) {
   *   console.log(`Name column is sorted ${direction}`);
   * }
   * ```
   */
  getSortDirection(columnId: string): SortDirection | undefined {
    const sort = this.sortingState.find((s) => s.columnId === columnId);
    return sort?.direction;
  }

  /**
   * Get sort priority for a column (lower number = higher priority).
   *
   * Returns the priority index of the specified column in the sorting order.
   * Lower numbers indicate higher priority (0 = highest priority).
   *
   * @param columnId - Column identifier to get priority for
   * @returns Priority index (0-based) or undefined if not sorted
   *
   * @example
   * ```typescript
   * const priority = sortingManager.getSortPriority('name');
   * if (priority !== undefined) {
   *   console.log(`Name column has priority ${priority}`);
   * }
   * ```
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
   * Validate a sort against column definitions.
   *
   * Checks whether a sort operation is valid by verifying the column exists,
   * is sortable, and has a valid direction.
   *
   * @param sort - Sort parameters to validate
   * @returns Validation result with success status and error information
   *
   * @example
   * ```typescript
   * const validation = sortingManager.validateSort({
   *   columnId: 'name',
   *   direction: 'asc'
   * });
   *
   * if (!validation.valid) {
   *   console.error('Invalid sort:', validation.error);
   * }
   * ```
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
   * Subscribe to sorting changes.
   *
   * Registers a callback function to be called whenever sorting state changes.
   * Returns an unsubscribe function to remove the subscription.
   *
   * @param callback - Function to call when sorting changes
   * @returns Unsubscribe function to remove the subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = sortingManager.subscribe((event) => {
   *   switch (event.type) {
   *     case 'sort_added':
   *       console.log(`Sort added for ${event.sort.columnId}`);
   *       break;
   *     case 'sort_updated':
   *       console.log(`Sort updated for ${event.columnId}`);
   *       break;
   *     case 'sort_removed':
   *       console.log(`Sort removed for ${event.columnId}`);
   *       break;
   *     case 'sorts_cleared':
   *       console.log('All sorts cleared');
   *       break;
   *     case 'direction_toggled':
   *       console.log(`Direction toggled for ${event.columnId} to ${event.direction}`);
   *       break;
   *   }
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
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
      } catch (_error) {}
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
   * Clone the sorting manager with the same configuration.
   *
   * Creates a new sorting manager instance with the same configuration
   * and current state. Useful for creating backup instances or managing
   * multiple sorting contexts.
   *
   * @returns New sorting manager instance with copied state
   *
   * @example
   * ```typescript
   * const originalManager = new SortingManager(columns, config);
   * originalManager.addSort('name', 'asc');
   *
   * // Create a backup
   * const backupManager = originalManager.clone();
   * console.log('Backup created with same state');
   * ```
   */
  clone(): SortingManager<TData> {
    return new SortingManager(this.columns, this.config, this.sortingState);
  }
}
