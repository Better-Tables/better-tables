/**
 * @fileoverview Factory function for creating Drizzle adapters with automatic type inference
 * @module @better-tables/adapters-drizzle/factory
 *
 * @description
 * Provides a convenient factory function for creating DrizzleAdapter instances
 * with automatic schema extraction and driver detection. This simplifies the API
 * and provides excellent TypeScript inference without requiring manual configuration.
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/better-sqlite3';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * const db = drizzle(connection, { schema: { users, profiles, usersRelations } });
 * const adapter = drizzleAdapter(db); // Fully typed, no 'as any' needed!
 * ```
 */

import { DrizzleAdapter } from './drizzle-adapter';
import type {
  AnyTableType,
  DatabaseDriver,
  DrizzleAdapterConfig,
  DrizzleAdapterFactoryOptions,
  ExtractDriverFromDB,
  ExtractSchemaFromDB,
} from './types';
import { SchemaError } from './types';
import { detectDriver, getDriverDetectionError, isValidDriver } from './utils/driver-detector';
import { extractSchemaFromDB, isValidExtractedSchema } from './utils/schema-extractor';

/**
 * Create a Drizzle adapter with automatic schema extraction and driver detection.
 *
 * @template TDB - The Drizzle database instance type (auto-inferred from db parameter)
 *
 * @param db - The Drizzle database instance. Schema and driver will be automatically extracted from this instance.
 * @param factoryOptions - Optional configuration overrides and adapter options
 * @param factoryOptions.schema - Override the auto-detected schema with a custom schema object
 * @param factoryOptions.driver - Override the auto-detected driver ('postgres' | 'mysql' | 'sqlite')
 * @param factoryOptions.relations - Override or provide additional relation definitions
 * @param factoryOptions.relationships - Manual relationship mappings (overrides auto-detection)
 * @param factoryOptions.autoDetectRelationships - Whether to automatically detect relationships from schema (default: true)
 * @param factoryOptions.options - Adapter configuration options (cache, logging, performance, etc.)
 * @param factoryOptions.meta - Custom adapter metadata
 *
 * @returns A fully typed DrizzleAdapter instance with auto-detected schema and driver
 *
 * @throws {SchemaError} If schema cannot be extracted from db instance and no manual schema override is provided
 * @throws {SchemaError} If driver cannot be detected from db instance and no manual driver override is provided
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/better-sqlite3';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * const db = drizzle(connection, { schema: { users, profiles, usersRelations } });
 *
 * // Simple usage - everything auto-detected
 * const adapter = drizzleAdapter(db);
 *
 * // With options
 * const adapter = drizzleAdapter(db, {
 *   options: {
 *     cache: { enabled: true, ttl: 300000, maxSize: 1000 },
 *     logging: { enabled: true, level: 'debug', logQueries: true }
 *   }
 * });
 *
 * // With manual overrides if auto-detection fails
 * const adapter = drizzleAdapter(db, {
 *   schema: { users, profiles },
 *   driver: 'postgres',
 *   relations: { usersRelations }
 * });
 * ```
 *
 * @remarks
 * This factory function provides a clean, type-safe API by automatically extracting
 * the schema and driver from the Drizzle database instance. This eliminates the need
 * for manual configuration and 'as any' type assertions. The returned adapter instance
 * is fully typed based on the schema and driver information.
 */
export function drizzleAdapter<TDB>(
  db: TDB,
  factoryOptions?: DrizzleAdapterFactoryOptions<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>>
): DrizzleAdapter<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>> {
  // Step 1: Extract or use provided schema
  let schema = factoryOptions?.schema;
  let relations = factoryOptions?.relations;

  if (!schema) {
    const extracted = extractSchemaFromDB(db);

    if (!isValidExtractedSchema(extracted)) {
      throw new SchemaError(
        'Could not extract schema from Drizzle database instance. ' +
          'Please ensure your db was initialized with a schema: ' +
          'drizzle(connection, { schema: { users, profiles, usersRelations } }), ' +
          'or provide schema manually: drizzleAdapter(db, { schema: { users, profiles } })',
        { extracted }
      );
    }

    schema = extracted.tables as ExtractSchemaFromDB<TDB>;

    // Use extracted relations if not provided
    if (!relations && Object.keys(extracted.relations).length > 0) {
      relations = extracted.relations;
    }
  }

  // Step 2: Detect or use provided driver
  let driver = factoryOptions?.driver;

  if (!driver) {
    const detected = detectDriver(db);

    if (!isValidDriver(detected)) {
      throw new SchemaError(getDriverDetectionError(), { db });
    }

    driver = detected as ExtractDriverFromDB<TDB>;
  }

  // Step 3: Create and return adapter instance
  // We need to construct the config object that matches DrizzleAdapterConfig
  // TypeScript inference is complex here, so we use spread to conditionally add properties
  const baseConfig = {
    db,
    schema,
    driver,
    autoDetectRelationships: factoryOptions?.autoDetectRelationships ?? true,
    options: factoryOptions?.options,
    meta: factoryOptions?.meta,
  };

  const configWithRelations = relations ? { ...baseConfig, relations } : baseConfig;

  const configWithRelationships = factoryOptions?.relationships
    ? { ...configWithRelations, relationships: factoryOptions.relationships }
    : configWithRelations;

  return new DrizzleAdapter<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>>(
    configWithRelationships as DrizzleAdapterConfig<
      ExtractSchemaFromDB<TDB>,
      ExtractDriverFromDB<TDB>
    >
  );
}

/**
 * Type-safe helper to create a Drizzle adapter with explicit type parameters.
 *
 * @description
 * Use this when you need to explicitly specify the schema and driver types,
 * or when TypeScript inference isn't working as expected.
 *
 * @template TSchema - The schema type containing all tables
 * @template TDriver - The database driver type
 *
 * @param db - The Drizzle database instance
 * @param factoryOptions - Configuration options
 * @returns A fully typed DrizzleAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createDrizzleAdapter<typeof schema, 'postgres'>(db, {
 *   schema: mySchema,
 *   driver: 'postgres',
 *   options: { cache: { enabled: true } }
 * });
 * ```
 */
export function createDrizzleAdapter<
  TSchema extends Record<string, AnyTableType>,
  TDriver extends DatabaseDriver,
>(
  db: unknown,
  factoryOptions: DrizzleAdapterFactoryOptions<TSchema, TDriver> & {
    schema: TSchema;
    driver: TDriver;
  }
): DrizzleAdapter<TSchema, TDriver> {
  // Build config with conditional properties
  const baseConfig = {
    db,
    schema: factoryOptions.schema,
    driver: factoryOptions.driver,
    autoDetectRelationships: factoryOptions.autoDetectRelationships ?? true,
    options: factoryOptions.options,
    meta: factoryOptions.meta,
  };

  const configWithRelations = factoryOptions.relations
    ? { ...baseConfig, relations: factoryOptions.relations }
    : baseConfig;

  const configWithRelationships = factoryOptions.relationships
    ? { ...configWithRelations, relationships: factoryOptions.relationships }
    : configWithRelations;

  // Complex generic inference requires boundary assertion
  return new DrizzleAdapter<TSchema, TDriver>(
    configWithRelationships as DrizzleAdapterConfig<TSchema, TDriver>
  );
}
