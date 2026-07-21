import { describe, expect, it } from 'bun:test';
import { betterTables, defineTable } from '../src/factory';
import { logPlugin } from '../src/plugins/log-plugin';
import type { FetchDataParams, FetchDataResult, TableAdapter } from '../src/types/adapter';
import type { TableDefPlugin } from '../src/types/factory';
import type { SchemaAwareAdapter } from '../src/types/paths';

/**
 * Plan 049: the `plugins` seam EXECUTES. `tables.fetchData` runs each plugin's
 * `beforeFetch` (in array order, threading params) before the adapter, then
 * each `afterFetch` (threading the result). These tests pin param mutation,
 * result mutation, registration order, error propagation, the empty-plugins
 * fast path, and the shipped `logPlugin`.
 */

interface Row {
  id: string;
  name: string;
}

type Schema = { users: { row: Row } };

/**
 * A mock adapter that records the params it received and returns a fixed page.
 * `rows` defaults to two rows so `afterFetch` transforms are observable.
 */
function createAdapter(
  rows: Row[] = [
    { id: '1', name: 'Ada' },
    { id: '2', name: 'Grace' },
  ]
): TableAdapter<Row> & SchemaAwareAdapter<{ tables: Schema }> & { lastParams?: FetchDataParams } {
  const adapter = {
    lastParams: undefined as FetchDataParams | undefined,
    fetchData: async (params: FetchDataParams): Promise<FetchDataResult<Row>> => {
      adapter.lastParams = params;
      return {
        data: rows,
        total: rows.length,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    },
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0] as [number, number],
    meta: {
      name: 'Mock',
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
        text: ['equals', 'contains'],
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
    $types: undefined as unknown as { tables: Schema },
  };
  return adapter as TableAdapter<Row> &
    SchemaAwareAdapter<{ tables: Schema }> & { lastParams?: FetchDataParams };
}

describe('plugin fetch hooks', () => {
  it('beforeFetch rewrites the params the adapter receives', async () => {
    const adapter = createAdapter();
    const addSearch: TableDefPlugin = {
      name: 'add-search',
      beforeFetch: ({ params }) => ({ ...params, search: 'ada' }),
    };
    const tables = betterTables({ database: adapter, plugins: [addSearch] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await tables.fetchData(usersTable, { pagination: { page: 1, limit: 20 } });

    // The adapter saw the plugin's edit AND the injected primaryTable.
    expect(adapter.lastParams?.search).toBe('ada');
    expect(adapter.lastParams?.primaryTable).toBe('users');
  });

  it('afterFetch transforms the returned result', async () => {
    const adapter = createAdapter();
    const upper: TableDefPlugin = {
      name: 'uppercase',
      afterFetch: ({ result }) => ({
        ...result,
        data: (result.data as Row[]).map((r) => ({ ...r, name: r.name.toUpperCase() })),
      }),
    };
    const tables = betterTables({ database: adapter, plugins: [upper] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    const result = await tables.fetchData(usersTable, {});

    expect((result.data as Row[]).map((r) => r.name)).toEqual(['ADA', 'GRACE']);
  });

  it('runs hooks in registration (array) order', async () => {
    const order: string[] = [];
    const adapter = createAdapter();
    const a: TableDefPlugin = {
      name: 'a',
      beforeFetch: ({ params }) => {
        order.push('before:a');
        return params;
      },
      afterFetch: ({ result }) => {
        order.push('after:a');
        return result;
      },
    };
    const b: TableDefPlugin = {
      name: 'b',
      beforeFetch: ({ params }) => {
        order.push('before:b');
        return params;
      },
      afterFetch: ({ result }) => {
        order.push('after:b');
        return result;
      },
    };
    const tables = betterTables({ database: adapter, plugins: [a, b] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await tables.fetchData(usersTable, {});

    // beforeFetch a→b before the fetch; afterFetch a→b after it.
    expect(order).toEqual(['before:a', 'before:b', 'after:a', 'after:b']);
  });

  it('threads a beforeFetch edit through to a later plugin and the adapter', async () => {
    const adapter = createAdapter();
    const first: TableDefPlugin = {
      name: 'first',
      beforeFetch: ({ params }) => ({ ...params, search: 'x' }),
    };
    let sawSearch: string | undefined;
    const second: TableDefPlugin = {
      name: 'second',
      beforeFetch: ({ params }) => {
        sawSearch = params.search;
        return { ...params, columns: ['name'] };
      },
    };
    const tables = betterTables({ database: adapter, plugins: [first, second] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await tables.fetchData(usersTable, {});

    expect(sawSearch).toBe('x'); // second saw first's edit
    expect(adapter.lastParams?.search).toBe('x');
    expect(adapter.lastParams?.columns).toEqual(['name']);
  });

  it('keeps primaryTable pinned even when beforeFetch returns a bare params object', async () => {
    const adapter = createAdapter();
    // This plugin does NOT spread `params` — it returns a fresh object. The
    // instance must still scope the fetch to the table (invariant, not the
    // plugin's responsibility).
    const clobber: TableDefPlugin = {
      name: 'clobber',
      beforeFetch: () => ({ search: 'only-this' }),
    };
    const tables = betterTables({ database: adapter, plugins: [clobber] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await tables.fetchData(usersTable, { pagination: { page: 1, limit: 20 } });

    expect(adapter.lastParams?.primaryTable).toBe('users');
    expect(adapter.lastParams?.search).toBe('only-this');
  });

  it('propagates a throwing hook (never swallowed)', async () => {
    const adapter = createAdapter();
    const boom: TableDefPlugin = {
      name: 'boom',
      beforeFetch: () => {
        throw new Error('hook failed');
      },
    };
    const tables = betterTables({ database: adapter, plugins: [boom] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await expect(tables.fetchData(usersTable, {})).rejects.toThrow('hook failed');
  });

  it('leaves the no-plugin path unchanged', async () => {
    const adapter = createAdapter();
    const tables = betterTables({ database: adapter });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    const result = await tables.fetchData(usersTable, { pagination: { page: 1, limit: 20 } });

    expect(result.total).toBe(2);
    expect(adapter.lastParams?.primaryTable).toBe('users');
  });
});

describe('logPlugin', () => {
  it('reports row count/total to onFetch without altering the result', async () => {
    const adapter = createAdapter();
    const calls: Array<{ table: string; rowCount: number; total: number }> = [];
    const tables = betterTables({
      database: adapter,
      plugins: [
        logPlugin({
          onFetch: ({ table, rowCount, total }) => {
            calls.push({ table, rowCount, total });
          },
        }),
      ],
    });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    const result = await tables.fetchData(usersTable, {});

    expect(calls).toEqual([{ table: 'users', rowCount: 2, total: 2 }]);
    // Pass-through: the result is unchanged.
    expect((result.data as Row[]).map((r) => r.id)).toEqual(['1', '2']);
  });
});
