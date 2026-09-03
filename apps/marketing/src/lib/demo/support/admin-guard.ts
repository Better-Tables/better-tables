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
  const table = requestedTable(body);
  return table === undefined || ALLOWED_TABLES.has(table);
}
