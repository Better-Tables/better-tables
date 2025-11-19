import { describe, expect, it } from 'vitest';
import { betterTables } from '../src/factory';
import type { TableAdapter } from '../src/types/adapter';
import type { ColumnDefinition } from '../src/types/column';

interface TestRecord {
  id: string;
  name: string;
  email: string;
}

describe('betterTables Factory', () => {
  const createMockAdapter = (): TableAdapter<TestRecord> => ({
    fetchData: async () => ({
      data: [],
      total: 0,
      pagination: {
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    meta: {
      name: 'Test Adapter',
      version: '1.0.0',
      features: {
        create: false,
        read: true,
        update: false,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text'],
      supportedOperators: {
        text: ['equals'],
        number: ['equals'],
        date: ['equals'],
        boolean: ['equals'],
        option: ['equals'],
        multiOption: ['equals'],
        currency: ['equals'],
        percentage: ['equals'],
        url: ['equals'],
        email: ['equals'],
        phone: ['equals'],
        json: ['equals'],
        custom: ['equals'],
      },
    },
  });

  const createMockColumn = (id: string): ColumnDefinition<TestRecord, unknown> => ({
    id,
    displayName: id,
    accessor: () => null,
    type: 'text',
  });

  describe('Instance Creation', () => {
    it('should create an instance with adapter', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      expect(instance).toBeDefined();
      expect(instance.adapter).toBe(adapter);
    });

    it('should create an instance with adapter and columns', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name'), createMockColumn('email')];
      const instance = betterTables({ database: adapter, columns });

      expect(instance.columns).toEqual(columns);
    });

    it('should create an instance with empty columns array', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter, columns: [] });

      expect(instance.columns).toEqual([]);
    });

    it('should default to empty array when columns is undefined', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      expect(instance.columns).toEqual([]);
    });
  });

  describe('Adapter Getter/Setter', () => {
    it('should get adapter via getter', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      expect(instance.adapter).toBe(adapter);
    });

    it('should set adapter via setter', () => {
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();
      const instance = betterTables({ database: adapter1 });

      expect(instance.adapter).toBe(adapter1);

      instance.adapter = adapter2;
      expect(instance.adapter).toBe(adapter2);
    });

    it('should update adapter and maintain other config', () => {
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter1, columns });

      instance.adapter = adapter2;

      expect(instance.adapter).toBe(adapter2);
      expect(instance.columns).toEqual(columns);
    });
  });

  describe('Columns Getter/Setter', () => {
    it('should get columns via getter', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name'), createMockColumn('email')];
      const instance = betterTables({ database: adapter, columns });

      expect(instance.columns).toEqual(columns);
    });

    it('should set columns via setter', () => {
      const adapter = createMockAdapter();
      const columns1 = [createMockColumn('name')];
      const columns2 = [createMockColumn('email')];
      const instance = betterTables({ database: adapter, columns: columns1 });

      expect(instance.columns).toEqual(columns1);

      instance.columns = columns2;
      expect(instance.columns).toEqual(columns2);
    });

    it('should handle setting columns to empty array', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      instance.columns = [];
      expect(instance.columns).toEqual([]);
    });

    it('should default to empty array when setting columns to null/undefined', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      instance.columns = null as unknown as ColumnDefinition<TestRecord, unknown>[];
      expect(instance.columns).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      const config = instance.getConfig();

      expect(config.database).toBe(adapter);
      expect(config.columns).toEqual(columns);
    });

    it('should return a copy of the config', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      const config1 = instance.getConfig();
      instance.columns = [createMockColumn('email')];
      const config2 = instance.getConfig();

      // Verify arrays are different references
      expect(config1.columns).not.toBe(instance.columns);
      expect(config1.columns).not.toBe(config2.columns);

      // Verify values
      expect(config1.columns).toHaveLength(1);
      if (config1.columns?.[0]) {
        expect(config1.columns[0].id).toBe('name');
      }
      expect(config2.columns).toHaveLength(1);
      if (config2.columns?.[0]) {
        expect(config2.columns[0].id).toBe('email');
      }
    });

    it('should include all config properties', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const pagination = {
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      const instance = betterTables({ database: adapter, columns, pagination });

      const config = instance.getConfig();

      expect(config.database).toBe(adapter);
      expect(config.columns).toEqual(columns);
      expect(config.pagination).toEqual(pagination);
    });

    it('should ensure returned config is immutable regarding internal state', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      const config = instance.getConfig();
      if (config.columns) {
        config.columns.push(createMockColumn('hacked'));
      }

      // Internal state should not be affected
      expect(instance.columns).toHaveLength(1);
      expect(instance.getConfig().columns).toHaveLength(1);
    });
  });

  describe('updateConfig', () => {
    it('should update columns in config', () => {
      const adapter = createMockAdapter();
      const columns1 = [createMockColumn('name')];
      const columns2 = [createMockColumn('email')];
      const instance = betterTables({ database: adapter, columns: columns1 });

      instance.updateConfig({ columns: columns2 });

      expect(instance.columns).toEqual(columns2);
      expect(instance.getConfig().columns).toEqual(columns2);
    });

    it('should preserve existing columns when not updating', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      instance.updateConfig({});

      expect(instance.columns).toEqual(columns);
    });

    it('should update multiple config properties', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const pagination1 = {
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      const pagination2 = {
        page: 2,
        limit: 50,
        totalPages: 1,
        hasNext: false,
        hasPrev: true,
      };
      const instance = betterTables({ database: adapter, columns, pagination: pagination1 });

      instance.updateConfig({ pagination: pagination2 });

      expect(instance.getConfig().pagination).toEqual(pagination2);
      expect(instance.columns).toEqual(columns); // Preserved
    });

    it('should handle updating columns with empty array', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      instance.updateConfig({ columns: [] });

      expect(instance.columns).toEqual([]);
    });

    it('should handle undefined columns in update', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const instance = betterTables({ database: adapter, columns });

      instance.updateConfig({ columns: undefined });

      expect(instance.columns).toEqual(columns); // Should preserve
    });

    it('should merge updates with existing config', () => {
      const adapter = createMockAdapter();
      const columns = [createMockColumn('name')];
      const pagination1 = {
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      const pagination2 = {
        page: 2,
        limit: 50,
        totalPages: 1,
        hasNext: false,
        hasPrev: true,
      };
      const instance = betterTables({ database: adapter, columns, pagination: pagination1 });

      instance.updateConfig({ pagination: pagination2 });

      const config = instance.getConfig();
      expect(config.database).toBe(adapter);
      expect(config.columns).toEqual(columns);
      expect(config.pagination).toEqual(pagination2);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for records', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      // TypeScript should infer TestRecord type
      const columns: ColumnDefinition<TestRecord, unknown>[] = [createMockColumn('name')];
      instance.columns = columns;

      expect(instance.columns).toEqual(columns);
    });
  });

  describe('Edge cases', () => {
    it('should handle minimal config with only adapter', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      expect(instance.adapter).toBe(adapter);
      expect(instance.columns).toEqual([]);
    });

    it('should handle multiple sequential updates', () => {
      const adapter = createMockAdapter();
      const instance = betterTables({ database: adapter });

      instance.updateConfig({ columns: [createMockColumn('name')] });
      expect(instance.columns).toHaveLength(1);

      instance.updateConfig({ columns: [createMockColumn('email'), createMockColumn('age')] });
      expect(instance.columns).toHaveLength(2);

      instance.updateConfig({ columns: [] });
      expect(instance.columns).toHaveLength(0);
    });

    it('should handle getter/setter interactions', () => {
      const adapter = createMockAdapter();
      const columns1 = [createMockColumn('name')];
      const columns2 = [createMockColumn('email')];
      const instance = betterTables({ database: adapter, columns: columns1 });

      // Use getter
      const currentColumns = instance.columns;
      expect(currentColumns).toEqual(columns1);

      // Use setter
      instance.columns = columns2;

      // Verify change via getter
      expect(instance.columns).toEqual(columns2);

      // Verify change via getConfig
      expect(instance.getConfig().columns).toEqual(columns2);
    });

    it('should handle config isolation between instances', () => {
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();
      const columns1 = [createMockColumn('name')];
      const columns2 = [createMockColumn('email')];

      const instance1 = betterTables({ database: adapter1, columns: columns1 });
      const instance2 = betterTables({ database: adapter2, columns: columns2 });

      expect(instance1.columns).toEqual(columns1);
      expect(instance2.columns).toEqual(columns2);

      instance1.columns = [createMockColumn('updated')];
      expect(instance2.columns).toEqual(columns2); // Unchanged
    });
  });
});
