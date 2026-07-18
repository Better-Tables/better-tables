import { describe, expect, it } from 'bun:test';
import type { AdapterMeta, AdapterRequestBody, TableAdapter } from '@better-tables/core';
import { createAdapterRouteHandler } from '@better-tables/core';
import {
  collectTicketsAdapterColumnIds,
  constrainTicketsAdapterRequest,
  isAllowedTicketsAdapterRequest,
  TICKETS_DEMO_COLUMN_IDS,
} from './tickets-adapter-guard';

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
  supportedColumnTypes: ['text', 'number', 'option'],
  supportedOperators: {
    text: [],
    number: [],
    option: [],
  } as unknown as AdapterMeta['supportedOperators'],
};

function makeSpyAdapter() {
  const calls: { method: string; args: unknown[] }[] = [];
  const adapter: TableAdapter = {
    meta: META,
    async fetchData(...args) {
      calls.push({ method: 'fetchData', args });
      return {
        data: [],
        total: 0,
        pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
      };
    },
    async getFilterOptions(...args) {
      calls.push({ method: 'getFilterOptions', args });
      return [];
    },
    async getFacetedValues(...args) {
      calls.push({ method: 'getFacetedValues', args });
      return new Map([['open', 1]]);
    },
    async getMinMaxValues(...args) {
      calls.push({ method: 'getMinMaxValues', args });
      return [0, 3];
    },
  };
  return { adapter, calls };
}

/** Mirror the marketing tickets route's authorize + constrain wiring. */
function makeTicketsHandler(adapter: TableAdapter) {
  return createAdapterRouteHandler(adapter, {
    authorize: (_request, body) => {
      if (!isAllowedTicketsAdapterRequest(body)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Column not allowed on this endpoint.',
            kind: 'bad_request',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
      return true;
    },
    constrainRequest: (body) => constrainTicketsAdapterRequest(body),
  });
}

describe('tickets adapter column allowlist', () => {
  it('includes tickets demo columns and relation paths, not bare related-table fields', () => {
    expect(TICKETS_DEMO_COLUMN_IDS.has('status')).toBe(true);
    expect(TICKETS_DEMO_COLUMN_IDS.has('customer.plan')).toBe(true);
    expect(TICKETS_DEMO_COLUMN_IDS.has('reopenCount')).toBe(true);
    // Bare customers/assignees/bulk columns must stay off the allowlist.
    expect(TICKETS_DEMO_COLUMN_IDS.has('company')).toBe(false);
    expect(TICKETS_DEMO_COLUMN_IDS.has('customerName')).toBe(false);
    expect(TICKETS_DEMO_COLUMN_IDS.has('description')).toBe(false);
  });

  it('collects facet columnId plus nested filter column ids', () => {
    const body: AdapterRequestBody = {
      method: 'getFacetedValues',
      columnId: 'status',
      params: {
        filters: {
          kind: 'group',
          logic: 'and',
          children: [
            {
              columnId: 'priority',
              type: 'option',
              operator: 'is',
              values: ['high'],
            },
          ],
        },
      },
    };
    expect(collectTicketsAdapterColumnIds(body)).toEqual(['status', 'priority']);
  });

  it('rejects facet requests that target a non-tickets schema column', () => {
    const body: AdapterRequestBody = {
      method: 'getFacetedValues',
      columnId: 'company',
    };
    expect(isAllowedTicketsAdapterRequest(body)).toBe(false);
  });

  it('rejects fetchData when a filter references a non-tickets column', () => {
    const body: AdapterRequestBody = {
      method: 'fetchData',
      params: {
        filters: [{ columnId: 'company', type: 'text', operator: 'equals', values: ['Acme'] }],
      },
    };
    expect(isAllowedTicketsAdapterRequest(body)).toBe(false);
  });

  it('allows legitimate tickets facet + relation filter requests', () => {
    const body: AdapterRequestBody = {
      method: 'getFacetedValues',
      columnId: 'status',
      params: {
        filters: [
          { columnId: 'customer.plan', type: 'option', operator: 'is', values: ['enterprise'] },
        ],
      },
    };
    expect(isAllowedTicketsAdapterRequest(body)).toBe(true);
  });

  it('pins fetchData primaryTable to tickets', () => {
    const constrained = constrainTicketsAdapterRequest({
      method: 'fetchData',
      params: { primaryTable: 'customers', pagination: { page: 1, limit: 10 } },
    });
    expect(constrained.method).toBe('fetchData');
    if (constrained.method === 'fetchData') {
      expect(constrained.params.primaryTable).toBe('tickets');
    }
  });
});

describe('tickets adapter route guard (HTTP)', () => {
  it('returns 403 and never hits the adapter for a leaked facet columnId', async () => {
    const { adapter, calls } = makeSpyAdapter();
    const handler = makeTicketsHandler(adapter);

    const response = await handler(
      new Request('http://x/api/tables/tickets', {
        method: 'POST',
        body: JSON.stringify({ method: 'getFacetedValues', columnId: 'company' }),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Column not allowed on this endpoint.',
      kind: 'bad_request',
    });
    expect(calls).toHaveLength(0);
  });

  it('dispatches allowed getFacetedValues and pins fetchData primaryTable', async () => {
    const { adapter, calls } = makeSpyAdapter();
    const handler = makeTicketsHandler(adapter);

    const facet = await handler(
      new Request('http://x/api/tables/tickets', {
        method: 'POST',
        body: JSON.stringify({ method: 'getFacetedValues', columnId: 'status' }),
      })
    );
    expect(facet.status).toBe(200);
    expect(calls.some((c) => c.method === 'getFacetedValues')).toBe(true);

    await handler(
      new Request('http://x/api/tables/tickets', {
        method: 'POST',
        body: JSON.stringify({
          method: 'fetchData',
          params: { primaryTable: 'customers', pagination: { page: 1, limit: 5 } },
        }),
      })
    );
    const fetchCall = calls.find((c) => c.method === 'fetchData');
    expect(fetchCall?.args[0]).toMatchObject({ primaryTable: 'tickets' });
  });
});
