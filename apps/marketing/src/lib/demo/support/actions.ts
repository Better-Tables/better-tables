'use server';

import type { CellEditActionInput } from '@better-tables/core';
import { ticketsTable } from './columns';
import { getSupportTables } from './db';

/**
 * The entire save path for the tickets demo's editable cells (plan 055) —
 * this one-liner replaces the hand-written POST route (body validation,
 * ALLOWED_FIELDS set, ISO→Date coercion, error mapping) AND the client
 * fetch shim that plan 053 needed.
 *
 * `tables.cellEditAction(ticketsTable)` derives everything from the table
 * definition: which columns are editable (the `.editable()` ones, including
 * the joined `customer.company`), how to coerce each value (column type),
 * and where the write lands (`updateRecord` with an explicit table — the
 * RELATED table for relationship-path columns). The lazy `getSupportTables`
 * keeps the native sqlite binding out of module scope (finding-13 rule);
 * the action itself is memoized per table definition inside the instance.
 *
 * Row-level authorization stays the app's concern — a real app would check
 * the caller's session here before delegating.
 */
export async function saveTicketCell(input: CellEditActionInput) {
  const tables = await getSupportTables();
  return tables.cellEditAction(ticketsTable)(input);
}
