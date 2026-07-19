import { createAdapterRouteHandler } from '@better-tables/core';
import { getSupportTables } from '@/lib/demo/support/db';
import {
  constrainTicketsAdapterRequest,
  isAllowedTicketsAdapterRequest,
} from '@/lib/demo/support/tickets-adapter-guard';

/**
 * HTTP adapter endpoint for the facets example.
 *
 * `httpAdapter({ url: '/api/tables/tickets' })` proxies fetch/facet calls here.
 * Always constrain a multi-table adapter: pin `primaryTable` and allowlist
 * column ids so clients cannot reach unrelated tables.
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
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    onError: (error) => console.error('[api/tables/tickets]', error),
  }
);
