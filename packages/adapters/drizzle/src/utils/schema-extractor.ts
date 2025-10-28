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
        result.tables[key] = value as AnyTableType;
      }
    }
    // Check if this is a relation wrapper with a 'table' property
    else if ('table' in potentialTable && potentialTable.table) {
      // This is a relation object, like `usersRelations`.
      const relationObject = value as Relations;
      const tableObject = relationObject.table as AnyTableType;

      // Get the table name (e.g., 'users') from the table object itself.
      const tableName = tableObject._.name;

      // Use the actual table name as the key.
      if (tableName) {
        // Store the table object, keyed by its name.
        result.tables[tableName] = tableObject;

        // Store the relation object, also keyed by the table name it corresponds to.
        // This ensures the relationship detector can find it later.
        result.relations[tableName] = relationObject;
      }
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
