import { describe, expect, it } from 'bun:test';
import { type FetchLike, HttpAdapterError, httpAdapter } from '../../src/adapters/http-adapter';
import { createAdapterRouteHandler, handleAdapterRequest } from '../../src/adapters/http-handler';
import type {
  AdapterMeta,
  FacetQueryParams,
  FetchDataParams,
  TableAdapter,
} from '../../src/types/adapter';

const TEST_META: AdapterMeta = {
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
  supportedColumnTypes: ['text', 'number', 'option'],
  supportedOperators: {
    text: [],
    number: [],
    option: [],
  } as unknown as AdapterMeta['supportedOperators'],
};

/**
 * A tiny in-memory adapter standing in for a real (server-only) one. Records
 * the args it was called with so tests can assert they crossed the wire.
 */
function makeServerAdapter() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const adapter: TableAdapter<{ id: number; status: string }> = {
    meta: TEST_META,
    async fetchData(params: FetchDataParams) {
      calls.push({ method: 'fetchData', args: [params] });
      return {
        data: [{ id: 1, status: 'open' }],
        total: 1,
        pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
    async getFilterOptions(columnId: string, params?: FacetQueryParams) {
      calls.push({ method: 'getFilterOptions', args: [columnId, params] });
      return [{ label: 'Open', value: 'open' }];
    },
    async getFacetedValues(columnId: string, params?: FacetQueryParams) {
      calls.push({ method: 'getFacetedValues', args: [columnId, params] });
      return new Map([
        ['open', 12],
        ['closed', 3],
      ]);
    },
    async getMinMaxValues(columnId: string, params?: FacetQueryParams) {
      calls.push({ method: 'getMinMaxValues', args: [columnId, params] });
      return [0, 9];
    },
  };
  return { adapter, calls };
}

/** A `fetch` that routes straight into the server handler — no network. */
function loopbackFetch<T>(server: TableAdapter<T>): FetchLike {
  return async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const envelope = await handleAdapterRequest(server, body);
    return {
      ok: envelope.ok,
      status: envelope.ok ? 200 : 400,
      json: async () => envelope,
    };
  };
}

describe('httpAdapter <-> handleAdapterRequest round-trip', () => {
  it('proxies fetchData and strips the AbortSignal from the wire', async () => {
    const { adapter: server, calls } = makeServerAdapter();
    const client = httpAdapter<{ id: number; status: string }>({
      url: '/api/tables',
      fetch: loopbackFetch(server),
    });

    const result = await client.fetchData({
      pagination: { page: 1, limit: 10 },
      filters: [{ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }],
      signal: new AbortController().signal,
    });

    expect(result.total).toBe(1);
    expect(result.data[0]?.status).toBe('open');
    // The server received params WITHOUT `signal`.
    const sent = calls.find((c) => c.method === 'fetchData')?.args[0] as FetchDataParams;
    expect(sent.signal).toBeUndefined();
    expect(sent.pagination).toEqual({ page: 1, limit: 10 });
  });

  it('rebuilds a Map from getFacetedValues over the wire', async () => {
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });

    const map = await client.getFacetedValues('status', {
      filters: [{ columnId: 'priority', type: 'option', operator: 'is', values: ['high'] }],
    });

    expect(map).toBeInstanceOf(Map);
    expect(map.get('open')).toBe(12);
    expect(map.get('closed')).toBe(3);
  });

  it('proxies getMinMaxValues and getFilterOptions', async () => {
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });

    expect(await client.getMinMaxValues('reopens')).toEqual([0, 9]);
    expect(await client.getFilterOptions('status')).toEqual([{ label: 'Open', value: 'open' }]);
  });

  it('surfaces a server-side error as HttpAdapterError', async () => {
    const failing: TableAdapter = {
      meta: TEST_META,
      async fetchData() {
        throw new Error('boom from the DB');
      },
      async getFilterOptions() {
        return [];
      },
      async getFacetedValues() {
        return new Map();
      },
      async getMinMaxValues() {
        return [0, 0];
      },
    };
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(failing) });

    await expect(client.fetchData({})).rejects.toBeInstanceOf(HttpAdapterError);
    await expect(client.fetchData({})).rejects.toThrow('boom from the DB');
  });

  it('accepts a lazy adapter factory (finding 13: per-request construction)', async () => {
    const { adapter: server } = makeServerAdapter();
    let built = 0;
    const envelope = await handleAdapterRequest(
      () => {
        built += 1;
        return server;
      },
      { method: 'getMinMaxValues', columnId: 'reopens' }
    );
    expect(built).toBe(1);
    expect(envelope).toEqual({ ok: true, result: [0, 9] });
  });

  it('rejects a malformed body with an error envelope', async () => {
    const { adapter: server } = makeServerAdapter();
    expect(await handleAdapterRequest(server, { method: 'nope' })).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
    });
    expect(await handleAdapterRequest(server, { method: 'getFacetedValues' })).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
    });
  });

  it('createAdapterRouteHandler serves a web Request and returns JSON', async () => {
    const { adapter: server } = makeServerAdapter();
    const handler = createAdapterRouteHandler(server);

    const ok = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'getMinMaxValues', columnId: 'reopens' }),
      })
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, result: [0, 9] });

    const bad = await handler(
      new Request('http://x/api/tables', { method: 'POST', body: 'not json' })
    );
    expect(bad.status).toBe(400);
  });
});
