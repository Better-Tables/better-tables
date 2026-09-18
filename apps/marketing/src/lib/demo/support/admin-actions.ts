'use server';

import { coerceCellValue, type TableAdapter } from '@better-tables/core';
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
 * Unlike `saveTicketCell`'s single-column `cellEditAction` path (which gets
 * field allow-listing and type coercion for free from `.editable()` +
 * `coerceCellValue`), `data` here is a caller-supplied full record — without
 * `sanitizeWriteData` below, ANY column (including primary/foreign keys)
 * could be set to an unvalidated value.
 */

/**
 * Drop any key `data` doesn't declare writable in `table`'s OWN schema, and
 * coerce each remaining value per its column type. Mirrors the protection
 * `cellEditAction`/the `cellEdit` wire method already give single-field
 * writes, applied across a full record.
 */
async function sanitizeWriteData(
  adapter: TableAdapter<Record<string, unknown>>,
  table: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!adapter.describeColumns) {
    throw new Error('This adapter does not support describeColumns.');
  }
  const specs = await adapter.describeColumns(table);
  const sanitized: Record<string, unknown> = {};
  for (const spec of specs) {
    if (spec.writable === false || !(spec.field in data)) continue;
    const coerced = coerceCellValue(spec.columnType, data[spec.field], spec.options, spec.nullable);
    if (!coerced.ok) {
      throw new Error(`Field "${spec.field}": ${coerced.error}`);
    }
    sanitized[spec.field] = coerced.value;
  }
  return sanitized;
}

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
  const sanitized = await sanitizeWriteData(adapter, table, data);
  return adapter.createRecord(sanitized, { table }) as Promise<Record<string, unknown>>;
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
  const sanitized = await sanitizeWriteData(adapter, table, data);
  return adapter.updateRecord(id, sanitized, { table }) as Promise<Record<string, unknown>>;
}
