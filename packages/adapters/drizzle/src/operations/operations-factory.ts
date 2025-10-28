/**
 * @fileoverview Factory for creating database operations
 * @module @better-tables/drizzle-adapter/operations/factory
 *
 * @description
 * This factory follows the Factory Pattern to create the appropriate
 * database operations implementation based on the driver type,
 * ensuring type safety through proper database type narrowing.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

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
        // TypeScript's control flow analysis doesn't narrow generic types in switch statements.
        // However, this is safe because the DrizzleDatabase<TDriver> type is guaranteed to match
        // the specific driver's database type when TDriver is narrowed by the switch case.
        // When TDriver = 'postgres', DrizzleDatabase<'postgres'> = PostgresJsDatabase
        return new PostgresOperations<TRecord>(db as PostgresJsDatabase);
      case 'mysql':
        // Same reasoning: DrizzleDatabase<'mysql'> = MySql2Database
        return new MySQLOperations<TRecord>(db as MySql2Database);
      case 'sqlite':
        // Same reasoning: DrizzleDatabase<'sqlite'> = BetterSQLite3Database
        return new SQLiteOperations<TRecord>(db as BetterSQLite3Database);
      default:
        throw new Error(`Unsupported database driver: ${driver as string}`);
    }
  };
}
