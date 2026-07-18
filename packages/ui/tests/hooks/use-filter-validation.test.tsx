import { describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { renderHook } from '@testing-library/react';
import { useFilterValidation } from '../../src/hooks/use-filter-validation';

interface Row {
  id: string;
  status: string;
  amount: number;
}

const textColumn: ColumnDefinition<Row> = {
  id: 'name',
  displayName: 'Name',
  type: 'text',
  accessor: () => '',
};

const numberColumn: ColumnDefinition<Row> = {
  id: 'amount',
  displayName: 'Amount',
  type: 'number',
  accessor: (row) => row.amount,
  filter: { min: 0, max: 100 },
};

const optionColumn: ColumnDefinition<Row> = {
  id: 'status',
  displayName: 'Status',
  type: 'option',
  accessor: (row) => row.status,
  filter: {
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
};

function renderValidation(
  filter: FilterState,
  column: ColumnDefinition<Row>,
  values: unknown[],
  immediate = true
) {
  return renderHook(() => useFilterValidation({ filter, column, values, immediate })).result
    .current;
}

describe('useFilterValidation (plan 042 step 3)', () => {
  it('accepts valid text values for operator "contains"', () => {
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'contains', values: ['x'] },
      textColumn,
      ['hello']
    );
    expect(result.isValid).toBe(true);
  });

  it('rejects empty values for operator "contains" when validated immediately', () => {
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'contains', values: [] },
      textColumn,
      []
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/exactly 1 value/i);
  });

  it('accepts zero values for isNull', () => {
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'isNull', values: [] },
      textColumn,
      [],
      true
    );
    expect(result.isValid).toBe(true);
  });

  it('rejects non-empty values for isNull', () => {
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'isNull', values: [] },
      textColumn,
      ['unexpected']
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/no values/i);
  });

  it('requires exactly two numeric values for operator "between"', () => {
    expect(
      renderValidation(
        { columnId: 'amount', type: 'number', operator: 'between', values: [1, 10] },
        numberColumn,
        [1, 10]
      ).isValid
    ).toBe(true);

    const invalid = renderValidation(
      { columnId: 'amount', type: 'number', operator: 'between', values: [1] },
      numberColumn,
      [1]
    );
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toMatch(/exactly 2 value/i);
  });

  it('enforces numeric column min/max constraints', () => {
    const result = renderValidation(
      { columnId: 'amount', type: 'number', operator: 'equals', values: [150] },
      numberColumn,
      [150]
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/at most 100/i);
  });

  it('rejects option values that are not in the column option list', () => {
    const result = renderValidation(
      { columnId: 'status', type: 'option', operator: 'is', values: ['missing'] },
      optionColumn,
      ['missing']
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/invalid option/i);
  });

  it('skips validation when immediate is false', () => {
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'contains', values: [] },
      textColumn,
      [],
      false
    );
    expect(result.isValid).toBe(true);
  });

  it('runs column.filter.validation hooks for custom rules', () => {
    const customColumn: ColumnDefinition<Row> = {
      ...textColumn,
      filter: {
        validation: (value) => (value === 'allowed' ? true : 'Only "allowed" is permitted'),
      },
    };
    const result = renderValidation(
      { columnId: 'name', type: 'text', operator: 'equals', values: ['nope'] },
      customColumn,
      ['nope']
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Only "allowed" is permitted');
  });
});
