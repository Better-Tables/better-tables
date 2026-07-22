import { describe, expect, it } from 'bun:test';
import { httpAdapter } from '../src/adapters/http-adapter';
import { betterTables, defineTable, defineTableRow } from '../src/factory';
import type { FetchDataParams, TableAdapter } from '../src/types/adapter';
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

const createMockAdapter = (): TableAdapter<TestRecord> &
  SchemaAwareAdapter<{ tables: TestSchema }> =>
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

  describe('non-schema-aware adapters (no `$types` phantom)', () => {
    // `SchemaAwareAdapter` is all-optional (`{ $types?: T }`). Constraining
    // `betterTables()` to it triggered TypeScript's weak-type detection, which
    // REJECTED every adapter that doesn't carry `$types` ("has no properties in
    // common") -- i.e. exactly the REST/in-memory/http adapters its own docs
    // say are supported. These are compile-time regressions: if the constraint
    // regresses, this file stops typechecking.
    it('accepts a plain TableAdapter carrying no `$types`', () => {
      const plain: TableAdapter<TestRecord> = { ...createMockAdapter() };
      const tables = betterTables({ database: plain });

      expect(tables.database).toBe(plain);
    });

    it('accepts an httpAdapter (a client-side adapter with no `$types`)', () => {
      const tables = betterTables({ database: httpAdapter<TestRecord>({ url: '/api/tables' }) });

      expect(tables.database).toBeDefined();
      expect(tables.defaults).toEqual({});
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
      expect(usersTable.columns[0]).toMatchObject({
        id: 'name',
        displayName: 'Name',
        type: 'text',
      });
      expect(usersTable.columns[1]).toMatchObject({
        id: 'age',
        displayName: 'Age',
        type: 'number',
      });
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
      expect(
        viaMethod.columns.map((c) => ({ id: c.id, displayName: c.displayName, type: c.type }))
      ).toEqual(
        viaCurried.columns.map((c) => ({ id: c.id, displayName: c.displayName, type: c.type }))
      );
    });
  });

  describe('tables.fetchData(table, params) -- table-scoped read surface (plan 030)', () => {
    it('injects primaryTable: table.tableName into the underlying database.fetchData call', async () => {
      let capturedParams: FetchDataParams | undefined;
      const adapter = createMockAdapter();
      adapter.fetchData = async (params) => {
        capturedParams = params;
        return {
          data: [],
          total: 0,
          pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
        };
      };
      const tables = betterTables({ database: adapter });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name')],
      }));

      await tables.fetchData(usersTable, { pagination: { page: 2, limit: 5 } });

      expect(capturedParams?.primaryTable).toBe('users');
      expect(capturedParams?.pagination).toEqual({ page: 2, limit: 5 });
    });

    it('returns exactly what database.fetchData resolves to', async () => {
      const adapter = createMockAdapter();
      const expected = {
        data: [{ id: '1', name: 'Ada', email: 'ada@example.com', age: 30 }],
        total: 1,
        pagination: { page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
      adapter.fetchData = async () => expected;
      const tables = betterTables({ database: adapter });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name')],
      }));

      const result = await tables.fetchData(usersTable, {});

      expect(result).toEqual(expected);
    });

    it('a per-call primaryTable is not accepted -- TableScopedFetchDataParams omits it', () => {
      const tables = betterTables({ database: createMockAdapter() });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name')],
      }));

      tables.fetchData(usersTable, {
        // @ts-expect-error - primaryTable is injected from usersTable.tableName,
        // not a caller-supplied param on this surface (plan 030 Step 3).
        primaryTable: 'someOtherTable',
      });
      expect(true).toBe(true);
    });

    it('attaches derived specs from the table definition (plan 060)', async () => {
      let capturedParams: FetchDataParams | undefined;
      const adapter = createMockAdapter();
      adapter.meta = {
        ...adapter.meta,
        capabilities: {
          aggregates: {
            fns: ['count', 'sum', 'avg', 'min', 'max'],
            render: true,
            filter: true,
            sort: true,
          },
        },
      };
      adapter.fetchData = async (params) => {
        capturedParams = params;
        return {
          data: [],
          total: 0,
          pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
        };
      };
      const tables = betterTables({ database: adapter });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name'), t.count('posts')],
      }));

      await tables.fetchData(usersTable, { columns: ['name', 'postsCount'] });

      expect(capturedParams?.derived).toEqual([
        { columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' },
      ]);
    });

    it('throws when derived columns are present but the adapter lacks capabilities.aggregates', async () => {
      const adapter = createMockAdapter();
      const tables = betterTables({ database: adapter });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name'), t.count('posts')],
      }));

      await expect(tables.fetchData(usersTable, { columns: ['postsCount'] })).rejects.toThrow(
        /capabilities\.aggregates/
      );
    });
  });

  describe('tables.createRecord/updateRecord/deleteRecord -- table-scoped writes (plan 047)', () => {
    it('injects { table: table.tableName } into createRecord/updateRecord/deleteRecord', async () => {
      const adapter = createMockAdapter();
      const createCalls: unknown[] = [];
      const updateCalls: unknown[] = [];
      const deleteCalls: unknown[] = [];
      adapter.createRecord = async (data, options) => {
        createCalls.push({ data, options });
        return { id: '1', name: 'Ada', email: 'a@x.com', age: 1, ...data } as TestRecord;
      };
      adapter.updateRecord = async (id, data, options) => {
        updateCalls.push({ id, data, options });
        return { id, name: 'Ada', email: 'a@x.com', age: 1, ...data } as TestRecord;
      };
      adapter.deleteRecord = async (id, options) => {
        deleteCalls.push({ id, options });
      };

      const tables = betterTables({ database: adapter });
      const usersTable = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name')],
      }));

      await tables.createRecord(usersTable, { name: 'Ada' });
      await tables.updateRecord(usersTable, '1', { name: 'Ada Lovelace' });
      await tables.deleteRecord(usersTable, '1');

      expect(createCalls[0]).toEqual({
        data: { name: 'Ada' },
        options: { table: 'users' },
      });
      expect(updateCalls[0]).toEqual({
        id: '1',
        data: { name: 'Ada Lovelace' },
        options: { table: 'users' },
      });
      expect(deleteCalls[0]).toEqual({ id: '1', options: { table: 'users' } });
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
