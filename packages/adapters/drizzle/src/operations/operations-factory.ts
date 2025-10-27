/**
 * @fileoverview Factory for creating database operations
 * @module @better-tables/drizzle-adapter/operations/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * database operations implementation based on the driver type.
 * It centralizes the creation logic and ensures type safety.
 */

import type {
  DatabaseDriver,
  DatabaseOperations,
  DrizzleDatabase,
  OperationsFactory,
} from '../types';
import { MySQLOperations } from './mysql-operations';
import { PostgresOperations } from './postgres-operations';
import { SQLiteOperations } from './sqlite-operations';

/**
 * Factory function to create database operations based on driver type.
 * This follows the Factory Pattern and provides type-safe operation creation.
 *
 * @template TDriver - The database driver type
 * @param driver - The database driver identifier
 * @returns A factory function that creates operations for the specific driver
 *
 * @example
 * ```typescript
 * const createOperations = getOperationsFactory('postgres');
 * const operations = createOperations<User>(postgresDb);
 * ```
 *
 * @throws {Error} If an unsupported driver is provided
 *
 * @since 1.0.0
 */
export function getOperationsFactory<TDriver extends DatabaseDriver>(
  driver: TDriver
): OperationsFactory<TDriver> {
  return <TRecord>(db: DrizzleDatabase<TDriver>): DatabaseOperations<TRecord> => {
    switch (driver) {
      case 'postgres':
        return new PostgresOperations<TRecord>(db as never);
      case 'mysql':
        return new MySQLOperations<TRecord>(db as never);
      case 'sqlite':
        return new SQLiteOperations<TRecord>(db as never);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
