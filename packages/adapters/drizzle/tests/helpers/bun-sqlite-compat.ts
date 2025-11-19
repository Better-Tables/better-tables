/**
 * Compatibility layer for using Bun's native SQLite with Drizzle ORM
 * This wraps bun:sqlite to mimic the better-sqlite3 API that Drizzle expects
 */

import { Database as BunDatabase } from 'bun:sqlite';

/**
 * Wrapper for prepared statements to match better-sqlite3 API
 */
class BunPreparedStatement {
  private stmt: ReturnType<BunDatabase['prepare']>;

  constructor(stmt: ReturnType<BunDatabase['prepare']>) {
    this.stmt = stmt;
  }

  /**
   * Execute the prepared statement with bindings
   */
  run(...bindings: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    const result = this.stmt.run(...bindings);
    return {
      changes: result.changes ?? 0,
      lastInsertRowid: result.lastInsertRowid ?? 0,
    };
  }

  /**
   * Get a single row
   */
  get(...bindings: unknown[]): unknown {
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    return this.stmt.get(...bindings);
  }

  /**
   * Get all rows
   */
  all(...bindings: unknown[]): unknown[] {
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    return this.stmt.all(...bindings);
  }

  /**
   * Finalize the statement
   */
  finalize(): void {
    // Bun's prepared statements don't need explicit finalization
    // but we provide this for API compatibility
  }
}

/**
 * Compatibility wrapper for Bun's SQLite Database
 * Mimics the better-sqlite3 Database interface
 *
 * Note: Drizzle's drizzle() function from drizzle-orm/better-sqlite3 expects
 * a better-sqlite3 Database instance. We use type assertions when calling
 * drizzle() since at runtime, Bun's SQLite should work similarly.
 */
export class BunSQLiteCompat {
  private db: BunDatabase;

  constructor(path: string) {
    this.db = new BunDatabase(path);
  }

  /**
   * Prepare a SQL statement
   */
  prepare(sql: string): BunPreparedStatement {
    const stmt = this.db.prepare(sql);
    return new BunPreparedStatement(stmt);
  }

  /**
   * Execute a SQL statement directly
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Run a SQL statement and return result
   */
  run(sql: string, ...bindings: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    const result = stmt.run(...bindings);
    return {
      changes: result.changes ?? 0,
      lastInsertRowid: result.lastInsertRowid ?? 0,
    };
  }

  /**
   * Get a single row
   */
  get(sql: string, ...bindings: unknown[]): unknown {
    const stmt = this.db.prepare(sql);
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    return stmt.get(...bindings);
  }

  /**
   * Get all rows
   */
  all(sql: string, ...bindings: unknown[]): unknown[] {
    const stmt = this.db.prepare(sql);
    // @ts-expect-error - Bun's SQLite accepts unknown[] bindings, but types are stricter
    return stmt.all(...bindings);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the underlying Bun database instance
   * This is used internally by Drizzle
   */
  get native(): BunDatabase {
    return this.db;
  }
}

/**
 * Type alias for compatibility with better-sqlite3 types
 */
export type Database = BunSQLiteCompat;

/**
 * Namespace for Database type (matching better-sqlite3 structure)
 */
export namespace Database {
  export type Database = BunSQLiteCompat;
}

/**
 * Default export for compatibility with better-sqlite3 import style
 */
export default BunSQLiteCompat;
