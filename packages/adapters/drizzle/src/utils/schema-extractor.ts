/**
 * @fileoverview Schema extraction utilities for Drizzle DB instances
 * @module @better-tables/adapters-drizzle/utils/schema-extractor
 *
 * @description
 * Provides utilities to extract schema information from Drizzle database instances.
 * This allows the adapter to automatically discover tables and relations without
 * requiring manual configuration.
 */

import type { Relations } from 'drizzle-orm';
import type { AnyTableType } from '../types';

/**
 * Extracted schema information from a Drizzle database instance
 */
export interface ExtractedSchema {
  /** Table definitions */
  tables: Record<string, AnyTableType>;
  /** Relation definitions */
  relations: Record<string, Relations>;
  /** Whether schema was successfully extracted */
  hasSchema: boolean;
}

/**
 * Extract schema from a Drizzle database instance.
 *
 * @description
 * Drizzle database instances can be initialized with a schema object:
 * `drizzle(connection, { schema: { users, profiles, usersRelations } })`
 *
 * This function extracts that schema from the db instance to automatically
 * configure the adapter without requiring manual schema passing.
 *
 * @param db - The Drizzle database instance
 * @returns Extracted schema with tables and relations
 *
 * @example
 * ```typescript
 * const db = drizzle(connection, { schema: { users, usersRelations } });
 * const extracted = extractSchemaFromDB(db);
 * // { tables: { users }, relations: { users }, hasSchema: true }
 * // Note: Relations are keyed by table name, not the relation property name
 * ```
 */
export function extractSchemaFromDB(db: unknown): ExtractedSchema {
  const result: ExtractedSchema = {
    tables: {},
    relations: {},
    hasSchema: false,
  };

  if (!db || typeof db !== 'object') {
    return result;
  }

  // Try to access schema from the db instance
  // Drizzle stores schema in the _ (underscore) property
  const dbWithMeta = db as {
    _?: {
      schema?: Record<string, unknown>;
      fullSchema?: Record<string, unknown>;
    };
    // Direct schema property (fallback)
    schema?: Record<string, unknown>;
  };

  // Try to get the schema from different possible locations
  let schemaObj: Record<string, unknown> | undefined;

  // Strategy 1: Check _.fullSchema (most complete, includes both tables and relations)
  if (dbWithMeta._?.fullSchema) {
    schemaObj = dbWithMeta._?.fullSchema;
  }
  // Strategy 2: Check _.schema
  else if (dbWithMeta._?.schema) {
    schemaObj = dbWithMeta._?.schema;
  }
  // Strategy 3: Direct schema property
  else if (dbWithMeta.schema) {
    schemaObj = dbWithMeta.schema;
  }

  if (!schemaObj || typeof schemaObj !== 'object') {
    return result;
  }

  // Separate tables from relations
  for (const [key, value] of Object.entries(schemaObj)) {
    if (!value || typeof value !== 'object') continue;

    // Check if this is a table (has table-specific properties)
    const potentialTable = value as Record<string, unknown>;

    // Tables have _ property with columns, name, etc.
    if ('_' in potentialTable && potentialTable._ && typeof potentialTable._ === 'object') {
      const meta = potentialTable._ as Record<string, unknown>;

      // Check if it has columns (table) or config (relation)
      if ('columns' in meta) {
        // Check if there's a schema property to create a qualified key
        const tableName = meta.name as string | undefined;
        const schemaNameValue = meta.schema;

        // Only use schemaName if it's actually a string (not a schema object like pgSchema())
        const schemaName = typeof schemaNameValue === 'string' ? schemaNameValue : undefined;

        // Use schema-qualified name if schema exists, otherwise use original key
        // This preserves the original behavior for SQLite while adding schema support for PostgreSQL
        const qualifiedKey = schemaName && tableName ? `${schemaName}.${tableName}` : key;

        result.tables[qualifiedKey] = value as AnyTableType;
      }
    }
    // Check if this is a relation wrapper with a 'table' property
    else if ('table' in potentialTable && potentialTable.table) {
      // This is a relation object, like `usersRelations`.
      try {
        const relationObject = value as Relations;
        const tableObject = relationObject.table as AnyTableType;

        // Check if tableObject exists and has a _ property before accessing it
        if (!tableObject || typeof tableObject !== 'object') {
          continue;
        }

        // Use Drizzle symbols to get table metadata
        const tableSymbol = Symbol.for('drizzle:Name');
        const schemaSymbol = Symbol.for('drizzle:Schema');
        const tableObjectWithSymbols = tableObject as unknown as Record<symbol, unknown>;

        // Get the table name from the Drizzle symbol
        const tableName = tableObjectWithSymbols[tableSymbol];

        // Get the schema name from the Drizzle symbol (if available)
        const schemaName = tableObjectWithSymbols[schemaSymbol];

        // Ensure tableName is a string, skip if not
        if (typeof tableName !== 'string' || tableName.length === 0) {
          continue;
        }

        const qualifiedKey =
          typeof schemaName === 'string' ? `${schemaName}.${tableName}` : tableName;

        // Use the qualified key to avoid collisions between tables with the same name in different schemas.
        if (qualifiedKey) {
          // Store the table object, keyed by its qualified name.
          result.tables[qualifiedKey] = tableObject as AnyTableType;

          // Store the relation object, also keyed by the qualified table name.
          // This ensures the relationship detector can find it later.
          result.relations[qualifiedKey] = relationObject;
        }
      } catch {}
    }
    // If no _ property, treat as table (handles flattened schema structures)
    else {
      result.tables[key] = value as AnyTableType;
    }
  }

  result.hasSchema = Object.keys(result.tables).length > 0;

  return result;
}

/**
 * Validate that extracted schema is usable for the adapter.
 *
 * @param extracted - The extracted schema
 * @returns True if schema has at least one table
 */
export function isValidExtractedSchema(extracted: ExtractedSchema): boolean {
  return extracted.hasSchema && Object.keys(extracted.tables).length > 0;
}

/**
 * Filter out relations from a schema object, keeping only actual table types.
 *
 * @description
 * This function filters a schema object to include only properties that are
 * actual table types (extending AnyTableType), excluding relation objects.
 * This is necessary because Drizzle schemas often include both tables and relations
 * (e.g., `{ users, profiles, usersRelations }`), but the adapter only needs tables.
 *
 * @param schema - The schema object that may include both tables and relations
 * @returns A schema object containing only table types
 *
 * @example
 * ```typescript
 * const schemaWithRelations = {
 *   users: usersTable,
 *   profiles: profilesTable,
 *   usersRelations: usersRelations, // This will be filtered out
 * };
 *
 * const tablesOnly = filterTablesFromSchema(schemaWithRelations);
 * // Result: { users: usersTable, profiles: profilesTable }
 * ```
 */
export function filterTablesFromSchema(
  schema: Record<string, unknown>
): Record<string, AnyTableType> {
  const filtered: Record<string, AnyTableType> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (!value || typeof value !== 'object') continue;

    const potentialTable = value as Record<string, unknown>;

    // Check if this is a table (has _ property with columns)
    if ('_' in potentialTable && potentialTable._ && typeof potentialTable._ === 'object') {
      const meta = potentialTable._ as Record<string, unknown>;

      // Check if it has columns (table) or config (relation)
      if ('columns' in meta) {
        filtered[key] = value as AnyTableType;
      }
    }
    // Check if this is a relation wrapper with a 'table' property
    // Relations have a 'table' property but we want to skip them
    else if (!('table' in potentialTable && potentialTable.table)) {
      // If no _ property and no table property, treat as table (handles flattened schema structures)
      filtered[key] = value as AnyTableType;
    }
  }

  return filtered;
}
