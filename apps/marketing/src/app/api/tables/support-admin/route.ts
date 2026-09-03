import { createAdapterRouteHandler } from '@better-tables/core';
import { isAllowedAdminAdapterRequest } from '@/lib/demo/support/admin-guard';
import { getSupportTables } from '@/lib/demo/support/db';

/**
 * HTTP adapter endpoint for the `<TableNavigator>` admin demo (plan 065
 * Phase 7). Unlike `/api/tables/tickets` (pinned to one table), this
 * endpoint deliberately serves MULTIPLE tables — that's the whole point of
 * a table navigator — so it allowlists a table SET instead of pinning one.
 * Reads only: writes go through `admin-actions.ts` server actions instead
 * (multi-field create/update, which this wire protocol's `cellEdit` can't
 * express — see that file's comment).
 */
export const POST = createAdapterRouteHandler(
  () => getSupportTables().then((tables) => tables.database),
  {
    authorize: (_request, body) => {
      if (!isAllowedAdminAdapterRequest(body)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Table not allowed on this endpoint.',
            kind: 'bad_request',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
      return true;
    },
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    onError: (error) => console.error('[api/tables/support-admin]', error),
  }
);
