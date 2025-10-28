/**
 * @fileoverview Factory for creating database query builders
 * @module @better-tables/drizzle-adapter/query-builders/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * query builder implementation based on the driver type,
 * ensuring type safety through proper database type narrowing.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { RelationshipManager } from '../relationship-manager';
import type { AnyTableType, DatabaseDriver, DrizzleDatabase, QueryBuilderFactory } from '../types';
import type { BaseQueryBuilder } from './base-query-builder';
import { MySQLQueryBuilder } from './mysql-query-builder';
import { PostgresQueryBuilder } from './postgres-query-builder';
import { SQLiteQueryBuilder } from './sqlite-query-builder';

/**
 * Factory function to create query builders based on driver type.
 * This follows the Factory Pattern and provides type-safe query builder creation.
 * Primary keys are auto-detected from the schema.
 *
 * @template TDriver - The database driver type
 * @param driver - The database driver identifier
 * @returns A factory function that creates a query builder for the specific driver
 *
 * @example
 * ```typescript
 * const createQueryBuilder = getQueryBuilderFactory('postgres');
 * const queryBuilder = createQueryBuilder(
 *   postgresDb,
 *   schema,
 *   relationshipManager
 * );
 * ```
 *
 * @throws {Error} If an unsupported driver is provided
 *
 * @since 1.0.0
 */
export function getQueryBuilderFactory<TDriver extends DatabaseDriver>(
  driver: TDriver
): QueryBuilderFactory<TDriver> {
  return (
    db: DrizzleDatabase<TDriver>,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager
  ): BaseQueryBuilder => {
    switch (driver) {
      case 'postgres':
        // TypeScript's control flow analysis doesn't narrow generic types in switch statements.
        // However, this is safe because the DrizzleDatabase<TDriver> type is guaranteed to match
        // the specific driver's database type when TDriver is narrowed by the switch case.
        // When TDriver = 'postgres', DrizzleDatabase<'postgres'> = PostgresJsDatabase
        return new PostgresQueryBuilder(db as PostgresJsDatabase, schema, relationshipManager);
      case 'mysql':
        // Same reasoning: DrizzleDatabase<'mysql'> = MySql2Database
        return new MySQLQueryBuilder(db as MySql2Database, schema, relationshipManager);
      case 'sqlite':
        // Same reasoning: DrizzleDatabase<'sqlite'> = BetterSQLite3Database
        return new SQLiteQueryBuilder(db as BetterSQLite3Database, schema, relationshipManager);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
