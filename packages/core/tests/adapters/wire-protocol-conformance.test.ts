/**
 * @fileoverview Self-service wire-protocol compliance check (plan 065 Phase
 * 1). Every assertion here targets the JSON shapes documented in
 * `packages/core/docs/ADAPTER_WIRE_PROTOCOL.md` — never this repo's
 * TypeScript types directly — so a team implementing their own (non-JS)
 * endpoint can run this file against their server and get a pass/fail on
 * wire compatibility.
 *
 * Default: exercises an in-process reference server built from
 * `createAdapterRouteHandler` + `memoryAdapter` (zero external setup, always
 * runnable in CI). Point `WIRE_PROTOCOL_TEST_URL` at any endpoint to run the
 * SAME universal assertions against it:
 *
 *   WIRE_PROTOCOL_TEST_URL=https://your-app.example.com/api/tables/tickets \
 *     bun test packages/core/tests/adapters/wire-protocol-conformance.test.ts
 *
 * A few assertions are inherently specific to how THIS repo's reference
 * server is configured (e.g. exactly which `cellEdit` failure mode fires) —
 * those are skipped when an external URL is supplied, since they assert a
 * server-config choice rather than the wire format itself.
 */

/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { createAdapterRouteHandler } from '../../src/adapters/http-handler';
import { memoryAdapter } from '../../src/adapters/memory-adapter';
import type { AdapterMeta, TableAdapter } from '../../src/types/adapter';

interface Item {
  id: string;
  status: string;
  priority: string;
  reopens: number;
  createdAt: Date;
}

const ITEMS: Item[] = [
  {
    id: '1',
    status: 'open',
    priority: 'high',
    reopens: 2,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
  },
  {
    id: '2',
    status: 'open',
    priority: 'low',
    reopens: 0,
    createdAt: new Date('2026-02-10T00:00:00.000Z'),
  },
  {
    id: '3',
    status: 'closed',
    priority: 'high',
    reopens: 5,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
  },
];

const EXTERNAL_URL = process.env.WIRE_PROTOCOL_TEST_URL;
/** Assertions that only make sense against THIS repo's own reference server. */
const referenceOnly = EXTERNAL_URL ? it.skip : it;

function referenceHandler(): (request: Request) => Promise<Response> {
  return createAdapterRouteHandler(() => memoryAdapter(ITEMS, { tableName: 'items' }));
}

interface Envelope {
  status: number;
  json: { ok: true; result: unknown } | { ok: false; error: string; kind: string };
}

/**
 * POST a raw request body to whichever endpoint this run targets: an
 * externally supplied `WIRE_PROTOCOL_TEST_URL` (a team's own
 * implementation), or — when unset — this repo's own in-process reference
 * server, invoked through the exact Fetch-API `Request`/`Response` shape a
 * real HTTP call uses. `handler` is ignored when `WIRE_PROTOCOL_TEST_URL` is
 * set — an external run always targets the real endpoint.
 */
async function post(
  body: unknown,
  handler: (request: Request) => Promise<Response> = referenceHandler()
): Promise<Envelope> {
  if (EXTERNAL_URL) {
    const response = await fetch(EXTERNAL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  }
  const response = await handler(
    new Request('http://reference.local/adapter', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, json: await response.json() };
}

describe('wire protocol conformance (universal — runs against WIRE_PROTOCOL_TEST_URL too)', () => {
  it('fetchData: envelope carries data/total/pagination', async () => {
    const { status, json } = await post({
      method: 'fetchData',
      params: { pagination: { page: 1, limit: 10 } },
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) throw new Error('unreachable');
    const result = json.result as { data: unknown[]; total: number; pagination: object };
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('serialization rule: Date row values cross the wire as ISO strings', async () => {
    const { json } = await post({
      method: 'fetchData',
      params: { pagination: { page: 1, limit: 10 } },
    });
    if (!json.ok) throw new Error('unreachable');
    const rows = json.result as { data: Array<Record<string, unknown>> };
    const row = rows.data.find((r) => r.id === '1');
    expect(typeof row?.createdAt).toBe('string');
    const createdAt = row?.createdAt as string;
    expect(new Date(createdAt).toISOString()).toBe(createdAt);
  });

  it('a date filter value sent as an ISO string round-trips correctly', async () => {
    const { json } = await post({
      method: 'fetchData',
      params: {
        pagination: { page: 1, limit: 10 },
        filters: [
          {
            columnId: 'createdAt',
            type: 'date',
            operator: 'after',
            values: ['2026-02-01T00:00:00.000Z'],
          },
        ],
      },
    });
    if (!json.ok) throw new Error('unreachable');
    const result = json.result as { data: Array<{ id: string }> };
    expect(result.data.map((r) => r.id).sort()).toEqual(['2', '3']);
  });

  it('getFilterOptions: envelope is an array of {value, label}', async () => {
    const { status, json } = await post({ method: 'getFilterOptions', columnId: 'status' });
    expect(status).toBe(200);
    if (!json.ok) throw new Error('unreachable');
    const options = json.result as Array<{ value: string; label: string }>;
    expect(Array.isArray(options)).toBe(true);
    for (const option of options) {
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    }
  });

  it('serialization rule: getFacetedValues sends a Map as [value, count][] entries', async () => {
    const { status, json } = await post({ method: 'getFacetedValues', columnId: 'status' });
    expect(status).toBe(200);
    if (!json.ok) throw new Error('unreachable');
    const entries = json.result as unknown;
    expect(Array.isArray(entries)).toBe(true);
    for (const entry of entries as unknown[]) {
      expect(Array.isArray(entry)).toBe(true);
      expect((entry as unknown[]).length).toBe(2);
    }
    const map = new Map(entries as [string, number][]);
    expect(map.get('open')).toBe(2);
    expect(map.get('closed')).toBe(1);
  });

  it("facet self-exclusion: faceting a column ignores that column's own filter", async () => {
    const { json } = await post({
      method: 'getFacetedValues',
      columnId: 'status',
      params: {
        filters: [{ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }],
      },
    });
    if (!json.ok) throw new Error('unreachable');
    const map = new Map(json.result as [string, number][]);
    // If self-exclusion were broken, 'closed' would be missing (its own rows
    // are filtered out by the very filter this facet is supposed to ignore).
    expect(map.get('open')).toBe(2);
    expect(map.get('closed')).toBe(1);
  });

  it('getMinMaxValues: envelope is a [min, max] tuple', async () => {
    const { status, json } = await post({ method: 'getMinMaxValues', columnId: 'reopens' });
    expect(status).toBe(200);
    if (!json.ok) throw new Error('unreachable');
    expect(json.result).toEqual([0, 5]);
  });

  it('getFacets: batches values + ranges in one response, only requested columns appear', async () => {
    const { status, json } = await post({
      method: 'getFacets',
      requests: [
        { columnId: 'status', kind: 'values' },
        { columnId: 'reopens', kind: 'minmax' },
      ],
    });
    expect(status).toBe(200);
    if (!json.ok) throw new Error('unreachable');
    const result = json.result as {
      values: Record<string, [string, number][]>;
      ranges: Record<string, [number, number]>;
    };
    const statusMap = new Map(result.values.status);
    expect(statusMap.get('open')).toBe(2);
    expect(result.ranges.reopens).toEqual([0, 5]);
    expect(result.values.priority).toBeUndefined();
  });

  it('describeColumns: envelope is an array of column specs', async () => {
    const { status, json } = await post({ method: 'describeColumns', table: 'items' });
    expect(status).toBe(200);
    if (!json.ok) throw new Error('unreachable');
    const specs = json.result as Array<Record<string, unknown>>;
    expect(Array.isArray(specs)).toBe(true);
    const statusSpec = specs.find((spec) => spec.field === 'status');
    expect(typeof statusSpec?.columnType).toBe('string');
    expect(typeof statusSpec?.label).toBe('string');
    expect(typeof statusSpec?.nullable).toBe('boolean');
    expect(typeof statusSpec?.primaryKey).toBe('boolean');
    expect(typeof statusSpec?.foreignKey).toBe('boolean');
    expect(typeof statusSpec?.writable).toBe('boolean');
  });

  it('status mapping: a malformed body is rejected as 400 bad_request', async () => {
    const { status, json } = await post({ method: 'nope' });
    expect(status).toBe(400);
    expect(json).toEqual({
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
    });
  });
});

describe('reference-server-only checks (server-config specific, skipped against WIRE_PROTOCOL_TEST_URL)', () => {
  referenceOnly('cellEdit is forbidden when the endpoint has writes disabled', async () => {
    const handler = createAdapterRouteHandler(() => memoryAdapter(ITEMS, { tableName: 'items' }));
    const { status, json } = await post(
      { method: 'cellEdit', id: '1', field: 'status', value: 'closed' },
      handler
    );
    expect(status).toBe(403);
    expect(json).toEqual({
      ok: false,
      error: 'Writes are not enabled on this endpoint.',
      kind: 'forbidden',
    });
  });

  referenceOnly(
    'cellEdit fails closed when the adapter cannot introspect its own schema',
    async () => {
      // memoryAdapter has describeColumns but no resolveCellWriteTarget (it
      // models no relationships) — this is the exact shape the security model
      // in the doc requires a server to reject, even with writes enabled.
      const handler = createAdapterRouteHandler(
        () => memoryAdapter(ITEMS, { tableName: 'items' }),
        {
          writes: true,
        }
      );
      const { status, json } = await post(
        { method: 'cellEdit', id: '1', field: 'status', value: 'closed' },
        handler
      );
      expect(status).toBe(400);
      expect(json).toEqual({
        ok: false,
        error: 'Adapter cannot validate writes (schema introspection unavailable).',
        kind: 'bad_request',
      });
    }
  );

  referenceOnly('status mapping: an adapter throw is reported as 500 server_error', async () => {
    const TEST_META: AdapterMeta = {
      name: 'throwing',
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
      supportedOperators: { text: [] } as unknown as AdapterMeta['supportedOperators'],
    };
    const throwing: TableAdapter = {
      meta: TEST_META,
      async fetchData() {
        throw new Error('boom from the db');
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
    const handler = createAdapterRouteHandler(() => throwing);
    const { status, json } = await post({ method: 'fetchData', params: {} }, handler);
    expect(status).toBe(500);
    expect(json).toEqual({
      ok: false,
      error: 'Adapter request failed.',
      kind: 'server_error',
    });
  });

  referenceOnly(
    'proves the suite actually checks something: a raw (non-entries) Map fails the Map-as-entries assertion',
    async () => {
      // A server that forgets the Map -> entries rule and sends `result: new
      // Map(...)` verbatim: `JSON.stringify` on a bare `Map` emits `{}` (a
      // Map has no enumerable own properties), which is NOT an array — this
      // is exactly the shape the getFacetedValues assertion above would
      // reject on a genuinely non-compliant server.
      const brokenHandler = async (): Promise<Response> => {
        const envelope = { ok: true, result: new Map([['open', 2]]) };
        return new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };
      const { json } = await post(
        { method: 'getFacetedValues', columnId: 'status' },
        brokenHandler
      );
      if (!json.ok) throw new Error('unreachable');
      expect(Array.isArray(json.result)).toBe(false);
    }
  );
});
