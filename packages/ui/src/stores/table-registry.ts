import type { StoreApi } from 'zustand/vanilla';
import { type TableState, type TableStoreInitialState, createTableStore } from './table-store';

/**
 * Global registry for table stores
 * Allows multiple table instances to exist independently
 */
const storeRegistry = new Map<string, StoreApi<TableState>>();

/**
 * Get or create a table store by ID
 * If a store with the given ID already exists, return it
 * Otherwise, create a new store with the provided initial state
 *
 * @param id - Unique table identifier
 * @param initialState - Initial state for the store (only used if creating new store)
 * @returns The store instance
 */
export function getOrCreateTableStore(
  id: string,
  initialState?: TableStoreInitialState
): StoreApi<TableState> {
  let store = storeRegistry.get(id);
  if (!store) {
    store = createTableStore(initialState || {});
    storeRegistry.set(id, store);
  }
  return store;
}

/**
 * Check if a table store exists
 *
 * @param id - Table identifier
 * @returns True if store exists
 */
export function hasTableStore(id: string): boolean {
  return storeRegistry.has(id);
}

/**
 * Update a table store with new initial state
 * This will reset the store to the new initial state
 *
 * @param id - Table identifier
 * @param initialState - New initial state
 */
export function updateTableStore(id: string, initialState: TableStoreInitialState): void {
  const store = storeRegistry.get(id);
  if (store) {
    const state = store.getState();

    // Update each piece of state if provided
    if (initialState.filters !== undefined) {
      state.setFilters(initialState.filters);
    }
    if (initialState.pagination !== undefined) {
      state.setPagination(initialState.pagination);
    }
    if (initialState.sorting !== undefined) {
      state.setSorting(initialState.sorting);
    }
    if (initialState.selectedRows !== undefined) {
      state.setSelectedRows(initialState.selectedRows);
    }
  } else {
    // Create new store if it doesn't exist
    storeRegistry.set(id, createTableStore(initialState));
  }
}

/**
 * Destroy a table store
 * Call this when a table unmounts to clean up memory
 * Note: You may want to keep stores around for navigation back scenarios
 *
 * @param id - Table identifier
 */
export function destroyTableStore(id: string): void {
  storeRegistry.delete(id);
}

/**
 * Get the current state of a table store without subscribing
 *
 * @param id - Table identifier
 * @returns The current state, or null if store doesn't exist
 */
export function getTableState(id: string): TableState | null {
  const store = storeRegistry.get(id);
  return store ? store.getState() : null;
}

/**
 * Clear all table stores
 * Useful for testing or complete application resets
 */
export function clearAllTableStores(): void {
  storeRegistry.clear();
}

/**
 * Get all registered table IDs
 * Useful for debugging
 */
export function getAllTableIds(): string[] {
  return Array.from(storeRegistry.keys());
}

