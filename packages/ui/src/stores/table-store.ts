import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { createStore } from 'zustand/vanilla';

/**
 * Table state managed by Zustand store
 */
export interface TableState {
  // Filter state
  filters: FilterState[];
  setFilters: (filters: FilterState[]) => void;
  addFilter: (filter: FilterState) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;

  // Pagination state
  pagination: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setPagination: (pagination: PaginationState) => void;

  // Sorting state
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  toggleSort: (columnId: string) => void;
  clearSorting: () => void;

  // Selection state
  selectedRows: Set<string>;
  toggleRow: (rowId: string) => void;
  selectAll: (rowIds: string[]) => void;
  clearSelection: () => void;
  setSelectedRows: (rows: Set<string>) => void;

  // Reset all state
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
}

/**
 * Create a new table store instance
 * This factory function creates isolated stores for each table instance
 */
export function createTableStore(initialState: TableStoreInitialState = {}) {
  const defaultState = {
    filters: initialState.filters || [],
    pagination: initialState.pagination || { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
    sorting: initialState.sorting || [],
    selectedRows: initialState.selectedRows || new Set<string>(),
  };

  return createStore<TableState>((set) => ({
    // Initial state
    ...defaultState,

    // Filter actions
    setFilters: (filters) => {
      set({ filters });
    },

    addFilter: (filter) => {
      set((state) => ({
        filters: [...state.filters, filter],
      }));
    },

    removeFilter: (columnId) => {
      set((state) => ({
        filters: state.filters.filter((f) => f.columnId !== columnId),
      }));
    },

    clearFilters: () => {
      set({ filters: [] });
    },

    // Pagination actions
    setPage: (page) => {
      set((state) => ({
        pagination: { ...state.pagination, page },
      }));
    },

    setPageSize: (size) => {
      set((state) => ({
        pagination: { ...state.pagination, limit: size, page: 1 },
      }));
    },

    setPagination: (pagination) => {
      set({ pagination });
    },

    // Sorting actions
    setSorting: (sorting) => {
      set({ sorting });
    },

    toggleSort: (columnId) => {
      set((state) => {
        const currentSort = state.sorting.find((s) => s.columnId === columnId);
        let newSorting: SortingState;

        if (currentSort) {
          // Cycle through: asc -> desc -> none
          if (currentSort.direction === 'asc') {
            newSorting = state.sorting.map((s) =>
              s.columnId === columnId ? { ...s, direction: 'desc' as const } : s
            );
          } else {
            // Remove from sorting
            newSorting = state.sorting.filter((s) => s.columnId !== columnId);
          }
        } else {
          // Add new sort (asc)
          newSorting = [...state.sorting, { columnId, direction: 'asc' as const }];
        }

        return { sorting: newSorting };
      });
    },

    clearSorting: () => {
      set({ sorting: [] });
    },

    // Selection actions
    toggleRow: (rowId) => {
      set((state) => {
        const newSelected = new Set(state.selectedRows);
        if (newSelected.has(rowId)) {
          newSelected.delete(rowId);
        } else {
          newSelected.add(rowId);
        }
        return { selectedRows: newSelected };
      });
    },

    selectAll: (rowIds) => {
      set({ selectedRows: new Set(rowIds) });
    },

    clearSelection: () => {
      set({ selectedRows: new Set() });
    },

    setSelectedRows: (rows) => {
      set({ selectedRows: rows });
    },

    // Reset to initial state
    reset: () => {
      set(defaultState);
    },
  }));
}

