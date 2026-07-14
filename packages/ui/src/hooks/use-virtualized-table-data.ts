'use client';

import type {
  ColumnDefinition,
  FetchDataParams,
  FetchDataResult,
  TableAdapter,
} from '@better-tables/core';
import { getOrCreateTableStore } from '@better-tables/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTableFilters, useTableSorting } from './use-table-store';

// Stable default so an omitted `params` doesn't recreate `fetchData`'s
// identity (and retrigger the fetch effect) on every render the way a
// `params = {}` default-parameter object literal would.
const EMPTY_PARAMS: Record<string, unknown> = {};

export interface UseVirtualizedTableDataOptions<TData = unknown> {
  /** Table adapter for data fetching. */
  adapter: TableAdapter<TData>;

  /**
   * Table store ID. Created on first call (idempotent, same as
   * `getOrCreateTableStore`/`<BetterTable id>`) so a sibling `<FilterBar>`
   * or `useTableFilters`/`useTableSorting` consumer bound to the same ID
   * reads/writes the exact state this hook fetches against.
   */
  tableId: string;

  /**
   * Column definitions, required to create the store on first call. Ignored
   * (same as `getOrCreateTableStore`) if a store with this `tableId` already
   * exists -- e.g. because a sibling `<FilterBar>` created it first.
   */
  columns: ColumnDefinition<TData>[];

  /**
   * Max rows to fetch in one request. `<VirtualizedTable>` virtualizes DOM
   * rendering, not data fetching -- there's no page-by-page UI for this
   * hook to drive, so it fetches ONE page of up to `limit` matching rows
   * rather than paging through results. Raise it for a bigger board.
   * @default 1000
   */
  limit?: number;

  /** Additional fetch parameters merged into every fetch. */
  params?: Record<string, unknown>;

  /** Whether to fetch data automatically. */
  enabled?: boolean;
}

export interface UseVirtualizedTableDataResult<TData = unknown> {
  /** Flat data array, ready for `<VirtualizedTable data={data} />`. */
  data: TData[];

  /** Loading state. */
  loading: boolean;

  /** Error state. */
  error: Error | null;

  /** Total count of rows matching the current filters (may exceed `data.length` if capped by `limit`). */
  totalCount: number;

  /** Manually trigger a refetch. */
  refetch: () => Promise<void>;

  /** Clear error state. */
  clearError: () => void;
}

/**
 * Convenience hook that feeds `<VirtualizedTable>`'s flat `data` prop from
 * an adapter, filtered and sorted by a table store's state -- the SAME
 * store a sibling `<FilterBar>`/`useTableFilters`/`useTableSorting` consumer
 * reads and writes.
 *
 * `<VirtualizedTable>` is a deliberate low-level rendering primitive with no
 * adapter/store integration of its own (see plan 032, finding 6): it takes
 * a flat `data` array and renders it virtualized, full stop. This hook is
 * the "bring your own filtering/sorting" wiring -- it does not replace
 * `<BetterTable>`'s pagination UI (virtualization already handles rendering
 * arbitrarily large `data`, so there's no page-by-page fetch here, just one
 * capped fetch).
 *
 * @example
 * ```tsx
 * // <FilterBar> (or your own filter UI) bound to the same tableId drives
 * // filters/sorting; this hook re-fetches whenever they change.
 * const { data, loading, error } = useVirtualizedTableData({
 *   adapter,
 *   tableId: 'big-board',
 *   columns,
 *   limit: 2000,
 * });
 *
 * const { filters, setFilters } = useTableFilters('big-board');
 *
 * return (
 *   <>
 *     <FilterBar columns={columns} filters={filters} onFiltersChange={setFilters} />
 *     <VirtualizedTable data={data} columns={columns} loading={loading} />
 *   </>
 * );
 * ```
 */
export function useVirtualizedTableData<TData = unknown>({
  adapter,
  tableId,
  columns,
  limit = 1000,
  params = EMPTY_PARAMS,
  enabled = true,
}: UseVirtualizedTableDataOptions<TData>): UseVirtualizedTableDataResult<TData> {
  // Idempotent: only creates the store on the first call for this tableId,
  // same guarantee `<BetterTable id>` relies on (table.tsx). Synchronous
  // during render so the useTableFilters/useTableSorting calls below never
  // hit their "store not found" throw.
  getOrCreateTableStore(tableId, { columns });

  const { filters } = useTableFilters(tableId);
  const { sorting } = useTableSorting(tableId);

  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const fetchParams: FetchDataParams = {
        filters,
        sorting,
        pagination: { page: 1, limit },
        ...params,
        signal: abortController.signal,
      };

      const result: FetchDataResult<TData> = await adapter.fetchData(fetchParams);

      if (requestId !== requestIdRef.current || abortController.signal.aborted) {
        return;
      }

      setData(result.data);
      setTotalCount(result.total);
    } catch (err) {
      if (requestId !== requestIdRef.current || abortController.signal.aborted) {
        return;
      }

      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      if (requestId === requestIdRef.current && !abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [adapter, filters, sorting, limit, params, enabled]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    void fetchData();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    totalCount,
    refetch,
    clearError,
  };
}
