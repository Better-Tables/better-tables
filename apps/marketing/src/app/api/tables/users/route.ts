import { createAdapterRouteHandler } from '@better-tables/core';
import { getUsersDatabaseAdapter } from '@/lib/demo/users/adapter';
import {
  constrainUsersAdapterRequest,
  isAllowedUsersAdapterRequest,
} from '@/lib/demo/users/users-adapter-guard';

/**
 * HTTP adapter endpoint for the homepage users demo.
 *
 * Used by the client for `resolveCellWriteTarget` (relationship-path cell
 * edits like `profile.bio`). Reads for the table still come from the RSC
 * `fetchUsers` path; saves go through `saveUserCell` (server action).
 */
export const POST = createAdapterRouteHandler(() => getUsersDatabaseAdapter(), {
  authorize: (_request, body) => {
    if (!isAllowedUsersAdapterRequest(body)) {
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
  constrainRequest: (body) => constrainUsersAdapterRequest(body),
  // biome-ignore lint/suspicious/noConsole: server-side demo log
  onError: (error) => console.error('[api/tables/users]', error),
});
