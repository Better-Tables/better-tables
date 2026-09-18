import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AdapterMeta, TableAdapter } from '@better-tables/core';

const META: AdapterMeta = {
  name: 'test',
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

function makeStubDatabase() {
  const fetchCalls: unknown[] = [];
  const database: TableAdapter = {
    meta: META,
    async fetchData(params) {
      fetchCalls.push(params);
      return {
        data: [],
        total: 0,
        pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
      };
    },
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
  };
  return { database, fetchCalls };
}

let currentDatabase = makeStubDatabase();

mock.module('@/lib/demo/support/db', () => ({
  getSupportTables: mock(async () => ({ database: currentDatabase.database })),
}));

// Import after mock.module so the route binds to the stub.
const { POST } = await import('./route');

afterAll(() => {
  mock.restore();
});

describe('POST /api/tables/support-admin', () => {
  beforeEach(() => {
    currentDatabase = makeStubDatabase();
  });

  afterEach(() => {
    mock.restore();
  });

  it('dispatches fetchData for an allowlisted table', async () => {
    const response = await POST(
      new Request('http://localhost/api/tables/support-admin', {
        method: 'POST',
        body: JSON.stringify({
          method: 'fetchData',
          params: { primaryTable: 'tickets', pagination: { page: 1, limit: 10 } },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(currentDatabase.fetchCalls).toHaveLength(1);
  });

  it('rejects fetchData for a table outside the allowlist, without reaching the adapter', async () => {
    const response = await POST(
      new Request('http://localhost/api/tables/support-admin', {
        method: 'POST',
        body: JSON.stringify({
          method: 'fetchData',
          params: { primaryTable: 'other', pagination: { page: 1, limit: 10 } },
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Table not allowed on this endpoint.',
      kind: 'bad_request',
    });
    expect(currentDatabase.fetchCalls).toHaveLength(0);
  });

  it('rejects a malformed fetchData body (missing params) as a clean rejection, not a 500', async () => {
    const response = await POST(
      new Request('http://localhost/api/tables/support-admin', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData' }),
      })
    );

    expect(response.status).toBe(403);
    expect(currentDatabase.fetchCalls).toHaveLength(0);
  });

  it('allows listTables through unconditionally', async () => {
    const response = await POST(
      new Request('http://localhost/api/tables/support-admin', {
        method: 'POST',
        body: JSON.stringify({ method: 'listTables' }),
      })
    );

    // The stub adapter has no listTables — the wire protocol reports that
    // as a 400 bad_request, not a rejection by this route's own guard.
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ kind: 'bad_request' });
  });
});
