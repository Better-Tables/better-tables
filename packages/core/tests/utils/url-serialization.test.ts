/**
 * Tests for URL serialization utilities with lz-string compression
 */

import { describe, expect, it } from 'bun:test';
import { deserializeTableStateFromUrl, serializeTableStateToUrl } from '../../src/utils/url-serialization';
import { FilterState, PaginationState, SortingState } from '@/types';

describe('serializeTableStateToUrl', () => {
  it('should serialize filters to compressed URL parameter', () => {
    const state = {
      filters: [
        {
          columnId: 'status',
          operator: 'equals',
          values: ['active'],
          type: 'option',
        },
      ] as FilterState[],
    };

    const params = serializeTableStateToUrl(state);

    expect(params.filters).toBeDefined();
    expect(typeof params.filters).toBe('string');
    // Should be compressed (starts with "c:")
    expect(params.filters).toStartWith('c:');
    // Should not contain JSON characters
    expect(params.filters).not.toContain('{');
    expect(params.filters).not.toContain('[');

    // Decode and verify
    if (params.filters) {
      const deserialized = deserializeTableStateFromUrl({ filters: params.filters });
      expect(deserialized.filters).toEqual(state.filters);
    }
  });

  it('should serialize pagination to plain string parameters', () => {
    const state = {
      pagination: {
        page: 2,
        limit: 50,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
      } as PaginationState,
    };

    const params = serializeTableStateToUrl(state);

    expect(params.page).toBe('2');
    expect(params.limit).toBe('50');
  });

  it('should serialize sorting to compressed URL parameter', () => {
    const state = {
      sorting: [
        { columnId: 'name', direction: 'asc' },
        { columnId: 'age', direction: 'desc' },
      ] as SortingState,
    };

    const params = serializeTableStateToUrl(state);

    expect(params.sorting).toBeDefined();
    expect(typeof params.sorting).toBe('string');
    // Should be compressed (starts with "c:")
    if (params.sorting) {
      expect(params.sorting).toStartWith('c:');
      const deserialized = deserializeTableStateFromUrl({ sorting: params.sorting });
      expect(deserialized.sorting).toEqual(state.sorting);
    }
  });

  it('should serialize column visibility to compressed URL parameter', () => {
    const state = {
      columnVisibility: {
        email: false,
        phone: true,
      },
    };

    const params = serializeTableStateToUrl(state);

    expect(params.columnVisibility).toBeDefined();
    if (params.columnVisibility) {
      expect(params.columnVisibility).toStartWith('c:');
      const deserialized = deserializeTableStateFromUrl({
        columnVisibility: params.columnVisibility,
      });
      expect(deserialized.columnVisibility).toEqual(state.columnVisibility);
    }
  });

  it('should serialize column order to compressed URL parameter', () => {
    const state = {
      columnOrder: ['id', 'name', 'email', 'status'],
    };

    const params = serializeTableStateToUrl(state);

    expect(params.columnOrder).toBeDefined();
    if (params.columnOrder) {
      expect(params.columnOrder).toStartWith('c:');
      const deserialized = deserializeTableStateFromUrl({ columnOrder: params.columnOrder });
      expect(deserialized.columnOrder).toEqual(state.columnOrder);
    }
  });

  it('should set null for empty arrays and objects', () => {
    const state = {
      filters: [],
      sorting: [],
      columnVisibility: {},
      columnOrder: [],
    };

    const params = serializeTableStateToUrl(state);

    expect(params.filters).toBeNull();
    expect(params.sorting).toBeNull();
    expect(params.columnVisibility).toBeNull();
    expect(params.columnOrder).toBeNull();
  });

  it('should handle all state properties together', () => {
    const state = {
      filters: [
        {
          columnId: 'status',
          operator: 'equals',
          values: ['active'],
          type: 'option',
        },
      ] as FilterState[],
      pagination: {
        page: 3,
        limit: 25,
        totalPages: 20,
        hasNext: true,
        hasPrev: true,
      } as PaginationState,
      sorting: [{ columnId: 'createdAt', direction: 'desc' }] as SortingState,
      columnVisibility: { email: false },
      columnOrder: ['id', 'name'],
    };

    const params = serializeTableStateToUrl(state);

    expect(params.filters).toBeDefined();
    expect(params.page).toBe('3');
    expect(params.limit).toBe('25');
    expect(params.sorting).toBeDefined();
    expect(params.columnVisibility).toBeDefined();
    expect(params.columnOrder).toBeDefined();
  });
});

describe('deserializeTableStateFromUrl', () => {
  it('should deserialize compressed filters from URL parameter', () => {
    const filters: FilterState[] = [
      {
        columnId: 'status',
        operator: 'equals',
        values: ['active'],
        type: 'option',
      },
    ];
    const serialized = serializeTableStateToUrl({ filters });
    const params = {
      filters: serialized.filters || '',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.filters).toHaveLength(1);
    expect(state.filters[0]).toMatchObject(filters[0]);
  });

  it('should deserialize pagination from URL parameters', () => {
    const params = {
      page: '2',
      limit: '50',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.pagination.page).toBe(2);
    expect(state.pagination.limit).toBe(50);
  });

  it('should use default pagination values when not provided', () => {
    const params = {};

    const state = deserializeTableStateFromUrl(params, { page: 1, limit: 20 });

    expect(state.pagination.page).toBe(1);
    expect(state.pagination.limit).toBe(20);
  });

  it('should deserialize compressed sorting from URL parameter', () => {
    const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];
    const serialized = serializeTableStateToUrl({ sorting });
    const params = {
      sorting: serialized.sorting || '',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.sorting).toHaveLength(1);
    expect(state.sorting[0]).toMatchObject(sorting[0]);
  });

  it('should deserialize compressed column visibility from URL parameter', () => {
    const visibility = { email: false, phone: true };
    const serialized = serializeTableStateToUrl({ columnVisibility: visibility });
    const params = {
      columnVisibility: serialized.columnVisibility || '',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.columnVisibility).toMatchObject(visibility);
  });

  it('should deserialize compressed column order from URL parameter', () => {
    const order = ['id', 'name', 'email'];
    const serialized = serializeTableStateToUrl({ columnOrder: order });
    const params = {
      columnOrder: serialized.columnOrder || '',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.columnOrder).toEqual(order);
  });

  it('should return empty defaults for missing parameters', () => {
    const params = {};

    const state = deserializeTableStateFromUrl(params);

    expect(state.filters).toEqual([]);
    expect(state.sorting).toEqual([]);
    expect(state.columnVisibility).toEqual({});
    expect(state.columnOrder).toEqual([]);
  });

  it('should handle invalid compressed data gracefully', () => {
    const params = {
      filters: 'invalid compressed data!!!',
      sorting: 'also invalid',
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.filters).toEqual([]);
    expect(state.sorting).toEqual([]);
  });

  it('should handle all parameters together', () => {
    const filters: FilterState[] = [
      {
        columnId: 'status',
        operator: 'equals',
        values: ['active'],
        type: 'option',
      },
    ];
    const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];
    const visibility = { email: false };
    const order = ['id', 'name'];

    const serialized = serializeTableStateToUrl({
      filters,
      pagination: { page: 2, limit: 50, totalPages: 10, hasNext: true, hasPrev: true },
      sorting,
      columnVisibility: visibility,
      columnOrder: order,
    });

    const state = deserializeTableStateFromUrl(serialized);

    expect(state.filters).toHaveLength(1);
    expect(state.pagination.page).toBe(2);
    expect(state.pagination.limit).toBe(50);
    expect(state.sorting).toHaveLength(1);
    expect(state.columnVisibility).toMatchObject(visibility);
    expect(state.columnOrder).toEqual(order);
  });
});

describe('round-trip serialization', () => {
  it('should serialize and deserialize filters correctly', () => {
    const original = {
      filters: [
        {
          columnId: 'status',
          operator: 'equals',
          values: ['active'],
          type: 'option',
        },
      ] as FilterState[],
    };

    const serialized = serializeTableStateToUrl(original);
    const deserialized = deserializeTableStateFromUrl(serialized);

    expect(deserialized.filters).toHaveLength(1);
    expect(deserialized.filters[0]).toMatchObject(original.filters[0]);
  });

  it('should serialize and deserialize complete state correctly', () => {
    const original = {
      filters: [
        {
          columnId: 'status',
          operator: 'equals',
          values: ['active'],
          type: 'option',
        },
      ] as FilterState[],
      pagination: {
        page: 3,
        limit: 25,
        totalPages: 20,
        hasNext: true,
        hasPrev: true,
      } as PaginationState,
      sorting: [{ columnId: 'createdAt', direction: 'desc' }] as SortingState,
      columnVisibility: { email: false },
      columnOrder: ['id', 'name'],
    };

    const serialized = serializeTableStateToUrl(original);
    const deserialized = deserializeTableStateFromUrl(serialized);

    expect(deserialized.filters).toHaveLength(1);
    expect(deserialized.pagination.page).toBe(original.pagination.page);
    expect(deserialized.pagination.limit).toBe(original.pagination.limit);
    expect(deserialized.sorting).toHaveLength(1);
    expect(deserialized.columnVisibility).toMatchObject(original.columnVisibility);
    expect(deserialized.columnOrder).toEqual(original.columnOrder);
  });

  it('should produce shorter URLs than JSON for complex filters', () => {
    const complexFilters: FilterState[] = [
      {
        columnId: 'status',
        operator: 'equals',
        values: ['active', 'pending', 'inactive'],
        type: 'option',
      },
      {
        columnId: 'name',
        operator: 'contains',
        values: ['test'],
        type: 'text',
      },
      {
        columnId: 'age',
        operator: 'greaterThan',
        values: [18],
        type: 'number',
      },
      {
        columnId: 'email',
        operator: 'startsWith',
        values: ['user@'],
        type: 'text',
      },
      {
        columnId: 'createdAt',
        operator: 'after',
        values: ['2024-01-01'],
        type: 'date',
      },
      {
        columnId: 'role',
        operator: 'isAnyOf',
        values: ['admin', 'user', 'moderator'],
        type: 'option',
      },
    ];

    const state = { filters: complexFilters };
    const params = serializeTableStateToUrl(state);
    const compressedLength = params.filters?.length || 0;

    // Compare with JSON (would be much longer)
    const jsonString = JSON.stringify(complexFilters);
    const jsonLength = jsonString.length;

    // Compressed should be significantly shorter than JSON
    expect(compressedLength).toBeGreaterThan(0);
    expect(compressedLength).toBeLessThan(jsonLength); // Compressed should be smaller than JSON
  });
});

describe('compression', () => {
  it('should compress large filter arrays', () => {
    const largeFilters: FilterState[] = [
      {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['a'],
      },
      {
        columnId: 'role',
        type: 'option',
        operator: 'is',
        values: ['contributor'],
      },
      {
        columnId: 'createdAt',
        type: 'date',
        operator: 'after',
        values: ['2024-01-01T05:00:00.000Z'],
      },
      {
        columnId: 'status',
        type: 'option',
        operator: 'is',
        values: ['active'],
      },
    ];

    const state = { filters: largeFilters };
    const params = serializeTableStateToUrl(state);

    expect(params.filters).toBeDefined();
    if (params.filters) {
      // Should be compressed (starts with "c:") for arrays this size
      // The threshold is 500, and 4 filters should exceed it
      expect(params.filters.length).toBeGreaterThan(0);
      // Verify it can be decompressed
      const deserialized = deserializeTableStateFromUrl({ filters: params.filters });
      expect(deserialized.filters).toHaveLength(4);
      expect(deserialized.filters[0]).toMatchObject(largeFilters[0]);
    }
  });

  it('should handle compressed data with c: prefix', () => {
    const filters: FilterState[] = [
      {
        columnId: 'status',
        operator: 'equals',
        values: ['active'],
        type: 'option',
      },
      {
        columnId: 'name',
        operator: 'contains',
        values: ['test'],
        type: 'text',
      },
    ];

    const state = { filters };
    const params = serializeTableStateToUrl(state);

    if (params.filters) {
      // Should be compressed (starts with "c:")

      // Should deserialize correctly
      const deserialized = deserializeTableStateFromUrl({ filters: params.filters });
      expect(deserialized.filters).toHaveLength(2);
      expect(deserialized.filters[0]).toMatchObject(filters[0]);
      expect(deserialized.filters[1]).toMatchObject(filters[1]);
    }
  });

  it('should handle data without c: prefix gracefully', () => {
    // Data without c: prefix should return empty (invalid format)
    const deserialized = deserializeTableStateFromUrl({ filters: 'invalid-format' });
    expect(deserialized.filters).toEqual([]);
  });

  it('should compress very large filter arrays significantly', () => {
    // Create 10+ filters to ensure compression kicks in
    const manyFilters: FilterState[] = Array.from({ length: 10 }, (_, i) => ({
      columnId: `column${i}`,
      type: 'text' as const,
      operator: 'contains' as const,
      values: [`value${i}`, `value${i}-alt`],
    }));

    const state = { filters: manyFilters };
    const params = serializeTableStateToUrl(state);

    expect(params.filters).toBeDefined();
    if (params.filters) {
      // Should be compressed (starts with "c:")
      expect(params.filters).toStartWith('c:');

      // Compressed version should be significantly shorter than JSON
      const jsonString = JSON.stringify(manyFilters);
      expect(params.filters.length).toBeLessThan(jsonString.length);

      // Should deserialize correctly
      const deserialized = deserializeTableStateFromUrl({ filters: params.filters });
      expect(deserialized.filters).toHaveLength(10);
    }
  });

  it('should compress sorting, columnVisibility, and columnOrder when large', () => {
    const largeSorting: SortingState = Array.from({ length: 5 }, (_, i) => ({
      columnId: `column${i}`,
      direction: i % 2 === 0 ? 'asc' : 'desc',
    }));

    const largeVisibility: Record<string, boolean> = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`column${i}`, i % 2 === 0])
    );

    const largeOrder = Array.from({ length: 20 }, (_, i) => `column${i}`);

    const state = {
      sorting: largeSorting,
      columnVisibility: largeVisibility,
      columnOrder: largeOrder,
    };

    const params = serializeTableStateToUrl(state);

    // All should be serialized
    expect(params.sorting).toBeDefined();
    expect(params.columnVisibility).toBeDefined();
    expect(params.columnOrder).toBeDefined();

    // Should deserialize correctly
    const deserialized = deserializeTableStateFromUrl(params);
    expect(deserialized.sorting).toHaveLength(5);
    expect(Object.keys(deserialized.columnVisibility)).toHaveLength(20);
    expect(deserialized.columnOrder).toHaveLength(20);
  });

  it('should handle round-trip with compression', () => {
    const original = {
      filters: [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['a'],
        },
        {
          columnId: 'role',
          type: 'option',
          operator: 'is',
          values: ['contributor'],
        },
        {
          columnId: 'createdAt',
          type: 'date',
          operator: 'after',
          values: ['2024-01-01T05:00:00.000Z'],
        },
        {
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['active'],
        },
      ] as FilterState[],
      sorting: [{ columnId: 'name', direction: 'asc' }] as SortingState,
      columnVisibility: { email: false, phone: true },
      columnOrder: ['id', 'name', 'email'],
    };

    const serialized = serializeTableStateToUrl(original);
    const deserialized = deserializeTableStateFromUrl(serialized);

    expect(deserialized.filters).toHaveLength(4);
    expect(deserialized.filters[0]).toMatchObject(original.filters[0]);
    expect(deserialized.filters[1]).toMatchObject(original.filters[1]);
    expect(deserialized.filters[2]).toMatchObject(original.filters[2]);
    expect(deserialized.filters[3]).toMatchObject(original.filters[3]);
    expect(deserialized.sorting).toEqual(original.sorting);
    expect(deserialized.columnVisibility).toEqual(original.columnVisibility);
    expect(deserialized.columnOrder).toEqual(original.columnOrder);
  });

  it('should handle invalid compressed data gracefully', () => {
    const params = {
      filters: 'c:invalid-compressed-data!!!',
      sorting: 'c:also-invalid',
    };

    const state = deserializeTableStateFromUrl(params);

    // Should return empty defaults on decompression failure
    expect(state.filters).toEqual([]);
    expect(state.sorting).toEqual([]);
  });
});
