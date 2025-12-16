import { getTableStore, type TableStoreState } from '@better-tables/core';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

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
export function useTableStore(tableId: string): TableStoreState {
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
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
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
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
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
  return useStore(
    store,
    useShallow((state) => ({
      pagination: state.pagination,
      setPage: state.setPage,
      setPageSize: state.setPageSize,
      setPagination: state.setPagination,
      setTotal: state.setTotal,
      nextPage: state.nextPage,
      prevPage: state.prevPage,
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
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
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
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
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
 * Hook to access column visibility state and actions
 * More performant than useTableStore as it only subscribes to visibility changes
 *
 * @param tableId - Unique table identifier
 * @returns Column visibility state and actions
 *
 * @example
 * ```tsx
 * const { columnVisibility, toggleColumnVisibility } = useTableColumnVisibility('my-table');
 * ```
 */
export function useTableColumnVisibility(tableId: string) {
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
  return useStore(
    store,
    useShallow((state) => ({
      columnVisibility: state.columnVisibility,
      toggleColumnVisibility: state.toggleColumnVisibility,
      setColumnVisibility: state.setColumnVisibility,
    }))
  );
}

/**
 * Hook to access column order state and actions
 * More performant than useTableStore as it only subscribes to column order changes
 *
 * @param tableId - Unique table identifier
 * @returns Column order state and actions
 *
 * @example
 * ```tsx
 * const { columnOrder, setColumnOrder, resetColumnOrder } = useTableColumnOrder('my-table');
 * ```
 */
export function useTableColumnOrder(tableId: string) {
  const store = getTableStore(tableId);
  if (!store) {
    throw new Error(
      `Table store "${tableId}" not found. Make sure BetterTable is rendered before accessing the store.`
    );
  }
  return useStore(
    store,
    useShallow((state) => ({
      columnOrder: state.columnOrder,
      setColumnOrder: state.setColumnOrder,
      resetColumnOrder: state.resetColumnOrder,
    }))
  );
}
