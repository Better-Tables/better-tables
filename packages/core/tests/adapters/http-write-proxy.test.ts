/**
 * Opt-in HTTP write proxy (plan 055 Step 4): double opt-in, fail-closed
 * server-side validation via schema introspection, {columns} narrowing,
 * 403 semantics, and the singular cell-oriented wire shape.
 */

import { describe, expect, it } from 'bun:test';
import { type FetchLike, HttpAdapterError, httpAdapter } from '../../src/adapters/http-adapter';
import { createAdapterRouteHandler, handleAdapterRequest } from '../../src/adapters/http-handler';
import type {
  CellWriteTarget,
  FacetQueryParams,
  FetchDataParams,
  InferredColumnSpec,
  MutationOptions,
  TableAdapter,
} from '../../src/types/adapter';

const TICKET_SPECS: InferredColumnSpec[] = [
  {
    field: 'id',
    columnType: 'number',
    label: 'Id',
    nullable: false,
    primaryKey: true,
    foreignKey: false,
    writable: false,
  },
  {
    field: 'subject',
    columnType: 'text',
    label: 'Subject',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
  {
    field: 'status',
    columnType: 'option',
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
  {
    field: 'createdAt',
    columnType: 'date',
    label: 'Created At',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
];

const CUSTOMER_SPECS: InferredColumnSpec[] = [
  {
    field: 'company',
    columnType: 'text',
    label: 'Company',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
];

function ownTarget(field: string, writable = true): CellWriteTarget {
  return { table: 'tickets', field, relatedIdPath: null, single: true, writable };
}

/** Server-side adapter with full write-validation capabilities. */
function makeWritableServer(overrides?: { omitResolveTarget?: boolean; omitDescribe?: boolean }) {
  const updates: Array<{ id: string; data: Record<string, unknown>; options?: MutationOptions }> =
    [];
  const adapter: TableAdapter<Record<string, unknown>> = {
    meta: {
      name: 'server',
      version: 'test',
      features: {
        create: false,
        read: true,
        update: true,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text'],
      supportedOperators: {} as never,
    },
    fetchData: async (_params: FetchDataParams) => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async (_c: string, _p?: FacetQueryParams) => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    ...(overrides?.omitDescribe
      ? {}
      : {
          describeColumns: async (table?: string) =>
            table === 'customers' ? CUSTOMER_SPECS : TICKET_SPECS,
        }),
    ...(overrides?.omitResolveTarget
      ? {}
      : {
          resolveCellWriteTarget: async (columnId: string): Promise<CellWriteTarget | null> => {
            if (columnId === 'customer.company') {
              return {
                table: 'customers',
                field: 'company',
                relatedIdPath: 'customer.id',
                single: true,
                writable: true,
              };
            }
            if (columnId === 'notes.body') {
              return {
                table: 'notes',
                field: 'body',
                relatedIdPath: 'notes.id',
                single: false,
                writable: true,
              };
            }
            const spec = TICKET_SPECS.find((candidate) => candidate.field === columnId);
            if (!spec) return null;
            return ownTarget(spec.field, spec.writable);
          },
        }),
    updateRecord: async (id, data, options) => {
      updates.push({
        id,
        data: data as Record<string, unknown>,
        ...(options ? { options } : {}),
      });
      return { id, ...data };
    },
  };
  return { adapter, updates };
}

function loopbackFetch(handler: (request: Request) => Promise<Response>): FetchLike {
  return async (url, init) => {
    const response = await handler(
      new Request(`http://loopback${url}`, {
        method: init?.method ?? 'POST',
        headers: init?.headers ?? {},
        ...(init?.body !== undefined ? { body: init.body } : {}),
      })
    );
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };
}

describe('cellEdit over the wire — server side', () => {
  it('writes disabled (default) → 403 forbidden, adapter never called', async () => {
    const { adapter, updates } = makeWritableServer();
    const handler = createAdapterRouteHandler(adapter);

    const response = await handler(
      new Request('http://x/api', {
        method: 'POST',
        body: JSON.stringify({ method: 'cellEdit', id: '1', field: 'subject', value: 'X' }),
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Writes are not enabled on this endpoint.',
      kind: 'forbidden',
    });
    expect(updates).toHaveLength(0);

    // Same gate at the framework-agnostic layer.
    expect(
      await handleAdapterRequest(adapter, {
        method: 'cellEdit',
        id: '1',
        field: 'subject',
        value: 'X',
      })
    ).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  it('enabled + valid → adapter receives the COERCED value and explicit table', async () => {
    const { adapter, updates } = makeWritableServer();

    const result = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '5', field: 'createdAt', value: '2026-02-01T00:00:00.000Z' },
      { writes: true }
    );
    expect(result.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe('5');
    expect(updates[0]?.options).toEqual({ table: 'tickets' });
    expect(updates[0]?.data.createdAt).toBeInstanceOf(Date);
    expect((updates[0]?.data.createdAt as Date).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('a dot column writes the RELATED table after server-side re-resolution', async () => {
    const { adapter, updates } = makeWritableServer();
    const result = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '9', field: 'customer.company', value: 'Globex' },
      { writes: true }
    );
    expect(result.ok).toBe(true);
    expect(updates).toEqual([
      { id: '9', data: { company: 'Globex' }, options: { table: 'customers' } },
    ]);
  });

  it('unknown, unwritable (PK), and one-to-many columns are rejected', async () => {
    const { adapter, updates } = makeWritableServer();
    for (const field of ['nope', 'id', 'notes.body']) {
      const result = await handleAdapterRequest(
        adapter,
        { method: 'cellEdit', id: '1', field, value: 'x' },
        { writes: true }
      );
      expect(result).toEqual({
        ok: false,
        error: `Column "${field}" is not writable.`,
        kind: 'bad_request',
      });
    }
    expect(updates).toHaveLength(0);
  });

  it('bad values are rejected by type-driven coercion (option outside the enum)', async () => {
    const { adapter, updates } = makeWritableServer();
    const result = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'status', value: 'escalated' },
      { writes: true }
    );
    expect(result).toMatchObject({ ok: false, kind: 'bad_request' });
    expect(updates).toHaveLength(0);
  });

  it('null on a non-nullable column is a 400 bad_request, never a 500 (P2)', async () => {
    const { adapter, updates } = makeWritableServer();
    // `subject` (own table) and `customer.company` (related table) are both
    // declared `nullable: false` in their specs — null must be rejected by
    // type-driven coercion instead of reaching `updateRecord` and throwing.
    const own = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'subject', value: null },
      { writes: true }
    );
    expect(own).toEqual({ ok: false, error: 'This field is required.', kind: 'bad_request' });

    const related = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '9', field: 'customer.company', value: null },
      { writes: true }
    );
    expect(related).toEqual({ ok: false, error: 'This field is required.', kind: 'bad_request' });
    expect(updates).toHaveLength(0);
  });

  it('{ columns } narrowing rejects fields outside the allow-list', async () => {
    const { adapter, updates } = makeWritableServer();
    const narrowed = { writes: { columns: ['subject'] } };

    const denied = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'status', value: 'closed' },
      narrowed
    );
    expect(denied).toEqual({
      ok: false,
      error: 'Column "status" is not on the write allow-list.',
      kind: 'bad_request',
    });
    expect(updates).toHaveLength(0);

    const allowed = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'subject', value: 'ok' },
      narrowed
    );
    expect(allowed.ok).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it('FAILS CLOSED when the adapter cannot validate (missing introspection)', async () => {
    for (const overrides of [{ omitResolveTarget: true }, { omitDescribe: true }]) {
      const { adapter, updates } = makeWritableServer(overrides);
      const result = await handleAdapterRequest(
        adapter,
        { method: 'cellEdit', id: '1', field: 'subject', value: 'x' },
        { writes: true }
      );
      expect(result).toEqual({
        ok: false,
        error: 'Adapter cannot validate writes (schema introspection unavailable).',
        kind: 'bad_request',
      });
      expect(updates).toHaveLength(0);
    }
  });

  it('authorize runs BEFORE the write and can deny it', async () => {
    const { adapter, updates } = makeWritableServer();
    const order: string[] = [];
    const handler = createAdapterRouteHandler(adapter, {
      writes: true,
      authorize: () => {
        order.push('authorize');
        return false;
      },
    });

    const response = await handler(
      new Request('http://x/api', {
        method: 'POST',
        body: JSON.stringify({ method: 'cellEdit', id: '1', field: 'subject', value: 'X' }),
      })
    );
    expect(response.status).toBe(403);
    expect(order).toEqual(['authorize']);
    expect(updates).toHaveLength(0);
  });

  it('{ columns } narrowing does not let a shared column id redirect to another table via `table` (P1)', async () => {
    // Two tables both expose an own, writable column literally named
    // 'subject' — 'tickets' is the DEFAULT (table omitted resolves to it);
    // 'notes' is a different table the app never intended to expose via
    // this endpoint's `writes: { columns: ['subject'] }` (scoped for
    // 'tickets' only, per the doc example).
    const NOTES_SPECS: InferredColumnSpec[] = [
      {
        field: 'subject',
        columnType: 'text',
        label: 'Subject',
        nullable: false,
        primaryKey: false,
        foreignKey: false,
        writable: true,
      },
    ];
    const updates: Array<{ id: string; data: Record<string, unknown>; options?: MutationOptions }> =
      [];
    const adapter: TableAdapter<Record<string, unknown>> = {
      meta: {
        name: 'shared-field-server',
        version: 'test',
        features: {
          create: false,
          read: true,
          update: true,
          delete: false,
          bulkOperations: false,
          realTimeUpdates: false,
          export: false,
          transactions: false,
        },
        supportedColumnTypes: ['text'],
        supportedOperators: {} as never,
      },
      fetchData: async () => ({
        data: [],
        total: 0,
        pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
      }),
      getFilterOptions: async () => [],
      getFacetedValues: async () => new Map(),
      getMinMaxValues: async () => [0, 0],
      describeColumns: async (table?: string) => (table === 'notes' ? NOTES_SPECS : TICKET_SPECS),
      resolveCellWriteTarget: async (columnId: string, table?: string) => {
        const primary = table ?? 'tickets';
        if (primary === 'notes') {
          return columnId === 'subject'
            ? {
                table: 'notes',
                field: 'subject',
                relatedIdPath: null,
                single: true,
                writable: true,
              }
            : null;
        }
        const spec = TICKET_SPECS.find((candidate) => candidate.field === columnId);
        return spec ? ownTarget(spec.field, spec.writable) : null;
      },
      updateRecord: async (id, data, options) => {
        updates.push({
          id,
          data: data as Record<string, unknown>,
          ...(options ? { options } : {}),
        });
        return { id, ...data };
      },
    };

    const narrowed = { writes: { columns: ['subject'] } };

    // Legit: table omitted (defaults to 'tickets') — allowed.
    const legitDefault = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'subject', value: 'a' },
      narrowed
    );
    expect(legitDefault.ok).toBe(true);

    // Legit: table EXPLICITLY 'tickets' — same as the default, still allowed.
    const legitExplicit = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'subject', table: 'tickets', value: 'b' },
      narrowed
    );
    expect(legitExplicit.ok).toBe(true);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.options?.table === 'tickets')).toBe(true);

    // Attack: same allow-listed column id, `table` redirected to 'notes' —
    // rejected, even though 'notes.subject' is independently writable.
    const attack = await handleAdapterRequest(
      adapter,
      { method: 'cellEdit', id: '1', field: 'subject', table: 'notes', value: 'x' },
      narrowed
    );
    expect(attack).toEqual({
      ok: false,
      error: 'Column "subject" is not on the write allow-list.',
      kind: 'bad_request',
    });
    expect(updates).toHaveLength(2); // no write from the attack
  });

  it('malformed cellEdit bodies are rejected', async () => {
    const { adapter } = makeWritableServer();
    for (const body of [
      { method: 'cellEdit', field: 'subject', value: 'x' }, // no id
      { method: 'cellEdit', id: '1', value: 'x' }, // no field
      { method: 'cellEdit', id: '1', field: 'subject' }, // no value key
      { method: 'cellEdit', id: '', field: 'subject', value: 'x' }, // empty id
    ]) {
      expect(await handleAdapterRequest(adapter, body, { writes: true })).toEqual({
        ok: false,
        error: 'Malformed adapter request body.',
        kind: 'bad_request',
      });
    }
  });
});

describe('resolveCellWriteTarget over the wire (read side — no opt-in needed)', () => {
  it('round-trips a target and caches it', async () => {
    const { adapter } = makeWritableServer();
    let fetchCount = 0;
    const handler = createAdapterRouteHandler(adapter);
    const client = httpAdapter({
      url: '/api/tables',
      cacheTtlMs: 5000,
      fetch: async (url, init) => {
        fetchCount += 1;
        return loopbackFetch(handler)(url, init);
      },
    });

    const target = await client.resolveCellWriteTarget?.('customer.company', 'tickets');
    expect(target).toEqual({
      table: 'customers',
      field: 'company',
      relatedIdPath: 'customer.id',
      single: true,
      writable: true,
    });
    await client.resolveCellWriteTarget?.('customer.company', 'tickets');
    expect(fetchCount).toBe(1);
  });

  it('absent capability → bad_request', async () => {
    const { adapter } = makeWritableServer({ omitResolveTarget: true });
    expect(
      await handleAdapterRequest(adapter, { method: 'resolveCellWriteTarget', columnId: 'x' })
    ).toEqual({
      ok: false,
      error: 'Adapter does not support resolveCellWriteTarget.',
      kind: 'bad_request',
    });
  });
});

describe('httpAdapter writes opt-in — client side', () => {
  it('without writes: shape stays read-only (no updateRecord, update: false)', () => {
    const client = httpAdapter({
      url: '/api/tables',
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: null }),
      }),
    });
    expect(client.updateRecord).toBeUndefined();
    expect(client.meta.features.update).toBe(false);
  });

  it('with writes: updateRecord maps a single-field record to the cell wire shape', async () => {
    const { adapter, updates } = makeWritableServer();
    const handler = createAdapterRouteHandler(adapter, { writes: true, authorize: () => true });
    const client = httpAdapter<Record<string, unknown>>({
      url: '/api/tables',
      writes: true,
      fetch: loopbackFetch(handler),
    });

    expect(client.meta.features.update).toBe(true);
    const when = new Date('2026-05-05T00:00:00.000Z');
    const updated = await client.updateRecord?.('7', { createdAt: when }, { table: 'tickets' });
    expect(updated).toBeDefined();
    // Date left the client as an ISO string, came back as a real Date
    // server-side via coercion.
    expect(updates[0]?.data.createdAt).toBeInstanceOf(Date);
    expect(updates[0]?.options).toEqual({ table: 'tickets' });
  });

  it('with writes: updateRecord sends the COLUMN id on the wire via options.columnId (P1 fix)', async () => {
    const { adapter, updates } = makeWritableServer();
    const handler = createAdapterRouteHandler(adapter, { writes: true, authorize: () => true });
    const client = httpAdapter<Record<string, unknown>>({
      url: '/api/tables',
      writes: true,
      fetch: loopbackFetch(handler),
    });

    // Mirrors the editable-cells save path for a relationship-path column:
    // `data` is keyed by the RELATED table's storage field ('company'), but
    // `options.columnId` carries the COLUMN id ('customer.company') the
    // allow-list / `resolveCellWriteTarget` expect on the wire.
    const updated = await client.updateRecord?.(
      '9',
      { company: 'Globex' },
      { table: 'customers', columnId: 'customer.company' }
    );
    expect(updated).toBeDefined();
    expect(updates).toEqual([
      { id: '9', data: { company: 'Globex' }, options: { table: 'customers' } },
    ]);
  });

  it('with writes: updateRecord falls back to the data key when columnId is absent (own-table columns)', async () => {
    const { adapter, updates } = makeWritableServer();
    const handler = createAdapterRouteHandler(adapter, { writes: true, authorize: () => true });
    const client = httpAdapter<Record<string, unknown>>({
      url: '/api/tables',
      writes: true,
      fetch: loopbackFetch(handler),
    });

    const updated = await client.updateRecord?.(
      '5',
      { subject: 'New subject' },
      { table: 'tickets' }
    );
    expect(updated).toBeDefined();
    expect(updates).toEqual([
      { id: '5', data: { subject: 'New subject' }, options: { table: 'tickets' } },
    ]);
  });

  it('with writes: a multi-field data record is rejected client-side (cell edits are singular)', async () => {
    const client = httpAdapter<Record<string, unknown>>({
      url: '/api/tables',
      writes: true,
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: null }),
      }),
    });
    await expect(client.updateRecord?.('1', { subject: 'a', status: 'closed' })).rejects.toThrow(
      /singular/
    );
  });

  it('a denied server write surfaces as an HttpAdapterError with the envelope message', async () => {
    const { adapter } = makeWritableServer();
    const handler = createAdapterRouteHandler(adapter); // writes NOT enabled server-side
    const client = httpAdapter<Record<string, unknown>>({
      url: '/api/tables',
      writes: true, // client alone is not enough — double opt-in
      fetch: loopbackFetch(handler),
    });

    try {
      await client.updateRecord?.('1', { subject: 'x' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpAdapterError);
      expect((error as HttpAdapterError).status).toBe(403);
      expect((error as Error).message).toBe('Writes are not enabled on this endpoint.');
    }
  });
});
