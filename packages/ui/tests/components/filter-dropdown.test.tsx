import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ColumnDefinition, FilterGroup } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FilterDropdown } from '../../src/components/filters/filter-dropdown';

interface Row {
  id: string;
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: () => '' },
  { id: 'status', displayName: 'Status', type: 'option', accessor: () => '' },
  { id: 'amount', displayName: 'Amount', type: 'number', accessor: () => 0 },
  { id: 'createdAt', displayName: 'Created', type: 'date', accessor: () => new Date() },
];

const groups: FilterGroup[] = [
  { id: 'main', label: 'Main fields', columns: ['name', 'status'] },
  {
    id: 'metrics',
    label: 'Metrics',
    description: 'Numeric and date columns',
    columns: ['amount', 'createdAt'],
  },
];

function Harness({
  onSelect,
  ungroupedMode = 'group',
  searchTerm,
  onSearchChange,
}: {
  onSelect: (columnId: string) => void;
  ungroupedMode?: 'group' | 'inline';
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}) {
  return (
    <FilterDropdown
      columns={columns}
      groups={groups}
      open
      onOpenChange={() => {}}
      onSelect={onSelect}
      ungroupedMode={ungroupedMode}
      {...(searchTerm !== undefined && { searchTerm })}
      {...(onSearchChange !== undefined && { onSearchChange })}
    >
      <button type="button">Add filter</button>
    </FilterDropdown>
  );
}

describe('FilterDropdown (plan 042 step 2)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('drills into a group and navigates back to the groups overview', () => {
    const onSelect = mock(() => {});
    render(<Harness onSelect={onSelect} />);

    expect(screen.getByText('Main fields')).toBeDefined();
    expect(screen.getByText('Metrics')).toBeDefined();

    fireEvent.click(screen.getByText('Metrics'));
    expect(screen.getByRole('heading', { name: 'Metrics' })).toBeDefined();
    expect(screen.getByText('Amount')).toBeDefined();

    const detailHeader = screen.getByRole('heading', { name: 'Metrics' }).closest('div')
      ?.parentElement;
    fireEvent.click(within(detailHeader as HTMLElement).getByRole('button'));

    expect(screen.queryByRole('heading', { name: 'Metrics', level: 3 })).toBeNull();
    expect(screen.getByText('Main fields')).toBeDefined();
  });

  it('selects a column from a drilled-in group view', () => {
    const onSelect = mock(() => {});
    render(<Harness onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Main fields'));
    fireEvent.click(screen.getByText('Status'));

    expect(onSelect).toHaveBeenCalledWith('status');
  });

  it('ungroupedMode "group" buckets stray columns under the default label', () => {
    const groupedColumns: ColumnDefinition<Row>[] = [
      ...columns,
      { id: 'extra', displayName: 'Extra', type: 'text', accessor: () => '' },
    ];
    const onSelect = mock(() => {});

    render(
      <FilterDropdown
        columns={groupedColumns}
        groups={groups}
        open
        onOpenChange={() => {}}
        onSelect={onSelect}
        ungroupedMode="group"
      >
        <button type="button">Add filter</button>
      </FilterDropdown>
    );

    expect(screen.getByText('Other')).toBeDefined();
    fireEvent.click(screen.getByText('Other'));
    expect(screen.getByText('Extra')).toBeDefined();
  });

  it('ungroupedMode "inline" lists ungrouped columns at the top level', () => {
    const groupedColumns: ColumnDefinition<Row>[] = [
      ...columns,
      { id: 'extra', displayName: 'Extra', type: 'text', accessor: () => '' },
    ];
    const onSelect = mock(() => {});

    render(
      <FilterDropdown
        columns={groupedColumns}
        groups={groups}
        open
        onOpenChange={() => {}}
        onSelect={onSelect}
        ungroupedMode="inline"
      >
        <button type="button">Add filter</button>
      </FilterDropdown>
    );

    expect(screen.getByText('Extra')).toBeDefined();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('filters the flat column list when a search term is active', () => {
    const onSelect = mock(() => {});
    let search = '';
    const onSearchChange = (term: string) => {
      search = term;
    };

    const { rerender } = render(
      <Harness onSelect={onSelect} searchTerm={search} onSearchChange={onSearchChange} />
    );

    fireEvent.change(screen.getByPlaceholderText('Search columns...'), {
      target: { value: 'amount' },
    });

    rerender(
      <Harness onSelect={onSelect} searchTerm="amount" onSearchChange={onSearchChange} />
    );

    expect(screen.getByText('Amount')).toBeDefined();
    expect(screen.queryByText('Name')).toBeNull();
  });

  it('uses a dialog shell on mobile viewports', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 480,
    });

    render(<Harness onSelect={mock(() => {})} />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Add Filter')).toBeDefined();
  });
});
