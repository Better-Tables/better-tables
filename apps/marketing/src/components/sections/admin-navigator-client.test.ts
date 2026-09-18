import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AdapterMeta, TableAdapter } from '@better-tables/core';
import { composeAdminNavigatorAdapter } from './admin-navigator-client';

const META: AdapterMeta = {
  name: 'test-read-adapter',
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
  supportedColumnTypes: ['text', 'number'],
  supportedOperators: { text: [], number: [] } as unknown as AdapterMeta['supportedOperators'],
};

function makeReadAdapter(): TableAdapter<Record<string, unknown>> & {
  listTables: NonNullable<TableAdapter<Record<string, unknown>>['listTables']>;
} {
  return {
    meta: META,
    async fetchData() {
      return {
        data: [],
        total: 0,
        pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
      };
    },
    // These would resolve against the WRONG table for a multi-table
    // endpoint (see composeAdminNavigatorAdapter's own doc comment) —
    // present here so a test can prove the composed adapter never calls
    // through to them.
    getFilterOptions: async () => [{ value: 'wrong-table-value', label: 'Wrong' }],
    getFacetedValues: async () => new Map([['wrong-table-value', 99]]),
    getMinMaxValues: async () => [1, 99],
    getFacets: async () => ({
      values: { status: new Map([['wrong-table-value', 99]]) },
      ranges: { age: [1, 99] as [number, number] },
    }),
    listTables: async () => [{ table: 'tickets', label: 'Tickets' }],
  };
}

// Injected directly into composeAdminNavigatorAdapter (not `mock.module`,
// which would replace `admin-actions.ts` for every other test file that
// imports it in the same test run).
const createSupportRecordMock = mock(async (table: string, data: Record<string, unknown>) => ({
  id: 1,
  table,
  ...data,
}));
const updateSupportRecordMock = mock(
  async (table: string, id: string, data: Record<string, unknown>) => ({
    id,
    table,
    ...data,
  })
);

function makeAdapter() {
  return composeAdminNavigatorAdapter(makeReadAdapter(), {
    createSupportRecord: createSupportRecordMock,
    updateSupportRecord: updateSupportRecordMock,
  });
}

describe('composeAdminNavigatorAdapter', () => {
  beforeEach(() => {
    createSupportRecordMock.mockClear();
    updateSupportRecordMock.mockClear();
  });

  it('advertises create/update support even though the read adapter does not', () => {
    const adapter = makeAdapter();
    expect(adapter.meta.features.create).toBe(true);
    expect(adapter.meta.features.update).toBe(true);
    // The read adapter's other meta is preserved.
    expect(adapter.meta.name).toBe('test-read-adapter');
  });

  it('routes createRecord to createSupportRecord with the selected table', async () => {
    const adapter = makeAdapter();
    await adapter.createRecord?.({ name: 'Acme' }, { table: 'customers' });
    expect(createSupportRecordMock).toHaveBeenCalledWith('customers', { name: 'Acme' });
  });

  it('defaults createRecord/updateRecord to "tickets" when no table is given', async () => {
    const adapter = makeAdapter();
    await adapter.createRecord?.({ subject: 'Help' });
    expect(createSupportRecordMock).toHaveBeenCalledWith('tickets', { subject: 'Help' });

    await adapter.updateRecord?.('1', { subject: 'Help again' });
    expect(updateSupportRecordMock).toHaveBeenCalledWith('tickets', '1', {
      subject: 'Help again',
    });
  });

  it('routes updateRecord to updateSupportRecord with the selected table', async () => {
    const adapter = makeAdapter();
    await adapter.updateRecord?.('42', { name: 'Bob' }, { table: 'assignees' });
    expect(updateSupportRecordMock).toHaveBeenCalledWith('assignees', '42', { name: 'Bob' });
  });

  it('neutralizes every facet method instead of delegating to the read adapter', async () => {
    const adapter = makeAdapter();

    expect(await adapter.getFilterOptions('status')).toEqual([]);
    expect(await adapter.getFacetedValues('status')).toEqual(new Map());
    expect(await adapter.getMinMaxValues('age')).toEqual([0, 0]);
    expect(await adapter.getFacets?.([{ columnId: 'status', kind: 'values' }])).toEqual({
      values: {},
      ranges: {},
    });
  });

  it('passes listTables through from the read adapter unchanged', async () => {
    const readAdapter = makeReadAdapter();
    const adapter = composeAdminNavigatorAdapter(readAdapter, {
      createSupportRecord: createSupportRecordMock,
      updateSupportRecord: updateSupportRecordMock,
    });
    expect(await adapter.listTables()).toEqual([{ table: 'tickets', label: 'Tickets' }]);
  });
});
