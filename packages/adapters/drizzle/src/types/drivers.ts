/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Union type for all PostgreSQL-compatible Drizzle database drivers.
 * Supports postgres-js, node-postgres, neon-http, and other PostgreSQL drivers.
 *
 * @description All these drivers produce compatible SQL for PostgreSQL dialect.
 * The adapter uses this union type to accept any PostgreSQL-compatible driver
 * without requiring unsafe type casts.
 *
 * @since 1.1.0
 */
export type PostgresDatabaseType<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = PostgresJsDatabase<TSchema> | NodePgDatabase<TSchema> | NeonHttpDatabase<TSchema>;

/**
 * Union type for all MySQL-compatible Drizzle database drivers.
 * Currently supports mysql2 driver.
 *
 * @description The adapter uses this union type to accept any MySQL-compatible driver.
 *
 * @since 1.1.0
 */
export type MySqlDatabaseType<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  MySql2Database<TSchema>;

/**
 * Union type for all SQLite-compatible Drizzle database drivers.
 * Currently supports better-sqlite3 driver.
 *
 * @description The adapter uses this type to accept SQLite-compatible drivers.
 *
 * Note: LibSQLDatabase (drizzle-orm/libsql) is NOT included in this union because
 * its TypeScript type definitions have incompatible method signatures with
 * BetterSQLite3Database (specifically for select() overloads). However, at runtime
 * LibSQLDatabase is API-compatible, so users can cast their database instance:
 *
 * ```typescript
 * import { drizzle } from 'drizzle-orm/libsql';
 * const libsqlDb = drizzle(client);
 *
 * // Cast to SQLiteDatabaseType for use with the adapter
 * const adapter = new DrizzleAdapter({
 *   db: libsqlDb as unknown as SQLiteDatabaseType,
 *   schema,
 *   driver: 'sqlite',
 * });
 * ```
 *
 * @since 1.1.0
 */
export type SQLiteDatabaseType<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  BetterSQLite3Database<TSchema>;

/**
 * Mapping of database drivers to their corresponding Drizzle database types.
 * This is the single source of truth for supported database drivers.
 *
 * @description This type ensures that every database driver has a corresponding
 * database type. When you add a new driver, add it here and TypeScript will
 * ensure type safety throughout the codebase.
 *
 * Each driver maps to a union type that includes all compatible Drizzle database
 * implementations for that SQL dialect:
 * - postgres: PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase
 * - mysql: MySql2Database
 * - sqlite: BetterSQLite3Database, LibSQLDatabase
 *
 * @since 1.0.0 (expanded in 1.1.0)
 */
export type DatabaseTypeMap = {
  postgres: PostgresDatabaseType;
  mysql: MySqlDatabaseType;
  sqlite: SQLiteDatabaseType;
};

/**
 * Database driver types supported by the Drizzle adapter.
 *
 * @description Identifies which database driver is being used
 * Supported drivers are: postgres, mysql, sqlite.
 *
 * @example
 * ```typescript
 * const driver: DatabaseDriver = 'postgres';
 * ```
 *
 * @since 1.0.0
 */
export type DatabaseDriver = keyof DatabaseTypeMap;
