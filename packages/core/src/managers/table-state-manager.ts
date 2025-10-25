/**
 * @fileoverview Central table state manager for coordinating all table operations.
 *
 * This module provides a unified state management system that coordinates between
 * filter, pagination, sorting, and selection managers while maintaining performance
 * through structural sharing and intelligent caching.
 *
 * @module managers/table-state-manager
 */

import type { ColumnDefinition } from '../types/column';
import type { FilterState } from '../types/filter';
import type { PaginationConfig, PaginationState } from '../types/pagination';
import type { SortingState } from '../types/sorting';
import { deepEqual, shallowEqualArrays } from '../utils/equality';
import { FilterManager } from './filter-manager';
import { PaginationManager } from './pagination-manager';

/**
 * Configuration for table state manager.
 *
 * Provides configuration options for the central table state manager,
 * primarily focused on pagination settings that affect the overall table behavior.
 *
 * @example
 * ```typescript
 * const config: TableStateConfig = {
 *   pagination: {
 *     defaultPageSize: 25,
 *     pageSizeOptions: [10, 25, 50, 100],
 *     maxPageSize: 500,
 *     showPageSizeSelector: true,
 *     showPageNumbers: true
 *   }
 * };
 * ```
 */
export interface TableStateConfig {
  /** Pagination configuration */
  pagination?: PaginationConfig;
}

/**
 * Complete table state interface.
 *
 * Represents the complete state of a table including filters, pagination,
 * sorting, and row selection. Used as the single source of truth for
 * table state management.
 *
 * @example
 * ```typescript
 * const tableState: TableState = {
 *   filters: [
 *     { columnId: 'status', operator: 'is', values: ['active'] }
 *   ],
 *   pagination: {
 *     page: 1,
 *     limit: 20,
 *     totalPages: 5,
 *     hasNext: true,
 *     hasPrev: false
 *   },
 *   sorting: [
 *     { columnId: 'name', direction: 'asc' }
 *   ],
 *   selectedRows: new Set(['user-1', 'user-2'])
 * };
 * ```
 */
export interface TableState {
  /** Current active filters */
  filters: FilterState[];
  /** Current pagination state */
  pagination: PaginationState;
  /** Current sorting configuration */
  sorting: SortingState;
  /** Currently selected row IDs */
  selectedRows: Set<string>;
}

/**
 * Event types for table state manager.
 *
 * Defines the different types of events that can be emitted by the table state manager,
 * enabling reactive updates and state synchronization across the entire table system.
 *
 * @example
 * ```typescript
 * const unsubscribe = tableStateManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'state_changed':
 *       console.log('Complete state changed:', event.state);
 *       break;
 *     case 'filters_changed':
 *       console.log('Filters updated:', event.filters);
 *       break;
 *     case 'pagination_changed':
 *       console.log('Page changed:', event.pagination);
 *       break;
 *     case 'sorting_changed':
 *       console.log('Sorting changed:', event.sorting);
 *       break;
 *     case 'selection_changed':
 *       console.log('Selection changed:', event.selectedRows);
 *       break;
 *   }
 * });
 * ```
 */
export type TableStateEvent =
  | { type: 'state_changed'; state: TableState }
  | { type: 'filters_changed'; filters: FilterState[] }
  | { type: 'pagination_changed'; pagination: PaginationState }
  | { type: 'sorting_changed'; sorting: SortingState }
  | { type: 'selection_changed'; selectedRows: Set<string> };

/**
 * Table state manager subscriber function type.
 *
 * Defines the callback function signature for table state event subscribers.
 *
 * @param event - The table state event that occurred
 *
 * @example
 * ```typescript
 * const handleStateChange: TableStateSubscriber = (event) => {
 *   if (event.type === 'state_changed') {
 *     // Update entire table based on new state
 *     updateTableDisplay(event.state);
 *   }
 * };
 * ```
 */
export type TableStateSubscriber = (event: TableStateEvent) => void;

/**
 * Central table state manager.
 *
 * Single source of truth for all table state, coordinating between filter, pagination,
 * sorting, and selection managers. Framework agnostic design supports both React and
 * vanilla JavaScript implementations. Uses structural sharing and intelligent caching
 * for optimal performance.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const tableStateManager = new TableStateManager<User>(columns, {
 *   filters: [{ columnId: 'status', operator: 'is', values: ['active'] }],
 *   pagination: { page: 1, limit: 20 },
 *   sorting: [{ columnId: 'name', direction: 'asc' }],
 *   selectedRows: new Set()
 * }, {
 *   pagination: { defaultPageSize: 20 }
 * });
 *
 * // Subscribe to state changes
 * const unsubscribe = tableStateManager.subscribe((event) => {
 *   console.log('Table state changed:', event);
 * });
 *
 * // Update filters
 * tableStateManager.setFilters([
 *   { columnId: 'status', operator: 'is', values: ['active'] },
 *   { columnId: 'age', operator: 'greaterThan', values: [18] }
 * ]);
 *
 * // Update pagination
 * tableStateManager.setPagination({ page: 2, limit: 50 });
 * tableStateManager.setTotal(1000);
 *
 * // Update sorting
 * tableStateManager.setSorting([
 *   { columnId: 'name', direction: 'asc' },
 *   { columnId: 'createdAt', direction: 'desc' }
 * ]);
 *
 * // Get complete state
 * const state = tableStateManager.getState();
 * console.log('Complete table state:', state);
 * ```
 */
export class TableStateManager<TData = unknown> {
  private filterManager: FilterManager<TData>;
  private paginationManager: PaginationManager;
  private sorting: SortingState = [];
  private selectedRows: Set<string> = new Set();
  private subscribers: TableStateSubscriber[] = [];
  private columns: ColumnDefinition<TData>[];

  // Caching for structural sharing
  private cachedFilters: FilterState[] | null = null;
  private cachedPagination: PaginationState | null = null;
  private cachedSorting: SortingState | null = null;
  private cachedSelectedRows: Set<string> | null = null;
  private lastNotifiedState: TableState | null = null;

  constructor(
    columns: ColumnDefinition<TData>[],
    initialState: Partial<TableState> = {},
    config: TableStateConfig = {}
  ) {
    this.columns = columns;

    // Initialize sub-managers
    this.filterManager = new FilterManager(columns, initialState.filters || []);
    this.paginationManager = new PaginationManager(
      config.pagination || {},
      initialState.pagination
    );

    // Initialize state
    this.sorting = initialState.sorting || [];
    this.selectedRows = initialState.selectedRows || new Set();

    // Subscribe to sub-manager changes
    this.filterManager.subscribe(() => {
      // Listen to all filter events and update state
      // Invalidate cache to force new reference
      this.cachedFilters = null;
      const filters = this.filterManager.getFilters();
      this.notifySubscribers({ type: 'filters_changed', filters });
      this.notifyStateChanged();
    });

    this.paginationManager.subscribe(() => {
      // Invalidate cache to force new reference
      this.cachedPagination = null;
      const pagination = this.paginationManager.getPagination();
      this.notifySubscribers({ type: 'pagination_changed', pagination });
      this.notifyStateChanged();
    });
  }

  /**
   * Get current complete state with structural sharing
   * Returns same object references if values haven't changed
   */
  getState(): TableState {
    return {
      filters: this.getFilters(),
      pagination: this.getPagination(),
      sorting: this.getSorting(),
      selectedRows: this.getSelectedRows(),
    };
  }

  /**
   * Get filter manager
   */
  getFilterManager(): FilterManager<TData> {
    return this.filterManager;
  }

  /**
   * Get pagination manager
   */
  getPaginationManager(): PaginationManager {
    return this.paginationManager;
  }

  // ============================================================================
  // Filter Operations
  // ============================================================================

  getFilters(): FilterState[] {
    const filters = this.filterManager.getFilters();

    // Return cached reference if arrays are shallow equal
    if (this.cachedFilters && shallowEqualArrays(this.cachedFilters, filters)) {
      return this.cachedFilters;
    }

    this.cachedFilters = filters;
    return filters;
  }

  setFilters(filters: FilterState[]): void {
    this.filterManager.setFilters(filters);
  }

  addFilter(filter: FilterState): void {
    this.filterManager.addFilter(filter);
  }

  removeFilter(columnId: string): void {
    this.filterManager.removeFilter(columnId);
  }

  clearFilters(): void {
    this.filterManager.clearFilters();
  }

  // ============================================================================
  // Pagination Operations
  // ============================================================================

  getPagination(): PaginationState {
    const pagination = this.paginationManager.getPagination();

    // Return cached reference if pagination hasn't changed
    if (this.cachedPagination && deepEqual(this.cachedPagination, pagination)) {
      return this.cachedPagination;
    }

    this.cachedPagination = pagination;
    return pagination;
  }

  setPage(page: number): void {
    this.paginationManager.goToPage(page);
  }

  setPageSize(size: number): void {
    this.paginationManager.changePageSize(size);
  }

  setTotal(total: number): void {
    this.paginationManager.setTotal(total);
  }

  nextPage(): void {
    this.paginationManager.nextPage();
  }

  prevPage(): void {
    this.paginationManager.prevPage();
  }

  // ============================================================================
  // Sorting Operations
  // ============================================================================

  getSorting(): SortingState {
    // Return cached reference if sorting array hasn't changed
    if (this.cachedSorting && shallowEqualArrays(this.cachedSorting, this.sorting)) {
      return this.cachedSorting;
    }

    this.cachedSorting = [...this.sorting];
    return this.cachedSorting;
  }

  setSorting(sorting: SortingState): void {
    this.sorting = sorting;
    // Invalidate cache to force new reference
    this.cachedSorting = null;
    this.notifySubscribers({ type: 'sorting_changed', sorting: this.sorting });
    this.notifyStateChanged();
  }

  toggleSort(columnId: string): void {
    const currentSort = this.sorting.find((s) => s.columnId === columnId);
    let newSorting: SortingState;

    if (currentSort) {
      // Cycle through: asc -> desc -> none
      if (currentSort.direction === 'asc') {
        newSorting = this.sorting.map((s) =>
          s.columnId === columnId ? { ...s, direction: 'desc' as const } : s
        );
      } else {
        // Remove from sorting
        newSorting = this.sorting.filter((s) => s.columnId !== columnId);
      }
    } else {
      // Add new sort (asc)
      newSorting = [...this.sorting, { columnId, direction: 'asc' as const }];
    }

    this.setSorting(newSorting);
  }

  clearSorting(): void {
    this.setSorting([]);
  }

  // ============================================================================
  // Selection Operations
  // ============================================================================

  getSelectedRows(): Set<string> {
    // Return cached reference if set hasn't changed
    if (
      this.cachedSelectedRows &&
      this.cachedSelectedRows.size === this.selectedRows.size &&
      [...this.cachedSelectedRows].every((id) => this.selectedRows.has(id))
    ) {
      return this.cachedSelectedRows;
    }

    this.cachedSelectedRows = new Set(this.selectedRows);
    return this.cachedSelectedRows;
  }

  setSelectedRows(rows: Set<string>): void {
    this.selectedRows = new Set(rows);
    // Invalidate cache to force new reference
    this.cachedSelectedRows = null;
    this.notifySubscribers({ type: 'selection_changed', selectedRows: this.selectedRows });
    this.notifyStateChanged();
  }

  toggleRow(rowId: string): void {
    const newSelected = new Set(this.selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    this.setSelectedRows(newSelected);
  }

  selectAll(rowIds: string[]): void {
    this.setSelectedRows(new Set(rowIds));
  }

  clearSelection(): void {
    this.setSelectedRows(new Set());
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Update multiple state properties at once
   * Useful for initialization or syncing from external sources (like URL)
   */
  updateState(updates: Partial<TableState>): void {
    if (updates.filters !== undefined) {
      this.filterManager.setFilters(updates.filters);
    }

    if (updates.pagination !== undefined) {
      const { page, limit } = updates.pagination;
      if (page !== undefined && page !== this.paginationManager.getCurrentPage()) {
        this.paginationManager.goToPage(page);
      }
      if (limit !== undefined && limit !== this.paginationManager.getPageSize()) {
        this.paginationManager.changePageSize(limit);
      }
    }

    if (updates.sorting !== undefined) {
      this.sorting = updates.sorting;
      this.notifySubscribers({ type: 'sorting_changed', sorting: this.sorting });
    }

    if (updates.selectedRows !== undefined) {
      this.selectedRows = new Set(updates.selectedRows);
      this.notifySubscribers({ type: 'selection_changed', selectedRows: this.selectedRows });
    }

    this.notifyStateChanged();
  }

  /**
   * Reset all state to initial values
   */
  reset(): void {
    this.filterManager.clearFilters();
    this.paginationManager.reset();
    this.sorting = [];
    this.selectedRows = new Set();
    this.notifyStateChanged();
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  subscribe(callback: TableStateSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(event: TableStateEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch {
        // Silently ignore errors in subscribers
      }
    });
  }

  /**
   * Notify subscribers of complete state change
   * Only notifies if state has actually changed (deep equality)
   */
  private notifyStateChanged(): void {
    const currentState = this.getState();

    // Only notify if state has actually changed
    if (!this.lastNotifiedState || !deepEqual(this.lastNotifiedState, currentState)) {
      this.lastNotifiedState = currentState;
      this.notifySubscribers({ type: 'state_changed', state: currentState });
    }
  }

  // ============================================================================
  // Column Management
  // ============================================================================

  /**
   * Get columns
   */
  getColumns(): ColumnDefinition<TData>[] {
    return this.columns;
  }

  /**
   * Update columns (useful for dynamic column changes)
   */
  updateColumns(columns: ColumnDefinition<TData>[]): void {
    this.columns = columns;
    // Reinitialize filter manager with new columns
    const currentFilters = this.filterManager.getFilters();
    this.filterManager = new FilterManager(columns, currentFilters);

    // Re-establish subscription to new FilterManager
    this.filterManager.subscribe(() => {
      // Listen to all filter events and update state
      // Invalidate cache to force new reference
      this.cachedFilters = null;
      const filters = this.filterManager.getFilters();
      this.notifySubscribers({ type: 'filters_changed', filters });
      this.notifyStateChanged();
    });
  }
}
