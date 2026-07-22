import { describe, expect, it } from 'bun:test';
import { betterTables, defineTable } from '../src/factory';
import { csvExport } from '../src/plugins/csv-export';
import type { FetchDataResult, TableAdapter } from '../src/types/adapter';
import type { SchemaAwareAdapter } from '../src/types/paths';

/**
 * Plan 050: `csvExport()` rides plan 049's `afterFetch` hook — it captures the
 * most-recent fetch result and formats it as CSV/JSON. Verified end-to-end
 * through `betterTables({ plugins: [csvExport()] })`.
 */

interface Row {
  id: string;
  name: string;
  note: string;
}

type Schema = { users: { row: Row } };

function adapterReturning(rows: Row[]): TableAdapter<Row> & SchemaAwareAdapter<{ tables: Schema }> {
  return {
    fetchData: async (): Promise<FetchDataResult<Row>> => ({
      data: rows,
      total: rows.length,
      pagination: { page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
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
    $types: undefined as unknown as { tables: Schema },
  } satisfies TableAdapter<Row> & SchemaAwareAdapter<{ tables: Schema }>;
}

describe('csvExport() plugin', () => {
  const rows: Row[] = [
    { id: '1', name: 'Ada', note: 'first' },
    { id: '2', name: 'Grace', note: '=SUM(A1)' },
  ];

  it('produces CSV of the most recent fetch, with formula escaping', async () => {
    const csv = csvExport();
    const tables = betterTables({ database: adapterReturning(rows), plugins: [csv] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    // Before any fetch, there is nothing to format.
    expect(csv.toCsv()).toBe('');
    expect(csv.getLastResult()).toBeNull();

    await tables.fetchData(usersTable, {});

    const text = csv.toCsv();
    expect(text.split('\n')[0]).toBe('id,name,note');
    // The `=SUM(A1)` note is neutralized with a leading quote.
    expect(text).toContain(`"'=SUM(A1)"`);
    expect(csv.getLastResult()?.total).toBe(2);
  });

  it('produces JSON of the most recent fetch', async () => {
    const csv = csvExport();
    const tables = betterTables({ database: adapterReturning(rows), plugins: [csv] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    await tables.fetchData(usersTable, {});

    expect(JSON.parse(csv.toJson())).toEqual(rows);
  });

  it('does not modify the fetch result (pass-through)', async () => {
    const csv = csvExport();
    const tables = betterTables({ database: adapterReturning(rows), plugins: [csv] });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    const result = await tables.fetchData(usersTable, {});
    expect(result.data).toEqual(rows);
  });
});
