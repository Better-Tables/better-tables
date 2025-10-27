/**
 * @fileoverview SQLite-specific database operations
 * @module @better-tables/drizzle-adapter/operations/sqlite
 */

import { eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DatabaseOperations, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * SQLite database operations implementation.
 * SQLite supports the RETURNING clause for all operations.
 *
 * @template TRecord - The record type for the table
 */
export class SQLiteOperations<TRecord> implements DatabaseOperations<TRecord> {
  constructor(private readonly db: BetterSQLite3Database) {}

  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.insert(sqliteTable).values(data).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError('Insert operation returned no record', { table, data });
    }
    return record;
  }

  async update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.update(sqliteTable).set(data).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  async delete(table: TableWithId, id: string): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.delete(sqliteTable).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  async bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db
      .update(sqliteTable)
      .set(data)
      .where(inArray(table.id, ids))
      .returning();
    return result as TRecord[];
  }

  async bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.delete(sqliteTable).where(inArray(table.id, ids)).returning();
    return result as TRecord[];
  }
}
