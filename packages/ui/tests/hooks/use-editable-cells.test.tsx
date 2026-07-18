import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition, ColumnType, TableAdapter } from '@better-tables/core';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  resolveColumnEditability,
  resolveEditableField,
  runValidationRules,
  useEditableCells,
} from '../../src/hooks/use-editable-cells';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  name: string;
  age: number;
  locked?: boolean;
}

function makeColumn(
  overrides: Partial<ColumnDefinition<Row>> & Pick<ColumnDefinition<Row>, 'id' | 'type'>
): ColumnDefinition<Row> {
  return {
    displayName: overrides.id,
    accessor: (row) => (row as unknown as Record<string, unknown>)[overrides.id] as never,
    ...overrides,
  };
}

function makeUpdateAdapter(
  updateRecord: NonNullable<TableAdapter<Row>['updateRecord']>
): TableAdapter<Row> {
  return {
    meta: {
      name: 'stub-update',
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
      data: [],
      total: 0,
      pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    updateRecord,
  };
}

describe('editable field / gating matrix (plan 053 step 5)', () => {
  it('resolves plain column ids as the storage field', () => {
    expect(resolveEditableField('name', {})).toBe('name');
    expect(resolveEditableField('name', { field: 'displayName' })).toBe('displayName');
    expect(resolveEditableField('customer.company', {})).toBeNull();
    expect(resolveEditableField('customer.company', { field: 'company' })).toBe('company');
  });

  it('covers the editability matrix rows', () => {
    const textCol = makeColumn({ id: 'name', type: 'text', editable: true });

    expect(
      resolveColumnEditability({
        editing: false,
        column: textCol,
        hasOnCellEdit: true,
      }).editable
    ).toBe(false);

    expect(
      resolveColumnEditability({
        column: makeColumn({ id: 'name', type: 'text' }),
        hasOnCellEdit: true,
      }).editable
    ).toBe(false);

    expect(
      resolveColumnEditability({
        column: textCol,
        hasOnCellEdit: true,
      })
    ).toMatchObject({ editable: true, savePath: 'callback' });

    const adapter = makeUpdateAdapter(async (_id, data) => ({
      id: '1',
      name: 'x',
      age: 1,
      ...data,
    }));
    expect(
      resolveColumnEditability({
        column: textCol,
        adapter,
        hasOnCellEdit: false,
      })
    ).toMatchObject({ editable: true, savePath: 'adapter', field: 'name' });

    expect(
      resolveColumnEditability({
        column: makeColumn({ id: 'customer.company', type: 'text', editable: true }),
        adapter,
        hasOnCellEdit: false,
      }).editable
    ).toBe(false);

    expect(
      resolveColumnEditability({
        column: makeColumn({ id: 'tags', type: 'multiOption', editable: true }),
        hasOnCellEdit: true,
      }).editable
    ).toBe(false);
  });

  it('runValidationRules returns the first failure message', () => {
    expect(
      runValidationRules(
        [
          { id: 'min', validate: (v: string) => v.length >= 2 || 'too short' },
          { id: 'max', validate: () => false, message: 'too long' },
        ],
        'a'
      )
    ).toBe('too short');
    expect(runValidationRules([{ id: 'ok', validate: () => true }], 'ab')).toBeNull();
  });
});

describe('useEditableCells (plan 053 step 2)', () => {
  it('applies optimistic overlay immediately and clears saving on success', async () => {
    let resolveUpdate!: (value: Row) => void;
    const updatePromise = new Promise<Row>((resolve) => {
      resolveUpdate = resolve;
    });
    const updateRecord = mock((_id: string, _data: Partial<Row>) => updatePromise);
    const adapter = makeUpdateAdapter(updateRecord);
    const column = makeColumn({ id: 'name', type: 'text', editable: true });
    const row: Row = { id: '1', name: 'Alice', age: 30 };

    const { result } = renderHook(() => useEditableCells({ adapter }));

    let commitPromise!: Promise<void>;
    await act(async () => {
      commitPromise = result.current.commitEdit({
        row,
        rowId: '1',
        column,
        value: 'Alicia',
        previousValue: 'Alice',
      });
    });

    expect(result.current.getDisplayValue('1', 'name', 'Alice')).toBe('Alicia');
    expect(result.current.savingCells.has('1:name')).toBe(true);

    await act(async () => {
      resolveUpdate({ id: '1', name: 'Alicia', age: 30 });
      await commitPromise;
    });

    await waitFor(() => {
      expect(result.current.savingCells.has('1:name')).toBe(false);
    });
    expect(updateRecord).toHaveBeenCalledTimes(1);
    expect(updateRecord.mock.calls[0]?.[0]).toBe('1');
    expect(updateRecord.mock.calls[0]?.[1]).toEqual({ name: 'Alicia' });
    expect(result.current.getDisplayValue('1', 'name', 'Alice')).toBe('Alicia');
  });

  it('rolls back overlay, sets error, and calls onCellEditError on failure', async () => {
    const updateRecord = mock(async () => {
      throw new Error('boom');
    });
    const onCellEditError = mock(() => {});
    const adapter = makeUpdateAdapter(updateRecord);
    const column = makeColumn({ id: 'name', type: 'text', editable: true });
    const row: Row = { id: '1', name: 'Alice', age: 30 };

    const { result } = renderHook(() => useEditableCells({ adapter, onCellEditError }));

    await act(async () => {
      await result.current.commitEdit({
        row,
        rowId: '1',
        column,
        value: 'Nope',
        previousValue: 'Alice',
      });
    });

    expect(result.current.getDisplayValue('1', 'name', 'Alice')).toBe('Alice');
    expect(result.current.cellErrors.get('1:name')).toBe('boom');
    expect(onCellEditError).toHaveBeenCalledTimes(1);
    expect(result.current.savingCells.has('1:name')).toBe(false);
  });

  it('validation failure never calls the adapter', async () => {
    const updateRecord = mock(async () => ({ id: '1', name: 'x', age: 1 }));
    const adapter = makeUpdateAdapter(updateRecord);
    const column = makeColumn({
      id: 'name',
      type: 'text',
      editable: true,
      validation: [
        {
          id: 'min',
          validate: (v) => (typeof v === 'string' && v.length >= 3) || 'too short',
        },
      ],
    });
    const row: Row = { id: '1', name: 'Alice', age: 30 };

    const { result } = renderHook(() => useEditableCells<Row>({ adapter }));

    await act(async () => {
      await result.current.commitEdit({
        row,
        rowId: '1',
        column,
        value: 'ab',
        previousValue: 'Alice',
      });
    });

    expect(updateRecord).not.toHaveBeenCalled();
    expect(result.current.cellErrors.get('1:name')).toBe('too short');
    expect(result.current.activeEditKey).toBe('1:name');
  });

  it('callback path wins over adapter path when both are present', async () => {
    const updateRecord = mock(async () => ({ id: '1', name: 'x', age: 1 }));
    const onCellEdit = mock(async () => {});
    const adapter = makeUpdateAdapter(updateRecord);
    const column = makeColumn({ id: 'name', type: 'text', editable: true });
    const row: Row = { id: '1', name: 'Alice', age: 30 };

    const { result } = renderHook(() => useEditableCells({ adapter, onCellEdit }));

    await act(async () => {
      await result.current.commitEdit({
        row,
        rowId: '1',
        column,
        value: 'Bob',
        previousValue: 'Alice',
      });
    });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('warns once per column for non-resolvable save path', () => {
    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;

    const column = makeColumn({ id: 'name', type: 'text', editable: true });
    const { result } = renderHook(() => useEditableCells<Row>({ editing: true }));

    expect(result.current.isColumnPotentiallyEditable(column)).toBe(false);
    expect(result.current.isColumnPotentiallyEditable(column)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    console.warn = original;
  });

  it('passes tableName into adapter updateRecord options', async () => {
    const updateRecord = mock(
      async (_id: string, _data: Partial<Row>, _options?: { table?: string }) => ({
        id: '1',
        name: 'Zed',
        age: 1,
      })
    );
    const adapter = makeUpdateAdapter(updateRecord);
    const column = makeColumn({ id: 'name', type: 'text', editable: true });
    const row: Row = { id: '1', name: 'Alice', age: 30 };

    const { result } = renderHook(() => useEditableCells<Row>({ adapter, tableName: 'users' }));

    await act(async () => {
      await result.current.commitEdit({
        row,
        rowId: '1',
        column,
        value: 'Zed',
        previousValue: 'Alice',
      });
    });

    expect(updateRecord.mock.calls[0]?.[2]).toEqual({ table: 'users' });
  });
});
