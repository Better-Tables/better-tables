import {
  type ColumnDefinition,
  type FilterState,
  type PaginationState,
  type SortingState,
  type TableStateConfig,
  type TableStateEvent,
  TableStateManager,
} from '@better-tables/core';
import { createStore } from 'zustand/vanilla';

/**
 * Table state exposed to React components
 * This is a thin wrapper around TableStateManager for React reactivity
 */
export interface TableState {
  // Core manager instance
  manager: TableStateManager;

  // State (synced from manager)
  filters: FilterState[];
  pagination: PaginationState;
  sorting: SortingState;
  selectedRows: Set<string>;

  // Filter actions
  setFilters: (filters: FilterState[]) => void;
  addFilter: (filter: FilterState) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  setTotal: (total: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Sorting actions
  setSorting: (sorting: SortingState) => void;
  toggleSort: (columnId: string) => void;
  clearSorting: () => void;

  // Selection actions
  toggleRow: (rowId: string) => void;
  selectAll: (rowIds: string[]) => void;
  clearSelection: () => void;
  setSelectedRows: (rows: Set<string>) => void;

  // Bulk operations
  updateState: (state: Partial<Omit<TableState, 'manager'>>) => void;
  reset: () => void;
}

/**
 * Initial state for table store
 */
export interface TableStoreInitialState {
  filters?: FilterState[];
  pagination?: PaginationState;
  sorting?: SortingState;
  selectedRows?: Set<string>;
  // biome-ignore lint/suspicious/noExplicitAny: Needs to work with any column type
  columns: ColumnDefinition<any>[];
  config?: TableStateConfig;
}

/**
 * Create a new table store instance
 * This is a thin Zustand wrapper around TableStateManager
 * The manager is the single source of truth
 */
export function createTableStore(initialState: TableStoreInitialState) {
  // Create the core manager
  const manager = new TableStateManager(
    initialState.columns,
    {
      filters: initialState.filters,
      pagination: initialState.pagination,
      sorting: initialState.sorting,
      selectedRows: initialState.selectedRows,
    },
    initialState.config
  );

  // Get initial state from manager
  const managerState = manager.getState();

  return createStore<TableState>((set, get) => {
    // Subscribe to manager changes and sync to Zustand with structural sharing
    manager.subscribe((event: TableStateEvent) => {
      if (event.type === 'state_changed') {
        // Only update Zustand if references actually changed
        // The manager already does deep equality checks, so we just check references
        set((state) => {
          const hasChanged =
            state.filters !== event.state.filters ||
            state.pagination !== event.state.pagination ||
            state.sorting !== event.state.sorting ||
            state.selectedRows !== event.state.selectedRows;

          // If nothing changed, return same state object to prevent re-renders
          if (!hasChanged) {
            return state;
          }

          // IMPORTANT: Must preserve manager reference and all actions
          return {
            ...state, // Preserve manager and all action functions
            filters: event.state.filters,
            pagination: event.state.pagination,
            sorting: event.state.sorting,
            selectedRows: event.state.selectedRows,
          };
        });
      }
    });

    return {
      // Core manager
      manager,

      // Initial state from manager
      filters: managerState.filters,
      pagination: managerState.pagination,
      sorting: managerState.sorting,
      selectedRows: managerState.selectedRows,

      // Filter actions - delegate to manager
      setFilters: (filters) => {
        get().manager.setFilters(filters);
      },

      addFilter: (filter) => {
        get().manager.addFilter(filter);
      },

      removeFilter: (columnId) => {
        get().manager.removeFilter(columnId);
      },

      clearFilters: () => {
        get().manager.clearFilters();
      },

      // Pagination actions - delegate to manager
      setPage: (page) => {
        get().manager.setPage(page);
      },

      setPageSize: (size) => {
        get().manager.setPageSize(size);
      },

      setPagination: (pagination) => {
        const manager = get().manager;
        if (pagination.page !== undefined) {
          manager.setPage(pagination.page);
        }
        if (pagination.limit !== undefined) {
          manager.setPageSize(pagination.limit);
        }
      },

      setTotal: (total) => {
        get().manager.setTotal(total);
      },

      nextPage: () => {
        get().manager.nextPage();
      },

      prevPage: () => {
        get().manager.prevPage();
      },

      // Sorting actions - delegate to manager
      setSorting: (sorting) => {
        get().manager.setSorting(sorting);
      },

      toggleSort: (columnId) => {
        get().manager.toggleSort(columnId);
      },

      clearSorting: () => {
        get().manager.clearSorting();
      },

      // Selection actions - delegate to manager
      toggleRow: (rowId) => {
        get().manager.toggleRow(rowId);
      },

      selectAll: (rowIds) => {
        get().manager.selectAll(rowIds);
      },

      clearSelection: () => {
        get().manager.clearSelection();
      },

      setSelectedRows: (rows) => {
        get().manager.setSelectedRows(rows);
      },

      // Bulk operations
      updateState: (updates) => {
        get().manager.updateState(updates);
      },

      reset: () => {
        get().manager.reset();
      },
    };
  });
}
