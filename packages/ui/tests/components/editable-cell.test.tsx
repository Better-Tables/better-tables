import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditableCell } from '../../src/components/table/editable-cell';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  name: string;
  age: number;
  status: string;
  active: boolean;
  joined: Date;
  note: string;
}

function renderEditable<TValue>(args: {
  column: ColumnDefinition<Row, TValue>;
  value: TValue;
  display?: string;
  editing?: boolean;
}) {
  const onBeginEdit = mock(() => {});
  const onCommit = mock((_value: TValue) => {});
  const onCancel = mock(() => {});
  const row: Row = {
    id: '1',
    name: 'Alice',
    age: 30,
    status: 'open',
    active: true,
    joined: new Date('2024-01-15T00:00:00.000Z'),
    note: 'hello',
  };

  const view = render(
    <EditableCell
      row={row}
      rowId="1"
      column={args.column}
      value={args.value}
      editing={args.editing ?? true}
      onBeginEdit={onBeginEdit}
      onCommit={onCommit}
      onCancel={onCancel}
    >
      {args.display ?? String(args.value)}
    </EditableCell>
  );

  return { ...view, onBeginEdit, onCommit, onCancel, row };
}

describe('EditableCell editors (plan 053 step 3)', () => {
  it('text edit types "abc" + Enter → commit called with abc', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (r) => r.name,
      editable: true,
    };
    const { onCommit } = renderEditable({ column, value: 'Alice' });

    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toBe('abc');
  });

  it('Escape cancels without commit', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (r) => r.name,
      editable: true,
    };
    const { onCommit, onCancel } = renderEditable({ column, value: 'Alice' });

    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('blur commits text', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (r) => r.name,
      editable: true,
    };
    const { onCommit } = renderEditable({ column, value: 'Alice' });

    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.blur(input);

    expect(onCommit.mock.calls[0]?.[0]).toBe('Bob');
  });

  it('number "12.5" commits 12.5; "abc" shows error and does not commit', () => {
    const column: ColumnDefinition<Row, number> = {
      id: 'age',
      displayName: 'Age',
      type: 'number',
      accessor: (r) => r.age,
      editable: true,
    };
    const { onCommit, rerender, onBeginEdit, onCancel } = renderEditable({
      column,
      value: 30,
    });

    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit.mock.calls[0]?.[0]).toBe(12.5);

    onCommit.mockClear();
    rerender(
      <EditableCell
        row={{
          id: '1',
          name: 'Alice',
          age: 30,
          status: 'open',
          active: true,
          joined: new Date(),
          note: '',
        }}
        rowId="1"
        column={column}
        value={30}
        editing
        onBeginEdit={onBeginEdit}
        onCommit={onCommit}
        onCancel={onCancel}
      >
        30
      </EditableCell>
    );

    const input2 = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input2, { target: { value: 'abc' } });
    fireEvent.keyDown(input2, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/valid number/i);
  });

  it('option select commits the option value', async () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'status',
      displayName: 'Status',
      type: 'option',
      accessor: (r) => r.status,
      editable: true,
      filter: {
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    };
    const { onCommit } = renderEditable({ column, value: 'open' });

    fireEvent.click(await screen.findByRole('option', { name: 'Closed' }));

    await waitFor(() => {
      expect(onCommit.mock.calls[0]?.[0]).toBe('closed');
    });
  });

  it('boolean toggle commits the flipped boolean', () => {
    const column: ColumnDefinition<Row, boolean> = {
      id: 'active',
      displayName: 'Active',
      type: 'boolean',
      accessor: (r) => r.active,
      editable: true,
    };
    const { onCommit } = renderEditable({ column, value: true });

    fireEvent.click(screen.getByRole('switch', { name: /edit cell/i }));
    expect(onCommit.mock.calls[0]?.[0]).toBe(false);
  });

  it('date pick commits a Date for the chosen day', async () => {
    const column: ColumnDefinition<Row, Date> = {
      id: 'joined',
      displayName: 'Joined',
      type: 'date',
      accessor: (r) => r.joined,
      editable: true,
    };
    const { onCommit } = renderEditable({
      column,
      value: new Date(2024, 0, 15),
    });

    // Day buttons expose the day-of-month as text content in this calendar build.
    const day = screen.getByText('20', { selector: 'button' });
    fireEvent.click(day);

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
    const committed = onCommit.mock.calls[0]?.[0];
    expect(committed).toBeInstanceOf(Date);
    expect((committed as Date).getDate()).toBe(20);
  });

  it('multiline Enter inserts newline; Cmd/Ctrl+Enter commits', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'note',
      displayName: 'Note',
      type: 'text',
      accessor: (r) => r.note,
      editable: { multiline: true },
    };
    const { onCommit } = renderEditable({ column, value: 'hello' });

    const input = screen.getByRole('textbox', { name: /edit cell/i });
    fireEvent.change(input, { target: { value: 'line1\nline2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(onCommit.mock.calls[0]?.[0]).toBe('line1\nline2');
  });

  it('editRenderer receives commit/cancel and commit flows through', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'name',
      displayName: 'Name',
      type: 'custom',
      accessor: (r) => r.name,
      editable: {
        editRenderer: ({ value, commit, cancel }) => (
          <div>
            <button type="button" onClick={() => commit(`${value}-edited`)}>
              Save custom
            </button>
            <button type="button" onClick={cancel}>
              Cancel custom
            </button>
          </div>
        ),
      },
    };
    const { onCommit, onCancel } = renderEditable({ column, value: 'Alice' });

    fireEvent.click(screen.getByRole('button', { name: /save custom/i }));
    expect(onCommit.mock.calls[0]?.[0]).toBe('Alice-edited');

    fireEvent.click(screen.getByRole('button', { name: /cancel custom/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('double-click on display begins edit', () => {
    const column: ColumnDefinition<Row, string> = {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      accessor: (r) => r.name,
      editable: true,
    };
    const { onBeginEdit } = renderEditable({
      column,
      value: 'Alice',
      editing: false,
      display: 'Alice',
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /edit name/i }));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });
});
