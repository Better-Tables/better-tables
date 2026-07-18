import { afterEach, describe, expect, it } from 'bun:test';
import {
  clearAllTableStores,
  getTableStore,
  type ColumnDefinition,
} from '@better-tables/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row>[] = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row) => row.name,
    sortable: true,
  },
];

const rows: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
];

const TABLE_ID = 'table-interactions-test';

describe('BetterTable interactions (plan 042 step 4)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('cycles sort on repeated header clicks (asc → desc → cleared)', () => {
    render(
      <BetterTable
        id={TABLE_ID}
        columns={columns}
        data={rows}
        totalCount={30}
        virtualized={false}
        features={{ sorting: true, pagination: true, rowSelection: true }}
        initialPagination={{
          page: 1,
          limit: 10,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        }}
      />
    );

    const store = getTableStore(TABLE_ID);
    if (!store) throw new Error('Expected table store');

    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });

    fireEvent.click(nameHeader);
    expect(store.getState().sorting).toEqual([{ columnId: 'name', direction: 'asc' }]);

    fireEvent.click(nameHeader);
    expect(store.getState().sorting).toEqual([{ columnId: 'name', direction: 'desc' }]);

    fireEvent.click(nameHeader);
    expect(store.getState().sorting).toEqual([]);
  });

  it('select-all checkbox selects and clears every visible row id', () => {
    render(
      <BetterTable
        id={TABLE_ID}
        columns={columns}
        data={rows}
        totalCount={30}
        virtualized={false}
        features={{ sorting: true, pagination: true, rowSelection: true }}
      />
    );

    const store = getTableStore(TABLE_ID);
    if (!store) throw new Error('Expected table store');

    const selectAll = screen.getByRole('checkbox', { name: /select all rows/i });

    fireEvent.click(selectAll);
    expect(store.getState().selectedRows).toEqual(new Set(['1', '2', '3']));

    fireEvent.click(selectAll);
    expect(store.getState().selectedRows.size).toBe(0);
  });

  it('pagination Next advances the store page', () => {
    render(
      <BetterTable
        id={TABLE_ID}
        columns={columns}
        data={rows}
        totalCount={30}
        virtualized={false}
        features={{ sorting: true, pagination: true, rowSelection: true }}
        initialPagination={{
          page: 1,
          limit: 10,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        }}
      />
    );

    const store = getTableStore(TABLE_ID);
    if (!store) throw new Error('Expected table store');

    expect(store.getState().pagination.page).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(store.getState().pagination.page).toBe(2);
    expect(store.getState().pagination.hasPrev).toBe(true);
  });
});
