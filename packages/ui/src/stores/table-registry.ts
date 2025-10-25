import type { StoreApi } from 'zustand/vanilla';
import { createTableStore, type TableState, type TableStoreInitialState } from './table-store';

/**
 * Global registry for table stores
 * Allows multiple table instances to exist independently
 */
const storeRegistry = new Map<string, StoreApi<TableState>>();

/**
 * Get or create a table store by ID
 * The store must be initialized with columns on first creation
 *
 * @param id - Unique table identifier
 * @param initialState - Initial state for the store (required for new stores)
 * @returns The store instance
 */
export function getOrCreateTableStore(
  id: string,
  initialState: TableStoreInitialState
): StoreApi<TableState> {
  let store = storeRegistry.get(id);
  if (!store) {
    if (!initialState.columns) {
      throw new Error(
        `Cannot create table store "${id}" without columns. Columns are required on first initialization.`
      );
    }
    store = createTableStore(initialState);
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
 * Get an existing table store without creating it
 *
 * @param id - Table identifier
 * @returns The store instance or undefined if it doesn't exist
 */
export function getTableStore(id: string): StoreApi<TableState> | undefined {
  return storeRegistry.get(id);
}

/**
 * Destroy a table store
 * Call this when a table unmounts to clean up memory
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
