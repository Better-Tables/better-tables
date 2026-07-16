/**
 * @fileoverview Central table state manager for coordinating all table operations.
 *
 * This module provides a unified state management system that coordinates between
 * filter, pagination, sorting, and selection managers while maintaining performance
 * through structural sharing and intelligent caching.
 *
 * @module managers/table-state-manager
 */

import { Subscribable } from '../lib/subscribable';
import type { ColumnDefinition, ColumnOrder, ColumnVisibility } from '../types/column';
import type { FilterGroupNode, FilterState } from '../types/filter';
import type { PaginationConfig, PaginationState } from '../types/pagination';
import type { SortingState } from '../types/sorting';
import { getDefaultColumnOrder, mergeColumnOrder } from '../utils/column-order';
import { mergeColumnVisibility } from '../utils/column-visibility';
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

  /** Sorting configuration */
  sorting?: {
    /**
     * Allow more than one column to be sorted at once. When `false` (the
     * default), `toggleSort` REPLACES the current sort, so the state never
     * holds more than one column.
     */
    multiSort?: boolean;
  };
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
  /**
   * Current active filters -- the real stored value (plan 016 semantic
   * contract rule 2): a flat array (implicit AND) or a single
   * {@link FilterGroupNode} tree. Use `TableStateManager.getFilters()` for
   * the legacy flat leaf view, or `getFilterNode()`/this field for the real
   * value.
   */
  filters: FilterState[] | FilterGroupNode;
  /** Current pagination state */
  pagination: PaginationState;
  /** Current sorting configuration */
  sorting: SortingState;
  /** Currently selected row IDs */
  selectedRows: Set<string>;
  /** Column visibility state */
  columnVisibility: ColumnVisibility;
  /** Column order state */
  columnOrder: ColumnOrder;
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
  | { type: 'selection_changed'; selectedRows: Set<string> }
  | { type: 'visibility_changed'; columnVisibility: ColumnVisibility }
  | { type: 'order_changed'; columnOrder: ColumnOrder }
  | { type: 'columns_changed'; columns: ColumnDefinition[] };

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
export class TableStateManager<TData = unknown> extends Subscribable<TableStateEvent> {
  private filterManager: FilterManager<TData>;
  private paginationManager: PaginationManager;
  private sorting: SortingState = [];
  private selectedRows: Set<string> = new Set();
  private columnVisibility: ColumnVisibility = {};
  private columnOrder: ColumnOrder = [];
  private columns: ColumnDefinition<TData>[];
  private multiSort: boolean;

  // Caching for structural sharing
  private cachedFilters: FilterState[] | null = null;
  private cachedFilterNode: FilterState[] | FilterGroupNode | null = null;
  private cachedPagination: PaginationState | null = null;
  private cachedSorting: SortingState | null = null;
  private cachedSelectedRows: Set<string> | null = null;
  private cachedColumnVisibility: ColumnVisibility | null = null;
  private cachedColumnOrder: ColumnOrder | null = null;
  private lastNotifiedState: TableState | null = null;
  private stateUpdateBatchDepth = 0;
  private pendingStateChanged = false;

  constructor(
    columns: ColumnDefinition<TData>[],
    initialState: Partial<TableState> = {},
    config: TableStateConfig = {}
  ) {
    super('table state manager');
    this.columns = columns;
    this.multiSort = config.sorting?.multiSort ?? false;

    // Initialize sub-managers
    this.filterManager = new FilterManager(columns, initialState.filters || []);
    this.paginationManager = new PaginationManager(
      config.pagination || {},
      initialState.pagination
    );

    // Initialize state
    this.sorting = initialState.sorting || [];
    this.selectedRows = initialState.selectedRows || new Set();
    // Merge initial visibility with column defaults
    this.columnVisibility = mergeColumnVisibility(columns, initialState.columnVisibility || {});
    // Merge initial order with column defaults
    this.columnOrder = mergeColumnOrder(columns, initialState.columnOrder || []);

    // Subscribe to sub-manager changes
    this.filterManager.subscribe(() => {
      // Listen to all filter events and update state
      // Invalidate cache to force new reference
      this.cachedFilters = null;
      this.cachedFilterNode = null;
      // filters_changed carries the flat leaf view (rule 3's legacy display
      // accessor), not the real (possibly tree) stored value -- see getState().
      const filters = this.filterManager.getFilters();
      this.notify({ type: 'filters_changed', filters });
      this.notifyStateChanged();
    });

    this.paginationManager.subscribe(() => {
      // Invalidate cache to force new reference
      this.cachedPagination = null;
      const pagination = this.paginationManager.getPagination();
      this.notify({ type: 'pagination_changed', pagination });
      this.notifyStateChanged();
    });
  }

  /**
   * Get current complete state with structural sharing
   * Returns same object references if values haven't changed
   */
  getState(): TableState {
    return {
      // The real stored value (rule 2) -- a flat array is returned
      // unchanged, so this is a no-op behavior change for every existing
      // flat call path (rule 1).
      filters: this.getFilterNode(),
      pagination: this.getPagination(),
      sorting: this.getSorting(),
      selectedRows: this.getSelectedRows(),
      columnVisibility: this.getColumnVisibility(),
      columnOrder: this.getColumnOrder(),
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

  /**
   * Get the real stored filter state: a flat array (implicit AND) or a
   * single {@link FilterGroupNode} tree (plan 016 semantic contract rule 3).
   * Unlike {@link getFilters}, this never flattens a stored tree.
   */
  getFilterNode(): FilterState[] | FilterGroupNode {
    const node = this.filterManager.getFilterNode();

    // Return cached reference if structurally equal (deepEqual already
    // handles nested trees generically -- no extension needed for groups).
    if (this.cachedFilterNode && deepEqual(this.cachedFilterNode, node)) {
      return this.cachedFilterNode;
    }

    this.cachedFilterNode = node;
    return node;
  }

  /**
   * Set the real stored filter state -- the tree-aware counterpart to
   * {@link setFilters} (plan 016 semantic contract rule 3).
   */
  setFilterNode(node: FilterState[] | FilterGroupNode): void {
    this.filterManager.setFilterNode(node);
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
    this.notify({ type: 'sorting_changed', sorting: this.sorting });
    this.notifyStateChanged();
  }

  /**
   * Cycle a column's sort: unsorted -> asc -> desc -> unsorted.
   *
   * In single-sort mode (the default) the result only ever holds THIS column,
   * so sorting by a new column replaces the previous one. Only `multiSort`
   * accumulates columns -- without that check, every header click appended and
   * the table stayed ordered by whatever was sorted first.
   */
  toggleSort(columnId: string): void {
    const currentSort = this.sorting.find((s) => s.columnId === columnId);
    let newSorting: SortingState;

    if (currentSort) {
      // Cycle through: asc -> desc -> none
      if (currentSort.direction === 'asc') {
        newSorting = this.multiSort
          ? this.sorting.map((s) =>
              s.columnId === columnId ? { ...s, direction: 'desc' as const } : s
            )
          : [{ columnId, direction: 'desc' as const }];
      } else {
        // Remove from sorting
        newSorting = this.multiSort ? this.sorting.filter((s) => s.columnId !== columnId) : [];
      }
    } else {
      // Add new sort (asc) -- replacing any other column unless multi-sorting.
      newSorting = this.multiSort
        ? [...this.sorting, { columnId, direction: 'asc' as const }]
        : [{ columnId, direction: 'asc' as const }];
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
    this.notify({ type: 'selection_changed', selectedRows: this.selectedRows });
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
  // Column Visibility Operations
  // ============================================================================

  getColumnVisibility(): ColumnVisibility {
    // Return cached reference if visibility hasn't changed
    if (
      this.cachedColumnVisibility &&
      deepEqual(this.cachedColumnVisibility, this.columnVisibility)
    ) {
      return this.cachedColumnVisibility;
    }

    this.cachedColumnVisibility = { ...this.columnVisibility };
    return this.cachedColumnVisibility;
  }

  setColumnVisibility(visibility: ColumnVisibility): void {
    this.columnVisibility = { ...visibility };
    // Invalidate cache to force new reference
    this.cachedColumnVisibility = null;
    this.notify({ type: 'visibility_changed', columnVisibility: this.columnVisibility });
    this.notifyStateChanged();
  }

  toggleColumnVisibility(columnId: string): void {
    const newVisibility = { ...this.columnVisibility };
    // Treat undefined as visible (true) before toggling
    const currentValue = newVisibility[columnId] ?? true;
    newVisibility[columnId] = !currentValue;
    this.setColumnVisibility(newVisibility);
  }

  resetColumnVisibility(): void {
    // Reset all columns to visible
    const newVisibility: ColumnVisibility = {};
    this.columns.forEach((column) => {
      newVisibility[column.id] = true;
    });
    this.setColumnVisibility(newVisibility);
  }

  // ============================================================================
  // Column Order Operations
  // ============================================================================

  getColumnOrder(): ColumnOrder {
    // Return cached reference if order array hasn't changed
    if (this.cachedColumnOrder && shallowEqualArrays(this.cachedColumnOrder, this.columnOrder)) {
      return this.cachedColumnOrder;
    }

    this.cachedColumnOrder = [...this.columnOrder];
    return this.cachedColumnOrder;
  }

  setColumnOrder(order: ColumnOrder): void {
    // Normalize and validate the incoming order to ensure it's valid
    this.columnOrder = mergeColumnOrder(this.columns, order);
    // Invalidate cache to force new reference
    this.cachedColumnOrder = null;
    this.notify({ type: 'order_changed', columnOrder: this.columnOrder });
    this.notifyStateChanged();
  }

  resetColumnOrder(): void {
    // Reset to default order based on column definitions
    this.columnOrder = getDefaultColumnOrder(this.columns);
    this.cachedColumnOrder = null;
    this.notify({ type: 'order_changed', columnOrder: this.columnOrder });
    this.notifyStateChanged();
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Update multiple state properties at once
   * Useful for initialization or syncing from external sources (like URL)
   */
  updateState(updates: Partial<TableState>): void {
    this.stateUpdateBatchDepth++;
    try {
      if (updates.filters !== undefined) {
        // Tree-preserving (rule 4): TableState.filters is the real stored
        // value, so a hydrated FilterGroupNode tree (e.g. from a c2: URL)
        // must flow through unflattened. setFilterNode delegates flat arrays
        // to setFilters verbatim (rule 1), so this is a no-op behavior change
        // for every existing flat call path.
        this.filterManager.setFilterNode(updates.filters);
      }

      if (updates.pagination !== undefined) {
        const { page, limit, totalPages } = updates.pagination;

        // If totalPages is provided, calculate and set total first
        // This ensures validation works correctly when updating page
        if (totalPages !== undefined) {
          const currentLimit = limit ?? this.paginationManager.getPageSize();
          const calculatedTotal = totalPages * currentLimit;
          this.paginationManager.setTotal(calculatedTotal);
        }

        if (limit !== undefined && limit !== this.paginationManager.getPageSize()) {
          // Restoring state (e.g. from a shared URL) must never throw for a
          // limit that isn't one of the configured pageSizeOptions - fall back
          // to the nearest allowed size instead of letting changePageSize throw.
          const allowedSizes = this.paginationManager.getPageSizeOptions();
          const resolvedLimit = allowedSizes.includes(limit)
            ? limit
            : allowedSizes.reduce((closest, size) =>
                Math.abs(size - limit) < Math.abs(closest - limit) ? size : closest
              );

          if (resolvedLimit !== limit) {
            // biome-ignore lint: Intentional warning logging for clamped pagination limit
            console.warn(
              `[better-tables] Restored pagination limit ${limit} is not an allowed page size; falling back to nearest allowed size ${resolvedLimit}.`
            );
          }

          if (resolvedLimit !== this.paginationManager.getPageSize()) {
            this.paginationManager.changePageSize(resolvedLimit);
          }
        }

        if (page !== undefined && page !== this.paginationManager.getCurrentPage()) {
          // Restoring state must never throw for an out-of-range page (e.g. a
          // bookmarked URL pointing past the current total) - clamp instead.
          const totalPages = this.paginationManager.getTotalPages();
          const resolvedPage =
            totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : Math.max(page, 1);

          if (resolvedPage !== page) {
            // biome-ignore lint: Intentional warning logging for clamped pagination page
            console.warn(
              `[better-tables] Restored pagination page ${page} is out of range; clamping to ${resolvedPage}.`
            );
          }

          if (resolvedPage !== this.paginationManager.getCurrentPage()) {
            this.paginationManager.goToPage(resolvedPage);
          }
        }
      }

      if (updates.sorting !== undefined) {
        this.sorting = updates.sorting;
        this.notify({ type: 'sorting_changed', sorting: this.sorting });
      }

      if (updates.selectedRows !== undefined) {
        this.selectedRows = new Set(updates.selectedRows);
        this.notify({ type: 'selection_changed', selectedRows: this.selectedRows });
      }

      if (updates.columnVisibility !== undefined) {
        this.columnVisibility = { ...updates.columnVisibility };
        this.cachedColumnVisibility = null;
        this.notify({
          type: 'visibility_changed',
          columnVisibility: this.columnVisibility,
        });
      }

      if (updates.columnOrder !== undefined) {
        // Normalize and validate the incoming order to ensure it's valid
        this.columnOrder = mergeColumnOrder(this.columns, updates.columnOrder);
        this.cachedColumnOrder = null;
        this.notify({
          type: 'order_changed',
          columnOrder: this.columnOrder,
        });
      }

      this.notifyStateChanged();
    } finally {
      this.stateUpdateBatchDepth--;
      if (this.stateUpdateBatchDepth === 0 && this.pendingStateChanged) {
        this.pendingStateChanged = false;
        this.flushStateChanged();
      }
    }
  }

  /**
   * Reset all state to initial values
   */
  reset(): void {
    this.filterManager.clearFilters();
    this.paginationManager.reset();
    this.sorting = [];
    this.selectedRows = new Set();
    // Reset column visibility to defaults
    this.columnVisibility = mergeColumnVisibility(this.columns, {});
    this.cachedColumnVisibility = null;
    // Reset column order to defaults
    this.columnOrder = getDefaultColumnOrder(this.columns);
    this.cachedColumnOrder = null;
    this.notifyStateChanged();
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Notify subscribers of complete state change
   * Only notifies if state has actually changed (deep equality)
   */
  private flushStateChanged(): void {
    const currentState = this.getState();

    // Only notify if state has actually changed
    if (!this.lastNotifiedState || !deepEqual(this.lastNotifiedState, currentState)) {
      this.lastNotifiedState = currentState;
      this.notify({ type: 'state_changed', state: currentState });
    }
  }

  private notifyStateChanged(): void {
    if (this.stateUpdateBatchDepth > 0) {
      this.pendingStateChanged = true;
      return;
    }

    this.flushStateChanged();
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
    // Reinitialize filter manager with new columns, preserving the real
    // stored value (a tree stays a tree across a column update).
    const currentFilterNode = this.filterManager.getFilterNode();
    this.filterManager = new FilterManager(columns, currentFilterNode);

    // Re-establish subscription to new FilterManager
    this.filterManager.subscribe(() => {
      // Listen to all filter events and update state
      // Invalidate cache to force new reference
      this.cachedFilters = null;
      this.cachedFilterNode = null;
      const filters = this.filterManager.getFilters();
      this.notify({ type: 'filters_changed', filters });
      this.notifyStateChanged();
    });

    // Notify subscribers that columns have changed
    // Cast to match the event type which expects ColumnDefinition[]
    this.notify({ type: 'columns_changed', columns: columns as ColumnDefinition[] });
  }
}
