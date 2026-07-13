import { describe, expect, it } from 'bun:test';
import { betterTables, defineTable, defineTableRow } from '../src/factory';
import type { TableAdapter } from '../src/types/adapter';
import type { SchemaAwareAdapter } from '../src/types/paths';

/**
 * Runtime tests for the 0.6 `betterTables()` instance + `defineTable()`
 * runtime (`plans/018-instance-api-runtime.md`, Step 2). Replaces the legacy
 * per-table `betterTables({database, columns, ...})` shell's test suite
 * (`ExtractAdapterRecord`, getter/setter `columns`/`adapter`, `getConfig`/
 * `updateConfig`) -- all REMOVED per the maintainer's 0.6 release-policy
 * decision (no deprecation interlude). "Adapter access" -- the one
 * still-meaningful legacy behavior called out in the plan -- is preserved as
 * `tables.database`.
 */

interface TestRecord {
  id: string;
  name: string;
  email: string;
  age: number;
}

type TestSchema = {
  users: { row: TestRecord };
};

const createMockAdapter = (): TableAdapter<TestRecord> & SchemaAwareAdapter<{ tables: TestSchema }> =>
  ({
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
    // Type-only phantom -- never read at runtime; see `SchemaAwareAdapter`.
    $types: undefined as unknown as { tables: TestSchema },
  }) satisfies TableAdapter<TestRecord> & SchemaAwareAdapter<{ tables: TestSchema }>;

describe('betterTables() instance', () => {
  describe('instance creation', () => {
    it('creates an instance exposing the configured adapter as `database`', () => {
      const adapter = createMockAdapter();
      const tables = betterTables({ database: adapter });

      expect(tables).toBeDefined();
      expect(tables.database).toBe(adapter);
    });

    it('defaults `defaults` to an empty object when omitted', () => {
      const tables = betterTables({ database: createMockAdapter() });

      expect(tables.defaults).toEqual({});
    });

    it('exposes `defaults` as passed', () => {
      const tables = betterTables({
        database: createMockAdapter(),
        defaults: { pageSize: 20, urlSync: true },
      });

      expect(tables.defaults).toEqual({ pageSize: 20, urlSync: true });
    });

    it('defaults `plugins` to an empty array when omitted', () => {
      const tables = betterTables({ database: createMockAdapter() });

      expect(tables.plugins).toEqual([]);
    });

    it('exposes `plugins` as passed', () => {
      const plugin = { name: 'csvExport' };
      const tables = betterTables({ database: createMockAdapter(), plugins: [plugin] });

      expect(tables.plugins).toEqual([plugin]);
    });

    it('isolates config between instances', () => {
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();
      const tables1 = betterTables({ database: adapter1, defaults: { pageSize: 10 } });
      const tables2 = betterTables({ database: adapter2, defaults: { pageSize: 50 } });

      expect(tables1.database).toBe(adapter1);
      expect(tables2.database).toBe(adapter2);
      expect(tables1.defaults).toEqual({ pageSize: 10 });
      expect(tables2.defaults).toEqual({ pageSize: 50 });
    });
  });

  describe('defineTable() -- curried form', () => {
    it('builds a table definition with path-typed columns', () => {
      const tables = betterTables({ database: createMockAdapter() });

      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name'), t.number('age').range(0, 130)],
      }));

      expect(usersTable.tableName).toBe('users');
      expect(usersTable.columns).toHaveLength(2);
      expect(usersTable.columns[0]).toMatchObject({ id: 'name', displayName: 'Name', type: 'text' });
      expect(usersTable.columns[1]).toMatchObject({ id: 'age', displayName: 'Age', type: 'number' });
    });

    it('the derived accessor reads the row value', () => {
      const tables = betterTables({ database: createMockAdapter() });

      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name')],
      }));

      const row: TestRecord = { id: '1', name: 'Ada', email: 'ada@example.com', age: 30 };
      expect(usersTable.columns[0]?.accessor(row)).toBe('Ada');
    });

    it('throws on duplicate column ids (computed/path collision guard)', () => {
      const tables = betterTables({ database: createMockAdapter() });

      expect(() =>
        defineTable<typeof tables>()('users', (t) => ({
          columns: [t.text('name'), t.computed('name', () => 'dup')],
        }))
      ).toThrow();
    });

    it('accepts a raw ColumnDefinition literal alongside path builders (escape hatch)', () => {
      const tables = betterTables({ database: createMockAdapter() });

      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [
          t.text('name'),
          {
            id: 'custom',
            displayName: 'Custom',
            type: 'custom',
            accessor: (row: TestRecord) => row.email.toUpperCase(),
          },
        ],
      }));

      expect(usersTable.columns).toHaveLength(2);
      const row: TestRecord = { id: '1', name: 'Ada', email: 'ada@example.com', age: 30 };
      expect(usersTable.columns[1]?.accessor(row)).toBe('ADA@EXAMPLE.COM');
    });
  });

  describe('tables.define() -- method form', () => {
    it('produces the same output as the curried form for the same input', () => {
      const tables = betterTables({ database: createMockAdapter() });

      const viaMethod = tables.define('users', (t) => ({
        columns: [t.text('name'), t.number('age').range(0, 130)],
      }));
      const viaCurried = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name'), t.number('age').range(0, 130)],
      }));

      expect(viaMethod.tableName).toBe(viaCurried.tableName);
      expect(viaMethod.columns.map((c) => ({ id: c.id, displayName: c.displayName, type: c.type }))).toEqual(
        viaCurried.columns.map((c) => ({ id: c.id, displayName: c.displayName, type: c.type }))
      );
    });
  });

  describe('defineTableRow() -- tier-2 escape hatch (schema-less adapters)', () => {
    interface RestCustomer {
      id: string;
      email: string;
    }

    it('compiles and works for an adapter without $types', () => {
      const customerTable = defineTableRow<RestCustomer>()('customers', (t) => ({
        columns: [t.text('email')],
      }));

      expect(customerTable.tableName).toBe('customers');
      expect(customerTable.columns[0]?.accessor({ id: '1', email: 'a@b.com' })).toBe('a@b.com');
    });
  });
});
