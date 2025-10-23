import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterManager } from '../../src/managers/filter-manager';
import type { ColumnDefinition } from '../../src/types/column';
import type { FilterState } from '../../src/types/filter';

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
  let filterManager: FilterManager;

  beforeEach(() => {
    filterManager = new FilterManager(mockColumns);
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
      const filter: FilterState = {
        columnId: 'name',
        type: 'number', // Wrong type
        operator: 'contains',
        values: ['John'],
      };

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

    it('should reject filter with wrong value count', () => {
      const filter: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'between',
        values: [25], // Should be 2 values
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 2 values');
    });

    it('should reject filter with values for no-value operator', () => {
      const filter: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'isNull',
        values: ['test'], // Should be no values
      };

      const result = filterManager.validateFilter(filter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires no values');
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
      const callback = vi.fn();
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
      const callback = vi.fn();

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
      const callback = vi.fn();

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
      const callback = vi.fn();

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
      const callback = vi.fn();
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
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

      consoleSpy.mockRestore();
    });
  });
});
