'use client';

import {
  deserializeTableStateFromUrl,
  getColumnOrderModifications,
  getColumnVisibilityModifications,
  getTableStore,
  mergeColumnOrder,
  mergeColumnVisibility,
  serializeTableStateToUrl,
  type TableStateEvent,
  type UrlSyncAdapter,
  type UrlSyncConfig,
} from '@better-tables/core';
import { useEffect, useRef } from 'react';

/**
 * Debounce utility to batch rapid updates
 */
function debounce<T extends (args: Record<string, string | null>) => void>(
  func: T,
  wait: number
): (args: Record<string, string | null>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(args: Record<string, string | null>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(args);
    }, wait);
  };
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
  const pendingUrlUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from URL on mount
  useEffect(() => {
    if (hasHydratedFromUrl.current) return undefined;

    const store = getTableStore(tableId);
    if (!store) {
      // Store doesn't exist yet - retry after a short delay
      const timeoutId = setTimeout(() => {
        const retryStore = getTableStore(tableId);
        if (retryStore && !hasHydratedFromUrl.current) {
          // Retry hydration logic here if needed
          hasHydratedFromUrl.current = true;
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    const manager = store.getState().manager;

    // Collect URL params
    const urlParams: Record<string, string | undefined | null> = {};
    if (config.filters) {
      urlParams.filters = adapter.getParam('filters') ?? undefined;
    }
    if (config.pagination) {
      urlParams.page = adapter.getParam('page') ?? undefined;
      urlParams.limit = adapter.getParam('limit') ?? undefined;
    }
    if (config.sorting) {
      urlParams.sorting = adapter.getParam('sorting') ?? undefined;
    }
    if (config.columnVisibility) {
      urlParams.columnVisibility = adapter.getParam('columnVisibility') ?? undefined;
    }
    if (config.columnOrder) {
      urlParams.columnOrder = adapter.getParam('columnOrder') ?? undefined;
    }

    // Deserialize table state from URL using utility function
    const deserialized = deserializeTableStateFromUrl(urlParams);

    // Build updates object
    const updates: Parameters<typeof manager.updateState>[0] = {};

    if (config.filters && deserialized.filters.length > 0) {
      updates.filters = deserialized.filters;
    }

    if (config.pagination) {
      const currentPagination = manager.getPagination();
      updates.pagination = {
        ...currentPagination,
        ...(deserialized.pagination.page !== undefined && { page: deserialized.pagination.page }),
        ...(deserialized.pagination.limit !== undefined && {
          limit: deserialized.pagination.limit,
        }),
      };
    }

    if (config.sorting && deserialized.sorting.length > 0) {
      updates.sorting = deserialized.sorting;
    }

    if (config.columnVisibility) {
      const { columns } = store.getState();
      // Merge modifications with defaults
      updates.columnVisibility = mergeColumnVisibility(columns, deserialized.columnVisibility);
    }

    if (config.columnOrder) {
      const { columns } = store.getState();
      // Merge modifications with defaults
      updates.columnOrder = mergeColumnOrder(columns, deserialized.columnOrder);
    }

    // Apply updates if we have any
    if (Object.keys(updates).length > 0) {
      manager.updateState(updates);
    }

    // Mark as hydrated immediately after applying updates
    hasHydratedFromUrl.current = true;

    return undefined;
  }, [tableId, config, adapter]);

  // Subscribe to state changes and sync to URL
  useEffect(() => {
    const store = getTableStore(tableId);
    if (!store) return;

    const manager = store.getState().manager;

    // Create debounced URL update function (150ms debounce to batch rapid changes)
    const debouncedUrlUpdate = debounce((urlParams: Record<string, string | null>) => {
      adapter.setParams(urlParams);
    }, 150);

    // Subscribe to manager state changes
    const unsubscribe = manager.subscribe((event: TableStateEvent) => {
      // Only sync to URL after initial hydration to avoid loops
      if (!hasHydratedFromUrl.current) return;

      if (event.type === 'state_changed') {
        // Build table state object for serialization
        const tableState: Parameters<typeof serializeTableStateToUrl>[0] = {};

        if (config.filters) {
          tableState.filters = event.state.filters;
        }

        if (config.pagination) {
          tableState.pagination = event.state.pagination;
        }

        if (config.sorting) {
          tableState.sorting = event.state.sorting;
        }

        if (config.columnVisibility) {
          const { columns } = store.getState();
          // Get only modifications from defaults
          tableState.columnVisibility = getColumnVisibilityModifications(
            columns,
            event.state.columnVisibility
          );
        }

        if (config.columnOrder) {
          const { columns } = store.getState();
          // Get only modifications from defaults
          tableState.columnOrder = getColumnOrderModifications(columns, event.state.columnOrder);
        }

        // Serialize table state to URL params using utility function
        const urlParams = serializeTableStateToUrl(tableState);

        // Clear any pending update and schedule new one
        if (pendingUrlUpdateRef.current) {
          clearTimeout(pendingUrlUpdateRef.current);
        }

        // Use debounced update to batch rapid changes
        debouncedUrlUpdate(urlParams);
      }
    });

    return () => {
      unsubscribe();
      // Clean up pending updates on unmount
      if (pendingUrlUpdateRef.current) {
        clearTimeout(pendingUrlUpdateRef.current);
      }
    };
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
