/**
 * @fileoverview SQLite-specific database operations
 * @module @better-tables/drizzle-adapter/operations/sqlite
 */

import { count, eq, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { AnyTableType, DatabaseOperations, SQLiteDatabaseType, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * SQLite database operations implementation.
 *
 * SQLite supports the RETURNING clause for all operations, making it efficient
 * similar to PostgreSQL. This implementation works with both in-memory and file-based databases.
 *
 * Supports all SQLite-compatible Drizzle drivers:
 * - better-sqlite3 (BetterSQLite3Database)
 * - libsql/Turso (LibSQLDatabase)
 *
 * @template TRecord - The record type for the table
 * @implements {DatabaseOperations<TRecord>}
 *
 * @example
 * ```typescript
 * // Works with any SQLite driver
 * const operations = new SQLiteOperations<User>(sqliteDb);
 * const user = await operations.insert(usersTable, { name: 'John', email: 'john@example.com' });
 * ```
 *
 * @since 1.0.0 (expanded to support all SQLite drivers in 1.1.0)
 */
export class SQLiteOperations<TRecord> implements DatabaseOperations<TRecord> {
  /**
   * Creates a new SQLite operations instance.
   *
   * @param {SQLiteDatabaseType} db - Any SQLite-compatible database connection instance
   *   (BetterSQLite3Database, LibSQLDatabase, etc.)
   *
   * @example
   * ```typescript
   * // Using better-sqlite3
   * const operations = new SQLiteOperations<User>(betterSqliteDb);
   *
   * // Using libsql/Turso
   * const operations = new SQLiteOperations<User>(libsqlDb);
   * ```
   */
  constructor(private readonly db: SQLiteDatabaseType) {}

  /**
   * Inserts a new record into the table.
   *
   * Uses SQLite's RETURNING clause for efficiency.
   *
   * @param {TableWithId} table - The table to insert into
   * @param {Partial<TRecord>} data - The data to insert
   * @returns {Promise<TRecord>} The inserted record
   * @throws {QueryError} When insert fails
   *
   * @example
   * ```typescript
   * const user = await operations.insert(usersTable, { name: 'John', email: 'john@example.com' });
   * ```
   */
  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.insert(sqliteTable).values(data).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError('Insert operation returned no record', { table, data });
    }
    return record;
  }

  /**
   * Updates an existing record by ID.
   *
   * Uses SQLite's RETURNING clause for efficiency.
   *
   * @param {TableWithId} table - The table to update
   * @param {string} id - The ID of the record to update
   * @param {Partial<TRecord>} data - The data to update
   * @returns {Promise<TRecord>} The updated record
   * @throws {QueryError} When record is not found
   *
   * @example
   * ```typescript
   * const updatedUser = await operations.update(usersTable, '123', { name: 'Jane' });
   * ```
   */
  async update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.update(sqliteTable).set(data).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Deletes a record by ID.
   *
   * Uses SQLite's RETURNING clause for efficiency.
   *
   * @param {TableWithId} table - The table to delete from
   * @param {string} id - The ID of the record to delete
   * @returns {Promise<TRecord>} The deleted record
   * @throws {QueryError} When record is not found
   *
   * @example
   * ```typescript
   * const deletedUser = await operations.delete(usersTable, '123');
   * ```
   */
  async delete(table: TableWithId, id: string): Promise<TRecord> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.delete(sqliteTable).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Bulk updates multiple records.
   *
   * Uses SQLite's RETURNING clause for efficiency.
   *
   * @param {TableWithId} table - The table to update
   * @param {string[]} ids - Array of IDs to update
   * @param {Partial<TRecord>} data - The data to update
   * @returns {Promise<TRecord[]>} Array of updated records
   *
   * @example
   * ```typescript
   * const updatedUsers = await operations.bulkUpdate(usersTable, ['1', '2', '3'], { status: 'active' });
   * ```
   */
  async bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db
      .update(sqliteTable)
      .set(data)
      .where(inArray(table.id, ids))
      .returning();
    return result as TRecord[];
  }

  /**
   * Bulk deletes multiple records.
   *
   * Uses SQLite's RETURNING clause for efficiency.
   *
   * @param {TableWithId} table - The table to delete from
   * @param {string[]} ids - Array of IDs to delete
   * @returns {Promise<TRecord[]>} Array of deleted records
   *
   * @example
   * ```typescript
   * const deletedUsers = await operations.bulkDelete(usersTable, ['1', '2', '3']);
   * ```
   */
  async bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]> {
    const sqliteTable = table as SQLiteTable;
    const result = await this.db.delete(sqliteTable).where(inArray(table.id, ids)).returning();
    return result as TRecord[];
  }

  /**
   * Builds a count query for SQLite.
   *
   * @param {AnyTableType} primaryTable - The primary table schema
   * @returns {Promise<{ count: number }[]>} Promise with the count result
   *
   * @example
   * ```typescript
   * const result = await operations.buildCountQuery(usersTable);
   * console.log(`Total users: ${result[0].count}`);
   * ```
   */
  async buildCountQuery(primaryTable: AnyTableType): Promise<{ count: number }[]> {
    const sqliteTable = primaryTable as SQLiteTable;
    const result = await this.db.select({ count: count() }).from(sqliteTable);
    return result as { count: number }[];
  }
}
