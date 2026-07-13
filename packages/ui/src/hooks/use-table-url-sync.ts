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
import { useEffect, useMemo, useRef, useState } from 'react';

type TableStore = NonNullable<ReturnType<typeof getTableStore>>;

const HYDRATION_RETRY_MS = 100;
const HYDRATION_MAX_ATTEMPTS = 5;

/**
 * Debounce utility to batch rapid updates.
 * Returns a cancel function so timers can be cleared on unmount.
 */
function debounce<T extends (args: Record<string, string | null>) => void>(
  func: T,
  wait: number
): {
  fn: (args: Record<string, string | null>) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const fn = (args: Record<string, string | null>) => {
    cancel();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func(args);
    }, wait);
  };

  return { fn, cancel };
}

/**
 * Stabilize UrlSyncConfig by value so inline object literals with the same
 * flags do not retrigger effects on every render.
 */
function useStableUrlSyncConfig(config: UrlSyncConfig): UrlSyncConfig {
  return useMemo(
    () => ({
      ...(config.filters !== undefined && { filters: config.filters }),
      ...(config.pagination !== undefined && { pagination: config.pagination }),
      ...(config.sorting !== undefined && { sorting: config.sorting }),
      ...(config.columnVisibility !== undefined && {
        columnVisibility: config.columnVisibility,
      }),
      ...(config.columnOrder !== undefined && { columnOrder: config.columnOrder }),
    }),
    [config.filters, config.pagination, config.sorting, config.columnVisibility, config.columnOrder]
  );
}

function hydrateFromUrl(store: TableStore, config: UrlSyncConfig, adapter: UrlSyncAdapter): void {
  const manager = store.getState().manager;

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

  const deserialized = deserializeTableStateFromUrl(urlParams);
  const updates: Parameters<typeof manager.updateState>[0] = {};

  const hasFilters = Array.isArray(deserialized.filters) ? deserialized.filters.length > 0 : true;
  if (config.filters && hasFilters) {
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
    updates.columnVisibility = mergeColumnVisibility(columns, deserialized.columnVisibility);
  }

  if (config.columnOrder) {
    const { columns } = store.getState();
    updates.columnOrder = mergeColumnOrder(columns, deserialized.columnOrder);
  }

  if (Object.keys(updates).length > 0) {
    manager.updateState(updates);
  }
}

/**
 * Hook to synchronize table state with URL query parameters
 * Framework-agnostic - requires a URL adapter implementation
 *
 * Pass a referentially stable `config` when possible (or rely on boolean
 * flags — inline literals with the same values are stabilized internally).
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
  const stableConfig = useStableUrlSyncConfig(config);
  const hasHydratedFromUrl = useRef(false);
  const [storeReady, setStoreReady] = useState(() => Boolean(getTableStore(tableId)));

  useEffect(() => {
    if (hasHydratedFromUrl.current) {
      return undefined;
    }

    const tryHydrate = (): boolean => {
      const store = getTableStore(tableId);
      if (!store) {
        return false;
      }

      hydrateFromUrl(store, stableConfig, adapter);
      hasHydratedFromUrl.current = true;
      setStoreReady(true);
      return true;
    };

    if (tryHydrate()) {
      return undefined;
    }

    let attempts = 0;
    const intervalId = setInterval(() => {
      attempts += 1;
      if (tryHydrate() || attempts >= HYDRATION_MAX_ATTEMPTS) {
        clearInterval(intervalId);
        if (attempts >= HYDRATION_MAX_ATTEMPTS && !getTableStore(tableId)) {
        }
      }
    }, HYDRATION_RETRY_MS);

    return () => clearInterval(intervalId);
  }, [tableId, stableConfig, adapter]);

  useEffect(() => {
    if (!storeReady) {
      return undefined;
    }

    const store = getTableStore(tableId);
    if (!store) {
      return undefined;
    }

    const manager = store.getState().manager;
    const { fn: debouncedUrlUpdate, cancel: cancelDebouncedUrlUpdate } = debounce(
      (urlParams: Record<string, string | null>) => {
        adapter.setParams(urlParams);
      },
      150
    );

    const unsubscribe = manager.subscribe((event: TableStateEvent) => {
      if (!hasHydratedFromUrl.current) return;

      if (event.type === 'state_changed') {
        const tableState: Parameters<typeof serializeTableStateToUrl>[0] = {};

        if (stableConfig.filters) {
          tableState.filters = event.state.filters;
        }

        if (stableConfig.pagination) {
          tableState.pagination = event.state.pagination;
        }

        if (stableConfig.sorting) {
          tableState.sorting = event.state.sorting;
        }

        if (stableConfig.columnVisibility) {
          const { columns } = store.getState();
          tableState.columnVisibility = getColumnVisibilityModifications(
            columns,
            event.state.columnVisibility
          );
        }

        if (stableConfig.columnOrder) {
          const { columns } = store.getState();
          tableState.columnOrder = getColumnOrderModifications(columns, event.state.columnOrder);
        }

        const urlParams = serializeTableStateToUrl(tableState);
        debouncedUrlUpdate(urlParams);
      }
    });

    return () => {
      unsubscribe();
      cancelDebouncedUrlUpdate();
    };
  }, [tableId, stableConfig, adapter, storeReady]);
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

      const hash = window.location.hash;
      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      window.history.replaceState({}, '', newUrl);
    },
  };
}
