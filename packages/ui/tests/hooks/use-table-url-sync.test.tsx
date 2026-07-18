import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';
import {
  clearAllTableStores,
  getOrCreateTableStore,
  getTableStore,
  type UrlSyncConfig,
} from '@better-tables/core';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useTableFilters } from '../../src/hooks/use-table-store';
import { useTableUrlSync } from '../../src/hooks/use-table-url-sync';
import { createFakeUrlAdapter, mockColumns, urlFilterForName } from '../helpers/url-sync';

const TABLE_ID = 'url-sync-test-table';

beforeEach(() => {
  clearAllTableStores();
});

afterEach(() => {
  clearAllTableStores();
  jest.useRealTimers();
});

function createStore() {
  return getOrCreateTableStore(TABLE_ID, {
    columns: mockColumns,
    config: { pagination: { defaultPageSize: 10 } },
  });
}

async function advanceFakeTimers(ms: number) {
  jest.useFakeTimers();
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  jest.useRealTimers();
}

describe('useTableUrlSync', () => {
  it('does not call setParams after unmount when a debounced update was queued', async () => {
    createStore();
    const { adapter, setParamsCalls } = createFakeUrlAdapter();
    const config: UrlSyncConfig = { filters: true };

    const { unmount } = renderHook(() => useTableUrlSync(TABLE_ID, config, adapter));

    await waitFor(() => expect(getTableStore(TABLE_ID)).toBeDefined());

    const store = getTableStore(TABLE_ID);
    expect(store).toBeDefined();
    if (!store) {
      throw new Error('Expected table store');
    }
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

    await advanceFakeTimers(200);

    expect(setParamsCalls.length - callsBeforeChange).toBe(0);
  });

  it('hydrates filters from the URL when the table store is created after mount', async () => {
    const filtersParam = urlFilterForName('late-store');
    const { adapter } = createFakeUrlAdapter({ filters: filtersParam });
    const config: UrlSyncConfig = { filters: true };

    renderHook(() => useTableUrlSync(TABLE_ID, config, adapter));

    jest.useFakeTimers();
    await act(async () => {
      jest.advanceTimersByTime(50);
      createStore();
      jest.advanceTimersByTime(300);
    });
    jest.useRealTimers();

    const store = getTableStore(TABLE_ID);
    expect(store).toBeDefined();
    if (!store) {
      throw new Error('Expected table store');
    }
    const filters = store.getState().manager.getFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0]?.values).toEqual(['late-store']);
  });

  it('does not re-subscribe when config values are unchanged across re-renders', async () => {
    createStore();
    const { adapter } = createFakeUrlAdapter();
    let subscribeCount = 0;

    const tableStore = getTableStore(TABLE_ID);
    expect(tableStore).toBeDefined();
    if (!tableStore) {
      throw new Error('Expected table store');
    }
    const manager = tableStore.getState().manager;
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

  it('re-hydrates the store and filter-bar chips after a post-mount URL change (soft nav), with no write-back loop', async () => {
    createStore();
    const filtersA = urlFilterForName('alpha');
    const filtersB = urlFilterForName('bravo');
    const { adapter, params, setParamsCalls } = createFakeUrlAdapter({ filters: filtersA });
    const config: UrlSyncConfig = { filters: true };

    function TestComponent() {
      useTableUrlSync(TABLE_ID, config, adapter);
      const { filters } = useTableFilters(TABLE_ID);
      return (
        <div data-testid="chips">{filters.map((f) => String(f.values?.[0] ?? '')).join(',')}</div>
      );
    }

    const { rerender, getByTestId } = render(<TestComponent />);

    await waitFor(() => expect(getByTestId('chips').textContent).toBe('alpha'));

    const store = getTableStore(TABLE_ID);
    expect(store).toBeDefined();
    if (!store) {
      throw new Error('Expected table store');
    }

    params.set('filters', filtersB);
    rerender(<TestComponent />);

    await waitFor(() => expect(getByTestId('chips').textContent).toBe('bravo'));
    expect(store.getState().manager.getFilters()).toHaveLength(1);
    expect(store.getState().manager.getFilters()[0]?.values).toEqual(['bravo']);

    await advanceFakeTimers(250);
    const callsAfterSettling = setParamsCalls.length;

    await advanceFakeTimers(250);
    expect(setParamsCalls.length).toBe(callsAfterSettling);
  });

  it('coalesces rapid state changes into a single setParams call with the final state', async () => {
    createStore();
    const { adapter, setParamsCalls } = createFakeUrlAdapter();
    const config: UrlSyncConfig = { filters: true, pagination: true };

    renderHook(() => useTableUrlSync(TABLE_ID, config, adapter));

    await waitFor(() => expect(getTableStore(TABLE_ID)).toBeDefined());

    const store = getTableStore(TABLE_ID);
    expect(store).toBeDefined();
    if (!store) {
      throw new Error('Expected table store');
    }

    const callsBeforeBurst = setParamsCalls.length;

    act(() => {
      store.getState().manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['first'],
      });
      store.getState().manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['second'],
      });
      const pagination = store.getState().manager.getPagination();
      store.getState().manager.updateState({
        pagination: { ...pagination, page: 2 },
      });
    });

    await advanceFakeTimers(200);

    const burstCalls = setParamsCalls.slice(callsBeforeBurst);
    expect(burstCalls.length).toBe(1);
    expect(burstCalls[0]?.page).toBe('2');
  });
});
