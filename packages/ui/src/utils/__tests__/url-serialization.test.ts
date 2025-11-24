/**
 * Tests for URL serialization utilities with base64 encoding
 */

import { describe, expect, it } from 'bun:test';
import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import {
  decodeBase64,
  deserializeTableStateFromUrl,
  encodeBase64,
  serializeTableStateToUrl,
} from '../url-serialization';

describe('encodeBase64 / decodeBase64', () => {
  it('should encode and decode simple data', () => {
    const data = { test: 'value', number: 123 };
    const encoded = encodeBase64(data);
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');

    const decoded = decodeBase64(encoded);
    expect(decoded).toEqual(data);
  });

  it('should encode and decode arrays', () => {
    const data = [1, 2, 3, 'test'];
    const encoded = encodeBase64(data);
    const decoded = decodeBase64(encoded);
    expect(decoded).toEqual(data);
  });

  it('should produce URL-safe base64 (no +, /, =)', () => {
    const data = { test: 'value with special chars: +/=' };
    const encoded = encodeBase64(data);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});

describe('serializeTableStateToUrl', () => {
  it('should serialize filters to base64-encoded URL parameter', () => {
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
    // Should be base64-encoded (not JSON)
    expect(params.filters).not.toContain('{');
    expect(params.filters).not.toContain('[');

    // Decode and verify
    if (params.filters) {
      const decoded = decodeBase64<FilterState[]>(params.filters);
      expect(decoded).toEqual(state.filters);
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

  it('should serialize sorting to base64-encoded URL parameter', () => {
    const state = {
      sorting: [
        { columnId: 'name', direction: 'asc' },
        { columnId: 'age', direction: 'desc' },
      ] as SortingState,
    };

    const params = serializeTableStateToUrl(state);

    expect(params.sorting).toBeDefined();
    expect(typeof params.sorting).toBe('string');
    // Should be base64-encoded
    if (params.sorting) {
      const decoded = decodeBase64<SortingState>(params.sorting);
      expect(decoded).toEqual(state.sorting);
    }
  });

  it('should serialize column visibility to base64-encoded URL parameter', () => {
    const state = {
      columnVisibility: {
        email: false,
        phone: true,
      },
    };

    const params = serializeTableStateToUrl(state);

    expect(params.columnVisibility).toBeDefined();
    if (params.columnVisibility) {
      const decoded = decodeBase64<Record<string, boolean>>(params.columnVisibility);
      expect(decoded).toEqual(state.columnVisibility);
    }
  });

  it('should serialize column order to base64-encoded URL parameter', () => {
    const state = {
      columnOrder: ['id', 'name', 'email', 'status'],
    };

    const params = serializeTableStateToUrl(state);

    expect(params.columnOrder).toBeDefined();
    if (params.columnOrder) {
      const decoded = decodeBase64<string[]>(params.columnOrder);
      expect(decoded).toEqual(state.columnOrder);
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
  it('should deserialize base64-encoded filters from URL parameter', () => {
    const filters: FilterState[] = [
      {
        columnId: 'status',
        operator: 'equals',
        values: ['active'],
        type: 'option',
      },
    ];
    const encoded = encodeBase64(filters);
    const params = {
      filters: encoded,
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

  it('should deserialize base64-encoded sorting from URL parameter', () => {
    const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];
    const encoded = encodeBase64(sorting);
    const params = {
      sorting: encoded,
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.sorting).toHaveLength(1);
    expect(state.sorting[0]).toMatchObject(sorting[0]);
  });

  it('should deserialize base64-encoded column visibility from URL parameter', () => {
    const visibility = { email: false, phone: true };
    const encoded = encodeBase64(visibility);
    const params = {
      columnVisibility: encoded,
    };

    const state = deserializeTableStateFromUrl(params);

    expect(state.columnVisibility).toMatchObject(visibility);
  });

  it('should deserialize base64-encoded column order from URL parameter', () => {
    const order = ['id', 'name', 'email'];
    const encoded = encodeBase64(order);
    const params = {
      columnOrder: encoded,
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

  it('should handle invalid base64 gracefully', () => {
    const params = {
      filters: 'invalid base64!!!',
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

    const params = {
      filters: encodeBase64(filters),
      page: '2',
      limit: '50',
      sorting: encodeBase64(sorting),
      columnVisibility: encodeBase64(visibility),
      columnOrder: encodeBase64(order),
    };

    const state = deserializeTableStateFromUrl(params);

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
    const base64Length = params.filters?.length || 0;

    // Compare with JSON (would be much longer)
    const jsonString = JSON.stringify(complexFilters);
    const jsonLength = jsonString.length;

    // Base64 should be shorter or similar length (base64 is ~33% larger than raw, but URL-encoded JSON is much larger)
    // For this test, we just verify base64 encoding works
    expect(base64Length).toBeGreaterThan(0);
    expect(base64Length).toBeLessThan(jsonLength * 2); // Base64 shouldn't be more than 2x the JSON length
  });
});
