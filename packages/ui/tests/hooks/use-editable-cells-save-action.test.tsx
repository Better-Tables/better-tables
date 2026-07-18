/**
 * saveAction save path + relationship-path (dot) column gating
 * (plan 055 Step 3): precedence onCellEdit → saveAction → adapter, Date
 * serialization, rollback on { ok: false }, and CellWriteTarget-driven
 * dot-column editability incl. the null-related-row row gate.
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type {
  CellEditActionInput,
  CellEditActionResult,
  CellWriteTarget,
  ColumnDefinition,
  ColumnType,
  TableAdapter,
} from '@better-tables/core';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useEditableCells } from '../../src/hooks/use-editable-cells';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  name: string;
  joined: Date;
  customer: { id: number; company: string } | null;
}

const ROW: Row = {
  id: '1',
  name: 'Alice',
  joined: new Date('2026-01-01T00:00:00.000Z'),
  customer: { id: 9, company: 'Acme' },
};

function makeColumn(
  overrides: Partial<ColumnDefinition<Row>> & Pick<ColumnDefinition<Row>, 'id' | 'type'>
): ColumnDefinition<Row> {
  return {
    displayName: overrides.id,
    accessor: (row) => (row as unknown as Record<string, unknown>)[overrides.id] as never,
    ...overrides,
  };
}

const NAME_COLUMN = makeColumn({ id: 'name', type: 'text', editable: true });
const JOINED_COLUMN = makeColumn({ id: 'joined', type: 'date', editable: true });
const COMPANY_COLUMN = makeColumn({ id: 'customer.company', type: 'text', editable: true });

const COMPANY_TARGET: CellWriteTarget = {
  table: 'customers',
  field: 'company',
  relatedIdPath: 'customer.id',
  single: true,
  writable: true,
};

function makeSaveAction(result: CellEditActionResult = { ok: true }) {
  return mock(async (_input: CellEditActionInput) => result);
}

/** Read-only adapter (no update) that CAN resolve write targets. */
function makeTargetAdapter(
  targets: Record<string, CellWriteTarget | null> = { 'customer.company': COMPANY_TARGET }
): TableAdapter<Row> {
  return {
    meta: {
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
      supportedColumnTypes: ['text'] as ColumnType[],
      supportedOperators: { text: [] } as never,
    },
    fetchData: async () => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    resolveCellWriteTarget: async (columnId: string) => targets[columnId] ?? null,
  };
}

describe('saveAction save path', () => {
  it('makes a flat column editable even without a writable adapter, and saves through it', async () => {
    const saveAction = makeSaveAction({ ok: true, data: { id: '1', name: 'Bob' } });
    const { result } = renderHook(() => useEditableCells<Row>({ saveAction }));

    expect(result.current.getColumnEditability(NAME_COLUMN)).toMatchObject({
      editable: true,
      savePath: 'action',
      field: 'name',
    });

    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: NAME_COLUMN,
        value: 'Bob',
        previousValue: 'Alice',
      });
    });

    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction.mock.calls[0]?.[0]).toEqual({ id: '1', field: 'name', value: 'Bob' });
    // Confirmed from result.data.
    expect(result.current.getDisplayValue('1', 'name', 'Alice')).toBe('Bob');
    expect(result.current.cellErrors.size).toBe(0);
  });

  it('serializes Date values to ISO strings on the way out', async () => {
    const saveAction = makeSaveAction();
    const { result } = renderHook(() => useEditableCells<Row>({ saveAction }));

    const when = new Date('2026-06-15T09:30:00.000Z');
    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: JOINED_COLUMN,
        value: when,
        previousValue: ROW.joined,
      });
    });

    expect(saveAction.mock.calls[0]?.[0]).toEqual({
      id: '1',
      field: 'joined',
      value: '2026-06-15T09:30:00.000Z',
    });
  });

  it('{ ok: false } rolls back the overlay, sets the cell error, and fires onCellEditError', async () => {
    const saveAction = makeSaveAction({ ok: false, error: 'Column "name" is not editable.' });
    const onCellEditError = mock(() => {});
    const { result } = renderHook(() => useEditableCells<Row>({ saveAction, onCellEditError }));

    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: NAME_COLUMN,
        value: 'Nope',
        previousValue: 'Alice',
      });
    });

    expect(result.current.getDisplayValue('1', 'name', 'Alice')).toBe('Alice');
    expect(result.current.cellErrors.get('1:name')).toBe('Column "name" is not editable.');
    expect(onCellEditError).toHaveBeenCalledTimes(1);
    expect(result.current.savingCells.has('1:name')).toBe(false);
  });

  it('onCellEdit wins over saveAction (precedence)', async () => {
    const saveAction = makeSaveAction();
    const onCellEdit = mock(async () => {});
    const { result } = renderHook(() => useEditableCells<Row>({ saveAction, onCellEdit }));

    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: NAME_COLUMN,
        value: 'Bob',
        previousValue: 'Alice',
      });
    });

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(saveAction).not.toHaveBeenCalled();
  });
});

describe('relationship-path (dot) column gating', () => {
  it('becomes editable once the write target resolves; save sends the RELATED row id', async () => {
    const saveAction = makeSaveAction({ ok: true, data: { id: 9, company: 'Globex' } });
    const adapter = makeTargetAdapter();
    const { result } = renderHook(() => useEditableCells<Row>({ adapter, saveAction }));

    // First check kicks off lazy resolution (pending → not yet editable).
    expect(result.current.getColumnEditability(COMPANY_COLUMN).editable).toBe(false);

    await waitFor(() => {
      expect(result.current.getColumnEditability(COMPANY_COLUMN)).toMatchObject({
        editable: true,
        savePath: 'action',
        target: COMPANY_TARGET,
      });
    });

    // Row gate: related id present → editable; null related object → not.
    expect(result.current.isRowCellEditable(COMPANY_COLUMN, ROW)).toBe(true);
    expect(result.current.isRowCellEditable(COMPANY_COLUMN, { ...ROW, customer: null })).toBe(
      false
    );

    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: COMPANY_COLUMN,
        value: 'Globex',
        previousValue: 'Acme',
      });
    });

    // The wire input addresses the RELATED row (customer.id = 9), with the
    // COLUMN id as field — the server policy re-resolves table/field.
    expect(saveAction.mock.calls[0]?.[0]).toEqual({
      id: '9',
      field: 'customer.company',
      value: 'Globex',
    });
    expect(result.current.getDisplayValue('1', 'customer.company', 'Acme')).toBe('Globex');
  });

  it('a null related object blocks the commit even if forced', async () => {
    const saveAction = makeSaveAction();
    const adapter = makeTargetAdapter();
    const { result } = renderHook(() => useEditableCells<Row>({ adapter, saveAction }));

    await waitFor(() => {
      expect(result.current.getColumnEditability(COMPANY_COLUMN).editable).toBe(true);
    });

    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;
    try {
      await act(async () => {
        await result.current.commitEdit({
          row: { ...ROW, customer: null },
          rowId: '1',
          column: COMPANY_COLUMN,
          value: 'Globex',
          previousValue: 'Acme',
        });
      });
    } finally {
      console.warn = original;
    }

    expect(saveAction).not.toHaveBeenCalled();
  });

  it('stays read-only (with the one dev warn) when the adapter lacks the capability', async () => {
    const saveAction = makeSaveAction();
    const warn = mock((..._args: unknown[]) => {});
    const original = console.warn;
    console.warn = warn;
    try {
      const { result } = renderHook(() => useEditableCells<Row>({ saveAction }));
      expect(result.current.getColumnEditability(COMPANY_COLUMN).editable).toBe(false);
      expect(result.current.getColumnEditability(COMPANY_COLUMN).editable).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('resolveCellWriteTarget');
    } finally {
      console.warn = original;
    }
  });

  it('one-to-many targets resolve to read-only', async () => {
    const adapter = makeTargetAdapter({
      'customer.company': { ...COMPANY_TARGET, single: false },
    });
    const saveAction = makeSaveAction();
    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;
    try {
      const { result } = renderHook(() => useEditableCells<Row>({ adapter, saveAction }));
      result.current.getColumnEditability(COMPANY_COLUMN);
      await waitFor(() => {
        const editability = result.current.getColumnEditability(COMPANY_COLUMN);
        expect(editability.editable).toBe(false);
        if (!editability.editable) {
          expect(editability.reason).toContain('one-to-many');
        }
      });
    } finally {
      console.warn = original;
    }
  });

  it('adapter save path works for dot columns: RELATED table + field + row id', async () => {
    const updateRecord = mock(
      async (_id: string, data: Partial<Row>, _options?: { table?: string }) => ({
        id: 9,
        company: 'Globex',
        ...data,
      })
    );
    const adapter: TableAdapter<Row> = {
      ...makeTargetAdapter(),
      meta: {
        ...makeTargetAdapter().meta,
        features: { ...makeTargetAdapter().meta.features, update: true },
      },
      updateRecord: updateRecord as never,
    };
    const { result } = renderHook(() => useEditableCells<Row>({ adapter, tableName: 'tickets' }));

    result.current.getColumnEditability(COMPANY_COLUMN);
    await waitFor(() => {
      expect(result.current.getColumnEditability(COMPANY_COLUMN)).toMatchObject({
        editable: true,
        savePath: 'adapter',
      });
    });

    await act(async () => {
      await result.current.commitEdit({
        row: ROW,
        rowId: '1',
        column: COMPANY_COLUMN,
        value: 'Globex',
        previousValue: 'Acme',
      });
    });

    expect(updateRecord).toHaveBeenCalledTimes(1);
    expect(updateRecord.mock.calls[0]?.[0]).toBe('9');
    expect(updateRecord.mock.calls[0]?.[1]).toEqual({ company: 'Globex' } as never);
    expect(updateRecord.mock.calls[0]?.[2]).toEqual({ table: 'customers' } as never);
  });
});
