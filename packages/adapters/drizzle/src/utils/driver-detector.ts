/**
 * @fileoverview Driver detection utilities for Drizzle DB instances
 * @module @better-tables/adapters-drizzle/utils/driver-detector
 *
 * @description
 * Provides utilities to automatically detect the database driver type from
 * Drizzle database instances. This enables automatic adapter configuration
 * without requiring manual driver specification.
 */

import type { DatabaseDriver } from '../types';

/**
 * Detect the database driver type from a Drizzle database instance.
 *
 * @description
 * Inspects the Drizzle database instance structure to determine which
 * database driver is being used. Each Drizzle database type has unique
 * internal properties and methods that can be used for identification.
 *
 * Detection strategy:
 * 1. Check for driver-specific internal properties (_
 * 2. Check for driver-specific methods or dialect indicators
 * 3. Check constructor names as fallback
 *
 * @param db - The Drizzle database instance
 * @returns The detected driver type or null if unable to detect
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/better-sqlite3';
 * const db = drizzle(connection);
 * const driver = detectDriver(db); // 'sqlite'
 * ```
 */
export function detectDriver(db: unknown): DatabaseDriver | null {
  if (!db || typeof db !== 'object') {
    return null;
  }

  const dbAny = db as Record<string, unknown>;

  // Strategy 1: Check for dialect property
  if ('dialect' in dbAny && dbAny.dialect && typeof dbAny.dialect === 'object') {
    const dialect = dbAny.dialect as Record<string, unknown>;

    // PostgreSQL dialect indicators
    if (
      'name' in dialect &&
      (dialect.name === 'pg' || dialect.name === 'postgres' || dialect.name === 'postgresql')
    ) {
      return 'postgres';
    }

    // MySQL dialect indicators
    if ('name' in dialect && (dialect.name === 'mysql' || dialect.name === 'mysql2')) {
      return 'mysql';
    }

    // SQLite dialect indicators
    if (
      'name' in dialect &&
      (dialect.name === 'sqlite' ||
        dialect.name === 'better-sqlite3' ||
        dialect.name === 'better-sqlite')
    ) {
      return 'sqlite';
    }
  }

  // Strategy 2: Check for driver-specific properties in _
  if ('_' in dbAny && dbAny._ && typeof dbAny._ === 'object') {
    const meta = dbAny._ as Record<string, unknown>;

    // Check for session which contains driver info
    if ('session' in meta && meta.session && typeof meta.session === 'object') {
      const session = meta.session as Record<string, unknown>;

      // PostgreSQL session indicators
      if ('client' in session || 'queryClient' in session) {
        const sessionAny = session as { constructor?: { name?: string } };
        const constructorName = sessionAny.constructor?.name;

        if (constructorName?.toLowerCase().includes('postgres')) {
          return 'postgres';
        }
        if (constructorName?.toLowerCase().includes('mysql')) {
          return 'mysql';
        }
      }

      // SQLite session indicators
      if ('db' in session || 'run' in session || 'exec' in session) {
        return 'sqlite';
      }
    }
  }

  // Strategy 3: Check for driver-specific methods
  // PostgreSQL has query, execute
  if ('query' in dbAny && 'execute' in dbAny && !('run' in dbAny)) {
    return 'postgres';
  }

  // SQLite has run, exec
  if ('run' in dbAny && 'exec' in dbAny) {
    return 'sqlite';
  }

  // Strategy 4: Check constructor name as last resort
  const dbConstructor = (dbAny as { constructor?: { name?: string } }).constructor;
  if (dbConstructor?.name) {
    const name = dbConstructor.name.toLowerCase();

    if (name.includes('postgres')) {
      return 'postgres';
    }
    if (name.includes('mysql')) {
      return 'mysql';
    }
    if (name.includes('sqlite')) {
      return 'sqlite';
    }
  }

  // Unable to detect
  return null;
}

/**
 * Validate that a driver was successfully detected.
 *
 * @param driver - The detected driver or null
 * @returns True if driver is valid
 */
export function isValidDriver(driver: DatabaseDriver | null): driver is DatabaseDriver {
  return driver !== null && ['postgres', 'mysql', 'sqlite'].includes(driver);
}

/**
 * Get a human-readable error message for driver detection failure.
 *
 * @returns Error message with suggestions
 */
export function getDriverDetectionError(): string {
  return `Unable to detect database driver from Drizzle instance. 
Please ensure you're passing a valid Drizzle database instance, or explicitly specify the driver:

Example:
  drizzleAdapter(db, { driver: 'postgres' })
  drizzleAdapter(db, { driver: 'mysql' })
  drizzleAdapter(db, { driver: 'sqlite' })`;
}
