/**
 * @fileoverview Factory for creating database operations
 * @module @better-tables/drizzle-adapter/operations/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * database operations implementation based on the driver type,
 * ensuring type safety through proper database type narrowing.
 *
 * Supports all driver variants for each SQL dialect:
 * - PostgreSQL: postgres-js, node-postgres, neon-http
 * - MySQL: mysql2
 * - SQLite: better-sqlite3, libsql
 */

import type {
  DatabaseDriver,
  DatabaseOperations,
  DrizzleDatabase,
  MySqlDatabaseType,
  OperationsFactory,
  PostgresDatabaseType,
  SQLiteDatabaseType,
} from '../types';
import { MySQLOperations } from './mysql-operations';
import { PostgresOperations } from './postgres-operations';
import { SQLiteOperations } from './sqlite-operations';

/**
 * Factory function to create database operations based on driver type.
 * This follows the Factory Pattern and provides type-safe operation creation.
 *
 * Supports all driver variants for each SQL dialect:
 * - 'postgres': PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase
 * - 'mysql': MySql2Database
 * - 'sqlite': BetterSQLite3Database, LibSQLDatabase
 *
 * @template TDriver - The database driver type
 * @param driver - The database driver identifier ('postgres', 'mysql', or 'sqlite')
 * @returns A factory function that creates operations for the specific driver
 *
 * @example
 * ```typescript
 * // Works with any PostgreSQL-compatible driver
 * const createOperations = getOperationsFactory('postgres');
 * const operations = createOperations<User>(nodePgDb); // NodePgDatabase
 * const operations = createOperations<User>(postgresJsDb); // PostgresJsDatabase
 * const operations = createOperations<User>(neonDb); // NeonHttpDatabase
 * ```
 *
 * @throws {Error} If an unsupported driver is provided
 *
 * @since 1.0.0 (expanded to support all driver variants in 1.1.0)
 */
export function getOperationsFactory<TDriver extends DatabaseDriver>(
  driver: TDriver
): OperationsFactory<TDriver> {
  return <TRecord>(db: DrizzleDatabase<TDriver>): DatabaseOperations<TRecord> => {
    switch (driver) {
      case 'postgres':
        // TypeScript's control flow analysis doesn't narrow generic types in switch statements.
        // However, this is safe because the DrizzleDatabase<TDriver> type is guaranteed to match
        // the specific driver's database type when TDriver is narrowed by the switch case.
        // When TDriver = 'postgres', DrizzleDatabase<'postgres'> = PostgresDatabaseType
        // which includes PostgresJsDatabase, NodePgDatabase, and NeonHttpDatabase
        return new PostgresOperations<TRecord>(db as PostgresDatabaseType);
      case 'mysql':
        // Same reasoning: DrizzleDatabase<'mysql'> = MySqlDatabaseType
        return new MySQLOperations<TRecord>(db as MySqlDatabaseType);
      case 'sqlite':
        // Same reasoning: DrizzleDatabase<'sqlite'> = SQLiteDatabaseType
        // which includes BetterSQLite3Database and LibSQLDatabase
        return new SQLiteOperations<TRecord>(db as SQLiteDatabaseType);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
