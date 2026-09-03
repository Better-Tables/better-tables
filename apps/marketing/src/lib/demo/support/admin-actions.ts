'use server';

import { getSupportTables } from './db';

const ALLOWED_TABLES = new Set(['tickets', 'customers', 'assignees', 'bulkTickets']);

/**
 * Multi-field create/update for the `<TableNavigator>` admin demo (plan 065
 * Phase 7). `httpAdapter`'s own write proxy (`cellEdit`) is deliberately
 * single-field-only (plan 055) — `<RecordFormDialog>` sends a full record,
 * so it can't go through that wire method at all. These two server actions
 * call the REAL server-side Drizzle adapter's `createRecord`/`updateRecord`
 * directly instead, the same "monolith path" idiom `saveTicketCell`
 * already uses for single-cell saves.
 *
 * Row-level authorization stays the app's concern, same note as
 * `saveTicketCell` — a real app would check the caller's session here.
 */

export async function createSupportRecord(
  table: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table "${table}" is not allowed on this endpoint.`);
  }
  const tables = await getSupportTables();
  const adapter = tables.database;
  if (!adapter.createRecord) {
    throw new Error('This adapter does not support createRecord.');
  }
  return adapter.createRecord(data, { table }) as Promise<Record<string, unknown>>;
}

export async function updateSupportRecord(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table "${table}" is not allowed on this endpoint.`);
  }
  const tables = await getSupportTables();
  const adapter = tables.database;
  if (!adapter.updateRecord) {
    throw new Error('This adapter does not support updateRecord.');
  }
  return adapter.updateRecord(id, data, { table }) as Promise<Record<string, unknown>>;
}
