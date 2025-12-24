/**
 * @fileoverview PostgreSQL-specific database operations
 * @module @better-tables/drizzle-adapter/operations/postgres
 */

import { count, eq, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { AnyTableType, DatabaseOperations, PostgresDatabaseType, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * PostgreSQL database operations implementation.
 *
 * PostgreSQL supports the RETURNING clause for all operations, making it more
 * efficient than MySQL as we don't need separate fetch queries after mutations.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @template TRecord - The record type for the table
 * @implements {DatabaseOperations<TRecord>}
 *
 * @example
 * ```typescript
 * // Works with any PostgreSQL driver
 * const operations = new PostgresOperations<User>(postgresDb);
 * const user = await operations.insert(usersTable, { name: 'John', email: 'john@example.com' });
 * ```
 *
 * @since 1.0.0 (expanded to support all PostgreSQL drivers in 1.1.0)
 */
export class PostgresOperations<TRecord> implements DatabaseOperations<TRecord> {
  /**
   * Creates a new PostgreSQL operations instance.
   *
   * @param {PostgresDatabaseType} db - Any PostgreSQL-compatible database connection instance
   *   (PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase, etc.)
   *
   * @example
   * ```typescript
   * // Using postgres-js
   * const operations = new PostgresOperations<User>(postgresJsDb);
   *
   * // Using node-postgres
   * const operations = new PostgresOperations<User>(nodePgDb);
   *
   * // Using Neon
   * const operations = new PostgresOperations<User>(neonDb);
   * ```
   */
  constructor(private readonly db: PostgresDatabaseType) {}

  /**
   * Inserts a new record into the table.
   *
   * Uses PostgreSQL's RETURNING clause for efficiency.
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
    const pgTable = table as PgTable;
    const result = await this.db.insert(pgTable).values(data).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError('Insert operation returned no record', { table, data });
    }
    return record;
  }

  /**
   * Updates an existing record by ID.
   *
   * Uses PostgreSQL's RETURNING clause for efficiency.
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
    const pgTable = table as PgTable;
    const result = await this.db.update(pgTable).set(data).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Deletes a record by ID.
   *
   * Uses PostgreSQL's RETURNING clause for efficiency.
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
    const pgTable = table as PgTable;
    const result = await this.db.delete(pgTable).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Bulk updates multiple records.
   *
   * Uses PostgreSQL's RETURNING clause for efficiency.
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
    const pgTable = table as PgTable;
    const result = await this.db
      .update(pgTable)
      .set(data)
      .where(inArray(table.id, ids))
      .returning();
    return result as TRecord[];
  }

  /**
   * Bulk deletes multiple records.
   *
   * Uses PostgreSQL's RETURNING clause for efficiency.
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
    const pgTable = table as PgTable;
    const result = await this.db.delete(pgTable).where(inArray(table.id, ids)).returning();
    return result as TRecord[];
  }

  /**
   * Builds a count query for PostgreSQL.
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
    const pgTable = primaryTable as PgTable;
    const result = await this.db.select({ count: count() }).from(pgTable);
    return result as { count: number }[];
  }
}
