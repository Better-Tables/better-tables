import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFilterValidation } from '../use-filter-validation';

describe('useFilterValidation', () => {
  const mockColumn: ColumnDefinition = {
    id: 'test',
    displayName: 'Test Column',
    accessor: (data: any) => data.test,
    type: 'text',
    sortable: true,
    filterable: true,
  };

  const mockFilter: FilterState = {
    columnId: 'test',
    type: 'text',
    operator: 'contains',
    values: ['test'],
  };

  it('should return valid for valid filter', () => {
    const { result } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: mockColumn,
        values: ['test'],
      })
    );

    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('should validate text filters', () => {
    const textColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'text',
    };

    const { result } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'text', operator: 'contains' },
        column: textColumn,
        values: ['test'],
      })
    );

    expect(result.current.isValid).toBe(true);
  });

  it('should validate number filters with min/max constraints', () => {
    const numberColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'number',
      filter: {
        min: 0,
        max: 100,
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'number', operator: 'greaterThanOrEqual' },
        column: numberColumn,
        values: [50],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'number', operator: 'greaterThanOrEqual' },
        column: numberColumn,
        values: [150],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
    expect(invalidResult.current.error).toContain('at most 100');
  });

  it('should validate option filters', () => {
    const optionColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'option',
      filter: {
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'option', operator: 'equals' },
        column: optionColumn,
        values: ['active'],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'option', operator: 'equals' },
        column: optionColumn,
        values: ['invalid'],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
    expect(invalidResult.current.error).toContain('Invalid option');
  });

  it('should validate multi-option filters', () => {
    const multiOptionColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'multiOption',
      filter: {
        options: [
          { value: 'tag1', label: 'Tag 1' },
          { value: 'tag2', label: 'Tag 2' },
        ],
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'multiOption', operator: 'includes' },
        column: multiOptionColumn,
        values: ['tag1', 'tag2'],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'multiOption', operator: 'includes' },
        column: multiOptionColumn,
        values: ['tag1', 'invalid'],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
    expect(invalidResult.current.error).toContain('Invalid option');
  });

  it('should handle custom validation functions', () => {
    const customColumn: ColumnDefinition = {
      ...mockColumn,
      filter: {
        validation: (value: any) => {
          if (typeof value === 'string' && value.length < 3) {
            return 'Value must be at least 3 characters';
          }
          return true;
        },
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: customColumn,
        values: ['valid'],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: customColumn,
        values: ['ab'],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
    expect(invalidResult.current.error).toBe('Value must be at least 3 characters');
  });

  it('should handle immediate validation', () => {
    const { result } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: mockColumn,
        values: ['test'],
        immediate: true,
      })
    );

    expect(result.current.isValid).toBe(true);
  });

  it('should skip validation when immediate is false', () => {
    const { result } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: mockColumn,
        values: ['test'],
        immediate: false,
      })
    );

    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('should handle empty values array', () => {
    const { result } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: mockColumn,
        values: [],
      })
    );

    expect(result.current.isValid).toBe(true);
  });

  it('should handle null/undefined values', () => {
    const { result } = renderHook(() =>
      useFilterValidation({
        filter: mockFilter,
        column: mockColumn,
        values: [null, undefined],
      })
    );

    expect(result.current.isValid).toBe(true);
  });

  it('should validate currency and percentage columns as numeric', () => {
    const currencyColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'currency',
      filter: {
        min: 0,
        max: 1000,
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'currency', operator: 'greaterThanOrEqual' },
        column: currencyColumn,
        values: [500],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'currency', operator: 'greaterThanOrEqual' },
        column: currencyColumn,
        values: [1500],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
  });

  it('should handle complex validation scenarios', () => {
    const complexColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'number',
      filter: {
        min: 10,
        max: 90,
        validation: (value: any) => {
          if (value % 2 !== 0) {
            return 'Value must be even';
          }
          return true;
        },
      },
    };

    const { result: validResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'number', operator: 'greaterThanOrEqual' },
        column: complexColumn,
        values: [20],
      })
    );

    expect(validResult.current.isValid).toBe(true);

    const { result: invalidResult } = renderHook(() =>
      useFilterValidation({
        filter: { ...mockFilter, type: 'number', operator: 'greaterThanOrEqual' },
        column: complexColumn,
        values: [21],
      })
    );

    expect(invalidResult.current.isValid).toBe(false);
    expect(invalidResult.current.error).toBe('Value must be even');
  });
});
