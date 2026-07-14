import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FetchDataParams, FilterState } from '@better-tables/core';
import { clearAllTableStores, getOrCreateTableStore } from '@better-tables/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTableFilters } from '../../src/hooks/use-table-store';
import { useVirtualizedTableData } from '../../src/hooks/use-virtualized-table-data';
import { createDeferredFetchAdapter, makeFetchResult } from '../helpers/stub-adapter';

const TABLE_ID = 'virtualized-data-test-table';

const columns: ColumnDefinition<{ id: string }>[] = [
  { id: 'id', displayName: 'ID', type: 'text', accessor: (row) => row.id, filterable: true },
];

beforeEach(() => {
  clearAllTableStores();
});

afterEach(() => {
  clearAllTableStores();
});

function matchesFilters(params: FetchDataParams, filters: FilterState[]) {
  return JSON.stringify(params.filters) === JSON.stringify(filters);
}

describe('useVirtualizedTableData (plan 032 step 3b)', () => {
  it('wires the adapter to a table store: fetches on mount and refetches when a sibling useTableFilters consumer changes filters', async () => {
    const { adapter, calls } = createDeferredFetchAdapter();
    getOrCreateTableStore(TABLE_ID, { columns });

    const { result } = renderHook(() => {
      const data = useVirtualizedTableData({ adapter, tableId: TABLE_ID, columns });
      const { setFilters } = useTableFilters(TABLE_ID);
      return { data, setFilters };
    });

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.params.filters).toEqual([]);
    expect(calls[0]?.params.pagination).toEqual({ page: 1, limit: 1000 });

    await act(async () => {
      calls[0]?.deferred.resolve(makeFetchResult([{ id: 'r1' }]));
    });

    await waitFor(() => expect(result.current.data.data).toEqual([{ id: 'r1' }]));

    // A sibling <FilterBar>/useTableFilters consumer bound to the SAME
    // tableId changes filters -- the hook must pick this up and refetch,
    // proving it's wired to the store (not just a static one-shot fetch).
    const newFilters: FilterState[] = [
      { columnId: 'id', type: 'text', operator: 'contains', values: ['r2'] },
    ];

    act(() => {
      result.current.setFilters(newFilters);
    });

    await waitFor(() => {
      expect(calls.some((c) => matchesFilters(c.params, newFilters))).toBe(true);
    });

    const filteredCall = calls.find((c) => matchesFilters(c.params, newFilters));
    expect(filteredCall).toBeDefined();
    if (!filteredCall) {
      throw new Error('Expected a fetch call for the new filters');
    }

    await act(async () => {
      filteredCall.deferred.resolve(makeFetchResult([{ id: 'r2' }]));
    });

    await waitFor(() => expect(result.current.data.data).toEqual([{ id: 'r2' }]));
  });

  it('is idempotent about store creation -- does not throw when the store already exists (e.g. created by a sibling BetterTable/FilterBar)', () => {
    getOrCreateTableStore(TABLE_ID, { columns });
    const { adapter } = createDeferredFetchAdapter();

    expect(() => {
      renderHook(() => useVirtualizedTableData({ adapter, tableId: TABLE_ID, columns }));
    }).not.toThrow();
  });

  it('respects a custom limit as the single-page fetch size', async () => {
    const { adapter, calls } = createDeferredFetchAdapter();
    getOrCreateTableStore(TABLE_ID, { columns });

    renderHook(() => useVirtualizedTableData({ adapter, tableId: TABLE_ID, columns, limit: 2500 }));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.params.pagination).toEqual({ page: 1, limit: 2500 });
  });
});
