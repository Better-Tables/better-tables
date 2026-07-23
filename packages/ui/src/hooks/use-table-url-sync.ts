'use client';

import {
  deepEqual,
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

type UrlWriteState = Parameters<typeof serializeTableStateToUrl>[0];

/**
 * Leading + trailing coalescer for URL writes.
 *
 * A trailing-only debounce put a fixed `wait` of idle time in front of EVERY
 * write — and for server-driven tables (Next.js demos) the URL write IS the
 * refetch trigger, so a single pagination click or filter commit paid a
 * built-in latency floor before the network even started. Instead:
 *
 * - a change arriving outside a cooldown window writes IMMEDIATELY (a
 *   discrete click/commit gets zero added latency), then opens a `wait`
 *   cooldown;
 * - changes arriving inside the cooldown are coalesced: only the LATEST is
 *   written when the cooldown expires (which re-opens it, so a continuous
 *   stream still writes at most once per `wait`).
 *
 * `func` returns whether it actually wrote (it skips writes that wouldn't
 * change the URL); a skipped leading write does NOT open a cooldown, so a
 * no-op change (e.g. row selection) never delays the next real one.
 */
function coalesceUrlWrites(
  func: (tableState: UrlWriteState) => boolean,
  wait: number
): {
  fn: (tableState: UrlWriteState) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pending: UrlWriteState | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pending = null;
  };

  const onCooldownEnd = () => {
    timeoutId = null;
    if (pending !== null) {
      const state = pending;
      pending = null;
      if (func(state)) {
        timeoutId = setTimeout(onCooldownEnd, wait);
      }
    }
  };

  const fn = (tableState: UrlWriteState) => {
    if (timeoutId === null) {
      if (func(tableState)) {
        timeoutId = setTimeout(onCooldownEnd, wait);
      }
      return;
    }
    pending = tableState;
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

/**
 * Read the current URL state and, if it differs from the store's current
 * state, apply it to the store.
 *
 * This is called both on mount and whenever the URL changes afterwards (soft
 * nav). To avoid a hydrate -> serialize -> hydrate loop with the store-to-URL
 * write-out effect, each field is only included in the `updates` passed to
 * `manager.updateState` when it deep-equals-differs from what the store
 * already holds -- a no-op hydration therefore never calls `updateState`,
 * never fires a `state_changed` event, and never triggers a write-back.
 *
 * @param allowClearFilters - When true, a URL with NO filters clears the
 *   store's filters (an intentional soft-nav "reset"). When false (the very
 *   first, mount-time hydration), an empty URL is treated as "nothing to
 *   apply" so it never wipes SSR-seeded `initialFilters`. Without this split,
 *   clearing filters via a soft navigation left the store's filter chips
 *   stale even though the data correctly refetched unfiltered (finding 15,
 *   clearing direction).
 *
 * @returns whether any state was actually applied to the store.
 */
function hydrateFromUrl(
  store: TableStore,
  config: UrlSyncConfig,
  adapter: UrlSyncAdapter,
  allowClearFilters: boolean
): boolean {
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
  // Apply when the URL actually carries filters, OR when a post-mount soft nav
  // removed them (`allowClearFilters`) so the store's chips clear to match.
  if (
    config.filters &&
    (hasFilters || allowClearFilters) &&
    !deepEqual(deserialized.filters, manager.getFilterNode())
  ) {
    updates.filters = deserialized.filters;
  }

  if (config.pagination) {
    const currentPagination = manager.getPagination();
    const nextPagination = {
      ...currentPagination,
      ...(deserialized.pagination.page !== undefined && { page: deserialized.pagination.page }),
      ...(deserialized.pagination.limit !== undefined && {
        limit: deserialized.pagination.limit,
      }),
    };
    if (!deepEqual(nextPagination, currentPagination)) {
      updates.pagination = nextPagination;
    }
  }

  if (
    config.sorting &&
    deserialized.sorting.length > 0 &&
    !deepEqual(deserialized.sorting, manager.getSorting())
  ) {
    updates.sorting = deserialized.sorting;
  }

  if (config.columnVisibility) {
    const { columns } = store.getState();
    const nextColumnVisibility = mergeColumnVisibility(columns, deserialized.columnVisibility);
    if (!deepEqual(nextColumnVisibility, manager.getColumnVisibility())) {
      updates.columnVisibility = nextColumnVisibility;
    }
  }

  if (config.columnOrder) {
    const { columns } = store.getState();
    const nextColumnOrder = mergeColumnOrder(columns, deserialized.columnOrder);
    if (!deepEqual(nextColumnOrder, manager.getColumnOrder())) {
      updates.columnOrder = nextColumnOrder;
    }
  }

  if (Object.keys(updates).length > 0) {
    manager.updateState(updates);
    return true;
  }
  return false;
}

/**
 * Capture the table's starting pagination once (its app-configured / SSR-seeded
 * default) so later writes can keep default `page`/`limit` out of a URL that
 * doesn't already carry them. Called before the first hydration, while the
 * store still holds its initial pagination.
 */
function captureDefaultPagination(
  store: TableStore,
  ref: { current: { page: number; limit: number } | null }
): void {
  if (ref.current) return;
  const p = store.getState().manager.getPagination();
  ref.current = { page: p.page, limit: p.limit };
}

/**
 * Drop `page`/`limit` from a params write when they're at the captured default
 * AND absent from the current URL, so a change that doesn't touch pagination
 * (row selection, a column toggle) on a clean URL doesn't introduce
 * `?page=1&limit=<default>` and trigger a navigation/refetch. Mutates
 * `urlParams`. Never removes a param the URL already carries — only skips
 * adding a redundant default one.
 */
function stripDefaultPaginationFromWrite(
  urlParams: Record<string, string | null>,
  pagination: { page: number; limit: number } | undefined,
  defaults: { page: number; limit: number } | null,
  adapter: UrlSyncAdapter
): void {
  if (!defaults || !pagination) return;
  if (
    urlParams.page != null &&
    pagination.page === defaults.page &&
    adapter.getParam('page') === null
  ) {
    delete urlParams.page;
  }
  if (
    urlParams.limit != null &&
    pagination.limit === defaults.limit &&
    adapter.getParam('limit') === null
  ) {
    delete urlParams.limit;
  }
}

/**
 * Whether writing `urlParams` would actually change any synced URL param.
 *
 * The table manager emits `state_changed` for mutations that touch no synced
 * URL param at all — row selection is the common one — and the write-out below
 * serializes the *current* value of every configured field, not a diff. Without
 * this check every such change would call `adapter.setParams` with values
 * identical to the URL; harmless for a history-only adapter, but with an adapter
 * that navigates on `setParams` (e.g. a Next.js router adapter) it forces a
 * needless refetch / full RSC round-trip (e.g. re-fetching the page just to tick
 * a checkbox).
 *
 * Each entry is compared against the adapter's current value. A `null` value
 * means "this param should be absent", which matches an absent (`null`) current
 * value; `undefined` from the adapter is normalized to `null`.
 */
function serializedParamsDifferFromUrl(
  urlParams: Record<string, string | null>,
  adapter: UrlSyncAdapter
): boolean {
  for (const [key, value] of Object.entries(urlParams)) {
    if ((adapter.getParam(key) ?? null) !== (value ?? null)) {
      return true;
    }
  }
  return false;
}

/**
 * Build a signature string from the URL param values relevant to `config`.
 * Used as a render-time effect dependency so the hydration effect re-runs
 * whenever the underlying URL values change -- even if the `adapter`
 * reference itself is stable (e.g. a vanilla adapter that reads
 * `window.location` fresh on every call) -- not just when a framework
 * adapter (e.g. Next.js's `useSearchParams`-backed adapter) is recreated.
 */
function computeUrlSignature(config: UrlSyncConfig, adapter: UrlSyncAdapter): string {
  const parts: string[] = [];
  if (config.filters) {
    parts.push(`filters=${adapter.getParam('filters') ?? ''}`);
  }
  if (config.pagination) {
    parts.push(`page=${adapter.getParam('page') ?? ''}`);
    parts.push(`limit=${adapter.getParam('limit') ?? ''}`);
  }
  if (config.sorting) {
    parts.push(`sorting=${adapter.getParam('sorting') ?? ''}`);
  }
  if (config.columnVisibility) {
    parts.push(`columnVisibility=${adapter.getParam('columnVisibility') ?? ''}`);
  }
  if (config.columnOrder) {
    parts.push(`columnOrder=${adapter.getParam('columnOrder') ?? ''}`);
  }
  return parts.join('&');
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
  // The pagination the table starts at (its app-configured / SSR-seeded
  // default), captured once before the first user interaction. Used to keep
  // default `page`/`limit` out of a URL that doesn't already carry them — see
  // the write-out effect below.
  const defaultPaginationRef = useRef<{ page: number; limit: number } | null>(null);
  // Re-capture the default pagination when this hook is pointed at a different
  // table, so table B's writes aren't measured against table A's defaults.
  const capturedForTableIdRef = useRef<string | null>(null);
  if (capturedForTableIdRef.current !== tableId) {
    capturedForTableIdRef.current = tableId;
    defaultPaginationRef.current = null;
  }
  const [storeReady, setStoreReady] = useState(() => Boolean(getTableStore(tableId)));
  // Recomputed every render (cheap: a handful of adapter.getParam reads) so
  // it changes whenever the URL's relevant params change, even for adapters
  // that keep a stable reference across soft navs (e.g. a vanilla adapter
  // reading window.location fresh each call).
  const urlSignature = computeUrlSignature(stableConfig, adapter);

  useEffect(() => {
    // Once the store exists, re-hydrate on every run of this effect (i.e.
    // whenever tableId/config/adapter identity/urlSignature change). This is
    // what makes a post-mount URL change (soft nav to a new filter) re-seed
    // the store instead of only running once at mount.
    // `hydrateFromUrl` itself is a no-op (does not call `manager.updateState`)
    // when the URL already matches the store, which is what prevents this
    // from looping with the store->URL write-out effect below.
    const store = getTableStore(tableId);
    if (store) {
      captureDefaultPagination(store, defaultPaginationRef);
      // First hydration must not clear SSR-seeded initialFilters; later ones
      // (soft navs) may clear (finding 15).
      hydrateFromUrl(store, stableConfig, adapter, hasHydratedFromUrl.current);
      if (!hasHydratedFromUrl.current) {
        hasHydratedFromUrl.current = true;
        setStoreReady(true);
      }
      return undefined;
    }

    // Store not created yet (e.g. it's created by a sibling component after
    // this hook mounts) -- poll briefly until it exists.
    let attempts = 0;
    const intervalId = setInterval(() => {
      attempts += 1;
      const lateStore = getTableStore(tableId);
      if (lateStore) {
        captureDefaultPagination(lateStore, defaultPaginationRef);
        hydrateFromUrl(lateStore, stableConfig, adapter, hasHydratedFromUrl.current);
        hasHydratedFromUrl.current = true;
        setStoreReady(true);
        clearInterval(intervalId);
        return;
      }
      if (attempts >= HYDRATION_MAX_ATTEMPTS) {
        clearInterval(intervalId);
      }
    }, HYDRATION_RETRY_MS);

    return () => clearInterval(intervalId);
  }, [tableId, stableConfig, adapter, urlSignature]);

  useEffect(() => {
    if (!storeReady) {
      return undefined;
    }

    const store = getTableStore(tableId);
    if (!store) {
      return undefined;
    }

    const manager = store.getState().manager;
    const { fn: coalescedUrlUpdate, cancel: cancelCoalescedUrlUpdate } = coalesceUrlWrites(
      (tableState) => {
        const urlParams = serializeTableStateToUrl(tableState);
        // Keep default page/limit out of a URL that doesn't already carry them,
        // so a change that doesn't touch pagination (selection, column toggle)
        // doesn't introduce `?page=1&limit=<default>`.
        stripDefaultPaginationFromWrite(
          urlParams,
          tableState.pagination,
          defaultPaginationRef.current,
          adapter
        );
        // Skip writes that wouldn't change the URL (e.g. a row-selection change,
        // which emits `state_changed` but touches no synced param) so adapters
        // that navigate on `setParams` don't refetch for nothing.
        if (!serializedParamsDifferFromUrl(urlParams, adapter)) {
          return false;
        }
        adapter.setParams(urlParams);
        return true;
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

        coalescedUrlUpdate(tableState);
      }
    });

    return () => {
      unsubscribe();
      cancelCoalescedUrlUpdate();
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
