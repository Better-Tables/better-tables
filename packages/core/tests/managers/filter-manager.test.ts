import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { FilterManager } from '../../src/managers/filter-manager';
import type { ColumnDefinition } from '../../src/types/column';
import type { FilterGroupNode, FilterState } from '../../src/types/filter';

interface TestData {
  name: string;
  age: number;
  birthDate: Date;
  status: string;
  tags: string[];
  active: boolean;
  readonly: string;
}

// Mock column definitions for testing
const mockColumns: ColumnDefinition<TestData>[] = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row: TestData) => row.name,
    filterable: true,
    sortable: true,
    resizable: true,
    filter: {
      operators: ['contains', 'equals', 'startsWith', 'endsWith'],
      debounce: 300,
    },
  },
  {
    id: 'age',
    displayName: 'Age',
    type: 'number',
    accessor: (row: TestData) => row.age,
    filterable: true,
    sortable: true,
    resizable: true,
    filter: {
      operators: ['equals', 'greaterThan', 'lessThan', 'between', 'isNull', 'isNotNull'],
      min: 0,
      max: 120,
    },
  },
  {
    id: 'birthDate',
    displayName: 'Birth Date',
    type: 'date',
    accessor: (row: TestData) => row.birthDate,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'status',
    displayName: 'Status',
    type: 'option',
    accessor: (row: TestData) => row.status,
    filterable: true,
    sortable: true,
    resizable: true,
    filter: {
      operators: ['is', 'isNot', 'isAnyOf'],
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending' },
      ],
    },
  },
  {
    id: 'tags',
    displayName: 'Tags',
    type: 'multiOption',
    accessor: (row: TestData) => row.tags,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'active',
    displayName: 'Active',
    type: 'boolean',
    accessor: (row: TestData) => row.active,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'readonly',
    displayName: 'Readonly',
    type: 'text',
    accessor: (row: TestData) => row.readonly,
    filterable: false, // Not filterable
    sortable: true,
    resizable: true,
  },
];

describe('FilterManager', () => {
  let filterManager: FilterManager<TestData>;

  beforeEach(() => {
    filterManager = new FilterManager<TestData>(mockColumns);
  });

  describe('initialization', () => {
    it('should initialize with empty filters', () => {
      expect(filterManager.getFilters()).toEqual([]);
    });

    it('should initialize with provided filters', () => {
      const initialFilters: FilterState[] = [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['John'],
        },
      ];

      const manager = new FilterManager(mockColumns, initialFilters);
      expect(manager.getFilters()).toEqual(initialFilters);
    });

    it('should filter out invalid initial filters', () => {
      const initialFilters: FilterState[] = [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['John'],
        },
        {
          columnId: 'nonexistent',
          type: 'text',
          operator: 'contains',
          values: ['test'],
        },
      ];

      const manager = new FilterManager(mockColumns, initialFilters);
      expect(manager.getFilters()).toHaveLength(1);
      expect(manager.getFilters()[0].columnId).toBe('name');
    });
  });

  describe('filter management', () => {
    it('should add a new filter', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      expect(filterManager.getFilters()).toHaveLength(1);
      expect(filterManager.getFilters()[0]).toEqual(filter);
    });

    it('should update existing filter for the same column', () => {
      const filter1: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      const filter2: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'equals',
        values: ['Jane'],
      };

      filterManager.addFilter(filter1);
      filterManager.addFilter(filter2);

      expect(filterManager.getFilters()).toHaveLength(1);
      expect(filterManager.getFilters()[0]).toEqual(filter2);
    });

    it('should remove a filter', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      expect(filterManager.getFilters()).toHaveLength(1);

      filterManager.removeFilter('name');
      expect(filterManager.getFilters()).toHaveLength(0);
    });

    it('should update filter values', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      filterManager.updateFilter('name', { values: ['Jane'] });

      expect(filterManager.getFilters()[0].values).toEqual(['Jane']);
    });

    it('should clear all filters', () => {
      const filter1: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      const filter2: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'equals',
        values: [25],
      };

      filterManager.addFilter(filter1);
      filterManager.addFilter(filter2);
      expect(filterManager.getFilters()).toHaveLength(2);

      filterManager.clearFilters();
      expect(filterManager.getFilters()).toHaveLength(0);
    });

    it('should set filters (replace all)', () => {
      const filter1: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      const filter2: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'equals',
        values: [25],
      };

      filterManager.addFilter(filter1);
      filterManager.setFilters([filter2]);

      expect(filterManager.getFilters()).toHaveLength(1);
      expect(filterManager.getFilters()[0]).toEqual(filter2);
    });
  });

  describe('filter queries', () => {
    beforeEach(() => {
      const filters: FilterState[] = [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['John'],
        },
        {
          columnId: 'age',
          type: 'number',
          operator: 'equals',
          values: [25],
        },
      ];

      for (const filter of filters) {
        filterManager.addFilter(filter);
      }
    });

    it('should get filter for specific column', () => {
      const filter = filterManager.getFilter('name');
      expect(filter).toBeDefined();
      expect(filter?.columnId).toBe('name');
    });

    it('should return undefined for non-existent filter', () => {
      const filter = filterManager.getFilter('nonexistent');
      expect(filter).toBeUndefined();
    });

    it('should check if column has filter', () => {
      expect(filterManager.hasFilter('name')).toBe(true);
      expect(filterManager.hasFilter('nonexistent')).toBe(false);
    });

    it('should get filtered column IDs', () => {
      const columnIds = filterManager.getFilteredColumnIds();
      expect(columnIds).toEqual(['name', 'age']);
    });

    it('should get filters by type', () => {
      const textFilters = filterManager.getFiltersByType('text');
      const numberFilters = filterManager.getFiltersByType('number');

      expect(textFilters).toHaveLength(1);
      expect(textFilters[0].columnId).toBe('name');

      expect(numberFilters).toHaveLength(1);
      expect(numberFilters[0].columnId).toBe('age');
    });
  });

  describe('filter validation', () => {
    it('should validate valid filters', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(true);
    });

    it('should reject filter for non-existent column', () => {
      const filter: FilterState = {
        columnId: 'nonexistent',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject filter for non-filterable column', () => {
      const filter: FilterState = {
        columnId: 'readonly',
        type: 'text',
        operator: 'contains',
        values: ['test'],
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not filterable');
    });

    it('should reject filter with wrong type', () => {
      const filter = {
        columnId: 'name',
        type: 'number', // Wrong type
        operator: 'contains',
        values: ['John'],
      } as unknown as FilterState;

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject filter with unknown operator', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'unknown' as never,
        values: ['John'],
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown operator');
    });

    it('should reject filter with disallowed operator', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'isNull', // Not in allowed operators
        values: [],
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject filter with wrong value count in strict mode', () => {
      const filter: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'between',
        values: [25], // Should be 2 values
      };

      // In strict mode (for query execution), incomplete filters should be rejected
      const result = filterManager.validateFilter(filter, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 2 values');
    });

    it('should allow filter with wrong value count in lenient mode', () => {
      const filter: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'between',
        values: [25], // Should be 2 values, but lenient mode allows incomplete
      };

      // In lenient mode (for UI editing), incomplete filters should be allowed with a warning
      const result = filterManager.validateFilter(filter, false);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('needs 2 values');
    });

    it('should reject filter with values for no-value operator', () => {
      const filter = {
        columnId: 'age',
        type: 'number',
        operator: 'isNull',
        values: ['test'], // Should be no values
      } as unknown as FilterState;

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires no values');
    });

    // Option A (CORE-10): includeNull satisfies the value requirement for
    // operators that otherwise need at least one value - a filter with
    // includeNull: true and empty values means "match null rows only".
    describe('includeNull semantics (CORE-10, Option A)', () => {
      it('should accept a null-only filter (includeNull + empty values) in strict mode', () => {
        const filter: FilterState = {
          columnId: 'age',
          type: 'number',
          operator: 'greaterThan',
          values: [],
          includeNull: true,
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(true);
      });

      it('should accept a null-only filter for a variable-value operator in strict mode', () => {
        const filter: FilterState = {
          columnId: 'status',
          type: 'option',
          operator: 'isAnyOf',
          values: [],
          includeNull: true,
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(true);
      });

      it('should accept includeNull combined with a satisfying values array in strict mode', () => {
        const filter: FilterState = {
          columnId: 'age',
          type: 'number',
          operator: 'greaterThan',
          values: [25],
          includeNull: true,
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(true);
      });

      it('should reject includeNull on an operator that already matches null (isNull)', () => {
        const filter: FilterState = {
          columnId: 'age',
          type: 'number',
          operator: 'isNull',
          values: [],
          includeNull: true,
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('includeNull');
      });

      it('should still reject plain empty values (no includeNull) in strict mode', () => {
        const filter: FilterState = {
          columnId: 'age',
          type: 'number',
          operator: 'greaterThan',
          values: [],
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires exactly 1 values');
      });

      it('should still reject plain empty values for a variable-value operator (no includeNull) in strict mode', () => {
        const filter: FilterState = {
          columnId: 'status',
          type: 'option',
          operator: 'isAnyOf',
          values: [],
        };

        const result = filterManager.validateFilter(filter, true);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires at least one value');
      });
    });
  });

  describe('operator management', () => {
    it('should get available operators for a column', () => {
      const operators = filterManager.getAvailableOperators('name');
      expect(operators).toHaveLength(4);
      expect(operators.map((op) => op.key)).toEqual([
        'contains',
        'equals',
        'startsWith',
        'endsWith',
      ]);
    });

    it('should return empty array for non-filterable column', () => {
      const operators = filterManager.getAvailableOperators('readonly');
      expect(operators).toHaveLength(0);
    });

    it('should return empty array for non-existent column', () => {
      const operators = filterManager.getAvailableOperators('nonexistent');
      expect(operators).toHaveLength(0);
    });

    it('should get default operators for column type', () => {
      const textOperators = filterManager.getDefaultOperatorsForType('text');
      expect(textOperators).toContain('contains');
      expect(textOperators).toContain('equals');

      const numberOperators = filterManager.getDefaultOperatorsForType('number');
      expect(numberOperators).toContain('equals');
      expect(numberOperators).toContain('greaterThan');

      const booleanOperators = filterManager.getDefaultOperatorsForType('boolean');
      expect(booleanOperators).toContain('isTrue');
      expect(booleanOperators).toContain('isFalse');
    });

    it('should get operator definition', () => {
      const operatorDef = filterManager.getOperatorDefinition('contains');
      expect(operatorDef).toBeDefined();
      expect(operatorDef?.key).toBe('contains');
      expect(operatorDef?.label).toBe('Contains');
      expect(operatorDef?.valueCount).toBe(1);
    });
  });

  describe('subscriptions', () => {
    it('should notify subscribers when filter is added', () => {
      const callback = mock();
      filterManager.subscribe(callback);

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);

      expect(callback).toHaveBeenCalledWith({
        type: 'filter_added',
        filter,
      });
    });

    it('should notify subscribers when filter is updated', () => {
      const callback = mock();

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      filterManager.subscribe(callback);

      const updatedFilter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'equals',
        values: ['Jane'],
      };

      filterManager.addFilter(updatedFilter);

      expect(callback).toHaveBeenCalledWith({
        type: 'filter_updated',
        columnId: 'name',
        filter: updatedFilter,
      });
    });

    it('should notify subscribers when filter is removed', () => {
      const callback = mock();

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      filterManager.subscribe(callback);

      filterManager.removeFilter('name');

      expect(callback).toHaveBeenCalledWith({
        type: 'filter_removed',
        columnId: 'name',
      });
    });

    it('should notify subscribers when filters are cleared', () => {
      const callback = mock();

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      filterManager.subscribe(callback);

      filterManager.clearFilters();

      expect(callback).toHaveBeenCalledWith({
        type: 'filters_cleared',
      });
    });

    it('should unsubscribe properly', () => {
      const callback = mock();
      const unsubscribe = filterManager.subscribe(callback);

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      filterManager.removeFilter('name');
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('serialization', () => {
    beforeEach(() => {
      const filters: FilterState[] = [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['John'],
        },
        {
          columnId: 'age',
          type: 'number',
          operator: 'equals',
          values: [25],
          includeNull: true,
          meta: { custom: 'data' },
        },
      ];

      for (const filter of filters) {
        filterManager.addFilter(filter);
      }
    });

    it('should serialize filters to JSON', () => {
      const json = filterManager.serialize();
      const parsed = JSON.parse(json);

      expect(parsed.filters).toHaveLength(2);
      expect(parsed.filters[0].columnId).toBe('name');
      expect(parsed.filters[1].columnId).toBe('age');
    });

    it('should serialize with compressed output', () => {
      const json = filterManager.serialize({ compress: true });
      expect(json).not.toContain('\n'); // No newlines in compressed output
    });

    it('should serialize with metadata when requested', () => {
      const json = filterManager.serialize({ includeMeta: true });
      const parsed = JSON.parse(json);

      expect(parsed.filters[1].meta).toEqual({ custom: 'data' });
    });

    it('should serialize without metadata by default', () => {
      const json = filterManager.serialize();
      const parsed = JSON.parse(json);

      expect(parsed.filters[1].meta).toBeUndefined();
    });

    it('should deserialize filters from JSON', () => {
      const json = filterManager.serialize();
      const newManager = new FilterManager(mockColumns);

      newManager.deserialize(json);

      expect(newManager.getFilters()).toHaveLength(2);
      expect(newManager.getFilters()[0].columnId).toBe('name');
      expect(newManager.getFilters()[1].columnId).toBe('age');
    });

    it('should handle deserialization errors', () => {
      expect(() => {
        filterManager.deserialize('invalid json');
      }).toThrow('Failed to deserialize filters');
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      const filters: FilterState[] = [
        {
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: ['John'],
        },
        {
          columnId: 'age',
          type: 'number',
          operator: 'equals',
          values: [25],
        },
        {
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['active'],
        },
      ];

      for (const filter of filters) {
        filterManager.addFilter(filter);
      }
    });

    it('should get filter statistics', () => {
      const stats = filterManager.getFilterStats();

      expect(stats.totalFilters).toBe(3);
      expect(stats.filtersByType.text).toBe(1);
      expect(stats.filtersByType.number).toBe(1);
      expect(stats.filtersByType.option).toBe(1);
      expect(stats.filtersByOperator.contains).toBe(1);
      expect(stats.filtersByOperator.equals).toBe(1);
      expect(stats.filtersByOperator.is).toBe(1);
    });
  });

  describe('cloning', () => {
    it('should clone the filter manager', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);
      const cloned = filterManager.clone();

      expect(cloned.getFilters()).toEqual(filterManager.getFilters());
      expect(cloned).not.toBe(filterManager); // Different instances
    });
  });

  describe('FilterNode state layer (plan 016)', () => {
    // A representative tree: status AND (name OR age). Two levels, valid
    // logic, no singletons/empties -- normalization leaves it untouched.
    const statusLeaf: FilterState = {
      columnId: 'status',
      type: 'option',
      operator: 'is',
      values: ['active'],
    };
    const nameLeaf: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'contains',
      values: ['John'],
    };
    const ageLeaf: FilterState = {
      columnId: 'age',
      type: 'number',
      operator: 'greaterThan',
      values: [30],
    };
    const tree: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        statusLeaf,
        { kind: 'group', logic: 'or', children: [nameLeaf, ageLeaf] },
      ],
    };

    it('flat regression: setFilters(flat) -> getFilters() behaves exactly as before', () => {
      // Behavioral snapshot of today's flat semantics: valid filters kept
      // in order, non-filterable dropped, and the tree accessor mirrors
      // the same flat array.
      filterManager.setFilters([
        nameLeaf,
        { columnId: 'readonly', type: 'text', operator: 'contains', values: ['x'] },
        ageLeaf,
      ]);

      expect(filterManager.getFilters()).toEqual([nameLeaf, ageLeaf]);
      expect(filterManager.getFilterNode()).toEqual([nameLeaf, ageLeaf]);
      expect(filterManager.getFilteredColumnIds()).toEqual(['name', 'age']);
    });

    it('tree round-trip: setFilterNode(tree) -> getFilterNode() structurally equal; getFilters() returns depth-first leaves', () => {
      filterManager.setFilterNode(tree);

      expect(filterManager.getFilterNode()).toEqual(tree);
      // Depth-first, order-preserving flat leaf view (display only).
      expect(filterManager.getFilters()).toEqual([statusLeaf, nameLeaf, ageLeaf]);
      expect(filterManager.hasFilter('name')).toBe(true);
      expect(filterManager.getFilter('age')).toEqual(ageLeaf);
    });

    it('replace semantic: legacy flat setFilters([x]) replaces a stored tree entirely', () => {
      filterManager.setFilterNode(tree);
      expect(filterManager.getFilterNode()).toEqual(tree);

      filterManager.setFilters([nameLeaf]);

      // The stored value is exactly the new flat array -- the tree is gone,
      // deterministically, with no silent merging into groups.
      expect(filterManager.getFilterNode()).toEqual([nameLeaf]);
      expect(filterManager.getFilters()).toEqual([nameLeaf]);
    });

    it('normalization on set: empty groups and unknown-logic nodes are dropped, singleton groups unwrapped', () => {
      const dirtyTree = {
        kind: 'group',
        logic: 'and',
        children: [
          statusLeaf,
          { kind: 'group', logic: 'or', children: [] }, // empty -> dropped
          { kind: 'group', logic: 'xor', children: [nameLeaf] }, // unknown logic -> dropped
        ],
      } as unknown as FilterGroupNode;

      filterManager.setFilterNode(dirtyTree);

      // After dropping both invalid children the root is a single-child
      // group, which unwraps to its sole leaf; a bare leaf is stored as a
      // length-1 flat array. Assert the outcome, not the mechanism.
      expect(filterManager.getFilterNode()).toEqual([statusLeaf]);
      expect(filterManager.getFilters()).toEqual([statusLeaf]);
    });

    it('events: setFilterNode notifies subscribers exactly once', () => {
      const subscriber: ReturnType<typeof mock> = mock();
      filterManager.subscribe(subscriber);

      filterManager.setFilterNode(tree);

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber.mock.calls[0][0]).toEqual({
        type: 'filters_replaced',
        filters: tree,
      });
    });

    it('cloning preserves a stored tree (tree stays a tree)', () => {
      filterManager.setFilterNode(tree);
      const cloned = filterManager.clone();

      expect(cloned.getFilterNode()).toEqual(tree);
      expect(cloned).not.toBe(filterManager);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid filter on addFilter', () => {
      const filter: FilterState = {
        columnId: 'nonexistent',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      expect(() => {
        filterManager.addFilter(filter);
      }).toThrow('Invalid filter');
    });

    it('should throw error for invalid filter on updateFilter', () => {
      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      filterManager.addFilter(filter);

      expect(() => {
        filterManager.updateFilter('name', { operator: 'unknown' as never });
      }).toThrow('Invalid filter update');
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = mock(() => {
        throw new Error('Subscriber error');
      });
      const originalError = console.error;
      const consoleSpy = mock();
      console.error = consoleSpy as typeof console.error;

      filterManager.subscribe(errorCallback);

      const filter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      };

      // Should not throw despite subscriber error
      expect(() => {
        filterManager.addFilter(filter);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in filter manager subscriber:',
        expect.any(Error)
      );

      console.error = originalError;
    });
  });
});
