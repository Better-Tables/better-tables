/**
 * Cross-package integration: real Drizzle (bun:sqlite) + BetterTable / useTableData
 * (plan 043). Product `src/**` is not modified — tests + fixture helpers only.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  clearAllTableStores,
  defineTableRow,
  type FilterState,
  formatDateWithConfig,
  getTableStore,
} from '@better-tables/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { BetterTable } from '../../src/components/table/table';
import { useFacets } from '../../src/hooks/use-facets';
import { useTableData } from '../../src/hooks/use-table-data';
import { createIntegrationAdapter, SEEDED_CREATED_AT } from '../helpers/drizzle-sqlite-fixture';

type UserRow = {
  id: number;
  name: string;
  status: string;
  createdAt: Date;
};

const DATE_FORMAT = {
  format: 'MMM d, yyyy',
  locale: 'en-US',
  timeZone: 'UTC',
} as const;

const usersTable = defineTableRow<UserRow>()('users', (t) => ({
  columns: [
    t.text('name').displayName('Name').editable(),
    t
      .option('status')
      .displayName('Status')
      .options([
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ])
      .editable(),
    t.date('createdAt').displayName('Joined').format(DATE_FORMAT.format, {
      locale: DATE_FORMAT.locale,
      timeZone: DATE_FORMAT.timeZone,
    }),
  ],
}));

const TABLE_ID = 'integration-drizzle';

/** Stable pagination — a fresh object literal would retrigger useTableData forever. */
const PAGINATION = {
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
} as const;

const FACET_COLUMN_IDS = ['status'];

function IntegrationHarness({
  adapter,
  filters,
}: {
  adapter: Awaited<ReturnType<typeof createIntegrationAdapter>>;
  filters: FilterState[];
}) {
  const { data, loading, totalCount } = useTableData<UserRow>({
    adapter: adapter as never,
    filters,
    pagination: PAGINATION,
  });

  const { facets } = useFacets({
    adapter: adapter as never,
    columnIds: FACET_COLUMN_IDS,
    filters,
  });

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="total">{totalCount}</div>
      <div data-testid="facet-status">{JSON.stringify(facets.status ?? null)}</div>
      <BetterTable
        id={TABLE_ID}
        table={usersTable}
        data={data}
        adapter={adapter as never}
        totalCount={totalCount}
        loading={loading}
        virtualized={false}
        features={{ filtering: true, sorting: true, pagination: true }}
      />
    </div>
  );
}

function FilterableIntegration({
  adapter,
}: {
  adapter: Awaited<ReturnType<typeof createIntegrationAdapter>>;
}) {
  const [filters, setFilters] = useState<FilterState[]>([]);
  return (
    <div>
      <button
        type="button"
        data-testid="apply-active-filter"
        onClick={() =>
          setFilters([
            {
              columnId: 'status',
              type: 'option',
              operator: 'is',
              values: ['active'],
            },
          ])
        }
      >
        Filter active
      </button>
      <IntegrationHarness adapter={adapter} filters={filters} />
    </div>
  );
}

describe('Drizzle + BetterTable integration (plan 043)', () => {
  let adapter: Awaited<ReturnType<typeof createIntegrationAdapter>>;

  beforeEach(async () => {
    adapter = await createIntegrationAdapter();
  });

  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders seeded rows from a real Drizzle fetch', async () => {
    render(<IntegrationHarness adapter={adapter} filters={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('total').textContent).toBe('3');
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
  });

  it('narrows rows when a filter is applied (real refetch)', async () => {
    render(<FilterableIntegration adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('3');
    });

    await act(async () => {
      screen.getByTestId('apply-active-filter').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('2');
    });

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('Carol')).toBeNull();
  });

  it('formats date cells (not raw ISO/epoch) and returns real facet counts', async () => {
    render(<IntegrationHarness adapter={adapter} filters={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    const expected = formatDateWithConfig(SEEDED_CREATED_AT, DATE_FORMAT);
    expect(expected.length).toBeGreaterThan(0);
    // Every seeded row shares the same createdAt — expect formatted cells.
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(1);
    // Raw epoch / ISO must not appear as the cell text.
    expect(screen.queryByText(String(SEEDED_CREATED_AT.getTime()))).toBeNull();
    expect(screen.queryByText(SEEDED_CREATED_AT.toISOString())).toBeNull();

    await waitFor(() => {
      const raw = screen.getByTestId('facet-status').textContent;
      expect(raw).not.toBe('null');
      const parsed = JSON.parse(raw ?? 'null') as Array<{ value: string; count: number }>;
      const byValue = Object.fromEntries(parsed.map((o) => [o.value, o.count]));
      expect(byValue.active).toBe(2);
      expect(byValue.inactive).toBe(1);
    });
  });

  it('commits an editable cell into sqlite and displays the new value (plan 053)', async () => {
    render(<IntegrationHarness adapter={adapter} filters={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    const nameCell = screen.getAllByRole('button', { name: /edit name/i })[0];
    if (!nameCell) throw new Error('expected editable name cell');
    fireEvent.doubleClick(nameCell);
    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'Alicia Updated' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('Alicia Updated')).toBeTruthy();
    });

    // Prove the write landed in sqlite via a fresh adapter read (same path as
    // the harness's useTableData — defaultPrimaryTable: 'users').
    const refetch = await adapter.fetchData({
      pagination: { page: 1, limit: 10 },
    } as never);
    const alice = refetch.data.find((r) => r.id === 1);
    expect(alice?.name).toBe('Alicia Updated');
  });

  it('renders a fully inferred auto-columns table against real bun:sqlite (plan 054)', async () => {
    // Fresh no-factory definition per test — resolveTableColumns memoizes
    // per (def, adapter) pair.
    const autoUsersTable = defineTableRow<UserRow>()('users');
    // Stable identity — a fresh [] every render would retrigger useTableData.
    const noFilters: FilterState[] = [];

    function AutoHarness() {
      const { data, loading } = useTableData<UserRow>({
        adapter: adapter as never,
        filters: noFilters,
        pagination: PAGINATION,
      });
      return (
        <BetterTable
          id="auto-users"
          table={autoUsersTable}
          data={data}
          adapter={adapter as never}
          loading={loading}
        />
      );
    }

    render(<AutoHarness />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    // Inferred, humanized headers from real Drizzle schema introspection.
    expect(screen.getByText('Id')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Created At')).toBeTruthy();

    // The enum column carried its choices through describeColumns.
    const store = getTableStore('auto-users');
    const statusColumn = store?.getState().columns.find((column) => column.id === 'status');
    expect(statusColumn?.type).toBe('option');
    expect(statusColumn?.filter?.options).toEqual([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ]);

    // Inferred columns are read-only — no editable affordance without an
    // explicit override.
    expect(screen.queryByRole('button', { name: /edit name/i })).toBeNull();
  });

  it('rolls back the display when updateRecord fails (plan 053)', async () => {
    const originalUpdate = adapter.updateRecord?.bind(adapter);
    adapter.updateRecord = mock(async () => {
      throw new Error('constraint failed');
    });

    try {
      render(<IntegrationHarness adapter={adapter} filters={[]} />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      expect(screen.getByText('Alice')).toBeTruthy();
      const nameCell = screen.getAllByRole('button', { name: /edit name/i })[0];
      if (!nameCell) throw new Error('expected editable name cell');
      fireEvent.doubleClick(nameCell);
      const input = screen.getByRole('textbox', { name: /edit cell/i });
      fireEvent.change(input, { target: { value: 'Should Rollback' } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeTruthy();
        expect(screen.queryByText('Should Rollback')).toBeNull();
      });
    } finally {
      if (originalUpdate) {
        adapter.updateRecord = originalUpdate;
      }
    }
  });
});
