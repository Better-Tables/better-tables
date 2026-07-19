/**
 * Facet-fallback options for option dropdowns (plan 054 Step 5): the option
 * EDITOR (editable-cell) and the option FILTER input lazily fetch
 * `adapter.getFilterOptions(columnId)` when the column declares no options —
 * fetch-once, declared-wins, and a failed/empty fetch keeps "No options".
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition, FilterOption, FilterState } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OptionFilterInput } from '../../src/components/filters/inputs/option-filter-input';
import { EditableCell } from '../../src/components/table/editable-cell';
import { TableProviders } from '../../src/components/table/table-providers';
import {
  type ColumnOptionsAdapter,
  TableAdapterProvider,
} from '../../src/hooks/use-column-options';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  status: string;
}

const ROW: Row = { id: '1', status: 'open' };

const FETCHED_OPTIONS: FilterOption[] = [
  { value: 'open', label: 'Open', count: 3 },
  { value: 'closed', label: 'Closed', count: 1 },
];

function makeOptionsAdapter(result: FilterOption[] | Error = FETCHED_OPTIONS) {
  const getFilterOptions = mock(async (_columnId: string) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const adapter: ColumnOptionsAdapter = { getFilterOptions };
  return { adapter, getFilterOptions };
}

function optionColumn(options?: FilterOption[]): ColumnDefinition<Row, unknown> {
  return {
    id: 'status',
    displayName: 'Status',
    type: 'option',
    accessor: (row) => row.status,
    editable: true,
    ...(options ? { filter: { options } } : {}),
  };
}

function renderOptionEditor(
  adapter: ColumnOptionsAdapter | null,
  column: ColumnDefinition<Row, unknown>
) {
  const onCommit = mock((_value: unknown) => {});
  const onCancel = mock(() => {});
  const view = render(
    <TableProviders>
      <TableAdapterProvider adapter={adapter}>
        <EditableCell
          row={ROW}
          rowId="1"
          column={column}
          value="open"
          editing
          onBeginEdit={() => {}}
          onCommit={onCommit}
          onCancel={onCancel}
        >
          open
        </EditableCell>
      </TableAdapterProvider>
    </TableProviders>
  );
  return { ...view, onCommit, onCancel };
}

describe('option EDITOR facet fallback', () => {
  it('fetches once, renders fetched choices, and commits the VALUE', async () => {
    const { adapter, getFilterOptions } = makeOptionsAdapter();
    const { onCommit } = renderOptionEditor(adapter, optionColumn());

    // Loading state while the facet fetch is in flight.
    expect(screen.queryByText('Loading options…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /closed/i })).toBeTruthy();
    });
    expect(getFilterOptions).toHaveBeenCalledTimes(1);
    expect(getFilterOptions.mock.calls[0]?.[0]).toBe('status');

    fireEvent.click(screen.getByRole('option', { name: /closed/i }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    // Commits the option VALUE, not its label.
    expect(onCommit.mock.calls[0]?.[0]).toBe('closed');
  });

  it('reuses the cached fetch on reopen (fetch-once per adapter+column)', async () => {
    const { adapter, getFilterOptions } = makeOptionsAdapter();
    const first = renderOptionEditor(adapter, optionColumn());
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /open/i })).toBeTruthy();
    });
    first.unmount();

    renderOptionEditor(adapter, optionColumn());
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /open/i })).toBeTruthy();
    });

    expect(getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('falls back to "No options" when the fetch fails, without crashing', async () => {
    const { adapter } = makeOptionsAdapter(new Error('facet endpoint down'));
    renderOptionEditor(adapter, optionColumn());

    await waitFor(() => {
      expect(screen.getByText('No options')).toBeTruthy();
    });
  });

  it('declared options never trigger a fetch', async () => {
    const { adapter, getFilterOptions } = makeOptionsAdapter();
    const declared: FilterOption[] = [{ value: 'open', label: 'Declared Open' }];
    renderOptionEditor(adapter, optionColumn(declared));

    // Declared options render immediately — no loading, no fetch.
    expect(screen.queryByText('Loading options…')).toBeNull();
    expect(screen.getByRole('option', { name: /declared open/i })).toBeTruthy();
    expect(getFilterOptions).not.toHaveBeenCalled();
  });

  it('shows "No options" without an adapter context (fallback disabled)', () => {
    renderOptionEditor(null, optionColumn());
    expect(screen.getByText('No options')).toBeTruthy();
  });
});

describe('option FILTER input facet fallback', () => {
  const filter: FilterState = {
    columnId: 'status',
    type: 'option',
    operator: 'is',
    values: [],
  };

  function renderFilterInput(
    adapter: ColumnOptionsAdapter | null,
    column: ColumnDefinition<Row, unknown>
  ) {
    const onChange = mock((_values: unknown[]) => {});
    const view = render(
      <TableAdapterProvider adapter={adapter}>
        <OptionFilterInput filter={filter} column={column} onChange={onChange} />
      </TableAdapterProvider>
    );
    return { ...view, onChange };
  }

  it('fetches once and renders the fetched choices', async () => {
    const { adapter, getFilterOptions } = makeOptionsAdapter();
    renderFilterInput(adapter, optionColumn());

    expect(screen.queryByText('Loading options…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Open')).toBeTruthy();
      expect(screen.getByText('Closed')).toBeTruthy();
    });
    expect(getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('selecting a fetched choice reports the VALUE', async () => {
    const { adapter } = makeOptionsAdapter();
    const { onChange } = renderFilterInput(adapter, optionColumn());

    await waitFor(() => {
      expect(screen.getByText('Closed')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Closed'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['closed']);
  });

  it('declared options render without fetching', () => {
    const { adapter, getFilterOptions } = makeOptionsAdapter();
    renderFilterInput(adapter, optionColumn([{ value: 'open', label: 'Declared Open' }]));

    expect(screen.getByText('Declared Open')).toBeTruthy();
    expect(getFilterOptions).not.toHaveBeenCalled();
  });

  it('empty fetch result keeps the "No options found." fallback', async () => {
    const { adapter } = makeOptionsAdapter([]);
    renderFilterInput(adapter, optionColumn());

    await waitFor(() => {
      expect(screen.getByText('No options found.')).toBeTruthy();
    });
  });
});
