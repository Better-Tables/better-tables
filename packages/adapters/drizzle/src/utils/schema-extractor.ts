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
 * // Note: both `tables` and `relations` are keyed by the schema object's
 * // JS key (`users` above), not the relation property name and not the
 * // underlying SQL table name -- these can differ, e.g.
 * // `export const users = sqliteTable('app_users', ...)`.
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

  // Pass 1: classify every schema entry and key table entries by the schema
  // OBJECT (JS) key -- the same key callers reference in `columns`,
  // `filters`, and `primaryTable`. Also index each table object by identity
  // so pass 2 (relation wrappers) can resolve which JS key its `.table`
  // points to, instead of trusting the Drizzle SQL table name (which can
  // legitimately differ from the JS export key, e.g. `export const tickets
  // = sqliteTable('support_tickets', ...)`). Before this fix, relation
  // wrappers were keyed by the SQL name while table entries were keyed by
  // the JS key, so `result.tables` and `result.relations` disagreed
  // whenever the two differed -- breaking relationship lookups for
  // `drizzleAdapter(db)` auto-detection (plan 029 finding 14).
  const tableEntries: Array<{ qualifiedKey: string; value: AnyTableType }> = [];
  const relationEntries: Array<Relations> = [];
  const plainEntries: Array<{ key: string; value: AnyTableType }> = [];
  const tableObjectToQualifiedKey = new Map<object, string>();

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

        tableEntries.push({ qualifiedKey, value: value as AnyTableType });
        tableObjectToQualifiedKey.set(value as object, qualifiedKey);
      }
    }
    // Check if this is a relation wrapper with a 'table' property
    else if ('table' in potentialTable && potentialTable.table) {
      // This is a relation object, like `usersRelations`. Defer processing
      // to pass 2, once every table entry's JS key is known.
      relationEntries.push(value as Relations);
    }
    // If no _ property, treat as table (handles flattened schema structures,
    // and -- in current Drizzle versions, which store table metadata under
    // `Symbol.for('drizzle:*')` rather than an own `_` property -- this is
    // the branch EVERY plain table actually takes, not just a fallback).
    else {
      plainEntries.push({ key, value: value as AnyTableType });
      tableObjectToQualifiedKey.set(value as object, key);
    }
  }

  for (const { qualifiedKey, value } of tableEntries) {
    result.tables[qualifiedKey] = value;
  }
  for (const { key, value } of plainEntries) {
    result.tables[key] = value;
  }

  // Pass 2: key each relation wrapper by the SAME qualified key as the table
  // it points to, so `result.relations` and `result.tables` always agree.
  for (const relationObject of relationEntries) {
    try {
      const tableObject = relationObject.table as AnyTableType;

      // Check if tableObject exists and has a _ property before accessing it
      if (!tableObject || typeof tableObject !== 'object') {
        continue;
      }

      // Prefer an identity match against a table entry already found in
      // this schema object -- guarantees the relation is keyed exactly like
      // `result.tables`, regardless of whether the SQL table name matches
      // the JS export key.
      let qualifiedKey = tableObjectToQualifiedKey.get(tableObject as object);

      if (!qualifiedKey) {
        // Fallback: the relation's table wasn't found among this schema
        // object's own table entries (e.g. a relations file imported
        // without its table alongside it). Fall back to the SQL name via
        // Drizzle's symbols, same as the pre-fix behavior, and register the
        // table under that key so it's still queryable.
        const tableSymbol = Symbol.for('drizzle:Name');
        const schemaSymbol = Symbol.for('drizzle:Schema');
        const tableObjectWithSymbols = tableObject as unknown as Record<symbol, unknown>;

        const tableName = tableObjectWithSymbols[tableSymbol];
        const schemaName = tableObjectWithSymbols[schemaSymbol];

        if (typeof tableName !== 'string' || tableName.length === 0) {
          continue;
        }

        qualifiedKey = typeof schemaName === 'string' ? `${schemaName}.${tableName}` : tableName;
        result.tables[qualifiedKey] = tableObject;
      }

      result.relations[qualifiedKey] = relationObject;
    } catch {}
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
