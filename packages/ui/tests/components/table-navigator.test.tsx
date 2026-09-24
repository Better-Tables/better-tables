/**
 * <TableNavigator> (plan 065 Phase 5): lists every table from
 * `adapter.listTables()`, mounts a fully-typed `<BetterTable>` for the
 * selection with zero per-table code, and never leaks filter/column state
 * across a table switch. FK-click navigation (Phase 3) switches the
 * selected table.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnType, InferredColumnSpec, TableAdapter } from '@better-tables/core';
import { clearAllTableStores } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TableNavigator } from '../../src/components/table/table-navigator';

/** `listTables` required — every stub in this file implements it. */
type StubAdapter = TableAdapter<Record<string, unknown>> & {
  listTables: NonNullable<TableAdapter<Record<string, unknown>>['listTables']>;
};

const META = {
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
  supportedColumnTypes: ['text', 'number'] as ColumnType[],
  supportedOperators: {} as Record<ColumnType, never[]>,
};

const USERS_SPECS: InferredColumnSpec[] = [
  {
    field: 'id',
    columnType: 'number',
    label: 'Id',
    nullable: false,
    primaryKey: true,
    foreignKey: false,
    writable: false,
  },
  {
    field: 'name',
    columnType: 'text',
    label: 'Name',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
  {
    field: 'customerId',
    columnType: 'number',
    label: 'Customer Id',
    nullable: false,
    primaryKey: false,
    foreignKey: true,
    foreignKeyTarget: { table: 'customers', field: 'id' },
    writable: true,
  },
];

const CUSTOMERS_SPECS: InferredColumnSpec[] = [
  {
    field: 'id',
    columnType: 'number',
    label: 'Id',
    nullable: false,
    primaryKey: true,
    foreignKey: false,
    writable: false,
  },
  {
    field: 'company',
    columnType: 'text',
    label: 'Company',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
];

function makeAdapter() {
  const fetchCalls: Array<{ table: string; params: unknown }> = [];
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
    users: [{ id: 1, name: 'Alice', customerId: 42 }],
    customers: [{ id: 42, company: 'Acme' }],
  };
  const specsByTable: Record<string, InferredColumnSpec[]> = {
    users: USERS_SPECS,
    customers: CUSTOMERS_SPECS,
  };

  const adapter: StubAdapter = {
    meta: META,
    async fetchData(params) {
      const table = (params.primaryTable as string) ?? '';
      fetchCalls.push({ table, params });
      const rows = rowsByTable[table] ?? [];
      return {
        data: rows,
        total: rows.length,
        pagination: { page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    describeColumns: async (table) => specsByTable[table ?? ''] ?? [],
    listTables: async () => [
      { table: 'users', label: 'Users' },
      { table: 'customers', label: 'Customers' },
    ],
  };

  return { adapter, fetchCalls };
}

afterEach(() => {
  clearAllTableStores();
  cleanup();
});

describe('TableNavigator', () => {
  it('lists tables, auto-selects the first, and renders its inferred columns + data', async () => {
    const { adapter } = makeAdapter();
    render(<TableNavigator adapter={adapter} />);

    expect(await screen.findByRole('button', { name: 'Users' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customers' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Customer Id')).toBeTruthy();
  });

  it('switching tables mounts a fresh table with the new schema — no leaked columns', async () => {
    const { adapter } = makeAdapter();
    render(<TableNavigator adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Customers' }));

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeTruthy();
    });
    // The previous table's column/data must be gone, not merely hidden.
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByText('Customer Id')).toBeNull();
    expect(screen.getByText('Company')).toBeTruthy();
  });

  it('fetches with the correct primaryTable for the selected table', async () => {
    const { adapter, fetchCalls } = makeAdapter();
    render(<TableNavigator adapter={adapter} />);

    await waitFor(() => {
      expect(fetchCalls.some((c) => c.table === 'users')).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Customers' }));

    await waitFor(() => {
      expect(fetchCalls.some((c) => c.table === 'customers')).toBe(true);
    });
  });

  it('clicking a resolved FK column navigates the navigator to the target table', async () => {
    const { adapter } = makeAdapter();
    render(<TableNavigator adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '42' }));

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Customers' }).getAttribute('aria-current')).toBe(
      'true'
    );
  });

  it('switching tables resets an applied filter and sort — the reset must be atomic with the selection change', async () => {
    const { adapter, fetchCalls } = makeAdapter();
    // `headerContextMenu` opts into the `aria-sort`-carrying column header
    // rendering path, so this test can observe sort state through the DOM.
    render(
      <TableNavigator
        adapter={adapter}
        tableProps={{ features: { headerContextMenu: { enabled: true, showSortToggle: true } } }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    // Apply a filter on 'users' via the FilterBar's Add Filter flow — this
    // trigger has an explicit `role="combobox"` (a popover trigger) and its
    // accessible name comes from `aria-label="Filter input"`, not its
    // visible "Add filter" text.
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter input' }));
    // Scoped to `option` (not `getByText`): the grid's own "Name" column
    // header is already on screen and would otherwise make the match
    // ambiguous.
    fireEvent.click(screen.getByRole('option', { name: 'Name' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeTruthy();
    });

    // Apply a sort on 'users' by clicking its sortable column header.
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ });
    fireEvent.click(nameHeader);
    await waitFor(() => {
      expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Customers' }));

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeTruthy();
    });

    // 'customers' must mount with no carried-over filter or sort in its own
    // UI...
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
    const companyHeader = screen.getByRole('columnheader', { name: /Company/ });
    expect(companyHeader.getAttribute('aria-sort')).toBe('none');

    // ...and — the real-world consequence of a non-atomic reset — must never
    // have been FETCHED with 'users' leftover sort/filter state either. A
    // reset that lands one render after `selectedTable` changes still lets
    // `<BetterTable>` mount and fetch once with the stale values before
    // self-correcting; that extra, wrong fetch is the actual bug (a
    // reset that's merely "eventually correct" still shows the wrong data
    // for a beat, and does one wasted/incorrect network round-trip).
    const customersFetches = fetchCalls.filter((c) => c.table === 'customers');
    expect(customersFetches.length).toBeGreaterThan(0);
    for (const call of customersFetches) {
      const params = call.params as { filters?: unknown[]; sorting?: unknown[] };
      expect(params.filters).toEqual([]);
      expect(params.sorting).toEqual([]);
    }
  });

  it('shows an error when listTables fails, without crashing', async () => {
    const adapter: StubAdapter = {
      meta: META,
      async fetchData() {
        return {
          data: [],
          total: 0,
          pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
        };
      },
      getFilterOptions: async () => [],
      getFacetedValues: async () => new Map(),
      getMinMaxValues: async () => [0, 0],
      listTables: async () => {
        throw new Error('cannot introspect schema');
      },
    };

    render(<TableNavigator adapter={adapter} />);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'cannot introspect schema'
    );
  });
});
