/**
 * `useColumnOptions` covers the facet-fallback cache/state machine used by
 * the option editor and option filter input (see
 * `src/hooks/use-column-options.tsx` module docs). These tests target the
 * hook directly rather than through a leaf component so the cache-hit /
 * cancellation / column-switch behaviors are unambiguous.
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition, FilterOption } from '@better-tables/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  type ColumnOptionsAdapter,
  TableAdapterProvider,
  useColumnOptions,
} from '../../src/hooks/use-column-options';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  status: string;
}

function optionColumn(id: string, options?: FilterOption[]): ColumnDefinition<Row, unknown> {
  return {
    id,
    displayName: id,
    type: 'option',
    accessor: (row) => row.status,
    ...(options ? { filter: { options } } : {}),
  };
}

function makeAdapter(resolve: (columnId: string) => FilterOption[] | Error) {
  const getFilterOptions = mock(async (columnId: string) => {
    const result = resolve(columnId);
    if (result instanceof Error) throw result;
    return result;
  });
  const adapter: ColumnOptionsAdapter = { getFilterOptions };
  return { adapter, getFilterOptions };
}

/** An adapter whose fetch only resolves once `resolveFetch()` is called. */
function makeDeferredAdapter() {
  const resolvers = new Map<string, (options: FilterOption[]) => void>();
  const getFilterOptions = mock(
    (columnId: string) =>
      new Promise<FilterOption[]>((resolve) => {
        resolvers.set(columnId, resolve);
      })
  );
  const adapter: ColumnOptionsAdapter = { getFilterOptions };
  return {
    adapter,
    getFilterOptions,
    resolveFetch: (columnId: string, options: FilterOption[]) => {
      resolvers.get(columnId)?.(options);
    },
  };
}

function renderWithAdapter(
  adapter: ColumnOptionsAdapter | null,
  column: ColumnDefinition<Row, unknown>
) {
  return renderHook(
    (props: { column: ColumnDefinition<Row, unknown> }) => useColumnOptions(props.column),
    {
      initialProps: { column },
      wrapper: ({ children }) => (
        <TableAdapterProvider adapter={adapter}>{children}</TableAdapterProvider>
      ),
    }
  );
}

describe('useColumnOptions', () => {
  it('fetches once via the fallback path and resolves loading -> options', async () => {
    const FETCHED: FilterOption[] = [{ value: 'open', label: 'Open' }];
    const { adapter, getFilterOptions } = makeAdapter(() => FETCHED);

    const { result } = renderWithAdapter(adapter, optionColumn('status'));

    expect(result.current.loading).toBe(true);
    expect(result.current.options).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.options).toEqual(FETCHED);
    expect(getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('sync cache hit: a remount after the fetch has settled shows options with no loading flash', async () => {
    const FETCHED: FilterOption[] = [{ value: 'open', label: 'Open' }];
    const { adapter, getFilterOptions } = makeAdapter(() => FETCHED);

    const first = renderWithAdapter(adapter, optionColumn('status'));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    // Remount against the same (adapter, columnId): the module cache
    // already holds a settled value, so the very first render must read it
    // synchronously instead of starting at `loading: true` for a frame.
    const second = renderWithAdapter(adapter, optionColumn('status'));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.options).toEqual(FETCHED);

    // Still fetch-once: the cache hit must not trigger a second request.
    expect(getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('cancels the in-flight fetch on unmount (no post-unmount state update)', async () => {
    const { adapter, resolveFetch } = makeDeferredAdapter();

    const { result, unmount } = renderWithAdapter(adapter, optionColumn('status'));
    expect(result.current.loading).toBe(true);

    unmount();

    // Resolve after unmount -- if the effect's cleanup didn't guard against
    // this, React would warn/error about updating state on an unmounted
    // component, and this would surface as a thrown/unhandled rejection in
    // the test run.
    resolveFetch('status', [{ value: 'open', label: 'Open' }]);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("switching column.id never exposes the previous column's options", async () => {
    const { adapter, resolveFetch } = makeDeferredAdapter();

    const { result, rerender } = renderWithAdapter(adapter, optionColumn('status'));
    resolveFetch('status', [{ value: 'open', label: 'Status Open' }]);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.options).toEqual([{ value: 'open', label: 'Status Open' }]);
    });

    // Switch to a different column whose fetch has NOT resolved yet -- the
    // hook must immediately stop showing `status`'s options and go back to
    // a loading (or empty) state for `priority`, never a stale mix.
    rerender({ column: optionColumn('priority') });
    expect(result.current.loading).toBe(true);
    expect(result.current.options).toEqual([]);

    resolveFetch('priority', [{ value: 'high', label: 'Priority High' }]);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.options).toEqual([{ value: 'high', label: 'Priority High' }]);
    });
    // Never accidentally shows the other column's options.
    expect(result.current.options).not.toContainEqual({ value: 'open', label: 'Status Open' });
  });

  it('switching column.id back to an already-settled column reads it synchronously (no flash)', async () => {
    const { adapter, resolveFetch } = makeDeferredAdapter();

    const { result, rerender } = renderWithAdapter(adapter, optionColumn('status'));
    resolveFetch('status', [{ value: 'open', label: 'Status Open' }]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ column: optionColumn('priority') });
    resolveFetch('priority', [{ value: 'high', label: 'Priority High' }]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Switching back to `status`, whose fetch is already cached/settled,
    // must resolve synchronously rather than flashing "loading" again.
    rerender({ column: optionColumn('status') });
    expect(result.current.loading).toBe(false);
    expect(result.current.options).toEqual([{ value: 'open', label: 'Status Open' }]);
  });

  it('declared options short-circuit and never touch the fetch path', () => {
    const { adapter, getFilterOptions } = makeAdapter(() => [{ value: 'x', label: 'X' }]);
    const declared: FilterOption[] = [{ value: 'a', label: 'A' }];

    const { result } = renderWithAdapter(adapter, optionColumn('status', declared));

    expect(result.current.loading).toBe(false);
    expect(result.current.options).toEqual(declared);
    expect(getFilterOptions).not.toHaveBeenCalled();
  });

  it('without an adapter, the fallback is disabled and returns empty/non-loading', () => {
    const { result } = renderWithAdapter(null, optionColumn('status'));

    expect(result.current.loading).toBe(false);
    expect(result.current.options).toEqual([]);
  });

  it('a failed fetch resolves to an empty list rather than staying loading forever', async () => {
    const { adapter } = makeAdapter(() => new Error('facet endpoint down'));

    const { result } = renderWithAdapter(adapter, optionColumn('status'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.options).toEqual([]);
  });
});
