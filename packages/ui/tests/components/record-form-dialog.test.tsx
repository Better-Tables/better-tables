/**
 * <RecordFormDialog> (plan 065 Phase 4): one field per writable column,
 * rendered via the SAME FieldEditor dispatch inline cell editing uses.
 * Read-only columns render disabled; create/edit call the matching adapter
 * write method with only writable-column data; derived columns never appear.
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition, TableAdapter } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordFormDialog } from '../../src/components/table/record-form-dialog';

interface Row {
  id: number;
  name: string;
  age: number;
}

function columns(): ColumnDefinition<Row>[] {
  return [
    {
      id: 'id',
      displayName: 'Id',
      type: 'number',
      accessor: (r) => r.id,
      writable: false,
    },
    {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (r) => r.name,
      writable: true,
    },
    {
      id: 'age',
      displayName: 'Age',
      type: 'number',
      accessor: (r) => r.age,
      writable: true,
    },
  ];
}

afterEach(() => {
  cleanup();
});

describe('RecordFormDialog — edit mode', () => {
  it('pre-fills from the row, renders the PK disabled, and updateRecord gets only writable fields', async () => {
    const row: Row = { id: 1, name: 'Alice', age: 30 };
    const updateRecord = mock(async (id: string, data: Partial<Row>) => ({
      ...row,
      ...data,
      id: Number(id),
    }));
    const onSuccess = mock((_r: Row) => {});
    const onOpenChange = mock((_open: boolean) => {});

    render(
      <RecordFormDialog
        open
        onOpenChange={onOpenChange}
        mode="edit"
        row={row}
        columns={columns()}
        adapter={{ updateRecord } as Pick<TableAdapter<Row>, 'updateRecord'>}
        onSuccess={onSuccess}
      />
    );

    // Dialog content renders through a portal, outside RTL's `container`.
    const idInput = document.querySelector('#record-form-id') as HTMLInputElement;
    expect(idInput.value).toBe('1');
    expect(idInput.disabled).toBe(true);

    const nameInput = screen.getByDisplayValue('Alice');
    fireEvent.change(nameInput, { target: { value: 'Bob' } });
    fireEvent.blur(nameInput);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(updateRecord).toHaveBeenCalledTimes(1);
    });
    expect(updateRecord).toHaveBeenCalledWith('1', { name: 'Bob', age: 30 });
    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'Bob', age: 30 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets to a fresh draft every time the dialog re-opens for a different row', () => {
    const rowA: Row = { id: 1, name: 'Alice', age: 30 };
    const rowB: Row = { id: 2, name: 'Bob', age: 40 };

    const { rerender } = render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        row={rowA}
        columns={columns()}
        adapter={{}}
      />
    );
    expect(screen.getByDisplayValue('Alice')).toBeTruthy();

    // Close, then re-open for a different row — must show Bob's data, not a
    // stale Alice draft (including any in-progress, uncommitted edit).
    rerender(
      <RecordFormDialog
        open={false}
        onOpenChange={() => {}}
        mode="edit"
        row={rowA}
        columns={columns()}
        adapter={{}}
      />
    );
    rerender(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        row={rowB}
        columns={columns()}
        adapter={{}}
      />
    );
    expect(screen.getByDisplayValue('Bob')).toBeTruthy();
    expect(screen.queryByDisplayValue('Alice')).toBeNull();
  });
});

describe('RecordFormDialog — create mode', () => {
  it('renders an empty form and createRecord gets only writable fields (PK excluded)', async () => {
    const createRecord = mock(async (data: Partial<Row>) => ({
      id: 99,
      name: '',
      age: 0,
      ...data,
    }));
    const onSuccess = mock((_r: Row) => {});

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={columns()}
        adapter={{ createRecord } as Pick<TableAdapter<Row>, 'createRecord'>}
        onSuccess={onSuccess}
      />
    );

    // Each field's editor is labeled by the column's displayName (plan 065
    // Phase 4 accessibility fix), not a generic "Edit cell" shared by all.
    const nameInput = screen.getByRole('textbox', { name: 'Name' });
    const ageInput = screen.getByRole('textbox', { name: 'Age' });

    fireEvent.change(nameInput, { target: { value: 'Charlie' } });
    fireEvent.blur(nameInput);
    fireEvent.change(ageInput, { target: { value: '25' } });
    fireEvent.blur(ageInput);

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(createRecord).toHaveBeenCalledTimes(1);
    });
    expect(createRecord).toHaveBeenCalledWith({ name: 'Charlie', age: 25 });
    expect(onSuccess).toHaveBeenCalledWith({ id: 99, name: 'Charlie', age: 25 });
  });

  it('shows a field error and disables Save on an invalid number, until fixed', () => {
    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={columns()}
        adapter={{}}
      />
    );

    const ageInput = screen.getByRole('textbox', { name: 'Age' });

    fireEvent.change(ageInput, { target: { value: 'not a number' } });
    fireEvent.blur(ageInput);

    expect(screen.getByText('Enter a valid number')).toBeTruthy();
    expect((screen.getByRole('button', { name: /^create$/i }) as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.change(ageInput, { target: { value: '25' } });
    fireEvent.blur(ageInput);

    expect(screen.queryByText('Enter a valid number')).toBeNull();
    expect((screen.getByRole('button', { name: /^create$/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('surfaces an adapter-capability error and calls onError without closing the dialog', async () => {
    const onError = mock((_e: unknown) => {});
    const onOpenChange = mock((_open: boolean) => {});

    render(
      <RecordFormDialog
        open
        onOpenChange={onOpenChange}
        mode="create"
        columns={columns()}
        adapter={{}}
        onError={onError}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'This adapter does not support createRecord.'
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('skips derived columns entirely — never rendered as a form field', () => {
    const withDerived: ColumnDefinition<Row>[] = [
      ...columns(),
      {
        id: 'postCount',
        displayName: 'Post Count',
        type: 'number',
        accessor: () => 0,
        derived: { kind: 'aggregate', relation: 'posts', fn: 'count' },
      },
    ];

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={withDerived}
        adapter={{}}
      />
    );

    expect(screen.queryByText('Post Count')).toBeNull();
  });

  it('runs column ValidationRules before submitting and blocks an invalid value', () => {
    const createRecord = mock(async (data: Partial<Row>) => ({ id: 1, name: '', age: 0, ...data }));
    const withValidation: ColumnDefinition<Row>[] = columns().map((c) =>
      c.id === 'name'
        ? {
            ...c,
            validation: [
              {
                id: 'required',
                validate: (v: unknown) => typeof v === 'string' && v.length > 0,
                message: 'Name is required',
              },
            ],
          }
        : c
    );

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={withValidation}
        adapter={{ createRecord } as Pick<TableAdapter<Row>, 'createRecord'>}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('sends editable.field as the payload key, not the column id, for a mapped column', async () => {
    const createRecord = mock(async (data: Record<string, unknown>) => ({ id: 1, ...data }));
    const mapped: ColumnDefinition<Row>[] = columns().map((c) =>
      c.id === 'name' ? { ...c, editable: { field: 'fullName' } } : c
    );

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={mapped}
        adapter={{ createRecord } as unknown as Pick<TableAdapter<Row>, 'createRecord'>}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Dana' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Age' }), { target: { value: '22' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Age' }));

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(createRecord).toHaveBeenCalledTimes(1);
    });
    expect(createRecord).toHaveBeenCalledWith({ fullName: 'Dana', age: 22 });
  });

  it('omits an untouched field from the create payload instead of sending explicit undefined', async () => {
    // A single boolean-only field (no sibling text/number field competing
    // for `autoFocus`, which would otherwise blur-and-commit it) isolates
    // the fix: an untouched boolean editor never calls onCommit, so
    // `formData['active']` stays `undefined` and must be left out of the
    // payload entirely, not sent as an explicit `undefined`.
    const createRecord = mock(async (data: Record<string, unknown>) => ({
      id: 1,
      active: false,
      ...data,
    }));
    const boolOnly: ColumnDefinition<{ id: number; active: boolean }>[] = [
      { id: 'id', displayName: 'Id', type: 'number', accessor: (r) => r.id, writable: false },
      {
        id: 'active',
        displayName: 'Active',
        type: 'boolean',
        accessor: (r) => r.active,
        writable: true,
      },
    ];

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={boolOnly}
        adapter={
          { createRecord } as Pick<TableAdapter<{ id: number; active: boolean }>, 'createRecord'>
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(createRecord).toHaveBeenCalledTimes(1);
    });
    expect(createRecord).toHaveBeenCalledWith({});
  });

  it('renders a writable custom-type column without an editRenderer as disabled, not blank', () => {
    const withCustom: ColumnDefinition<Row & { note: string }>[] = [
      ...columns(),
      {
        id: 'note',
        displayName: 'Note',
        type: 'custom',
        accessor: (r) => r.note,
        writable: true,
      },
    ];

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        columns={withCustom}
        adapter={{}}
      />
    );

    const noteInput = document.querySelector('#record-form-note') as HTMLInputElement;
    expect(noteInput).toBeTruthy();
    expect(noteInput.disabled).toBe(true);
  });

  it('renders a read-only boolean field as "false", not blank', () => {
    const withBoolean: ColumnDefinition<Row & { active: boolean }>[] = [
      ...columns(),
      {
        id: 'active',
        displayName: 'Active',
        type: 'boolean',
        accessor: (r) => r.active,
        writable: false,
      },
    ];
    const row: Row & { active: boolean } = { id: 1, name: 'Alice', age: 30, active: false };

    render(
      <RecordFormDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        row={row}
        columns={withBoolean}
        adapter={{}}
      />
    );

    const activeInput = document.querySelector('#record-form-active') as HTMLInputElement;
    expect(activeInput.value).toBe('false');
  });

  it('does not report a write as failed when onSuccess throws after a successful mutation', async () => {
    const updateRecord = mock(async (id: string, data: Partial<Row>) => ({
      id: Number(id),
      name: 'Alice',
      age: 30,
      ...data,
    }));
    const onOpenChange = mock((_open: boolean) => {});
    const onSuccess = mock(() => {
      throw new Error('boom in consumer callback');
    });
    const row: Row = { id: 1, name: 'Alice', age: 30 };

    render(
      <RecordFormDialog
        open
        onOpenChange={onOpenChange}
        mode="edit"
        row={row}
        columns={columns()}
        adapter={{ updateRecord } as Pick<TableAdapter<Row>, 'updateRecord'>}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(updateRecord).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
