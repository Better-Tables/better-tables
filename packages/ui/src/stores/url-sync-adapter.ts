'use client';

import {
  getColumnOrderModifications,
  getColumnVisibilityModifications,
  mergeColumnOrder,
  mergeColumnVisibility,
} from '@better-tables/core';
import { useEffect, useRef } from 'react';
import { getTableStore } from './table-registry';

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
  /** Sync column visibility to URL */
  columnVisibility?: boolean;
  /** Sync column order to URL */
  columnOrder?: boolean;
}

/**
 * Hook to synchronize table state with URL query parameters
 * Framework-agnostic - requires a URL adapter implementation
 *
 * This hook:
 * 1. Reads URL params once on mount and updates the table manager
 * 2. Subscribes to table state changes and syncs them to the URL
 *
 * @param tableId - Unique table identifier
 * @param config - Configuration for which state to sync
 * @param adapter - Framework-specific URL adapter
 *
 * @example
 * ```tsx
 * // Next.js example
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
  const hasHydratedFromUrl = useRef(false);

  // Hydrate from URL on mount
  useEffect(() => {
    if (hasHydratedFromUrl.current) return;

    const store = getTableStore(tableId);
    if (!store) {
      // Store doesn't exist yet - will retry when dependencies change
      return;
    }

    const manager = store.getState().manager;
    const updates: Parameters<typeof manager.updateState>[0] = {};

    // Parse URL params
    if (config.filters) {
      const filtersParam = adapter.getParam('filters');
      if (filtersParam) {
        try {
          updates.filters = JSON.parse(filtersParam);
        } catch {
          // Silently ignore parse errors
        }
      }
    }

    if (config.pagination) {
      const pageParam = adapter.getParam('page');
      const limitParam = adapter.getParam('limit');

      if (pageParam || limitParam) {
        // Start with current pagination state
        const currentPagination = manager.getPagination();
        updates.pagination = { ...currentPagination };

        if (pageParam) {
          const page = Number.parseInt(pageParam, 10);
          if (!Number.isNaN(page)) {
            updates.pagination.page = page;
          }
        }
        if (limitParam) {
          const limit = Number.parseInt(limitParam, 10);
          if (!Number.isNaN(limit)) {
            updates.pagination.limit = limit;
          }
        }
      }
    }

    if (config.sorting) {
      const sortingParam = adapter.getParam('sorting');
      if (sortingParam) {
        try {
          updates.sorting = JSON.parse(sortingParam);
        } catch {
          // Silently ignore parse errors
        }
      }
    }

    if (config.columnVisibility) {
      const visibilityParam = adapter.getParam('columnVisibility');
      if (visibilityParam) {
        try {
          const modifications = JSON.parse(visibilityParam);
          const { columns } = store.getState();
          // Merge modifications with defaults
          updates.columnVisibility = mergeColumnVisibility(columns, modifications);
        } catch {
          // Silently ignore parse errors
        }
      }
    }

    if (config.columnOrder) {
      const orderParam = adapter.getParam('columnOrder');
      if (orderParam) {
        try {
          const modifications = JSON.parse(orderParam);
          const { columns } = store.getState();
          // Merge modifications with defaults
          updates.columnOrder = mergeColumnOrder(columns, modifications);
        } catch {
          // Silently ignore parse errors
        }
      }
    }

    // Apply updates if we have any
    if (Object.keys(updates).length > 0) {
      manager.updateState(updates);
    }

    hasHydratedFromUrl.current = true;
  }, [tableId, config, adapter]);

  // Subscribe to state changes and sync to URL
  useEffect(() => {
    const store = getTableStore(tableId);
    if (!store) return;

    const manager = store.getState().manager;

    // Subscribe to manager state changes
    const unsubscribe = manager.subscribe((event) => {
      // Only sync to URL after initial hydration to avoid loops
      if (!hasHydratedFromUrl.current) return;

      if (event.type === 'state_changed') {
        const updates: Record<string, string | null> = {};

        if (config.filters) {
          updates.filters =
            event.state.filters.length > 0 ? JSON.stringify(event.state.filters) : null;
        }

        if (config.pagination) {
          updates.page = event.state.pagination.page.toString();
          updates.limit = event.state.pagination.limit.toString();
        }

        if (config.sorting) {
          updates.sorting =
            event.state.sorting.length > 0 ? JSON.stringify(event.state.sorting) : null;
        }

        if (config.columnVisibility) {
          const { columns } = store.getState();
          // Get only modifications from defaults
          const modifications = getColumnVisibilityModifications(
            columns,
            event.state.columnVisibility
          );
          updates.columnVisibility =
            Object.keys(modifications).length > 0 ? JSON.stringify(modifications) : null;
        }

        if (config.columnOrder) {
          const { columns } = store.getState();
          // Get only modifications from defaults
          const modifications = getColumnOrderModifications(columns, event.state.columnOrder);
          updates.columnOrder = modifications.length > 0 ? JSON.stringify(modifications) : null;
        }

        adapter.setParams(updates);
      }
    });

    return unsubscribe;
  }, [tableId, config, adapter]);
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

      // Preserve hash fragment when updating URL
      const hash = window.location.hash;
      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      window.history.replaceState({}, '', newUrl);
    },
  };
}
