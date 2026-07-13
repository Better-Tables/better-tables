/**
 * @fileoverview PostgreSQL-specific database operations
 * @module @better-tables/drizzle-adapter/operations/postgres
 */

import type { PostgresDatabaseType } from '../types';
import { type ReturningDb, ReturningOperations } from './returning-operations';

/**
 * PostgreSQL database operations implementation.
 *
 * PostgreSQL supports the RETURNING clause for all operations, so the entire
 * implementation lives in the shared {@link ReturningOperations} base
 * (plan 007 step 5) — this class only adapts the strongly-typed PostgreSQL
 * db handle to the base's structural interface.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @template TRecord - The record type for the table
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
export class PostgresOperations<TRecord> extends ReturningOperations<TRecord> {
  /**
   * Creates a new PostgreSQL operations instance.
   *
   * @param db - Any PostgreSQL-compatible database connection instance
   *   (PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase, etc.)
   *
   * The cast is safe: Drizzle's PostgreSQL db implements every method the
   * structural ReturningDb interface declares; the per-method `as PgTable`
   * casts this class used to carry were compile-time-only.
   */
  constructor(db: PostgresDatabaseType) {
    super(db as unknown as ReturningDb);
  }
}
