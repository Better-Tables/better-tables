import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getOrCreateTableStore } from '../stores/table-registry';
import type { TableState, TableStoreInitialState } from '../stores/table-store';

/**
 * Hook to access the complete table store
 * Use this when you need access to all state and actions
 *
 * @param tableId - Unique table identifier
 * @returns Complete table state and actions
 *
 * @example
 * ```tsx
 * const tableState = useTableStore('my-table');
 * console.log(tableState.filters);
 * tableState.setFilters([...]);
 * ```
 */
export function useTableStore(tableId: string): TableState {
  const store = getOrCreateTableStore(tableId);
  return useStore(store);
}

/**
 * Hook to access filter state and actions
 * More performant than useTableStore as it only subscribes to filter changes
 *
 * @param tableId - Unique table identifier
 * @returns Filter state and actions
 *
 * @example
 * ```tsx
 * const { filters, setFilters, clearFilters } = useTableFilters('my-table');
 * ```
 */
export function useTableFilters(tableId: string) {
  const store = getOrCreateTableStore(tableId);
  return useStore(
    store,
    useShallow((state) => ({
      filters: state.filters,
      setFilters: state.setFilters,
      addFilter: state.addFilter,
      removeFilter: state.removeFilter,
      clearFilters: state.clearFilters,
    }))
  );
}

/**
 * Hook to access pagination state and actions
 * More performant than useTableStore as it only subscribes to pagination changes
 *
 * @param tableId - Unique table identifier
 * @returns Pagination state and actions
 *
 * @example
 * ```tsx
 * const { pagination, setPage, setPageSize } = useTablePagination('my-table');
 * ```
 */
export function useTablePagination(tableId: string) {
  const store = getOrCreateTableStore(tableId);
  return useStore(
    store,
    useShallow((state) => ({
      pagination: state.pagination,
      setPage: state.setPage,
      setPageSize: state.setPageSize,
      setPagination: state.setPagination,
    }))
  );
}

/**
 * Hook to access sorting state and actions
 * More performant than useTableStore as it only subscribes to sorting changes
 *
 * @param tableId - Unique table identifier
 * @returns Sorting state and actions
 *
 * @example
 * ```tsx
 * const { sorting, setSorting, toggleSort } = useTableSorting('my-table');
 * ```
 */
export function useTableSorting(tableId: string) {
  const store = getOrCreateTableStore(tableId);
  return useStore(
    store,
    useShallow((state) => ({
      sorting: state.sorting,
      setSorting: state.setSorting,
      toggleSort: state.toggleSort,
      clearSorting: state.clearSorting,
    }))
  );
}

/**
 * Hook to access selection state and actions
 * More performant than useTableStore as it only subscribes to selection changes
 *
 * @param tableId - Unique table identifier
 * @returns Selection state and actions
 *
 * @example
 * ```tsx
 * const { selectedRows, toggleRow, selectAll, clearSelection } = useTableSelection('my-table');
 * ```
 */
export function useTableSelection(tableId: string) {
  const store = getOrCreateTableStore(tableId);
  return useStore(
    store,
    useShallow((state) => ({
      selectedRows: state.selectedRows,
      toggleRow: state.toggleRow,
      selectAll: state.selectAll,
      clearSelection: state.clearSelection,
      setSelectedRows: state.setSelectedRows,
    }))
  );
}

/**
 * Hook to initialize a table store with initial state
 * Useful for setting up initial state from URL params or props
 * Note: This only initializes once - subsequent changes to initialState are ignored
 *
 * @param tableId - Unique table identifier
 * @param initialState - Initial state to set
 *
 * @example
 * ```tsx
 * useTableInit('my-table', {
 *   filters: initialFilters,
 *   pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false }
 * });
 * ```
 */
export function useTableInit(tableId: string, initialState: TableStoreInitialState) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only initialize once on mount
  useEffect(() => {
    // Initialize the store with initial state
    // This only happens once when the component mounts
    getOrCreateTableStore(tableId, initialState);
  }, [tableId]); // Only depend on tableId, not initialState - we want one-time initialization
}
