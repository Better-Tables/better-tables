/**
 * @fileoverview Factory for creating database query builders
 * @module @better-tables/drizzle-adapter/query-builders/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * query builder implementation based on the driver type,
 * ensuring type safety through proper database type narrowing.
 *
 * Supports all driver variants for each SQL dialect:
 * - PostgreSQL: postgres-js, node-postgres, neon-http
 * - MySQL: mysql2
 * - SQLite: better-sqlite3, libsql
 */

import type { RelationshipManager } from '../relationship-manager';
import type {
  AnyTableType,
  DatabaseDriver,
  DrizzleDatabase,
  FilterHandlerHooks,
  MySqlDatabaseType,
  PostgresDatabaseType,
  QueryBuilderFactory,
  SQLiteDatabaseType,
} from '../types';
import type { BaseQueryBuilder } from './base-query-builder';
import { MySQLQueryBuilder } from './mysql-query-builder';
import { PostgresQueryBuilder } from './postgres-query-builder';
import { SQLiteQueryBuilder } from './sqlite-query-builder';

/**
 * Factory function to create query builders based on driver type.
 * This follows the Factory Pattern and provides type-safe query builder creation.
 * Primary keys are auto-detected from the schema.
 *
 * Supports all driver variants for each SQL dialect:
 * - 'postgres': PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase
 * - 'mysql': MySql2Database
 * - 'sqlite': BetterSQLite3Database, LibSQLDatabase
 *
 * @template TDriver - The database driver type
 * @param driver - The database driver identifier ('postgres', 'mysql', or 'sqlite')
 * @returns A factory function that creates a query builder for the specific driver
 *
 * @example
 * ```typescript
 * // Works with any PostgreSQL-compatible driver
 * const createQueryBuilder = getQueryBuilderFactory('postgres');
 * const queryBuilder = createQueryBuilder(
 *   nodePgDb, // NodePgDatabase, PostgresJsDatabase, or NeonHttpDatabase
 *   schema,
 *   relationshipManager
 * );
 * ```
 *
 * @throws {Error} If an unsupported driver is provided
 *
 * @since 1.0.0 (expanded to support all driver variants in 1.1.0)
 */
export function getQueryBuilderFactory<TDriver extends DatabaseDriver>(
  driver: TDriver
): QueryBuilderFactory<TDriver> {
  return (
    db: DrizzleDatabase<TDriver>,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    hooks?: FilterHandlerHooks
  ): BaseQueryBuilder => {
    switch (driver) {
      case 'postgres':
        // TypeScript's control flow analysis doesn't narrow generic types in switch statements.
        // However, this is safe because the DrizzleDatabase<TDriver> type is guaranteed to match
        // the specific driver's database type when TDriver is narrowed by the switch case.
        // When TDriver = 'postgres', DrizzleDatabase<'postgres'> = PostgresDatabaseType
        // which includes PostgresJsDatabase, NodePgDatabase, and NeonHttpDatabase
        return new PostgresQueryBuilder(
          db as PostgresDatabaseType,
          schema,
          relationshipManager,
          hooks
        );
      case 'mysql':
        // Same reasoning: DrizzleDatabase<'mysql'> = MySqlDatabaseType
        return new MySQLQueryBuilder(db as MySqlDatabaseType, schema, relationshipManager, hooks);
      case 'sqlite':
        // Same reasoning: DrizzleDatabase<'sqlite'> = SQLiteDatabaseType
        // which includes BetterSQLite3Database and LibSQLDatabase
        return new SQLiteQueryBuilder(db as SQLiteDatabaseType, schema, relationshipManager, hooks);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
