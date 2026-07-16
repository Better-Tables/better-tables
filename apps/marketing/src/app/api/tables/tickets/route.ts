import { createAdapterRouteHandler } from '@better-tables/core';
import { getSupportTables } from '@/lib/demo/support/db';

/**
 * The entire server side of a client-callable table adapter: one line.
 * `httpAdapter({ url: '/api/tables/tickets' })` (see `facets-sidebar.tsx`)
 * proxies `fetchData`/`getFacetedValues`/`getMinMaxValues` here;
 * `createAdapterRouteHandler` dispatches to the real Drizzle adapter, handling
 * `Map` serialization and error envelopes. The factory form keeps the native
 * `better-sqlite3` binding lazy (constructed on first request, never at build
 * time -- finding 13).
 */
export const POST = createAdapterRouteHandler(() =>
  getSupportTables().then((tables) => tables.database)
);
