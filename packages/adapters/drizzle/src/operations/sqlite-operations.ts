/**
 * @fileoverview SQLite-specific database operations
 * @module @better-tables/drizzle-adapter/operations/sqlite
 */

import type { SQLiteDatabaseType } from '../types';
import { type ReturningDb, ReturningOperations } from './returning-operations';

/**
 * SQLite database operations implementation.
 *
 * SQLite supports the RETURNING clause for all operations, so the entire
 * implementation lives in the shared {@link ReturningOperations} base
 * (plan 007 step 5) — this class only adapts the strongly-typed SQLite db
 * handle to the base's structural interface. Works with both in-memory and
 * file-based databases.
 *
 * Supports all SQLite-compatible Drizzle drivers:
 * - better-sqlite3 (BetterSQLite3Database)
 * - libsql/Turso (LibSQLDatabase)
 *
 * @template TRecord - The record type for the table
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
export class SQLiteOperations<TRecord> extends ReturningOperations<TRecord> {
  /**
   * Creates a new SQLite operations instance.
   *
   * @param db - Any SQLite-compatible database connection instance
   *   (BetterSQLite3Database, LibSQLDatabase, etc.)
   *
   * The cast is safe: Drizzle's SQLite db implements every method the
   * structural ReturningDb interface declares; the per-method `as
   * SQLiteTable` casts this class used to carry were compile-time-only.
   */
  constructor(db: SQLiteDatabaseType) {
    super(db as unknown as ReturningDb);
  }
}
