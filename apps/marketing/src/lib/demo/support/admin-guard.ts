/**
 * Request-surface allowlist for `/api/tables/support-admin` (plan 065
 * Phase 7's `<TableNavigator>` demo).
 *
 * Unlike `tickets-adapter-guard.ts` (pinned to ONE primary table),
 * `<TableNavigator>` legitimately needs to browse SEVERAL tables — so this
 * guard allowlists a fixed SET of table names instead of pinning one. No
 * per-column allowlist: every column of every table below is fair game
 * (this is fabricated, public seed data — the same data the tickets/facets
 * demos already expose column-by-column).
 */

import type { AdapterRequestBody } from '@better-tables/core';

/** Every table this endpoint may serve. `bulkTickets` stays reachable here
 * (it's still part of the schema) — the demo page hides it from the
 * navigator via `overrides`, not by blocking it at the API layer. */
const ALLOWED_TABLES = new Set(['tickets', 'customers', 'assignees', 'bulkTickets']);

function requestedTable(body: AdapterRequestBody): string | undefined {
  if (body.method === 'fetchData') return body.params.primaryTable;
  if (body.method === 'describeColumns' || body.method === 'resolveCellWriteTarget') {
    return body.table;
  }
  return undefined;
}

/** `listTables`/`getFacets`/facet reads carry no table name to check — allowed unconditionally. */
export function isAllowedAdminAdapterRequest(body: AdapterRequestBody): boolean {
  // The route's own body validator (`isValidBody` in http-handler.ts)
  // doesn't check that `fetchData` carries `params` — a malformed body
  // (`{ method: 'fetchData' }`, no `params`) reaches this guard as-is.
  // `requestedTable` would throw on it (`body.params.primaryTable` off
  // `undefined`), and that throw gets misclassified as a 500 server_error
  // by the route handler's outer try/catch instead of a clean rejection.
  // Fail closed here instead of letting it throw.
  if (body.method === 'fetchData' && (body.params == null || typeof body.params !== 'object')) {
    return false;
  }
  const table = requestedTable(body);
  return table === undefined || ALLOWED_TABLES.has(table);
}
