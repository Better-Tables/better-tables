import { createStore } from 'zustand/vanilla';
import { type TableStateConfig, type TableStateEvent, TableStateManager } from '../managers';
import type {
  ColumnDefinition,
  ColumnOrder,
  ColumnVisibility,
  FilterState,
  PaginationState,
  SortingState,
} from '../types';

/**
 * Table store state exposed to React components
 * This is a thin Zustand wrapper around TableStateManager for React reactivity
 * Includes the manager instance, state data, and action methods
 */
export interface TableStoreState {
  // Core manager instance
  manager: TableStateManager;

  // State (synced from manager)
  columns: ColumnDefinition[];
  filters: FilterState[];
  pagination: PaginationState;
  sorting: SortingState;
  selectedRows: Set<string>;
  columnVisibility: ColumnVisibility;
  columnOrder: ColumnOrder;

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

  // Column visibility actions
  toggleColumnVisibility: (columnId: string) => void;
  setColumnVisibility: (visibility: ColumnVisibility) => void;

  // Column order actions
  setColumnOrder: (order: ColumnOrder) => void;
  resetColumnOrder: () => void;

  // Bulk operations
  updateState: (state: Partial<Omit<TableStoreState, 'manager'>>) => void;
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
  columnVisibility?: ColumnVisibility;
  columnOrder?: ColumnOrder;
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
      columnVisibility: initialState.columnVisibility,
      columnOrder: initialState.columnOrder,
    },
    initialState.config
  );

  // Get initial state from manager
  const managerState = manager.getState();

  return createStore<TableStoreState>(
    (
      set: (fn: (state: TableStoreState) => TableStoreState) => void,
      get: () => TableStoreState
    ) => {
      // Subscribe to manager changes and sync to Zustand with structural sharing
      manager.subscribe((event: TableStateEvent) => {
        if (event.type === 'state_changed') {
          // Only update Zustand if references actually changed
          // The manager already does deep equality checks, so we just check references
          set((state: TableStoreState) => {
            const hasChanged =
              state.filters !== event.state.filters ||
              state.pagination !== event.state.pagination ||
              state.sorting !== event.state.sorting ||
              state.selectedRows !== event.state.selectedRows ||
              state.columnVisibility !== event.state.columnVisibility ||
              state.columnOrder !== event.state.columnOrder;

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
              columnVisibility: event.state.columnVisibility,
              columnOrder: event.state.columnOrder,
            };
          });
        } else if (event.type === 'visibility_changed') {
          set((state) => ({
            ...state,
            columnVisibility: event.columnVisibility,
          }));
        } else if (event.type === 'order_changed') {
          set((state) => ({
            ...state,
            columnOrder: event.columnOrder,
          }));
        } else if (event.type === 'columns_changed') {
          set((state) => ({
            ...state,
            columns: event.columns,
          }));
        }
      });

      return {
        // Core manager
        manager,

        // Initial state from manager
        columns: initialState.columns,
        filters: managerState.filters,
        pagination: managerState.pagination,
        sorting: managerState.sorting,
        selectedRows: managerState.selectedRows,
        columnVisibility: managerState.columnVisibility,
        columnOrder: managerState.columnOrder,

        // Filter actions - delegate to manager
        setFilters: (filters: FilterState[]) => {
          get().manager.setFilters(filters);
        },

        addFilter: (filter: FilterState) => {
          get().manager.addFilter(filter);
        },

        removeFilter: (columnId: string) => {
          get().manager.removeFilter(columnId);
        },

        clearFilters: () => {
          get().manager.clearFilters();
        },

        // Pagination actions - delegate to manager
        setPage: (page: number) => {
          get().manager.setPage(page);
        },

        setPageSize: (size: number) => {
          get().manager.setPageSize(size);
        },

        setPagination: (pagination: Partial<PaginationState>) => {
          const manager = get().manager;
          if (pagination.page !== undefined) {
            manager.setPage(pagination.page);
          }
          if (pagination.limit !== undefined) {
            manager.setPageSize(pagination.limit);
          }
        },

        setTotal: (total: number) => {
          get().manager.setTotal(total);
        },

        nextPage: () => {
          get().manager.nextPage();
        },

        prevPage: () => {
          get().manager.prevPage();
        },

        // Sorting actions - delegate to manager
        setSorting: (sorting: SortingState) => {
          get().manager.setSorting(sorting);
        },

        toggleSort: (columnId: string) => {
          get().manager.toggleSort(columnId);
        },

        clearSorting: () => {
          get().manager.clearSorting();
        },

        // Selection actions - delegate to manager
        toggleRow: (rowId: string) => {
          get().manager.toggleRow(rowId);
        },

        selectAll: (rowIds: string[]) => {
          get().manager.selectAll(rowIds);
        },

        clearSelection: () => {
          get().manager.clearSelection();
        },

        setSelectedRows: (rows: Set<string>) => {
          get().manager.setSelectedRows(rows);
        },

        // Column visibility actions - delegate to manager
        toggleColumnVisibility: (columnId: string) => {
          get().manager.toggleColumnVisibility(columnId);
        },

        setColumnVisibility: (visibility: ColumnVisibility) => {
          get().manager.setColumnVisibility(visibility);
        },

        // Column order actions - delegate to manager
        setColumnOrder: (order: ColumnOrder) => {
          get().manager.setColumnOrder(order);
        },

        resetColumnOrder: () => {
          get().manager.resetColumnOrder();
        },

        // Bulk operations
        updateState: (updates: Partial<Omit<TableStoreState, 'manager'>>) => {
          get().manager.updateState(updates);
        },

        reset: () => {
          get().manager.reset();
        },
      };
    }
  );
}
