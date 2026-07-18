import { createAdapterRouteHandler } from '@better-tables/core';
import { getSupportTables } from '@/lib/demo/support/db';

/**
 * Client-callable table adapter for the tickets demo.
 *
 * `httpAdapter({ url: '/api/tables/tickets' })` (see `facets-sidebar.tsx`)
 * proxies `fetchData`/`getFacetedValues`/`getMinMaxValues` here.
 * `createAdapterRouteHandler` dispatches to the real Drizzle adapter.
 *
 * IMPORTANT: a bare `createAdapterRouteHandler(adapter)` exposes every table
 * in the server adapter's schema. This route pins `primaryTable: 'tickets'`
 * via `constrainRequest` so clients cannot read `customers`/`assignees`/etc.
 * Copy this pattern — do not mount a multi-table adapter without constraining.
 */
export const POST = createAdapterRouteHandler(
  () => getSupportTables().then((tables) => tables.database),
  {
    constrainRequest: (body) =>
      body.method === 'fetchData'
        ? { ...body, params: { ...body.params, primaryTable: 'tickets' } }
        : body,
    onError: (error) => console.error('[api/tables/tickets]', error),
  }
);
