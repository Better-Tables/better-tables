import { describe, expect, it, jest } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFacets } from '../../src/hooks/use-facets';
import {
  createDeferredFetchAdapter,
  createSelfExclusionFacetAdapter,
} from '../helpers/stub-adapter';

interface Ticket {
  id: string;
  status: string;
  priority: string;
  reopenCount: number;
}

const tickets: Ticket[] = [
  { id: '1', status: 'open', priority: 'high', reopenCount: 0 },
  { id: '2', status: 'open', priority: 'low', reopenCount: 2 },
  { id: '3', status: 'closed', priority: 'high', reopenCount: 1 },
  { id: '4', status: 'closed', priority: 'low', reopenCount: 5 },
];

describe('useFacets (plan 032 step 4, finding 7)', () => {
  it('passes the full filters array through, unmodified, for every configured column', async () => {
    const { adapter, facetCalls, rangeCalls } = createDeferredFetchAdapter();
    const filters: FilterState[] = [
      { columnId: 'status', type: 'text', operator: 'contains', values: ['open'] },
    ];

    renderHook(() =>
      useFacets({
        adapter,
        columnIds: ['status', 'priority'],
        rangeColumnIds: ['reopenCount'],
        filters,
      })
    );

    await waitFor(() => {
      expect(facetCalls.length).toBe(2);
      expect(rangeCalls.length).toBe(1);
    });

    // The hook must NOT strip/modify the caller's filters per column --
    // self-exclusion is the adapter's job (see FacetQueryParams docs), not
    // this hook's. Every call gets the SAME, complete filters array.
    for (const call of [...facetCalls, ...rangeCalls]) {
      expect(call.params?.filters).toBe(filters);
    }

    const statusCall = facetCalls.find((c) => c.columnId === 'status');
    const priorityCall = facetCalls.find((c) => c.columnId === 'priority');
    const rangeCall = rangeCalls.find((c) => c.columnId === 'reopenCount');
    expect(statusCall).toBeDefined();
    expect(priorityCall).toBeDefined();
    expect(rangeCall).toBeDefined();
  });

  it('converts the adapter Map<string, number> into a facets Record<string, FacetOption[]>', async () => {
    const { adapter } = createSelfExclusionFacetAdapter(tickets);

    const { result } = renderHook(() =>
      useFacets({
        adapter,
        columnIds: ['priority'],
        filters: [],
      })
    );

    await waitFor(() => expect(result.current.facets.priority).toBeDefined());

    const priorityOptions = [...(result.current.facets.priority ?? [])].sort((a, b) =>
      a.value.localeCompare(b.value)
    );
    expect(priorityOptions).toEqual([
      { value: 'high', count: 2 },
      { value: 'low', count: 2 },
    ]);
  });

  it('proves self-exclusion works through the hook: a status filter does not narrow the status facet itself, but DOES narrow the priority facet', async () => {
    const { adapter } = createSelfExclusionFacetAdapter(tickets);

    // Filtering status = 'open' should narrow OTHER columns' facets (e.g.
    // priority, among open tickets) but leave the status facet itself
    // showing every status option at its true (unfiltered) count -- that's
    // self-exclusion, and it must hold with the hook passing `filters`
    // through as-is.
    const filters: FilterState[] = [
      { columnId: 'status', type: 'text', operator: 'contains', values: ['open'] },
    ];

    const { result } = renderHook(() =>
      useFacets({
        adapter,
        columnIds: ['status', 'priority'],
        filters,
      })
    );

    await waitFor(() => {
      expect(result.current.facets.status).toBeDefined();
      expect(result.current.facets.priority).toBeDefined();
    });

    const statusOptions = [...(result.current.facets.status ?? [])].sort((a, b) =>
      a.value.localeCompare(b.value)
    );
    // Self-exclusion: status's own filter is excluded when computing the
    // status facet, so BOTH statuses still show their true, unfiltered
    // counts (2 open, 2 closed) -- not just the selected 'open' bucket.
    expect(statusOptions).toEqual([
      { value: 'closed', count: 2 },
      { value: 'open', count: 2 },
    ]);

    const priorityOptions = [...(result.current.facets.priority ?? [])].sort((a, b) =>
      a.value.localeCompare(b.value)
    );
    // priority IS narrowed by the active status = 'open' filter: only
    // tickets 1 (high) and 2 (low) are open.
    expect(priorityOptions).toEqual([
      { value: 'high', count: 1 },
      { value: 'low', count: 1 },
    ]);
  });

  it('refetches when filters change', async () => {
    const { adapter } = createSelfExclusionFacetAdapter(tickets);

    const { result, rerender } = renderHook(
      ({ filters }: { filters: FilterState[] }) =>
        useFacets({ adapter, columnIds: ['priority'], filters }),
      { initialProps: { filters: [] as FilterState[] } }
    );

    await waitFor(() => expect(result.current.facets.priority).toBeDefined());
    const initialPriority = [...(result.current.facets.priority ?? [])].sort((a, b) =>
      a.value.localeCompare(b.value)
    );
    expect(initialPriority).toEqual([
      { value: 'high', count: 2 },
      { value: 'low', count: 2 },
    ]);

    const statusOpenFilter: FilterState[] = [
      { columnId: 'status', type: 'text', operator: 'contains', values: ['open'] },
    ];
    rerender({ filters: statusOpenFilter });

    await waitFor(() => {
      const priority = [...(result.current.facets.priority ?? [])].sort((a, b) =>
        a.value.localeCompare(b.value)
      );
      expect(priority).toEqual([
        { value: 'high', count: 1 },
        { value: 'low', count: 1 },
      ]);
    });
  });

  it('does not fetch when no columnIds/rangeColumnIds are configured', async () => {
    const { adapter, facetCalls, rangeCalls } = createDeferredFetchAdapter();

    renderHook(() => useFacets({ adapter, filters: [] }));

    jest.useFakeTimers();
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    jest.useRealTimers();
    expect(facetCalls.length).toBe(0);
    expect(rangeCalls.length).toBe(0);
  });

  it('distinguishes column id lists that would collide under space-joining', async () => {
    const { adapter, facetCalls } = createDeferredFetchAdapter();

    const { rerender } = renderHook(
      ({ columnIds }: { columnIds: string[] }) => useFacets({ adapter, columnIds, filters: [] }),
      { initialProps: { columnIds: ['foo', 'bar baz'] } }
    );

    await waitFor(() => expect(facetCalls.length).toBe(2));
    expect(facetCalls.map((c) => c.columnId).sort()).toEqual(['bar baz', 'foo']);

    rerender({ columnIds: ['foo bar', 'baz'] });

    await waitFor(() => expect(facetCalls.length).toBe(4));
    expect(
      facetCalls
        .slice(2)
        .map((c) => c.columnId)
        .sort()
    ).toEqual(['baz', 'foo bar']);
  });
});
