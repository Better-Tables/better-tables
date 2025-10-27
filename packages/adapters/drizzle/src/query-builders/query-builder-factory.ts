/**
 * @fileoverview Factory for creating database query builders
 * @module @better-tables/drizzle-adapter/query-builders/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * query builder implementation based on the driver type.
 * It centralizes the creation logic and ensures type safety.
 */

import type { RelationshipManager } from '../relationship-manager';
import type { AnyTableType, DatabaseDriver, DrizzleDatabase, QueryBuilderFactory } from '../types';
import type { BaseQueryBuilder } from './base-query-builder';
import { MySQLQueryBuilder } from './mysql-query-builder';
import { PostgresQueryBuilder } from './postgres-query-builder';
import { SQLiteQueryBuilder } from './sqlite-query-builder';

/**
 * Factory function to create query builders based on driver type.
 * This follows the Factory Pattern and provides type-safe query builder creation.
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
 *   relationshipManager,
 *   primaryKeyMap
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
    relationshipManager: RelationshipManager,
    primaryKeyMap?: Record<string, string>
  ): BaseQueryBuilder => {
    switch (driver) {
      case 'postgres':
        return new PostgresQueryBuilder(db as never, schema, relationshipManager, primaryKeyMap);
      case 'mysql':
        return new MySQLQueryBuilder(db as never, schema, relationshipManager, primaryKeyMap);
      case 'sqlite':
        return new SQLiteQueryBuilder(db as never, schema, relationshipManager, primaryKeyMap);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
