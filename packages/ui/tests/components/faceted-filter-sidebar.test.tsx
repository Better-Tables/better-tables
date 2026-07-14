import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  FacetedFilterSidebar,
  toggleFacetValue,
} from '../../src/components/filters/faceted-filter-sidebar';

interface Ticket {
  id: string;
  status: string;
  reopenCount: number;
}

const columns: ColumnDefinition<Ticket>[] = [
  {
    id: 'status',
    displayName: 'Status',
    type: 'option',
    accessor: (row) => row.status,
    filterable: true,
  },
  {
    id: 'reopenCount',
    displayName: 'Reopens',
    type: 'number',
    accessor: (row) => row.reopenCount,
    filterable: true,
  },
];

afterEach(() => {
  cleanup();
});

describe('toggleFacetValue (plan 032 step 4, finding 7)', () => {
  it('adds a new single-value filter (operator "is") when selecting the first value for a column', () => {
    const result = toggleFacetValue([], 'status', 'option', 'open');
    expect(result).toEqual([
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ]);
  });

  it('accumulates a second value into operator "isAnyOf" instead of a second filter', () => {
    const withOpen: FilterState[] = [
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ];
    const result = toggleFacetValue(withOpen, 'status', 'option', 'closed');
    expect(result).toEqual([
      { columnId: 'status', type: 'option', operator: 'isAnyOf', values: ['open', 'closed'] },
    ]);
  });

  it('removes the value (and the whole filter, if it was the last one) when re-clicking an active option', () => {
    const withOpen: FilterState[] = [
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ];
    const result = toggleFacetValue(withOpen, 'status', 'option', 'open');
    expect(result).toEqual([]);
  });

  it('leaves other columns filters untouched', () => {
    const filters: FilterState[] = [
      { columnId: 'priority', type: 'option', operator: 'is', values: ['high'] },
    ];
    const result = toggleFacetValue(filters, 'status', 'option', 'open');
    expect(result).toEqual([
      { columnId: 'priority', type: 'option', operator: 'is', values: ['high'] },
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ]);
  });
});

describe('FacetedFilterSidebar (plan 032 step 4, finding 7)', () => {
  it('renders facet options with counts and range values from useFacets-shaped props', () => {
    render(
      <FacetedFilterSidebar
        columns={columns}
        columnIds={['status']}
        rangeColumnIds={['reopenCount']}
        facets={{
          status: [
            { value: 'open', count: 3 },
            { value: 'closed', count: 5 },
          ],
        }}
        ranges={{ reopenCount: [0, 7] }}
        filters={[]}
        onFiltersChange={() => {}}
      />
    );

    expect(screen.getByText('open')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('closed')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('0 – 7')).toBeDefined();
  });

  it('calls onFiltersChange with the toggled filter when an option is clicked', () => {
    const captured: { filters: FilterState[] | null } = { filters: null };

    render(
      <FacetedFilterSidebar
        columns={columns}
        columnIds={['status']}
        facets={{ status: [{ value: 'open', count: 3 }] }}
        ranges={{}}
        filters={[]}
        onFiltersChange={(filters) => {
          captured.filters = filters;
        }}
      />
    );

    fireEvent.click(screen.getByText('open'));

    expect(captured.filters).toEqual([
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ]);
  });

  it('renders an active option as pressed when its value is in the current filters', () => {
    render(
      <FacetedFilterSidebar
        columns={columns}
        columnIds={['status']}
        facets={{ status: [{ value: 'open', count: 3 }] }}
        ranges={{}}
        filters={[{ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }]}
        onFiltersChange={() => {}}
      />
    );

    const button = screen.getByRole('button', { name: /open/ });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders nothing when no columnIds/rangeColumnIds are configured', () => {
    const { container } = render(
      <FacetedFilterSidebar
        columns={columns}
        facets={{}}
        ranges={{}}
        filters={[]}
        onFiltersChange={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
