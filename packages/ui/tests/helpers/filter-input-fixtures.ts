import type { ColumnDefinition, FilterState } from '@better-tables/core';

export interface FixtureRow {
  id: string;
  status: string;
  amount: number;
  createdAt: Date;
  tags: string[];
}

export function makeOptionColumn(
  optionCount = 3,
  id = 'status'
): ColumnDefinition<FixtureRow> {
  const options = Array.from({ length: optionCount }, (_, index) => ({
    value: `opt-${index}`,
    label: `Option ${index}`,
  }));
  return {
    id,
    displayName: 'Status',
    type: 'option',
    accessor: (row) => row.status,
    filter: { options },
  };
}

export function makeTextColumn(): ColumnDefinition<FixtureRow> {
  return {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: () => '',
  };
}

export function makeNumberColumn(): ColumnDefinition<FixtureRow> {
  return {
    id: 'amount',
    displayName: 'Amount',
    type: 'number',
    accessor: (row) => row.amount,
  };
}

export function makeDateColumn(): ColumnDefinition<FixtureRow> {
  return {
    id: 'createdAt',
    displayName: 'Created',
    type: 'date',
    accessor: (row) => row.createdAt,
  };
}

export function makeMultiOptionColumn(): ColumnDefinition<FixtureRow> {
  return {
    id: 'tags',
    displayName: 'Tags',
    type: 'multiOption',
    accessor: (row) => row.tags,
    filter: {
      options: [
        { value: 'alpha', label: 'Alpha' },
        { value: 'beta', label: 'Beta' },
        { value: 'gamma', label: 'Gamma' },
      ],
    },
  };
}

export function baseFilter(
  partial: Pick<FilterState, 'columnId' | 'type' | 'operator'> & Partial<FilterState>
): FilterState {
  return {
    values: [],
    includeNull: false,
    ...partial,
  };
}
