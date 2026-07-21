import { describe, expect, it } from 'bun:test';
import { type FetchLike, HttpAdapterError, httpAdapter } from '../../src/adapters/http-adapter';
import { createAdapterRouteHandler, handleAdapterRequest } from '../../src/adapters/http-handler';
import type {
  AdapterMeta,
  FacetQueryParams,
  FetchDataParams,
  FetchDataResult,
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
function makeServerAdapter(overrides?: Partial<TableAdapter<{ id: number; status: string }>>) {
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
    ...overrides,
  };
  return { adapter, calls };
}

/** A `fetch` that routes straight into the server handler — no network. */
function loopbackFetch<T>(
  server: TableAdapter<T>,
  options?: Parameters<typeof handleAdapterRequest>[2]
): FetchLike {
  return async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const envelope = await handleAdapterRequest(server, body, options);
    return {
      ok: envelope.ok,
      status: envelope.ok ? 200 : envelope.kind === 'server_error' ? 500 : 400,
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

  it('surfaces a server-side error as a generic HttpAdapterError', async () => {
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
    await expect(client.fetchData({})).rejects.toThrow('Adapter request failed.');
    await expect(client.fetchData({})).rejects.not.toThrow('boom from the DB');
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

  it('rejects a malformed body with a bad_request envelope', async () => {
    const { adapter: server } = makeServerAdapter();
    expect(await handleAdapterRequest(server, { method: 'nope' })).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
    });
    expect(await handleAdapterRequest(server, { method: 'getFacetedValues' })).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
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
    expect(await bad.json()).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
    });
  });

  it('sends static headers on every request', async () => {
    const seen: Array<Record<string, string> | undefined> = [];
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({
      url: '/api/tables',
      headers: { authorization: 'Bearer static' },
      fetch: async (url, init) => {
        seen.push(init?.headers);
        return loopbackFetch(server)(url, init);
      },
    });

    await client.getFilterOptions('status');
    expect(seen[0]?.authorization).toBe('Bearer static');
    expect(seen[0]?.['content-type']).toBe('application/json');
  });

  it('resolves headers as an async function per call', async () => {
    let n = 0;
    const seen: string[] = [];
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 0,
      headers: async () => {
        n += 1;
        return { 'x-call': String(n) };
      },
      fetch: async (url, init) => {
        seen.push(init?.headers?.['x-call'] ?? '');
        return loopbackFetch(server)(url, init);
      },
    });

    await client.getFilterOptions('status');
    await client.getFilterOptions('status');
    expect(seen).toEqual(['1', '2']);
  });

  it('throws HttpAdapterError when the response body is non-JSON', async () => {
    const client = httpAdapter({
      url: '/api/tables',
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token');
        },
      }),
    });

    await expect(client.fetchData({})).rejects.toThrow(/non-JSON/);
  });

  it('throws HttpAdapterError carrying status for a non-2xx error envelope', async () => {
    const client = httpAdapter({
      url: '/api/tables',
      fetch: async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          ok: false,
          error: 'Adapter request failed.',
          kind: 'server_error',
        }),
      }),
    });

    try {
      await client.fetchData({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpAdapterError);
      expect((error as HttpAdapterError).status).toBe(503);
      expect((error as Error).message).toBe('Adapter request failed.');
    }
  });

  it('round-trips fetchData faceted Maps over the wire', async () => {
    const { adapter: server } = makeServerAdapter({
      async fetchData() {
        return {
          data: [{ id: 1, status: 'open' }],
          total: 1,
          pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
          faceted: { status: new Map([['open', 2]]) },
        } satisfies FetchDataResult<{ id: number; status: string }>;
      },
    });
    const client = httpAdapter<{ id: number; status: string }>({
      url: '/api/tables',
      fetch: loopbackFetch(server),
    });

    const result = await client.fetchData({});
    const statusFacet = result.faceted?.status;
    expect(statusFacet).toBeInstanceOf(Map);
    expect(statusFacet?.get('open')).toBe(2);
  });

  it('propagates AbortError from fetch when the signal aborts', async () => {
    const controller = new AbortController();
    const client = httpAdapter({
      url: '/api/tables',
      fetch: async (_url, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          };
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      },
    });

    const pending = client.fetchData({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('authorize false returns 403 and never invokes the adapter factory', async () => {
    let built = 0;
    const handler = createAdapterRouteHandler(
      () => {
        built += 1;
        return makeServerAdapter().adapter;
      },
      { authorize: () => false }
    );

    const response = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData', params: {} }),
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Unauthorized.',
      kind: 'bad_request',
    });
    expect(built).toBe(0);
  });

  it('authorize may return a custom Response verbatim', async () => {
    const custom = new Response('login', {
      status: 401,
      headers: { 'www-authenticate': 'Bearer' },
    });
    const handler = createAdapterRouteHandler(makeServerAdapter().adapter, {
      authorize: () => custom,
    });

    const response = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData', params: {} }),
      })
    );
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('login');
  });

  it('constrainRequest pins primaryTable regardless of the client value', async () => {
    const { adapter: server, calls } = makeServerAdapter();
    const handler = createAdapterRouteHandler(server, {
      constrainRequest: (body) =>
        body.method === 'fetchData'
          ? { ...body, params: { ...body.params, primaryTable: 'tickets' } }
          : body,
    });

    await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({
          method: 'fetchData',
          params: { primaryTable: 'customers', pagination: { page: 1, limit: 1 } },
        }),
      })
    );

    const sent = calls.find((c) => c.method === 'fetchData')?.args[0] as FetchDataParams;
    expect(sent.primaryTable).toBe('tickets');
  });

  it('authorize throws map to 500 server_error and invoke onError', async () => {
    const seen: unknown[] = [];
    let built = 0;
    const handler = createAdapterRouteHandler(
      () => {
        built += 1;
        return makeServerAdapter().adapter;
      },
      {
        authorize: () => {
          throw new Error('auth boom');
        },
        onError: (error) => {
          seen.push(error);
        },
      }
    );

    const response = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData', params: {} }),
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Adapter request failed.',
      kind: 'server_error',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
    expect((seen[0] as Error).message).toBe('auth boom');
    expect(built).toBe(0);
  });

  it('constrainRequest throws map to 500 server_error and invoke onError', async () => {
    const seen: unknown[] = [];
    let built = 0;
    const handler = createAdapterRouteHandler(
      () => {
        built += 1;
        return makeServerAdapter().adapter;
      },
      {
        constrainRequest: () => {
          throw new Error('constrain boom');
        },
        onError: (error) => {
          seen.push(error);
        },
      }
    );

    const response = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData', params: {} }),
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Adapter request failed.',
      kind: 'server_error',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
    expect((seen[0] as Error).message).toBe('constrain boom');
    expect(built).toBe(0);
  });

  it('maps adapter throws to 500 server_error and malformed body to 400', async () => {
    const failing: TableAdapter = {
      meta: TEST_META,
      async fetchData() {
        throw new Error('secret sql fragment');
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
    const handler = createAdapterRouteHandler(failing);

    const serverError = await handler(
      new Request('http://x/api/tables', {
        method: 'POST',
        body: JSON.stringify({ method: 'fetchData', params: {} }),
      })
    );
    expect(serverError.status).toBe(500);
    expect(await serverError.json()).toEqual({
      ok: false,
      error: 'Adapter request failed.',
      kind: 'server_error',
    });

    const badRequest = await handler(
      new Request('http://x/api/tables', { method: 'POST', body: 'not json' })
    );
    expect(badRequest.status).toBe(400);
    expect(await badRequest.json()).toMatchObject({ kind: 'bad_request' });
  });

  it('serializes Date filter values as ISO strings on the wire', async () => {
    const { adapter: server, calls } = makeServerAdapter();
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });
    const when = new Date('2026-03-10T09:00:00.000Z');

    await client.fetchData({
      filters: [{ columnId: 'createdAt', type: 'date', operator: 'is', values: [when] }],
    });

    const sent = calls.find((c) => c.method === 'fetchData')?.args[0] as FetchDataParams;
    const value = (sent.filters as Array<{ values: unknown[] }>)[0]?.values[0];
    expect(typeof value).toBe('string');
    expect(value).toBe(when.toISOString());
  });

  it('dedups in-flight and caches getFacetedValues within cacheTtlMs', async () => {
    let fetchCount = 0;
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 50,
      fetch: async (url, init) => {
        fetchCount += 1;
        return loopbackFetch(server)(url, init);
      },
    });
    const params = {
      filters: [
        {
          columnId: 'priority',
          type: 'option' as const,
          operator: 'is' as const,
          values: ['high'],
        },
      ],
    };
    await Promise.all([
      client.getFacetedValues('status', params),
      client.getFacetedValues('status', params),
    ]);
    expect(fetchCount).toBe(1);
    await client.getFacetedValues('status', params);
    expect(fetchCount).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    await client.getFacetedValues('status', params);
    expect(fetchCount).toBe(2);
  });
  it('does not cache fetchData even when cacheTtlMs is set', async () => {
    let fetchCount = 0;
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 5000,
      fetch: async (url, init) => {
        fetchCount += 1;
        return loopbackFetch(server)(url, init);
      },
    });
    await client.fetchData({ pagination: { page: 1, limit: 10 } });
    await client.fetchData({ pagination: { page: 1, limit: 10 } });
    expect(fetchCount).toBe(2);
  });
  it('round-trips describeColumns spec lists (plan 054)', async () => {
    const specs = [
      {
        field: 'status',
        columnType: 'option' as const,
        label: 'Status',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
        nullable: false,
        primaryKey: false,
        foreignKey: false,
        writable: true,
      },
    ];
    const tables: Array<string | undefined> = [];
    const { adapter: server } = makeServerAdapter();
    server.describeColumns = async (table?: string) => {
      tables.push(table);
      return specs;
    };
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });

    expect(await client.describeColumns?.('tickets')).toEqual(specs);
    expect(tables).toEqual(['tickets']);

    // Table omitted — the optional arg crosses the wire as absent.
    expect(await client.describeColumns?.()).toEqual(specs);
    expect(tables).toEqual(['tickets', undefined]);
  });

  it('describeColumns on an adapter without the capability is a bad_request', async () => {
    const { adapter: server } = makeServerAdapter();
    expect(server.describeColumns).toBeUndefined();
    expect(await handleAdapterRequest(server, { method: 'describeColumns' })).toEqual({
      ok: false,
      error: 'Adapter does not support describeColumns.',
      kind: 'bad_request',
    });

    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });
    await expect(client.describeColumns?.('tickets')).rejects.toThrow(
      'Adapter does not support describeColumns.'
    );
  });

  it('rejects a describeColumns body with a non-string table', async () => {
    const { adapter: server } = makeServerAdapter();
    expect(await handleAdapterRequest(server, { method: 'describeColumns', table: 42 })).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
    });
  });

  it('caches describeColumns within cacheTtlMs (schema answers are stable)', async () => {
    let fetchCount = 0;
    const { adapter: server } = makeServerAdapter();
    server.describeColumns = async () => [];
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 5000,
      fetch: async (url, init) => {
        fetchCount += 1;
        return loopbackFetch(server)(url, init);
      },
    });

    await client.describeColumns?.('tickets');
    await client.describeColumns?.('tickets');
    expect(fetchCount).toBe(1);
    // A different table is a different cache key.
    await client.describeColumns?.('customers');
    expect(fetchCount).toBe(2);
  });

  it('does not cache failed facet requests', async () => {
    let fetchCount = 0;
    const failing: TableAdapter = {
      meta: TEST_META,
      async fetchData() {
        return {
          data: [],
          total: 0,
          pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
        };
      },
      async getFilterOptions() {
        return [];
      },
      async getFacetedValues() {
        throw new Error('boom');
      },
      async getMinMaxValues() {
        return [0, 0];
      },
    };
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 5000,
      fetch: async (url, init) => {
        fetchCount += 1;
        return loopbackFetch(failing)(url, init);
      },
    });
    await expect(client.getFacetedValues('status')).rejects.toBeInstanceOf(HttpAdapterError);
    await expect(client.getFacetedValues('status')).rejects.toBeInstanceOf(HttpAdapterError);
    expect(fetchCount).toBe(2);
  });
});

describe('httpAdapter export (plan 050)', () => {
  it('advertises export and formats CSV by reusing the fetch proxy', async () => {
    const { adapter: server, calls } = makeServerAdapter();
    const client = httpAdapter<{ id: number; status: string }>({
      url: '/api/tables',
      fetch: loopbackFetch(server),
    });

    expect(client.meta.features.export).toBe(true);

    const result = await client.exportData?.({
      format: 'csv',
      filters: [{ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }],
      maxRows: 1000,
    });

    expect(result?.mimeType).toBe('text/csv');
    expect(result?.filename).toBe('export.csv');
    const csv = result?.data as string;
    expect(csv.split('\n')[0]).toBe('id,status');
    expect(csv).toContain('open');

    // Export went over the wire as a fetchData request carrying the filters + cap.
    const sent = calls.find((c) => c.method === 'fetchData')?.args[0] as FetchDataParams;
    expect(sent.pagination).toEqual({ page: 1, limit: 1000 });
    expect(sent.filters).toEqual([
      { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
    ]);
  });

  it('formats JSON', async () => {
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });
    const result = await client.exportData?.({ format: 'json' });
    expect(result?.mimeType).toBe('application/json');
    expect(JSON.parse(result?.data as string)).toEqual([{ id: 1, status: 'open' }]);
  });

  it('rejects Excel (unsupported over HTTP)', async () => {
    const { adapter: server } = makeServerAdapter();
    const client = httpAdapter({ url: '/api/tables', fetch: loopbackFetch(server) });
    await expect(client.exportData?.({ format: 'excel' })).rejects.toThrow(/excel/i);
  });
});
