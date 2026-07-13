import { describe, expect, it, mock } from 'bun:test';
import type { FilterState } from '../../src/types/filter';
import { compressAndEncode } from '../../src/utils/compression';
import {
  deserializeFiltersFromURL,
  serializeFiltersToURL,
} from '../../src/utils/filter-serialization';

// Mock data
const mockFilters: FilterState[] = [
  {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: ['John'],
  },
  {
    columnId: 'age',
    type: 'number',
    operator: 'greaterThan',
    values: [25],
  },
  {
    columnId: 'status',
    type: 'option',
    operator: 'is',
    values: ['active'],
  },
];

const mockFilterWithMeta: FilterState = {
  columnId: 'priority',
  type: 'option',
  operator: 'isAnyOf',
  values: ['high', 'urgent'],
  includeNull: true,
  meta: {
    customField: 'test',
    nested: { value: 123 },
  },
};

describe('serializeFiltersToURL', () => {
  it('should serialize filters to compressed URL-safe string', () => {
    const serialized = serializeFiltersToURL(mockFilters);

    expect(serialized).toBeTypeOf('string');
    expect(serialized.length).toBeGreaterThan(0);
    // Plan 015: WRITE always emits the c2: (group-aware) wire format now,
    // not the legacy c: prefix.
    expect(serialized).toStartWith('c2:');
  });

  it('should include metadata when present in filters', () => {
    const filtersWithMeta = [mockFilterWithMeta];
    const serialized = serializeFiltersToURL(filtersWithMeta);

    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];
    expect(deserialized[0].meta).toEqual(mockFilterWithMeta.meta);
    expect(deserialized[0].includeNull).toBe(true);
  });

  it('should handle empty filters array', () => {
    const serialized = serializeFiltersToURL([]);

    expect(serialized).toBeTypeOf('string');
    // Plan 015: WRITE always emits the c2: (group-aware) wire format now,
    // not the legacy c: prefix.
    expect(serialized).toStartWith('c2:');

    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];
    expect(deserialized).toEqual([]);
  });

  it('should always compress data', () => {
    const largeFilters: FilterState[] = Array.from({ length: 50 }, (_, i) => ({
      columnId: `veryLongColumnNameThatRepeatsOften${i}`,
      type: 'text',
      operator: 'contains',
      values: [`very long value that repeats often and makes the data much larger ${i}`],
    }));

    const serialized = serializeFiltersToURL(largeFilters);

    // Plan 015: WRITE always emits the c2: (group-aware) wire format now,
    // not the legacy c: prefix.
    expect(serialized).toStartWith('c2:');
    expect(serialized.length).toBeGreaterThan(0);
  });
});

describe('deserializeFiltersFromURL', () => {
  it('should deserialize filters from compressed URL string', () => {
    const serialized = serializeFiltersToURL(mockFilters);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(mockFilters);
  });

  it('should throw error for invalid data', () => {
    expect(() => {
      deserializeFiltersFromURL('invalid-data');
    }).toThrow();
  });

  it('should throw error for empty string', () => {
    expect(() => {
      deserializeFiltersFromURL('');
    }).toThrow('Empty URL string');
  });

  it('should throw error for non-compressed format', () => {
    expect(() => {
      deserializeFiltersFromURL('not-compressed-data');
    }).toThrow('Invalid format');
  });

  it('should preserve special properties', () => {
    const filtersWithProps = [mockFilterWithMeta];
    const serialized = serializeFiltersToURL(filtersWithProps);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized[0]).toEqual(mockFilterWithMeta);
  });

  it('should handle filters with includeNull', () => {
    const filterWithNull: FilterState = {
      columnId: 'status',
      type: 'option',
      operator: 'is',
      values: ['active'],
      includeNull: true,
    };

    const serialized = serializeFiltersToURL([filterWithNull]);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized[0].includeNull).toBe(true);
  });
});

describe('edge cases', () => {
  it('should handle filters with special characters', () => {
    const specialFilters: FilterState[] = [
      {
        columnId: 'search',
        type: 'text',
        operator: 'contains',
        values: ['special characters: !@#$%^&*()_+-=[]{}|;":,.<>?'],
      },
    ];

    const serialized = serializeFiltersToURL(specialFilters);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(specialFilters);
  });

  it('should handle filters with null/undefined values', () => {
    const filtersWithNulls: FilterState[] = [
      {
        columnId: 'optional',
        type: 'text',
        operator: 'isEmpty',
        values: [],
      },
    ];

    const serialized = serializeFiltersToURL(filtersWithNulls);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(filtersWithNulls);
  });

  it('should not corrupt values containing key names during compression', () => {
    // This tests the fix for the bug where string replacement was corrupting values
    const filtersWithKeyNames: FilterState[] = [
      {
        columnId: 'description',
        type: 'text',
        operator: 'contains',
        values: ['The type of this operator is columnId-based and uses values from meta'],
      },
      {
        columnId: 'metadata',
        type: 'text',
        operator: 'equals',
        values: ['includeNull in values should not be replaced'],
      },
      {
        columnId: 'info',
        type: 'option',
        operator: 'is',
        values: ['This text has type, operator, and columnId words'],
      },
    ];

    const serialized = serializeFiltersToURL(filtersWithKeyNames);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    // Values should be completely unchanged
    expect(deserialized).toEqual(filtersWithKeyNames);
    expect(deserialized[0].values[0]).toBe(
      'The type of this operator is columnId-based and uses values from meta'
    );
    expect(deserialized[1].values[0]).toBe('includeNull in values should not be replaced');
    expect(deserialized[2].values[0]).toBe('This text has type, operator, and columnId words');
  });

  it('should handle nested meta values containing key names', () => {
    const filtersWithNestedKeyNames: FilterState[] = [
      {
        columnId: 'complex',
        type: 'text',
        operator: 'contains',
        values: ['test'],
        includeNull: true,
        meta: {
          description: 'The type operator is used',
          nested: {
            info: 'columnId and values in nested meta',
            array: ['type', 'operator', 'includeNull'],
          },
        },
      },
    ];

    const serialized = serializeFiltersToURL(filtersWithNestedKeyNames);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(filtersWithNestedKeyNames);
    expect(deserialized[0].meta?.description).toBe('The type operator is used');
    expect(deserialized[0].meta?.nested).toEqual({
      info: 'columnId and values in nested meta',
      array: ['type', 'operator', 'includeNull'],
    });
  });

  it('should handle multiple filters with various types', () => {
    const complexFilters: FilterState[] = [
      {
        columnId: 'text',
        type: 'text',
        operator: 'contains',
        values: ['search term'],
      },
      {
        columnId: 'number',
        type: 'number',
        operator: 'between',
        values: [10, 20],
      },
      {
        columnId: 'date',
        type: 'date',
        operator: 'equals',
        values: ['2024-01-01'],
      },
      {
        columnId: 'option',
        type: 'option',
        operator: 'isAnyOf',
        values: ['option1', 'option2'],
      },
    ];

    const serialized = serializeFiltersToURL(complexFilters);
    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(complexFilters);
  });
});

describe('deserializeFiltersFromURL - untrusted/malformed input (URL boundary validation)', () => {
  it('drops a filter object missing `values` instead of crashing with a TypeError, and keeps valid filters', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const tampered = [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        { columnId: 'broken', type: 'text', operator: 'contains' }, // missing `values`
      ];
      const serialized = compressAndEncode(tampered);

      let deserialized: FilterState[] = [];
      expect(() => {
        // All fixtures in this file are flat FilterState[] payloads (implicit
        // AND); narrow the union return type accordingly, per plan 015.
        deserialized = deserializeFiltersFromURL(serialized) as FilterState[];
      }).not.toThrow();

      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].columnId).toBe('name');
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('drops a filter with an unknown `type` or unknown `operator`', () => {
    const tampered = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
      { columnId: 'bad-type', type: 'not-a-real-type', operator: 'contains', values: ['x'] },
      { columnId: 'bad-operator', type: 'text', operator: 'not-a-real-operator', values: ['x'] },
    ];
    const serialized = compressAndEncode(tampered);

    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toHaveLength(1);
    expect(deserialized[0].columnId).toBe('name');
  });

  it('drops a filter where `values` is a string, not an array', () => {
    const tampered = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
      { columnId: 'string-values', type: 'text', operator: 'contains', values: 'not-an-array' },
    ];
    const serialized = compressAndEncode(tampered);

    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toHaveLength(1);
    expect(deserialized[0].columnId).toBe('name');
  });

  it('round-trips a completely valid payload identically (regression guard)', () => {
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
      { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
    ];
    const serialized = serializeFiltersToURL(filters);

    // All fixtures in this file are flat FilterState[] payloads (implicit
    // AND); narrow the union return type accordingly, per plan 015.
    const deserialized = deserializeFiltersFromURL(serialized) as FilterState[];

    expect(deserialized).toEqual(filters);
  });

  it('still throws for a non-array payload (existing behavior preserved)', () => {
    const serialized = compressAndEncode({ columnId: 'name', type: 'text' });

    expect(() => {
      deserializeFiltersFromURL(serialized);
    }).toThrow('Invalid filter data format: expected array');
  });
});
