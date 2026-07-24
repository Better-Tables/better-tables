import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';
import type { ColumnDefinition, PaginationState, TableAdapter } from '@better-tables/core';
import { clearAllTableStores, getOrCreateTableStore, getTableStore } from '@better-tables/core';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useMemo } from 'react';
import { BetterTable } from '../../src/components/table/table';
import { useFacets } from '../../src/hooks/use-facets';
import { useTableData } from '../../src/hooks/use-table-data';
import { useTableFilters, useTablePagination } from '../../src/hooks/use-table-store';
import { useTableUrlSync } from '../../src/hooks/use-table-url-sync';
import { createCountingAdapter } from '../helpers/stub-adapter';
import { createFakeUrlAdapter } from '../helpers/url-sync';

/**
 * Plan 063 Step 1 — interaction-cost gates.
 *
 * Pins the EXACT downstream cost of each user interaction in the library's
 * client wiring (useTableData + useTableUrlSync + useFacets + BetterTable):
 * adapter fetches, facet requests, and URL writes are counted per
 * interaction and asserted as integers. Every number is the POST-lag-fix
 * contract (leading-edge URL writes, batched facets); a change to any of
 * them is a performance regression (or a deliberate contract change that
 * must update the number here, with a comment citing why).
 */

type Row = { id: string };

const COLUMNS: ColumnDefinition<Row>[] = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row) => row.id,
    filterable: true,
  },
  {
    id: 'status',
    displayName: 'Status',
    type: 'option',
    accessor: () => 'a',
    filterable: true,
  },
];

// K = 2 option facets, R = 1 range facet — the sidebar shape the batch
// contract is asserted against.
const FACET_IDS = ['status', 'name'];
const RANGE_IDS = ['reopens'];

const COOLDOWN_MS = 150;

function CostHarness({
  tableId,
  adapter,
  urlAdapter,
}: {
  tableId: string;
  adapter: TableAdapter<Row>;
  urlAdapter: ReturnType<typeof createFakeUrlAdapter>['adapter'];
}) {
  const { filters } = useTableFilters(tableId);
  const { pagination } = useTablePagination(tableId);

  // Key the fetch strictly on page/limit: the store's pagination object also
  // changes when totals sync back after a fetch, and that must not count as
  // (or trigger) another fetch.
  const fetchPagination = useMemo<PaginationState>(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    }),
    [pagination.page, pagination.limit]
  );

  const { data, loading, totalCount } = useTableData<Row>({
    adapter,
    filters,
    pagination: fetchPagination,
    // useTableData takes ColumnDefinition<unknown>[] (it only reads derived
    // specs); the row generic is irrelevant to that read.
    columns: COLUMNS as unknown as ColumnDefinition[],
  });

  useTableUrlSync(tableId, { filters: true, pagination: true, sorting: true }, urlAdapter);

  useFacets({
    adapter,
    columnIds: FACET_IDS,
    rangeColumnIds: RANGE_IDS,
    filters,
  });

  return (
    <BetterTable
      id={tableId}
      name="Interaction cost"
      columns={COLUMNS}
      data={data}
      loading={loading}
      totalCount={totalCount}
      features={{ pagination: true, filtering: true, sorting: true }}
    />
  );
}

function createStore(tableId: string) {
  return getOrCreateTableStore(tableId, {
    columns: COLUMNS,
    config: { pagination: { defaultPageSize: 10 } },
  });
}

async function mountSettled(tableId: string, options?: { batchFacets?: boolean }) {
  const counting = createCountingAdapter({
    totalRows: 25,
    batchFacets: options?.batchFacets ?? true,
  });
  const fakeUrl = createFakeUrlAdapter();
  createStore(tableId);
  render(<CostHarness tableId={tableId} adapter={counting.adapter} urlAdapter={fakeUrl.adapter} />);
  // Settle the mount: initial fetch resolved (25 rows → 3 pages, Next
  // enabled) and the initial facet load done.
  await waitFor(() => {
    expect(counting.fetchCalls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Next page')).toBeTruthy();
  });
  await act(async () => {});
  return { counting, fakeUrl };
}

/** Snapshot the counters so per-interaction assertions are deltas. */
function baseline(
  counting: ReturnType<typeof createCountingAdapter>,
  fakeUrl: ReturnType<typeof createFakeUrlAdapter>
) {
  return {
    fetches: counting.fetchCalls.length,
    batches: counting.batchCalls.length,
    singularFacets: counting.facetCalls.length + counting.rangeCalls.length,
    urlWrites: fakeUrl.setParamsCalls.length,
  };
}

describe('interaction cost gates (plan 063 Step 1)', () => {
  beforeEach(() => {
    clearAllTableStores();
  });
  afterEach(() => {
    cleanup();
    clearAllTableStores();
    jest.useRealTimers();
  });

  it('mount: exactly 1 fetch + 1 batched facet call (carrying K=2 values + R=1 minmax), 0 URL writes', async () => {
    const tableId = 'cost-mount';
    const { counting, fakeUrl } = await mountSettled(tableId);

    expect(counting.fetchCalls).toHaveLength(1);
    expect(counting.batchCalls).toHaveLength(1);
    expect(counting.batchCalls[0]?.requests).toEqual([
      { columnId: 'status', kind: 'values' },
      { columnId: 'name', kind: 'values' },
      { columnId: 'reopens', kind: 'minmax' },
    ]);
    // The batch path must fully replace the singular per-column calls.
    expect(counting.facetCalls).toHaveLength(0);
    expect(counting.rangeCalls).toHaveLength(0);
    // A clean URL stays clean on mount — no write, no navigation.
    expect(fakeUrl.setParamsCalls).toHaveLength(0);
  });

  it('one pagination click: 1 fetch, 0 facet calls, 1 SYNCHRONOUS URL write', async () => {
    const tableId = 'cost-page-click';
    const { counting, fakeUrl } = await mountSettled(tableId);
    const before = baseline(counting, fakeUrl);

    // Freeze timers: the URL write must happen on the leading edge — if it
    // needed the 150 ms cooldown timer, this assertion would see zero.
    jest.useFakeTimers();
    act(() => {
      screen.getByLabelText('Next page').click();
    });

    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(1);
    expect(fakeUrl.setParamsCalls.at(-1)?.page).toBe('2');
    jest.useRealTimers();

    await waitFor(() => {
      // Exactly one refetch, for page 2 — and no facet traffic (filters
      // didn't change, so a pagination click must never refire facets).
      expect(counting.fetchCalls.length - before.fetches).toBe(1);
    });
    expect(counting.fetchCalls.at(-1)?.pagination?.page).toBe(2);
    expect(counting.batchCalls.length - before.batches).toBe(0);
    expect(counting.facetCalls.length + counting.rangeCalls.length).toBe(before.singularFacets);
  });

  it('rapid double pagination click: first write immediate, second coalesced — 2 writes, 2 fetches, 0 facet calls', async () => {
    const tableId = 'cost-double-click';
    const { counting, fakeUrl } = await mountSettled(tableId);
    const before = baseline(counting, fakeUrl);

    jest.useFakeTimers();
    // Two separate acts so the second click sees the re-rendered button
    // (inside one act both clicks would read the same stale `currentPage`
    // and the second would be a store no-op). Timers stay frozen, so both
    // land inside one 150 ms cooldown window.
    act(() => {
      screen.getByLabelText('Next page').click();
    });
    act(() => {
      screen.getByLabelText('Next page').click();
    });
    // Leading write fired for the first click only.
    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(1);
    expect(fakeUrl.setParamsCalls.at(-1)?.page).toBe('2');

    await act(async () => {
      jest.advanceTimersByTime(COOLDOWN_MS);
    });
    jest.useRealTimers();

    // Trailing write carries the burst's final state (page 3).
    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(2);
    expect(fakeUrl.setParamsCalls.at(-1)?.page).toBe('3');

    await waitFor(() => {
      // One fetch per real page change (the first may be aborted by the
      // second — it still counts as issued work).
      expect(counting.fetchCalls.length - before.fetches).toBe(2);
    });
    expect(counting.batchCalls.length - before.batches).toBe(0);
  });

  it('page-size change: 1 fetch, 1 immediate URL write, 0 facet calls', async () => {
    const tableId = 'cost-page-size';
    const { counting, fakeUrl } = await mountSettled(tableId);
    const before = baseline(counting, fakeUrl);
    const store = getTableStore(tableId);
    if (!store) throw new Error('store missing');

    jest.useFakeTimers();
    act(() => {
      // 20 is on the manager's allowed page-size list (10/20/50/100).
      store.getState().setPageSize(20);
    });
    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(1);
    expect(fakeUrl.setParamsCalls.at(-1)?.limit).toBe('20');
    jest.useRealTimers();

    await waitFor(() => {
      expect(counting.fetchCalls.length - before.fetches).toBe(1);
    });
    expect(counting.fetchCalls.at(-1)?.pagination?.limit).toBe(20);
    expect(counting.batchCalls.length - before.batches).toBe(0);
  });

  it('filter commit: 1 fetch, 1 batched facet refresh, 1 immediate URL write', async () => {
    const tableId = 'cost-filter-commit';
    const { counting, fakeUrl } = await mountSettled(tableId);
    const before = baseline(counting, fakeUrl);
    const store = getTableStore(tableId);
    if (!store) throw new Error('store missing');

    jest.useFakeTimers();
    act(() => {
      store
        .getState()
        .setFilters([{ columnId: 'name', type: 'text', operator: 'contains', values: ['alpha'] }]);
    });
    // Leading-edge write carries the filter — no 150 ms floor on a commit.
    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(1);
    expect(fakeUrl.setParamsCalls.at(-1)?.filters).toBeTruthy();
    jest.useRealTimers();

    await waitFor(() => {
      expect(counting.fetchCalls.length - before.fetches).toBe(1);
      // Exactly ONE batched facet refresh for the whole sidebar.
      expect(counting.batchCalls.length - before.batches).toBe(1);
    });
    expect(counting.facetCalls).toHaveLength(0);
    expect(counting.rangeCalls).toHaveLength(0);
  });

  it('adding a filter with EMPTY values: characterized cost (pinned)', async () => {
    const tableId = 'cost-empty-filter';
    const { counting, fakeUrl } = await mountSettled(tableId);
    const before = baseline(counting, fakeUrl);
    const store = getTableStore(tableId);
    if (!store) throw new Error('store missing');

    act(() => {
      // What FilterBar's handleAddFilter dispatches before any value is
      // chosen (filter-bar.tsx builds `values: []`).
      store.getState().addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: [],
      });
    });
    await act(async () => {});

    // CHARACTERIZATION: an empty-values filter still changes the filters
    // array identity/content, so today it costs one refetch and one facet
    // refresh before the user has typed anything — and the URL serializer
    // KEEPS valueless filters, so the URL changes too.
    // FINDING: in a server-driven app (Next.js demos) that URL write is a
    // real RSC navigation for a filter that cannot narrow anything yet;
    // skipping fetch/serialize until a value commits would save one
    // round-trip per added filter chip. Pinned as-is; update these numbers
    // alongside any such fix.
    expect(counting.fetchCalls.length - before.fetches).toBe(1);
    expect(counting.batchCalls.length - before.batches).toBe(1);
    expect(fakeUrl.setParamsCalls.length - before.urlWrites).toBe(1);
  });

  it('singular fallback (adapter without getFacets): filter commit costs exactly K+R per-column calls', async () => {
    const tableId = 'cost-singular-facets';
    const { counting, fakeUrl } = await mountSettled(tableId, { batchFacets: false });
    const before = baseline(counting, fakeUrl);
    const store = getTableStore(tableId);
    if (!store) throw new Error('store missing');

    act(() => {
      store
        .getState()
        .setFilters([{ columnId: 'name', type: 'text', operator: 'contains', values: ['alpha'] }]);
    });

    await waitFor(() => {
      expect(counting.fetchCalls.length - before.fetches).toBe(1);
      // K = 2 getFacetedValues + R = 1 getMinMaxValues, exactly once each.
      expect(counting.facetCalls.length + counting.rangeCalls.length - before.singularFacets).toBe(
        3
      );
    });
    expect(counting.batchCalls).toHaveLength(0);
  });
});
