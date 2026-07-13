import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import type { FetchDataParams, FilterState } from '@better-tables/core';
import { useTableData } from '../../src/hooks/use-table-data';
import { createDeferredFetchAdapter, makeFetchResult } from '../helpers/stub-adapter';

const filterA: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: ['alice'] },
];

const filterB: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: ['bob'] },
];

function matchesFilters(params: FetchDataParams, filters: FilterState[]) {
  return JSON.stringify(params.filters) === JSON.stringify(filters);
}

function latestCallForFilters(
  calls: ReturnType<typeof createDeferredFetchAdapter>['calls'],
  filters: FilterState[]
) {
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    if (matchesFilters(calls[index].params, filters)) {
      return calls[index];
    }
  }
  return undefined;
}

describe('useTableData', () => {
  it('uses the newest fetch result when an older request resolves later (race)', async () => {
    const { adapter, calls } = createDeferredFetchAdapter();

    const { result, rerender } = renderHook(
      ({ filters }: { filters: FilterState[] }) => useTableData({ adapter, filters }),
      { initialProps: { filters: filterA } }
    );

    await waitFor(() => {
      expect(latestCallForFilters(calls, filterA)).toBeDefined();
    });

    rerender({ filters: filterB });

    await waitFor(() => {
      expect(latestCallForFilters(calls, filterB)).toBeDefined();
    });

    const fastCall = latestCallForFilters(calls, filterB)!;
    const slowCall = latestCallForFilters(calls, filterA)!;

    await act(async () => {
      fastCall.deferred.resolve(makeFetchResult([{ id: 'bob' }]));
    });

    await waitFor(() => expect(result.current.data).toEqual([{ id: 'bob' }]));

    await act(async () => {
      slowCall.deferred.resolve(makeFetchResult([{ id: 'alice' }]));
    });

    expect(result.current.data).toEqual([{ id: 'bob' }]);
  });

  it('passes an AbortSignal to fetchData and aborts the previous in-flight request', async () => {
    const { adapter, calls } = createDeferredFetchAdapter();

    const { rerender } = renderHook(
      ({ filters }: { filters: FilterState[] }) => useTableData({ adapter, filters }),
      { initialProps: { filters: filterA } }
    );

    await waitFor(() => {
      expect(latestCallForFilters(calls, filterA)).toBeDefined();
    });

    const firstCall = latestCallForFilters(calls, filterA)!;
    expect(firstCall.params.signal).toBeInstanceOf(AbortSignal);
    expect(firstCall.params.signal?.aborted).toBe(false);

    rerender({ filters: filterB });

    await waitFor(() => {
      expect(latestCallForFilters(calls, filterB)).toBeDefined();
    });

    const secondCall = latestCallForFilters(calls, filterB)!;
    expect(secondCall.params.signal).toBeInstanceOf(AbortSignal);
    expect(firstCall.params.signal?.aborted).toBe(true);
    expect(secondCall.params.signal?.aborted).toBe(false);
  });

  it('does not apply results after unmount', async () => {
    const { adapter, calls } = createDeferredFetchAdapter();
    const onUpdate = { count: 0 };

    const { unmount } = renderHook(() => {
      const result = useTableData({ adapter, filters: filterA });
      if (result.data.length > 0) {
        onUpdate.count += 1;
      }
      return result;
    });

    await waitFor(() => {
      expect(latestCallForFilters(calls, filterA)).toBeDefined();
    });

    const inFlight = latestCallForFilters(calls, filterA)!;
    unmount();

    await act(async () => {
      inFlight.deferred.resolve(makeFetchResult([{ id: 'late' }]));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onUpdate.count).toBe(0);
  });
});
