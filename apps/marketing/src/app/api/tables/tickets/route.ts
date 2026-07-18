import { createAdapterRouteHandler } from '@better-tables/core';
import { getSupportTables } from '@/lib/demo/support/db';
import {
  constrainTicketsAdapterRequest,
  isAllowedTicketsAdapterRequest,
} from '@/lib/demo/support/tickets-adapter-guard';

/**
 * Client-callable table adapter for the tickets demo.
 *
 * `httpAdapter({ url: '/api/tables/tickets' })` (see `facets-sidebar.tsx`)
 * proxies `fetchData`/`getFacetedValues`/`getMinMaxValues` here.
 * `createAdapterRouteHandler` dispatches to the real Drizzle adapter.
 *
 * IMPORTANT: a bare `createAdapterRouteHandler(adapter)` exposes every table
 * in the server adapter's schema. This route:
 * 1. Pins `primaryTable: 'tickets'` for `fetchData` via `constrainRequest`
 * 2. Allowlists every referenced `columnId` (facet target, filters, sort,
 *    columns) to the tickets demo surface — facet methods resolve their
 *    table from `columnId`, so without (2) a client could still read
 *    `customers`/`assignees`/`bulkTickets` via e.g. `company`.
 * Copy this pattern — do not mount a multi-table adapter without constraining.
 */
export const POST = createAdapterRouteHandler(
  () => getSupportTables().then((tables) => tables.database),
  {
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
    onError: (error) => console.error('[api/tables/tickets]', error),
  }
);
