'use client';

import type { FilterGroupNode, FilterState, TableAdapter } from '@better-tables/core';
import { getEffectiveFilters, MAX_FACET_BATCH_SIZE } from '@better-tables/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** A single faceted option: a distinct value and how many rows match it. */
export interface FacetOption {
  value: string;
  count: number;
}

export interface UseFacetsOptions<TData = unknown> {
  /**
   * Table adapter. Must implement `getFacetedValues`/`getMinMaxValues`; may
   * additionally implement the optional `getFacets` batch method, which the
   * hook prefers when present to fetch the whole sidebar in a single
   * round-trip per {@link MAX_FACET_BATCH_SIZE}-sized chunk (e.g. `httpAdapter`).
   */
  adapter: TableAdapter<TData>;

  /**
   * Column IDs to fetch checkbox-style faceted value counts for (via
   * `adapter.getFacetedValues`). May be a fresh array literal on every
   * render (e.g. `columnIds={['status', 'priority']}`) -- internally
   * interned by content, no memoization required.
   */
  columnIds?: string[];

  /**
   * Column IDs to fetch a `[min, max]` range for (via
   * `adapter.getMinMaxValues`) -- typically numeric/date columns. Same
   * "fresh array literal is fine" guarantee as `columnIds`.
   */
  rangeColumnIds?: string[];

  /**
   * The caller's full, current active filter state. Passed UNMODIFIED to
   * the adapter for every column queried -- per the `FacetQueryParams`
   * contract (`@better-tables/core`), self-exclusion (a column's own
   * filter never narrows its own facet) is the ADAPTER's responsibility,
   * not this hook's. Do not pre-filter this array per column; that would
   * fight the adapter's own self-exclusion logic instead of relying on it.
   * Pass a referentially stable array when possible (e.g. from
   * `useTableFilters`, which already is one).
   */
  filters?: FilterState[] | FilterGroupNode;

  /** Whether to fetch facets automatically. */
  enabled?: boolean;
}

export interface UseFacetsResult {
  /** `columnId -> [{ value, count }, ...]`, converted from the adapter's `Map<string, number>`. */
  facets: Record<string, FacetOption[]>;

  /** `columnId -> [min, max]`. */
  ranges: Record<string, [number, number]>;

  /** Loading state (true while any facet/range request is in flight). */
  loading: boolean;

  /** Error state (the first rejection among the in-flight batch, if any). */
  error: Error | null;

  /** Manually trigger a refetch of every configured column. */
  refetch: () => Promise<void>;

  /** Clear error state. */
  clearError: () => void;
}

const EMPTY_IDS: string[] = [];

/**
 * Fetches faceted filter data (checkbox option counts + numeric/date
 * ranges) for a set of columns, re-fetching whenever the caller's active
 * `filters` change.
 *
 * This is the reusable version of the fetch/self-exclusion/`Map`-to-array
 * plumbing every faceted-sidebar consumer otherwise hand-builds (plan 032,
 * finding 7): the race guard (only the newest request's results are applied)
 * and the `Map<string, number>` -> `FacetOption[]` conversion. It does NOT
 * own filter STATE -- pass your `filters` in (e.g. from `useTableFilters`)
 * and use the returned `facets`/`ranges` to render checkboxes/ranges that
 * toggle real filters via your own `onFiltersChange`/`setFilters`.
 *
 * Fetch strategy depends on the adapter: when it implements the optional
 * `getFacets` batch method (e.g. `httpAdapter`), the whole sidebar is fetched
 * in one round-trip per {@link MAX_FACET_BATCH_SIZE}-sized chunk; otherwise
 * the hook falls back to concurrent singular `getFacetedValues`/
 * `getMinMaxValues` calls (`Promise.all`), one per column — fine for
 * in-process adapters where there is no transport to save. The refetch
 * trigger keys on the EFFECTIVE filters, so an incomplete filter chip
 * (`values: []`) does not refire.
 *
 * @example
 * ```tsx
 * const { filters, setFilters } = useTableFilters('tickets');
 * const { facets, ranges, loading } = useFacets({
 *   adapter,
 *   columnIds: ['status', 'priority'],
 *   rangeColumnIds: ['reopenCount'],
 *   filters,
 * });
 *
 * // facets.status -- e.g. [{ value: 'open', count: 42 }, ...] -- reflects
 * // every OTHER active filter; a `status` filter never narrows
 * // `facets.status` itself (self-exclusion, proven by the adapter).
 * ```
 */
export function useFacets<TData = unknown>({
  adapter,
  columnIds = EMPTY_IDS,
  rangeColumnIds = EMPTY_IDS,
  filters,
  enabled = true,
}: UseFacetsOptions<TData>): UseFacetsResult {
  const [facets, setFacets] = useState<Record<string, FacetOption[]>>({});
  const [ranges, setRanges] = useState<Record<string, [number, number]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // columnIds/rangeColumnIds are near-always inline array literals at the
  // call site (e.g. columnIds={['status', 'priority']}), which is a fresh
  // reference every render. Intern by JSON content so IDs that contain
  // spaces (or other delimiters) cannot collide — e.g. ['foo', 'bar baz']
  // vs ['foo bar', 'baz'] — instead of requiring the caller to memoize.
  const columnIdsKey = JSON.stringify(columnIds);
  const rangeColumnIdsKey = JSON.stringify(rangeColumnIds);
  const stableColumnIds = useMemo(() => columnIds, [columnIdsKey]);
  const stableRangeColumnIds = useMemo(() => rangeColumnIds, [rangeColumnIdsKey]);

  // Same footgun as above applies to `filters`: an inline `filters={[]}` (or
  // any other freshly-computed array/tree) would otherwise change identity
  // every render and re-fire the fetch effect indefinitely. Intern by JSON
  // content -- filter state is small and this only runs on identity change,
  // not on every fetch.
  //
  // Key on the EFFECTIVE filters (no-effect leaves dropped) so a chip added
  // before its value is chosen (`values: []`) does not refire the facet batch
  // — it cannot change any facet's counts yet (plan 063 follow-up). The full
  // `filters` array is still what's passed to the adapter (self-exclusion is
  // its job over the complete state); only the refetch TRIGGER is effective.
  const filtersKey = JSON.stringify(filters === undefined ? null : getEffectiveFilters(filters));
  // Intern `filters` by effective content, not identity: `filtersKey` (not
  // `filters`) is the dependency on purpose.
  const stableFilters = useMemo(() => filters, [filtersKey]);

  const fetchFacets = useCallback(async () => {
    if (!enabled || (stableColumnIds.length === 0 && stableRangeColumnIds.length === 0)) {
      return;
    }

    const requestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    // `exactOptionalPropertyTypes` forbids `{ filters: undefined }` /
    // `{ signal: undefined }` — only include keys when they have real values.
    const facetParams = {
      ...(stableFilters !== undefined ? { filters: stableFilters } : {}),
      signal: controller.signal,
    };

    try {
      let facetResults: (readonly [string, FacetOption[]])[];
      let rangeResults: (readonly [string, [number, number]])[];

      if (adapter.getFacets) {
        // Batch-capable adapter (e.g. `httpAdapter`): one round-trip per
        // chunk instead of one request per column. Chunk to
        // `MAX_FACET_BATCH_SIZE` so a sidebar with more facet+range columns
        // than the server's per-batch cap doesn't fail as `bad_request` — it
        // just costs an extra round-trip per chunk (still far fewer than one
        // per column). The chunks run concurrently.
        const requests = [
          ...stableColumnIds.map((columnId) => ({ columnId, kind: 'values' as const })),
          ...stableRangeColumnIds.map((columnId) => ({ columnId, kind: 'minmax' as const })),
        ];
        const chunks: (typeof requests)[] = [];
        for (let i = 0; i < requests.length; i += MAX_FACET_BATCH_SIZE) {
          chunks.push(requests.slice(i, i + MAX_FACET_BATCH_SIZE));
        }
        const getFacets = adapter.getFacets.bind(adapter);
        const batchResults = await Promise.all(
          chunks.map((chunk) => getFacets(chunk, facetParams))
        );
        const values: Record<string, Map<string, number>> = {};
        const ranges: Record<string, [number, number]> = {};
        for (const batch of batchResults) {
          Object.assign(values, batch.values);
          Object.assign(ranges, batch.ranges);
        }
        facetResults = stableColumnIds.map((columnId) => {
          const map = values[columnId] ?? new Map<string, number>();
          const options: FacetOption[] = Array.from(map, ([value, count]) => ({ value, count }));
          return [columnId, options] as const;
        });
        rangeResults = stableRangeColumnIds.flatMap((columnId) => {
          const range = ranges[columnId];
          return range ? [[columnId, range] as const] : [];
        });
      } else {
        // In-process adapters: parallel singular calls (no transport to save).
        [facetResults, rangeResults] = await Promise.all([
          Promise.all(
            stableColumnIds.map(async (columnId) => {
              const map = await adapter.getFacetedValues(columnId, facetParams);
              const options: FacetOption[] = Array.from(map, ([value, count]) => ({
                value,
                count,
              }));
              return [columnId, options] as const;
            })
          ),
          Promise.all(
            stableRangeColumnIds.map(async (columnId) => {
              const range = await adapter.getMinMaxValues(columnId, facetParams);
              return [columnId, range] as const;
            })
          ),
        ]);
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setFacets(Object.fromEntries(facetResults));
      setRanges(Object.fromEntries(rangeResults));
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      // Aborted requests are superseded — don't surface them as errors.
      if ((err instanceof Error && err.name === 'AbortError') || controller.signal.aborted) {
        return;
      }

      setError(err instanceof Error ? err : new Error('Failed to fetch facets'));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [adapter, stableColumnIds, stableRangeColumnIds, stableFilters, enabled]);

  const refetch = useCallback(async () => {
    await fetchFacets();
  }, [fetchFacets]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    void fetchFacets();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchFacets]);

  return {
    facets,
    ranges,
    loading,
    error,
    refetch,
    clearError,
  };
}
