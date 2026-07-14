import type {
  ColumnType,
  FacetQueryParams,
  FetchDataParams,
  FetchDataResult,
  FilterOperator,
  FilterState,
  TableAdapter,
} from '@better-tables/core';

type Row = { id: string };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export type StubFetchCall = {
  params: FetchDataParams;
  deferred: Deferred<FetchDataResult<Row>>;
};

export type StubFacetCall = { columnId: string; params: FacetQueryParams | undefined };

export function createDeferredFetchAdapter() {
  const calls: StubFetchCall[] = [];
  const facetCalls: StubFacetCall[] = [];
  const rangeCalls: StubFacetCall[] = [];

  const adapter: TableAdapter<Row> = {
    meta: {
      name: 'stub',
      version: 'test',
      features: {
        create: false,
        read: true,
        update: false,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text'],
      supportedOperators: {
        text: ['contains'],
      } as Record<ColumnType, FilterOperator[]>,
    },
    fetchData: (params) => {
      const deferred = createDeferred<FetchDataResult<Row>>();
      calls.push({ params, deferred });
      return deferred.promise;
    },
    getFilterOptions: async () => [],
    getFacetedValues: async (columnId, params) => {
      facetCalls.push({ columnId, params });
      return new Map();
    },
    getMinMaxValues: async (columnId, params) => {
      rangeCalls.push({ columnId, params });
      return [0, 0];
    },
  };

  return { adapter, calls, facetCalls, rangeCalls };
}

export function makeFetchResult(data: Row[]): FetchDataResult<Row> {
  return {
    data,
    total: data.length,
    pagination: {
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

/**
 * An in-memory adapter with GENUINE self-exclusion semantics for
 * `getFacetedValues`/`getMinMaxValues` (per the `FacetQueryParams` contract:
 * "every filter leaf targeting that SAME column must be excluded from the
 * filters applied here"), so tests can prove a hook that merely passes
 * `filters` through unmodified gets correct self-excluded counts back --
 * without the hook doing any self-exclusion logic itself (that would fight
 * the adapter's own responsibility for it).
 *
 * Only supports flat `FilterState[]` (no `FilterGroupNode`) and the `is`/
 * `isAnyOf` operators -- enough to exercise self-exclusion, not a full
 * filter engine.
 */
export function createSelfExclusionFacetAdapter<TRow extends { id: string }>(rows: TRow[]) {
  function asRecord(row: TRow): Record<string, unknown> {
    return row as unknown as Record<string, unknown>;
  }

  function applyFiltersExcluding(excludeColumnId: string, filters: FilterState[] | undefined) {
    const applicable = (filters ?? []).filter((f) => f.columnId !== excludeColumnId);
    return rows.filter((row) =>
      applicable.every((f) => {
        const rowValue = asRecord(row)[f.columnId];
        return (f.values as unknown[]).includes(rowValue);
      })
    );
  }

  const facetCalls: StubFacetCall[] = [];
  const rangeCalls: StubFacetCall[] = [];

  const adapter: TableAdapter<TRow> = {
    meta: {
      name: 'stub-self-exclusion',
      version: 'test',
      features: {
        create: false,
        read: true,
        update: false,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text', 'number'],
      supportedOperators: {
        text: ['is', 'isAnyOf'],
        number: ['between'],
      } as unknown as Record<ColumnType, FilterOperator[]>,
    },
    fetchData: async () => ({
      data: rows,
      total: rows.length,
      pagination: { page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async (columnId, params) => {
      facetCalls.push({ columnId, params });
      const filters = Array.isArray(params?.filters) ? params.filters : undefined;
      const matching = applyFiltersExcluding(columnId, filters);
      const counts = new Map<string, number>();
      for (const row of matching) {
        const value = String(asRecord(row)[columnId]);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    },
    getMinMaxValues: async (columnId, params) => {
      rangeCalls.push({ columnId, params });
      const filters = Array.isArray(params?.filters) ? params.filters : undefined;
      const matching = applyFiltersExcluding(columnId, filters);
      const values = matching
        .map((row) => Number(asRecord(row)[columnId]))
        .filter((n) => !Number.isNaN(n));
      if (values.length === 0) return [0, 0];
      return [Math.min(...values), Math.max(...values)];
    },
  };

  return { adapter, facetCalls, rangeCalls };
}
