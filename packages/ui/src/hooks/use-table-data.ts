'use client';

import type {
  FetchDataParams,
  FetchDataResult,
  FilterState,
  PaginationState,
  TableAdapter,
} from '@better-tables/core';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTableDataOptions<TData = unknown> {
  /** Table adapter for data fetching */
  adapter: TableAdapter<TData>;

  /**
   * Current filters.
   * Pass a referentially stable array when possible (e.g. from state or useMemo).
   */
  filters?: FilterState[];

  /** Current pagination state */
  pagination?: PaginationState;

  /**
   * Additional fetch parameters.
   * Pass a referentially stable object when possible.
   */
  params?: Record<string, unknown>;

  /** Whether to fetch data automatically */
  enabled?: boolean;
}

export interface UseTableDataResult<TData = unknown> {
  /** Table data */
  data: TData[];

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: Error | null;

  /** Total count of items */
  totalCount: number;

  /** Pagination information */
  paginationInfo: FetchDataResult<TData>['pagination'] | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;

  /** Clear error state */
  clearError: () => void;
}

/**
 * Hook for fetching table data with proper cleanup and error handling
 *
 * @example
 * ```tsx
 * const { data, loading, error, totalCount, refetch } = useTableData({
 *   adapter: myAdapter,
 *   filters,
 *   pagination: paginationState,
 * });
 *
 * return (
 *   <BetterTable
 *     data={data}
 *     loading={loading}
 *     error={error}
 *     totalCount={totalCount}
 *     filters={filters}
 *     onFiltersChange={setFilters}
 *     paginationState={paginationState}
 *     onPageChange={handlePageChange}
 *     // ... other props
 *   />
 * );
 * ```
 */
export function useTableData<TData = unknown>({
  adapter,
  filters = [],
  pagination,
  params = {},
  enabled = true,
}: UseTableDataOptions<TData>): UseTableDataResult<TData> {
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationInfo, setPaginationInfo] = useState<FetchDataResult<TData>['pagination'] | null>(
    null
  );

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
        ...params,
        signal: abortController.signal,
      };

      if (pagination) {
        fetchParams.pagination = {
          page: pagination.page,
          limit: pagination.limit,
        };
      }

      const result = await adapter.fetchData(fetchParams);

      if (requestId !== requestIdRef.current || abortController.signal.aborted) {
        return;
      }

      setData(result.data);
      setTotalCount(result.total);
      setPaginationInfo(result.pagination);
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
  }, [adapter, filters, pagination, params, enabled]);

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
    paginationInfo,
    refetch,
    clearError,
  };
}

/**
 * Example implementation with React Query (for reference)
 *
 * @example
 * ```tsx
 * import { useQuery } from '@tanstack/react-query';
 *
 * export function useTableDataWithQuery<TData = any>({
 *   adapter,
 *   filters = [],
 *   pagination,
 *   params = {},
 * }: UseTableDataOptions<TData>) {
 *   const {
 *     data: result,
 *     isLoading,
 *     error,
 *     refetch,
 *   } = useQuery({
 *     queryKey: ['table-data', adapter.meta.name, filters, pagination, params],
 *     queryFn: () => adapter.fetchData({
 *       filters,
 *       pagination: pagination ? {
 *         page: pagination.page,
 *         limit: pagination.limit,
 *       } : undefined,
 *       ...params,
 *     }),
 *     staleTime: 5 * 60 * 1000, // 5 minutes
 *     gcTime: 10 * 60 * 1000, // 10 minutes
 *   });
 *
 *   return {
 *     data: result?.data ?? [],
 *     loading: isLoading,
 *     error: error as Error | null,
 *     totalCount: result?.total ?? 0,
 *     paginationInfo: result?.pagination ?? null,
 *     refetch: () => refetch(),
 *     clearError: () => {}, // React Query handles this
 *   };
 * }
 * ```
 */
