import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  clearAllTableStores,
  getOrCreateTableStore,
  getTableStore,
  type UrlSyncConfig,
} from '@better-tables/core';
import { useTableUrlSync } from '../../src/hooks/use-table-url-sync';
import { createFakeUrlAdapter, mockColumns, urlFilterForName } from '../helpers/url-sync';

const TABLE_ID = 'url-sync-test-table';

beforeEach(() => {
  clearAllTableStores();
});

afterEach(() => {
  clearAllTableStores();
});

function createStore() {
  return getOrCreateTableStore(TABLE_ID, {
    columns: mockColumns,
    config: { pagination: { defaultPageSize: 10 } },
  });
}

describe('useTableUrlSync', () => {
  it('does not call setParams after unmount when a debounced update was queued', async () => {
    createStore();
    const { adapter, setParamsCalls } = createFakeUrlAdapter();
    const config: UrlSyncConfig = { filters: true };

    const { unmount } = renderHook(() => useTableUrlSync(TABLE_ID, config, adapter));

    await waitFor(() => expect(getTableStore(TABLE_ID)).toBeDefined());

    const store = getTableStore(TABLE_ID)!;
    const callsBeforeChange = setParamsCalls.length;

    act(() => {
      store.getState().manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['queued'],
      });
    });

    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(setParamsCalls.length - callsBeforeChange).toBe(0);
  });

  it('hydrates filters from the URL when the table store is created after mount', async () => {
    const filtersParam = urlFilterForName('late-store');
    const { adapter } = createFakeUrlAdapter({ filters: filtersParam });
    const config: UrlSyncConfig = { filters: true };

    renderHook(() => useTableUrlSync(TABLE_ID, config, adapter));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      createStore();
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    const store = getTableStore(TABLE_ID);
    expect(store).toBeDefined();
    const filters = store!.getState().manager.getFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0]?.values).toEqual(['late-store']);
  });

  it('does not re-subscribe when config values are unchanged across re-renders', async () => {
    createStore();
    const { adapter } = createFakeUrlAdapter();
    let subscribeCount = 0;

    const manager = getTableStore(TABLE_ID)!.getState().manager;
    const originalSubscribe = manager.subscribe.bind(manager);
    manager.subscribe = (listener) => {
      subscribeCount += 1;
      return originalSubscribe(listener);
    };

    function TestComponent({ tick }: { tick: number }) {
      useTableUrlSync(
        TABLE_ID,
        {
          filters: true,
          pagination: true,
        },
        adapter
      );
      return <span data-testid="tick">{tick}</span>;
    }

    const { rerender } = render(<TestComponent tick={0} />);

    await waitFor(() => expect(subscribeCount).toBe(1));

    for (let i = 1; i < 5; i++) {
      rerender(<TestComponent tick={i} />);
    }

    expect(subscribeCount).toBe(1);
  });
});
