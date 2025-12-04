/**
 * @fileoverview MySQL-specific database operations
 * @module @better-tables/drizzle-adapter/operations/mysql
 */

import { count, eq, inArray } from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { AnyTableType, DatabaseOperations, MySqlDatabaseType, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * MySQL database operations implementation.
 *
 * MySQL does NOT support the RETURNING clause, so we need to fetch records separately
 * after insert/update/delete operations. This implementation handles both auto-increment
 * integer primary keys and UUID/string primary keys.
 *
 * Supports all MySQL-compatible Drizzle drivers:
 * - mysql2 (MySql2Database)
 *
 * @template TRecord - The record type for the table
 * @implements {DatabaseOperations<TRecord>}
 *
 * @example
 * ```typescript
 * const operations = new MySQLOperations<User>(mysqlDb);
 * const user = await operations.insert(usersTable, { name: 'John', email: 'john@example.com' });
 * ```
 *
 * @since 1.0.0 (expanded to support all MySQL drivers in 1.1.0)
 */
export class MySQLOperations<TRecord> implements DatabaseOperations<TRecord> {
  /**
   * Creates a new MySQL operations instance.
   *
   * @param {MySqlDatabaseType} db - Any MySQL-compatible database connection instance
   *
   * @example
   * ```typescript
   * const operations = new MySQLOperations<User>(mysqlDb);
   * ```
   */
  constructor(private readonly db: MySqlDatabaseType) {}

  /**
   * Inserts a new record into the table.
   *
   * Handles both auto-increment integer primary keys and UUID/string primary keys.
   * For auto-increment keys, uses the returned insertId. For UUID/string keys,
   * uses the provided primary key value from the data.
   *
   * @param {TableWithId} table - The table to insert into
   * @param {Partial<TRecord>} data - The data to insert
   * @returns {Promise<TRecord>} The inserted record
   * @throws {QueryError} When insert fails or record cannot be fetched
   *
   * @example
   * ```typescript
   * // Auto-increment primary key
   * const user = await operations.insert(usersTable, { name: 'John', email: 'john@example.com' });
   *
   * // UUID primary key
   * const user = await operations.insert(usersTable, {
   *   id: 'uuid-123',
   *   name: 'John',
   *   email: 'john@example.com'
   * });
   * ```
   */
  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const mysqlTable = table as MySqlTable;
    const result = await this.db.insert(mysqlTable).values(data);

    // For MySQL, we need to handle both auto-increment and non-auto-increment primary keys
    // Check if the primary key was provided in the data (UUID/string keys)
    const primaryKeyValue = (data as Record<string, unknown>)[table.id.name];

    if (primaryKeyValue) {
      // Primary key was provided (UUID/string), fetch using that value
      const records = await this.db
        .select()
        .from(mysqlTable)
        .where(eq(table.id, String(primaryKeyValue)));
      const [record] = records as [TRecord];
      if (!record) {
        throw new QueryError('Failed to fetch inserted record', { table, primaryKeyValue });
      }
      return record;
    } else {
      // Auto-increment primary key, extract insertId
      const insertId = Array.isArray(result)
        ? (result[0] as { insertId: number }).insertId
        : (result as { insertId: number }).insertId;

      if (!insertId) {
        throw new QueryError('Insert operation failed: no insertId returned', { table, data });
      }

      // Fetch the inserted record using insertId
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
  }

  /**
   * Updates an existing record by ID.
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
    const mysqlTable = table as MySqlTable;
    await this.db.update(mysqlTable).set(data).where(eq(table.id, id));

    // Determine the correct identifier to fetch the updated record
    // If the update changed the primary key, use the new value; otherwise use the original id
    const dataAsRecord = data as Record<string, unknown>;
    const newPrimaryKeyValue = dataAsRecord[table.id.name];
    const identifierToFetch = newPrimaryKeyValue !== undefined ? String(newPrimaryKeyValue) : id;

    // Fetch the updated record
    const records = await this.db.select().from(mysqlTable).where(eq(table.id, identifierToFetch));
    const [record] = records as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${identifierToFetch}`, {
        table,
        id: identifierToFetch,
      });
    }
    return record;
  }

  /**
   * Deletes a record by ID.
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

  /**
   * Bulk updates multiple records.
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
    const mysqlTable = table as MySqlTable;
    await this.db.update(mysqlTable).set(data).where(inArray(table.id, ids));

    // Fetch the updated records
    const records = await this.db.select().from(mysqlTable).where(inArray(table.id, ids));
    return records as TRecord[];
  }

  /**
   * Bulk deletes multiple records.
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
    const mysqlTable = table as MySqlTable;

    // Fetch the records before deleting
    const records = await this.db.select().from(mysqlTable).where(inArray(table.id, ids));
    await this.db.delete(mysqlTable).where(inArray(table.id, ids));
    return records as TRecord[];
  }

  /**
   * Builds a count query for MySQL.
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
    const mysqlTable = primaryTable as MySqlTable;
    const result = await this.db.select({ count: count() }).from(mysqlTable);
    return result as { count: number }[];
  }
}
