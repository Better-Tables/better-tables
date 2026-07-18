import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  type ColumnDefinition,
  type ColumnType,
  clearAllTableStores,
  getTableStore,
  type TableAdapter,
} from '@better-tables/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
  locked?: boolean;
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

function makeUpdateAdapter(
  updateRecord: NonNullable<TableAdapter<Row>['updateRecord']>
): TableAdapter<Row> {
  return {
    meta: {
      name: 'stub',
      version: 'test',
      features: {
        create: false,
        read: true,
        update: true,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text'] as ColumnType[],
      supportedOperators: { text: ['contains'] } as never,
    },
    fetchData: async () => ({
      data: rows,
      total: rows.length,
      pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    updateRecord,
  };
}

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

describe('BetterTable inline editing (plan 053 step 4)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  const editableColumns: ColumnDefinition<Row>[] = [
    {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (row) => row.name,
      editable: {
        when: (row) => !row.locked,
      },
    },
  ];

  const editableRows: Row[] = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob', locked: true },
  ];

  it('double-click opens editor; commit calls updateRecord and shows new value', async () => {
    const updateRecord = mock(async (_id: string, data: Partial<Row>) => ({
      id: '1',
      name: String(data.name),
    }));
    const adapter = makeUpdateAdapter(updateRecord);

    render(
      <BetterTable
        id={`${TABLE_ID}-edit`}
        columns={editableColumns}
        data={editableRows}
        adapter={adapter}
        virtualized={false}
        features={{ sorting: false, pagination: false, filtering: false }}
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /edit name/i }));
    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'Alicia' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(updateRecord).toHaveBeenCalledTimes(1);
    });
    expect(updateRecord.mock.calls[0]?.[0]).toBe('1');
    expect(updateRecord.mock.calls[0]?.[1]).toEqual({ name: 'Alicia' });
    expect(screen.getByText('Alicia')).toBeDefined();
  });

  it('Escape cancels without calling updateRecord', () => {
    const updateRecord = mock(async () => ({ id: '1', name: 'Alice' }));
    const adapter = makeUpdateAdapter(updateRecord);

    render(
      <BetterTable
        id={`${TABLE_ID}-escape`}
        columns={editableColumns}
        data={editableRows}
        adapter={adapter}
        virtualized={false}
        features={{ sorting: false, pagination: false, filtering: false }}
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /edit name/i }));
    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(updateRecord).not.toHaveBeenCalled();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('when: () => false rows are not editable', () => {
    const updateRecord = mock(async () => ({ id: '2', name: 'Bob' }));
    const adapter = makeUpdateAdapter(updateRecord);

    render(
      <BetterTable
        id={`${TABLE_ID}-when`}
        columns={editableColumns}
        data={editableRows}
        adapter={adapter}
        virtualized={false}
        features={{ sorting: false, pagination: false, filtering: false }}
      />
    );

    // Only Alice's cell should expose the editable button affordance.
    const editCells = screen.getAllByRole('button', { name: /edit name/i });
    expect(editCells).toHaveLength(1);
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('editing={false} disables all inline editors', () => {
    const adapter = makeUpdateAdapter(async () => ({ id: '1', name: 'Alice' }));

    render(
      <BetterTable
        id={`${TABLE_ID}-off`}
        columns={editableColumns}
        data={editableRows}
        adapter={adapter}
        editing={false}
        virtualized={false}
        features={{ sorting: false, pagination: false, filtering: false }}
      />
    );

    expect(screen.queryByRole('button', { name: /edit name/i })).toBeNull();
  });

  it('non-editable columns are unaffected', () => {
    const adapter = makeUpdateAdapter(async () => ({ id: '1', name: 'Alice' }));

    render(
      <BetterTable
        id={`${TABLE_ID}-plain`}
        columns={columns}
        data={rows}
        adapter={adapter}
        virtualized={false}
        features={{ sorting: false, pagination: false, filtering: false }}
      />
    );

    expect(screen.queryByRole('button', { name: /edit name/i })).toBeNull();
    expect(screen.getByText('Alice')).toBeDefined();
  });
});
