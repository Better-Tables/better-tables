import type {
  ColumnType,
  FetchDataParams,
  FetchDataResult,
  FilterOperator,
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

export function createDeferredFetchAdapter() {
  const calls: StubFetchCall[] = [];

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
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
  };

  return { adapter, calls };
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
