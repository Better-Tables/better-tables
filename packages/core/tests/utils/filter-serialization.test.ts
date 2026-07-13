import { describe, expect, it, mock } from 'bun:test';
import type { FilterGroupNode, FilterState } from '../../src/types/filter';
import { compressAndEncode } from '../../src/utils/compression';
import {
  deserializeFiltersFromURL,
  serializeFiltersToURL,
} from '../../src/utils/filter-serialization';
import { isFilterGroupNode } from '../../src/utils/type-guards';

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
    expect(deserialized[0]?.meta).toEqual(mockFilterWithMeta.meta);
    expect(deserialized[0]?.includeNull).toBe(true);
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

    expect(deserialized[0]?.includeNull).toBe(true);
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
    expect(deserialized[0]?.values[0]).toBe(
      'The type of this operator is columnId-based and uses values from meta'
    );
    expect(deserialized[1]?.values[0]).toBe('includeNull in values should not be replaced');
    expect(deserialized[2]?.values[0]).toBe('This text has type, operator, and columnId words');
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
    expect(deserialized[0]?.meta?.description).toBe('The type operator is used');
    expect(deserialized[0]?.meta?.nested).toEqual({
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
      expect(deserialized[0]?.columnId).toBe('name');
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
    expect(deserialized[0]?.columnId).toBe('name');
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
    expect(deserialized[0]?.columnId).toBe('name');
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

describe('contract v2 -- filter groups (plan 015)', () => {
  it('round-trips a nested (status AND (role OR role)) tree structurally identically', () => {
    const tree: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        { columnId: 'status', type: 'option', operator: 'is', values: ['active'] },
        {
          kind: 'group',
          logic: 'or',
          children: [
            { columnId: 'role', type: 'option', operator: 'is', values: ['admin'] },
            { columnId: 'role', type: 'option', operator: 'is', values: ['editor'] },
          ],
        },
      ],
    };

    const serialized = serializeFiltersToURL(tree);
    expect(serialized).toStartWith('c2:');

    const deserialized = deserializeFiltersFromURL(serialized);
    expect(deserialized).toEqual(tree);
    expect(isFilterGroupNode(deserialized)).toBe(true);
  });

  it('reads a legacy c: payload as a flat FilterState[] with no error or warning', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const legacy: FilterState[] = [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
      ];
      // Simulate a URL saved before plan 015: raw compressAndEncode still
      // defaults to the legacy "c:" prefix.
      const legacyUrl = compressAndEncode(legacy);
      expect(legacyUrl).toStartWith('c:');
      expect(legacyUrl).not.toStartWith('c2:');

      const deserialized = deserializeFiltersFromURL(legacyUrl);

      expect(deserialized).toEqual(legacy);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('fails closed on a group nested beyond the depth cap (drops the over-deep subtree, does not throw)', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      // depth 1 (root) -> 2 -> 3 -> 4 (over the default cap of 3)
      const overDeep = {
        kind: 'group',
        logic: 'and',
        children: [
          {
            kind: 'group',
            logic: 'and',
            children: [
              {
                kind: 'group',
                logic: 'and',
                children: [
                  {
                    kind: 'group',
                    logic: 'and',
                    children: [
                      { columnId: 'deep', type: 'text', operator: 'contains', values: ['x'] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const serialized = compressAndEncode(overDeep, 'c2:');

      let deserialized: FilterState[] | FilterGroupNode = [];
      expect(() => {
        deserialized = deserializeFiltersFromURL(serialized);
      }).not.toThrow();

      // The entire tree is a single over-deep chain, so the whole subtree
      // (down to the root) is dropped -- fail closed, not a throw.
      expect(deserialized).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('drops an empty group and unwraps a single-child group on read', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const emptyGroupUrl = compressAndEncode({ kind: 'group', logic: 'and', children: [] }, 'c2:');
      expect(deserializeFiltersFromURL(emptyGroupUrl)).toEqual([]);

      const soleChild: FilterState = {
        columnId: 'status',
        type: 'option',
        operator: 'is',
        values: ['active'],
      };
      const singletonUrl = compressAndEncode(
        { kind: 'group', logic: 'and', children: [soleChild] },
        'c2:'
      );
      expect(deserializeFiltersFromURL(singletonUrl)).toEqual([soleChild]);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('drops a node with tampered logic and keeps its valid siblings', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    try {
      const tampered = {
        kind: 'group',
        logic: 'and',
        children: [
          { columnId: 'status', type: 'option', operator: 'is', values: ['active'] },
          {
            kind: 'group',
            logic: 'xor', // invalid -- neither 'and' nor 'or'
            children: [{ columnId: 'role', type: 'option', operator: 'is', values: ['admin'] }],
          },
        ],
      };
      const serialized = compressAndEncode(tampered, 'c2:');

      const deserialized = deserializeFiltersFromURL(serialized);

      // The 'xor' sibling is dropped; the one valid child remains and is
      // unwrapped (and/or of one thing is that thing).
      expect(deserialized).toEqual([
        { columnId: 'status', type: 'option', operator: 'is', values: ['active'] },
      ]);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('CORE-06 regression: meta/values keys colliding with structural short codes round-trip byte-identically', () => {
    // `meta` has keys literally named `kind`, `c`, and `children` -- short
    // codes for FilterGroupNode's discriminant, columnId, and children. A
    // `json` filter's `values` holds an object containing a `logic` key.
    // None of this is structural; it must survive compress -> decompress
    // untouched (plans/design/core-contract-v2.md §1.3, CORE-06).
    const filter: FilterState = {
      columnId: 'weird',
      type: 'json',
      operator: 'equals',
      values: [{ logic: 'and', foo: 'bar' }],
      meta: {
        kind: 'x',
        c: 'y',
        children: [1],
      },
    };

    const serialized = serializeFiltersToURL([filter]);
    const deserialized = deserializeFiltersFromURL(serialized);

    expect(deserialized).toEqual([filter]);
  });
});
