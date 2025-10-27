/**
 * @fileoverview MySQL-specific database operations
 * @module @better-tables/drizzle-adapter/operations/mysql
 */

import { eq, inArray } from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { DatabaseOperations, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * MySQL database operations implementation.
 * MySQL does NOT support the RETURNING clause, so we need to fetch records separately.
 *
 * @template TRecord - The record type for the table
 */
export class MySQLOperations<TRecord> implements DatabaseOperations<TRecord> {
  constructor(private readonly db: MySql2Database) {}

  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const mysqlTable = table as MySqlTable;
    const result = await this.db.insert(mysqlTable).values(data);

    // MySQL returns [ResultSetHeader, FieldPacket[]], extract insertId
    const insertId = Array.isArray(result)
      ? (result[0] as { insertId: number }).insertId
      : (result as { insertId: number }).insertId;

    if (!insertId) {
      throw new QueryError('Insert operation failed: no insertId returned', { table, data });
    }

    // Fetch the inserted record
    const records = await this.db
      .select()
      .from(mysqlTable)
      .where(eq(table.id, String(insertId)));
    const [record] = records as [TRecord];
    if (!record) {
      throw new QueryError('Failed to fetch inserted record', { table, insertId });
    }
    return record;
  }

  async update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord> {
    const mysqlTable = table as MySqlTable;
    await this.db.update(mysqlTable).set(data).where(eq(table.id, id));

    // Fetch the updated record
    const records = await this.db.select().from(mysqlTable).where(eq(table.id, id));
    const [record] = records as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  async delete(table: TableWithId, id: string): Promise<TRecord> {
    const mysqlTable = table as MySqlTable;

    // Fetch the record before deleting (MySQL doesn't support RETURNING)
    const records = await this.db.select().from(mysqlTable).where(eq(table.id, id));
    const [record] = records as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }

    await this.db.delete(mysqlTable).where(eq(table.id, id));
    return record;
  }

  async bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]> {
    const mysqlTable = table as MySqlTable;
    await this.db.update(mysqlTable).set(data).where(inArray(table.id, ids));

    // Fetch the updated records
    const records = await this.db.select().from(mysqlTable).where(inArray(table.id, ids));
    return records as TRecord[];
  }

  async bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]> {
    const mysqlTable = table as MySqlTable;

    // Fetch the records before deleting
    const records = await this.db.select().from(mysqlTable).where(inArray(table.id, ids));
    await this.db.delete(mysqlTable).where(inArray(table.id, ids));
    return records as TRecord[];
  }
}
