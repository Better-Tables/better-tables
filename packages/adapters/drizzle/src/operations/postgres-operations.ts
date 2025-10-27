/**
 * @fileoverview PostgreSQL-specific database operations
 * @module @better-tables/drizzle-adapter/operations/postgres
 */

import { count, eq, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AnyTableType, DatabaseOperations, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * PostgreSQL database operations implementation.
 * PostgreSQL supports the RETURNING clause for all operations.
 *
 * @template TRecord - The record type for the table
 */
export class PostgresOperations<TRecord> implements DatabaseOperations<TRecord> {
  constructor(private readonly db: PostgresJsDatabase) {}

  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const pgTable = table as PgTable;
    const result = await this.db.insert(pgTable).values(data).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError('Insert operation returned no record', { table, data });
    }
    return record;
  }

  async update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord> {
    const pgTable = table as PgTable;
    const result = await this.db.update(pgTable).set(data).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  async delete(table: TableWithId, id: string): Promise<TRecord> {
    const pgTable = table as PgTable;
    const result = await this.db.delete(pgTable).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  async bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]> {
    const pgTable = table as PgTable;
    const result = await this.db
      .update(pgTable)
      .set(data)
      .where(inArray(table.id, ids))
      .returning();
    return result as TRecord[];
  }

  async bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]> {
    const pgTable = table as PgTable;
    const result = await this.db.delete(pgTable).where(inArray(table.id, ids)).returning();
    return result as TRecord[];
  }

  /**
   * Build count query for PostgreSQL
   * @param primaryTable - The primary table schema
   * @returns Promise with the count result
   */
  async buildCountQuery(primaryTable: AnyTableType): Promise<{ count: number }[]> {
    const pgTable = primaryTable as PgTable;
    const result = await this.db.select({ count: count() }).from(pgTable);
    return result as { count: number }[];
  }
}
