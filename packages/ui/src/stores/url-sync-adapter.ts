import { useEffect } from 'react';
import { getOrCreateTableStore } from './table-registry';

/**
 * Framework-agnostic URL sync adapter interface
 * Implement this interface for your specific framework (Next.js, React Router, etc.)
 */
export interface UrlSyncAdapter {
  /**
   * Get a URL parameter value
   * @param key - Parameter key
   * @returns Parameter value or null if not present
   */
  getParam: (key: string) => string | null;

  /**
   * Set multiple URL parameters at once
   * @param updates - Object with key-value pairs to update (null values delete the param)
   */
  setParams: (updates: Record<string, string | null>) => void;
}

/**
 * Configuration for URL synchronization
 */
export interface UrlSyncConfig {
  /** Sync filters to URL */
  filters?: boolean;
  /** Sync pagination to URL */
  pagination?: boolean;
  /** Sync sorting to URL */
  sorting?: boolean;
}

/**
 * Hook to synchronize table state with URL query parameters
 * Framework-agnostic - requires a URL adapter implementation
 *
 * @param tableId - Unique table identifier
 * @param config - Configuration for which state to sync
 * @param adapter - Framework-specific URL adapter
 *
 * @example
 * ```tsx
 * // Next.js example (adapter implemented in your app)
 * const urlAdapter = useNextjsUrlAdapter();
 * useTableUrlSync('my-table', {
 *   filters: true,
 *   pagination: true,
 *   sorting: true
 * }, urlAdapter);
 * ```
 */
export function useTableUrlSync(
  tableId: string,
  config: UrlSyncConfig,
  adapter: UrlSyncAdapter
): void {
  const store = getOrCreateTableStore(tableId);

  // Sync URL -> Store on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only sync from URL once on mount
  useEffect(() => {
    const state = store.getState();

    if (config.filters) {
      const filtersParam = adapter.getParam('filters');
      if (filtersParam) {
        try {
          const filters = JSON.parse(filtersParam);
          state.setFilters(filters);
        } catch {
          // Silently ignore parse errors
        }
      }
    }

    if (config.pagination) {
      const pageParam = adapter.getParam('page');
      const limitParam = adapter.getParam('limit');

      if (pageParam) {
        const page = Number.parseInt(pageParam, 10);
        if (!Number.isNaN(page)) {
          state.setPage(page);
        }
      }

      if (limitParam) {
        const limit = Number.parseInt(limitParam, 10);
        if (!Number.isNaN(limit)) {
          state.setPageSize(limit);
        }
      }
    }

    if (config.sorting) {
      const sortingParam = adapter.getParam('sorting');
      if (sortingParam) {
        try {
          const sorting = JSON.parse(sortingParam);
          state.setSorting(sorting);
        } catch {
          // Silently ignore parse errors
        }
      }
    }
  }, [tableId]); // Only run on mount - intentionally not including other deps

  // Sync Store -> URL on state changes
  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      const updates: Record<string, string | null> = {};

      if (config.filters) {
        updates.filters = state.filters.length > 0 ? JSON.stringify(state.filters) : null;
      }

      if (config.pagination) {
        updates.page = state.pagination.page.toString();
        updates.limit = state.pagination.limit.toString();
      }

      if (config.sorting) {
        updates.sorting = state.sorting.length > 0 ? JSON.stringify(state.sorting) : null;
      }

      adapter.setParams(updates);
    });

    return unsubscribe;
  }, [store, config, adapter]);
}

/**
 * Utility to create a vanilla JavaScript URL adapter
 * Uses the browser's History API and URLSearchParams
 * Works with any React framework that doesn't provide its own router
 *
 * @returns UrlSyncAdapter implementation
 *
 * @example
 * ```tsx
 * const urlAdapter = createVanillaUrlAdapter();
 * useTableUrlSync('my-table', { filters: true }, urlAdapter);
 * ```
 */
export function createVanillaUrlAdapter(): UrlSyncAdapter {
  return {
    getParam: (key: string) => {
      const params = new URLSearchParams(window.location.search);
      return params.get(key);
    },
    setParams: (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    },
  };
}

