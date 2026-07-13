/**
 * @fileoverview Shared database operations for RETURNING-capable dialects
 * @module @better-tables/drizzle-adapter/operations/returning
 *
 * @description
 * PostgreSQL and SQLite both support the SQL `RETURNING` clause on
 * INSERT/UPDATE/DELETE, which makes their operation implementations
 * line-for-line identical apart from compile-time-only table casts
 * (`as PgTable` vs `as SQLiteTable`). This base class holds that single
 * shared implementation (plan 007 step 5); the dialect subclasses supply
 * only their strongly-typed db handle through one contained cast.
 *
 * MySQL intentionally does NOT extend this class: it lacks RETURNING, so
 * its operations use a genuinely different select-then-mutate shape (see
 * `mysql-operations.ts` — a documented dialect difference, not hidden
 * duplication).
 */

import type { SQL, SQLWrapper } from 'drizzle-orm';
import { count, eq, inArray } from 'drizzle-orm';
import type { AnyTableType, DatabaseOperations, TableWithId } from '../types';
import { QueryError } from '../types';

/**
 * Minimal structural view of a Drizzle database whose mutations support
 * RETURNING. Both PostgreSQL and SQLite db types satisfy this at runtime;
 * the dialect subclasses adapt their own db instance with a single cast in
 * their constructor.
 */
export interface ReturningDb {
  insert(table: AnyTableType): {
    values(data: Record<string, unknown>): { returning(): Promise<unknown[]> };
  };
  update(table: AnyTableType): {
    set(data: Record<string, unknown>): {
      where(condition: SQL | SQLWrapper): { returning(): Promise<unknown[]> };
    };
  };
  delete(table: AnyTableType): {
    where(condition: SQL | SQLWrapper): { returning(): Promise<unknown[]> };
  };
  select(selection: Record<string, unknown>): {
    from(table: AnyTableType): PromiseLike<unknown[]>;
  };
}

/**
 * Shared operations implementation for RETURNING-capable dialects
 * (PostgreSQL, SQLite).
 *
 * @template TRecord - The record type for the table
 * @implements {DatabaseOperations<TRecord>}
 * @since 1.0.0
 */
export abstract class ReturningOperations<TRecord> implements DatabaseOperations<TRecord> {
  protected constructor(private readonly rdb: ReturningDb) {}

  /**
   * Inserts a new record into the table.
   * Uses the RETURNING clause for efficiency.
   *
   * @param table - The table to insert into
   * @param data - The data to insert
   * @returns The inserted record
   * @throws {QueryError} When insert fails
   */
  async insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord> {
    const result = await this.rdb
      .insert(table)
      .values(data as Record<string, unknown>)
      .returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError('Insert operation returned no record', { table, data });
    }
    return record;
  }

  /**
   * Updates an existing record by ID.
   * Uses the RETURNING clause for efficiency.
   *
   * @param table - The table to update
   * @param id - The ID of the record to update
   * @param data - The data to update
   * @returns The updated record
   * @throws {QueryError} When record is not found
   */
  async update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord> {
    const result = await this.rdb
      .update(table)
      .set(data as Record<string, unknown>)
      .where(eq(table.id, id))
      .returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Deletes a record by ID.
   * Uses the RETURNING clause for efficiency.
   *
   * @param table - The table to delete from
   * @param id - The ID of the record to delete
   * @returns The deleted record
   * @throws {QueryError} When record is not found
   */
  async delete(table: TableWithId, id: string): Promise<TRecord> {
    const result = await this.rdb.delete(table).where(eq(table.id, id)).returning();
    const [record] = result as [TRecord];
    if (!record) {
      throw new QueryError(`Record not found with id: ${id}`, { table, id });
    }
    return record;
  }

  /**
   * Bulk updates multiple records.
   * Uses the RETURNING clause for efficiency.
   *
   * @param table - The table to update
   * @param ids - Array of IDs to update
   * @param data - The data to update
   * @returns Array of updated records
   */
  async bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]> {
    const result = await this.rdb
      .update(table)
      .set(data as Record<string, unknown>)
      .where(inArray(table.id, ids))
      .returning();
    return result as TRecord[];
  }

  /**
   * Bulk deletes multiple records.
   * Uses the RETURNING clause for efficiency.
   *
   * @param table - The table to delete from
   * @param ids - Array of IDs to delete
   * @returns Array of deleted records
   */
  async bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]> {
    const result = await this.rdb.delete(table).where(inArray(table.id, ids)).returning();
    return result as TRecord[];
  }

  /**
   * Builds a count query.
   *
   * @param primaryTable - The primary table schema
   * @returns Promise with the count result
   */
  async buildCountQuery(primaryTable: AnyTableType): Promise<{ count: number }[]> {
    const result = await this.rdb.select({ count: count() }).from(primaryTable);
    return result as { count: number }[];
  }
}
