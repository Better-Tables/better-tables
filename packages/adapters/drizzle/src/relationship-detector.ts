/**
 * @fileoverview Relationship detection and parsing for Drizzle ORM
 * @module @better-tables/drizzle-adapter/relationship-detector
 *
 * @description
 * Automatically detects and parses relationships from Drizzle ORM schemas.
 * This module inspects Drizzle's relation definitions to extract information about
 * table relationships, including cardinality, foreign keys, and join conditions.
 *
 * Key capabilities:
 * - Parses Drizzle Relations objects
 * - Extracts relationship paths between tables
 * - Infers cardinality (one-to-one, one-to-many)
 * - Builds relationship graph for path resolution
 * - Detects circular relationships
 * - Validates relationship integrity
 * - Handles composite foreign keys
 * - Automatically detects array foreign key relationships
 *
 * The detector works by calling Drizzle's config() function on Relations objects
 * and extracting the relationship metadata. It builds both forward and backward
 * relationship paths to support bidirectional navigation.
 *
 * @example
 * ```typescript
 * const detector = new RelationshipDetector();
 * const relationships = detector.detectFromSchema(
 *   { users: usersRelations },
 *   { users, profiles, events }
 * );
 * // Returns: {
 * //   'users.profile': { from: 'users', to: 'profiles', ... },
 * //   'events.organizers': { from: 'events', to: 'users', isArray: true, ... }
 * // }
 * ```
 *
 * Array foreign key detection:
 * Automatically detects relationships from array columns with foreign key references:
 * ```typescript
 * // Schema definition
 * organizerId: uuid()
 *   .references(() => usersTable.id)
 *   .array()
 *   .notNull()
 *
 * // Automatically creates: 'eventsTable.organizers' relationship
 * ```
 *
 * @see {@link RelationshipMap} for the relationship structure
 * @see {@link RelationshipPath} for the path structure
 * @since 1.0.0
 */

import type { Relations } from 'drizzle-orm';
import type { AnyTableType, RelationshipMap, RelationshipPath } from './types';
import { RelationshipError } from './types';

// Type for the actual relation object returned by Drizzle's config() function
type DrizzleRelationConfig = {
  table: unknown;
  fields: string | string[];
  references: string | string[];
  nullable?: boolean;
  type?: 'one' | 'many';
  cardinality?: 'one' | 'many';
};

/**
 * Relationship detector that parses Drizzle schema relations.
 *
 * @class RelationshipDetector
 * @description Automatically extracts relationship information from Drizzle schemas
 *
 * @example
 * ```typescript
 * const detector = new RelationshipDetector();
 * const relationships = detector.detectFromSchema(relations, schema);
 * ```
 *
 * @since 1.0.0
 */
export class RelationshipDetector {
  private relationships: Map<string, RelationshipPath> = new Map();
  private relationshipGraph: Map<string, Set<string>> = new Map();
  private schema: Record<string, unknown> | undefined;
  /**
   * Type guard to check if an object is a Drizzle Relations object
   */
  private isDrizzleRelations(obj: unknown): obj is Relations {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'config' in obj &&
      typeof (obj as Record<string, unknown>).config === 'function'
    );
  }

  /**
   * Type guard to check if an object is a Drizzle relation config
   */
  private isDrizzleRelationConfig(obj: unknown): obj is DrizzleRelationConfig {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'fields' in obj &&
      'references' in obj &&
      'table' in obj
    );
  }

  /**
   * Detect relationships from Drizzle schema
   */
  detectFromSchema(
    relations: Record<string, Relations>,
    schema?: Record<string, unknown>
  ): RelationshipMap {
    this.relationships.clear();
    this.relationshipGraph.clear();
    this.schema = schema;

    // Build relationship graph
    this.buildRelationshipGraph(relations);

    // Extract relationship paths
    this.extractRelationshipPaths(relations, schema);

    // Detect array foreign keys from schema
    this.detectArrayForeignKeys(schema);

    // Backfill missing keys for forward relations using reverse relations when available
    this.backfillKeysFromReverse();

    return Object.fromEntries(this.relationships);
  }

  /**
   * Detect array foreign keys from schema
   *
   * Array foreign keys are columns that are arrays and have foreign key references.
   * This method automatically detects relationships like:
   *
   * ```typescript
   * organizerId: uuid()
   *   .references(() => usersTable.id)
   *   .array()
   *   .notNull()
   * ```
   *
   * The detection process:
   * 1. Identifies array columns using `isArrayColumn()`
   * 2. Extracts FK references using `getForeignKeyInfo()`
   * 3. Resolves schema keys using `resolveSchemaKey()`
   * 4. Resolves field names using `getFieldName()`
   *
   * The relationship is stored with a friendly alias (e.g., 'organizerId' → 'organizers').
   *
   * @param schema - The Drizzle schema object containing all tables
   */
  private detectArrayForeignKeys(schema?: Record<string, unknown>): void {
    if (!schema) return;

    for (const [tableName, tableSchema] of Object.entries(schema)) {
      if (!tableSchema || typeof tableSchema !== 'object') continue;

      const tableObj = tableSchema as Record<string, unknown>;

      // Iterate through all columns in the table
      for (const [columnName, columnValue] of Object.entries(tableObj)) {
        if (!columnValue || typeof columnValue !== 'object') continue;

        const columnObj = columnValue as Record<string, unknown>;

        // Check if this column is an array type
        const isArray = this.isArrayColumn(columnObj);
        if (!isArray) continue;

        // Check if this array column has foreign key references
        const fkInfo = this.getForeignKeyInfo(columnObj);
        if (!fkInfo) continue;

        // Convert table reference to schema key (handles both table objects and strings)
        const targetTableSchemaKey = this.resolveSchemaKey(fkInfo.table, schema);
        if (!targetTableSchemaKey) {
          // Schema key not found - skip this relationship (graceful degradation)
          // This can happen if the target table is not in the schema
          continue;
        }

        // Get the referenced column name in the target table
        const referencedColumn = fkInfo.column;
        const referencedColumnName = this.getFieldName(referencedColumn, targetTableSchemaKey);
        if (!referencedColumnName) continue;

        // Create relationship path for array foreign key
        const relationshipPath: RelationshipPath = {
          from: tableName,
          to: targetTableSchemaKey, // Use schema key, not database table name
          foreignKey: referencedColumnName, // The column in the target table (e.g., 'id' in users)
          localKey: columnName, // The array column in the source table (e.g., 'organizerId' in events)
          cardinality: 'many', // Array FKs are always many-to-many conceptually
          nullable: true, // Arrays can be empty
          joinType: 'left',
          isArray: true, // Mark as array relationship
        };

        // Store the relationship with a friendly alias name (plural form)
        // For 'organizerId' -> 'organizers'
        const aliasName = this.getArrayRelationshipAlias(columnName);
        const forwardKey = `${tableName}.${aliasName}`;
        this.relationships.set(forwardKey, relationshipPath);

        // Also store reverse relationship (use schema key)
        const reverseKey = `${targetTableSchemaKey}.${this.getReverseRelationName(tableName, aliasName)}`;
        this.relationships.set(reverseKey, this.reverseRelationshipPath(relationshipPath));

        // Add forward edge to relationship graph (from array-owning table to referenced table)
        if (!this.relationshipGraph.has(tableName)) {
          this.relationshipGraph.set(tableName, new Set());
        }
        const sourceSet = this.relationshipGraph.get(tableName);
        if (sourceSet) {
          sourceSet.add(targetTableSchemaKey); // Use schema key
        }

        // Add reverse edge to relationship graph (from referenced table back to array-owning table)
        // This allows getJoinPath to traverse in both directions
        if (!this.relationshipGraph.has(targetTableSchemaKey)) {
          this.relationshipGraph.set(targetTableSchemaKey, new Set());
        }
        const targetSet = this.relationshipGraph.get(targetTableSchemaKey);
        if (targetSet) {
          targetSet.add(tableName);
        }
      }
    }
  }

  /**
   * Check if a column is an array type
   *
   * Generic detection for any array column type (uuid[], text[], integer[], etc.)
   * Works by checking Drizzle's internal metadata symbols and properties.
   */
  private isArrayColumn(columnObj: Record<string, unknown>): boolean {
    // Check for Drizzle array column indicators
    // Array columns have specific metadata symbols
    const arraySymbols = [
      Symbol.for('drizzle:Array'),
      Symbol.for('drizzle:ArrayType'),
      Symbol.for('drizzle:ColumnArray'),
      // Additional symbols that might be used in different Drizzle versions
    ];

    for (const sym of arraySymbols) {
      if (sym in columnObj) {
        return true;
      }
    }

    // Check for array-related properties directly on the column
    if ('dataType' in columnObj && columnObj.dataType === 'array') {
      return true;
    }

    // Check if column has array property set to true
    if ('array' in columnObj && columnObj.array === true) {
      return true;
    }

    // Check column metadata for array type
    const columnSymbols = Object.getOwnPropertySymbols(columnObj);
    for (const sym of columnSymbols) {
      const symValue = (columnObj as Record<symbol, unknown>)[sym];
      if (symValue && typeof symValue === 'object') {
        const metaObj = symValue as Record<string, unknown>;

        // Check dataType in metadata
        if ('dataType' in metaObj && metaObj.dataType === 'array') {
          return true;
        }

        // Check array flag in metadata
        if ('array' in metaObj && metaObj.array === true) {
          return true;
        }

        // Check for array-related flags
        if ('isArray' in metaObj && metaObj.isArray === true) {
          return true;
        }

        // Check for SQL type indicators (e.g., 'uuid[]', 'text[]')
        if (
          'sqlName' in metaObj &&
          typeof metaObj.sqlName === 'string' &&
          metaObj.sqlName.endsWith('[]')
        ) {
          return true;
        }

        // Check for column type that includes array
        if (
          'columnType' in metaObj &&
          typeof metaObj.columnType === 'string' &&
          metaObj.columnType.includes('Array')
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get foreign key information from a column
   *
   * Generic method that extracts FK references from any column, including array columns.
   * Handles both direct FK metadata and function-based references from .references() calls.
   */
  private getForeignKeyInfo(
    columnObj: Record<string, unknown>
  ): { table: unknown; column: unknown } | null {
    // Check for foreign key metadata in column symbols
    const columnSymbols = Object.getOwnPropertySymbols(columnObj);
    for (const sym of columnSymbols) {
      const symValue = (columnObj as Record<symbol, unknown>)[sym];
      if (symValue && typeof symValue === 'object') {
        const metaObj = symValue as Record<string, unknown>;

        // Check for foreignKeys array (standard Drizzle FK metadata)
        if ('foreignKeys' in metaObj && Array.isArray(metaObj.foreignKeys)) {
          const foreignKeys = metaObj.foreignKeys;
          if (foreignKeys.length > 0) {
            const fk = foreignKeys[0];
            if (fk && typeof fk === 'object') {
              const fkObj = fk as Record<string, unknown>;
              const refTable = fkObj.table;
              const refColumn =
                fkObj.column || (Array.isArray(fkObj.columns) ? fkObj.columns[0] : null);
              if (refTable && refColumn) {
                return { table: refTable, column: refColumn };
              }
            }
          }
        }

        // Check for reference property (function-based reference from .references(() => table.column))
        // This is the key pattern: .references(() => usersTable.id) stores a function
        if ('reference' in metaObj && metaObj.reference) {
          const ref = metaObj.reference;
          if (typeof ref === 'function') {
            try {
              // Call the reference function to get the target column object
              const refColumn = ref();

              // The column object has a reference to its parent table
              // We need to extract both the table and the column name
              if (refColumn && typeof refColumn === 'object') {
                // Get the table from the column's metadata
                // Drizzle columns store their table reference in metadata
                const refColumnObj = refColumn as Record<string, unknown>;
                const refColumnSymbols = Object.getOwnPropertySymbols(refColumnObj);

                // Extract the table from the column object
                // Drizzle columns store their parent table in various locations
                let refTable: unknown = null;

                // Method 1: Check for table in column metadata symbols
                for (const colSym of refColumnSymbols) {
                  const colSymValue = (refColumnObj as Record<symbol, unknown>)[colSym];
                  if (colSymValue && typeof colSymValue === 'object') {
                    const colMetaObj = colSymValue as Record<string, unknown>;

                    // Check for table property in column metadata
                    if ('table' in colMetaObj) {
                      refTable = colMetaObj.table;
                      break;
                    }
                  }
                }

                // Method 2: Check if column has a direct table property
                if (!refTable && 'table' in refColumnObj) {
                  refTable = refColumnObj.table;
                }

                // Method 3: Check column's _ property (common Drizzle pattern)
                if (
                  !refTable &&
                  '_' in refColumnObj &&
                  refColumnObj._ &&
                  typeof refColumnObj._ === 'object'
                ) {
                  const colUnder = refColumnObj._ as Record<string, unknown>;
                  if ('table' in colUnder) {
                    refTable = colUnder.table;
                  }
                }

                // Method 4: Search through schema to find which table contains this column
                // This is a fallback when table reference isn't directly available
                if (!refTable && this.schema) {
                  for (const [, schemaTable] of Object.entries(this.schema)) {
                    if (schemaTable && typeof schemaTable === 'object') {
                      const tableObj = schemaTable as Record<string, unknown>;
                      for (const [, tableColumn] of Object.entries(tableObj)) {
                        // Use reference equality to find the matching column
                        if (tableColumn === refColumn) {
                          // Found the table that contains this column
                          // Return the table object from schema
                          refTable = schemaTable;
                          break;
                        }
                      }
                      if (refTable) break;
                    }
                  }
                }

                // If we found a table, return both table and column
                if (refTable) {
                  return { table: refTable, column: refColumn };
                }
              }
            } catch {
              // Ignore if reference() fails - this is expected for some column types
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get a friendly alias name for an array foreign key relationship
   * Converts 'organizerId' -> 'organizers', 'userId' -> 'users', etc.
   */
  private getArrayRelationshipAlias(columnName: string): string {
    // Remove common suffixes: Id, _id, ID, Ids, _ids, IDs
    // Handle both singular (organizerId) and plural (tagIds) forms
    let alias = columnName.replace(/(Ids|_ids|IDS|Id|_id|ID)$/i, '');

    // Convert to plural form (simple heuristic)
    if (alias.endsWith('y')) {
      alias = `${alias.slice(0, -1)}ies`;
    } else if (
      alias.endsWith('s') ||
      alias.endsWith('x') ||
      alias.endsWith('z') ||
      alias.endsWith('ch') ||
      alias.endsWith('sh')
    ) {
      alias = `${alias}es`;
    } else {
      alias = `${alias}s`;
    }

    // Convert to camelCase if needed
    return alias.charAt(0).toLowerCase() + alias.slice(1);
  }

  /**
   * Backfill missing local/foreign keys for relationships using reverse relationships
   */
  private backfillKeysFromReverse(): void {
    for (const [key, relationship] of this.relationships.entries()) {
      if (!relationship.localKey || !relationship.foreignKey) {
        const reverse = this.findRelationship(relationship.to, relationship.from);
        if (reverse?.localKey && reverse.foreignKey) {
          const updatedRelationship: RelationshipPath = {
            ...relationship,
            localKey: reverse.foreignKey,
            foreignKey: reverse.localKey,
          };
          // Preserve isArray flag if present in either relationship
          if (relationship.isArray !== undefined || reverse.isArray !== undefined) {
            updatedRelationship.isArray = relationship.isArray ?? reverse.isArray ?? false;
          }
          this.relationships.set(key, updatedRelationship);
        }
      }
    }
  }

  /**
   * Merge manual relationships with auto-detected ones, preserving manual overrides
   */
  mergeManualRelationships(manualRelationships: RelationshipMap): void {
    for (const [key, manualRelationship] of Object.entries(manualRelationships)) {
      // Preserve all properties from manual relationship, including isArray
      const mergedRelationship: RelationshipPath = {
        ...manualRelationship,
      };
      // Only set isArray if it's explicitly provided (preserve undefined if not set)
      if (manualRelationship.isArray !== undefined) {
        mergedRelationship.isArray = manualRelationship.isArray;
      }
      this.relationships.set(key, mergedRelationship);
    }
  }

  /**
   * Build a traversable relationship graph
   */
  private buildRelationshipGraph(relations: Record<string, Relations>): void {
    for (const [tableName, tableRelations] of Object.entries(relations)) {
      if (!this.relationshipGraph.has(tableName)) {
        this.relationshipGraph.set(tableName, new Set());
      }

      // Handle Drizzle relations structure - it has a config function
      let relationsObj: Record<string, DrizzleRelationConfig> = {};

      // Check if it's a Drizzle Relations object with config function
      if (this.isDrizzleRelations(tableRelations)) {
        try {
          // Call config with proper helpers that return objects with the expected structure
          const configResult = tableRelations.config({
            one: (table: unknown, config?: unknown) => {
              const configObj = (config as Record<string, unknown>) || {};
              return {
                table,
                fields: configObj.fields,
                references: configObj.references,
                nullable: configObj.nullable,
                type: 'one',
                withFieldName: (name: string) => ({
                  name,
                  table,
                  fields: configObj.fields,
                  references: configObj.references,
                  nullable: configObj.nullable,
                  type: 'one',
                }),
              };
            },
            many: (table: unknown, config?: unknown) => {
              const configObj = (config as Record<string, unknown>) || {};
              return {
                table,
                fields: configObj.fields,
                references: configObj.references,
                nullable: configObj.nullable,
                type: 'many',
                withFieldName: (name: string) => ({
                  name,
                  table,
                  fields: configObj.fields,
                  references: configObj.references,
                  nullable: configObj.nullable,
                  type: 'many',
                }),
              };
            },
          } as unknown as Parameters<typeof tableRelations.config>[0]);
          if (configResult && typeof configResult === 'object') {
            relationsObj = configResult as unknown as Record<string, DrizzleRelationConfig>;
          }
        } catch {
          // If calling fails, skip this table
          continue;
        }
      }

      // Handle Drizzle relations structure
      if (relationsObj && typeof relationsObj === 'object') {
        for (const [, relation] of Object.entries(relationsObj)) {
          // Check if this is a valid relation object
          if (this.isDrizzleRelationConfig(relation)) {
            const targetTable = relation.table;

            if (this.schema) {
              // Convert table reference to schema key (handles both table objects and strings)
              const targetTableSchemaKey = this.resolveSchemaKey(targetTable, this.schema);
              if (targetTableSchemaKey) {
                const sourceSet = this.relationshipGraph.get(tableName);
                if (sourceSet) {
                  sourceSet.add(targetTableSchemaKey); // Use schema key
                }

                // Directed graph: edge from source table to target table only
              }
            }
          }
        }
      }
    }
  }

  /**
   * Extract relationship paths from schema
   */
  private extractRelationshipPaths(
    relations: Record<string, Relations>,
    schema?: Record<string, unknown>
  ): void {
    for (const [tableName, tableRelations] of Object.entries(relations)) {
      // Handle Drizzle relations structure - it has a config function
      let relationsObj: Record<string, DrizzleRelationConfig> = {};

      // Check if it's a Drizzle Relations object with config function
      if (this.isDrizzleRelations(tableRelations)) {
        try {
          // Call config with proper helpers that return objects with the expected structure
          const configResult = tableRelations.config({
            one: (table: unknown, config?: unknown) => {
              const configObj = (config as Record<string, unknown>) || {};
              return {
                table,
                fields: configObj.fields,
                references: configObj.references,
                nullable: configObj.nullable,
                type: 'one',
                withFieldName: (name: string) => ({
                  name,
                  table,
                  fields: configObj.fields,
                  references: configObj.references,
                  nullable: configObj.nullable,
                  type: 'one',
                }),
              };
            },
            many: (table: unknown, config?: unknown) => {
              const configObj = (config as Record<string, unknown>) || {};
              return {
                table,
                fields: configObj.fields,
                references: configObj.references,
                nullable: configObj.nullable,
                type: 'many',
                withFieldName: (name: string) => ({
                  name,
                  table,
                  fields: configObj.fields,
                  references: configObj.references,
                  nullable: configObj.nullable,
                  type: 'many',
                }),
              };
            },
          } as unknown as Parameters<typeof tableRelations.config>[0]);
          if (configResult && typeof configResult === 'object') {
            relationsObj = configResult as unknown as Record<string, DrizzleRelationConfig>;
          }
        } catch {
          // If calling fails, skip this table
          continue;
        }
      }

      // Handle Drizzle relations structure
      if (relationsObj && typeof relationsObj === 'object') {
        for (const [relationName, relation] of Object.entries(relationsObj)) {
          // Check if this is a valid relation object
          if (this.isDrizzleRelationConfig(relation)) {
            const targetTable = relation.table;

            if (schema) {
              // Convert table reference to schema key (handles both table objects and strings)
              const targetTableSchemaKey = this.resolveSchemaKey(targetTable, schema);
              if (!targetTableSchemaKey) {
                // Schema key not found - skip this relationship
                continue;
              }

              // Determine cardinality based on relation type
              const cardinality = this.inferCardinalityFromRelation(relation);

              // Extract field names from column objects using property names
              const getFieldName = (field: unknown, tableName: string): string => {
                if (typeof field === 'string') return field;

                if (field && typeof field === 'object') {
                  const fieldObj = field as Record<string, unknown>;

                  // First, try to find the property name by matching the field object with the table schema
                  if (schema?.[tableName]) {
                    const tableSchema = schema[tableName] as Record<string, unknown>;

                    // Iterate through all properties in the table schema
                    for (const [propName, propValue] of Object.entries(tableSchema)) {
                      // Check if this property value matches our field object
                      if (propValue === field) {
                        return propName;
                      }
                    }
                  }

                  // Fallback: try to extract from the field object itself
                  if ('name' in fieldObj && typeof fieldObj.name === 'string') {
                    return fieldObj.name;
                  }

                  const nameSymbol = Symbol.for('drizzle:Name');
                  if (nameSymbol in fieldObj && typeof fieldObj[nameSymbol] === 'string') {
                    return fieldObj[nameSymbol] as string;
                  }
                }

                return '';
              };

              let localKey = Array.isArray(relation.fields)
                ? getFieldName(relation.fields[0], tableName)
                : getFieldName(relation.fields, tableName);

              let foreignKey = Array.isArray(relation.references)
                ? getFieldName(relation.references[0], targetTableSchemaKey)
                : getFieldName(relation.references, targetTableSchemaKey);

              // Handle composite foreign keys - use all fields/references
              if (Array.isArray(relation.fields) && Array.isArray(relation.references)) {
                // For composite keys, we'll use the first field as the primary identifier
                // but store all fields for proper join construction
                localKey = getFieldName(relation.fields[0], tableName);
                foreignKey = getFieldName(relation.references[0], targetTableSchemaKey);
              }

              // Handle many() relationships without explicit field mappings
              if (!localKey && !foreignKey && relation.type === 'many') {
                // For many() relationships, infer from foreign key constraints
                // Pass schema keys to inferManyRelationshipKeys
                const inferredKeys = this.inferManyRelationshipKeys(
                  tableName,
                  targetTableSchemaKey
                );
                localKey = inferredKeys.localKey;
                foreignKey = inferredKeys.foreignKey;
              }

              const relationshipPath: RelationshipPath = {
                from: tableName,
                to: targetTableSchemaKey, // Use schema key, not database table name
                foreignKey,
                localKey,
                cardinality,
                // Default to nullable (LEFT JOIN) for safety - only use INNER if explicitly non-nullable
                nullable: relation.nullable ?? true,
                joinType: relation.nullable === false ? 'inner' : 'left',
                // isArray will be set from manual relationships via mergeManualRelationships if provided
              };

              // Store both directions
              const forwardKey = `${tableName}.${relationName}`;
              const backwardKey = `${targetTableSchemaKey}.${this.getReverseRelationName(tableName, relationName)}`;

              this.relationships.set(forwardKey, relationshipPath);
              this.relationships.set(backwardKey, this.reverseRelationshipPath(relationshipPath));
            }
          }
        }
      }
    }
  }

  /**
   * Get join path between two tables
   */
  getJoinPath(fromTable: string, toTable: string): RelationshipPath[] {
    if (fromTable === toTable) {
      return [];
    }

    const visited = new Set<string>();
    const path: RelationshipPath[] = [];

    const found = this.findPath(fromTable, toTable, visited, path);

    if (!found) {
      throw new RelationshipError(`No relationship path found from ${fromTable} to ${toTable}`, {
        fromTable,
        toTable,
      });
    }

    return path;
  }

  /**
   * Find path between tables using DFS
   */
  private findPath(
    current: string,
    target: string,
    visited: Set<string>,
    path: RelationshipPath[]
  ): boolean {
    if (current === target) {
      return true;
    }

    if (visited.has(current)) {
      return false;
    }

    visited.add(current);
    const neighbors = this.relationshipGraph.get(current) || new Set();

    for (const neighbor of neighbors) {
      const relationship = this.findRelationship(current, neighbor);
      if (relationship) {
        path.push(relationship);

        if (this.findPath(neighbor, target, visited, path)) {
          return true;
        }

        path.pop();
      }
    }

    return false;
  }

  /**
   * Find relationship between two tables
   */
  private findRelationship(fromTable: string, toTable: string): RelationshipPath | null {
    for (const [, relationship] of this.relationships) {
      if (relationship.from === fromTable && relationship.to === toTable) {
        return relationship;
      }
    }
    return null;
  }

  /**
   * Infer cardinality of a relationship
   */
  inferCardinality(fromTable: string, toTable: string): 'one' | 'many' {
    const relationship = this.findRelationship(fromTable, toTable);
    return relationship?.cardinality || 'one';
  }

  /**
   * Get all relationships for a table
   */
  getTableRelationships(tableName: string): RelationshipPath[] {
    const relationships: RelationshipPath[] = [];

    for (const [, relationship] of this.relationships) {
      if (relationship.from === tableName) {
        relationships.push(relationship);
      }
    }

    return relationships;
  }

  /**
   * Check if two tables are related
   */
  areTablesRelated(table1: string, table2: string): boolean {
    if (table1 === table2) {
      return true;
    }

    try {
      this.getJoinPath(table1, table2);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all reachable tables from a starting table
   */
  getReachableTables(startTable: string): Set<string> {
    const reachable = new Set<string>();
    const queue = [startTable];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      reachable.add(current);

      const neighbors = this.relationshipGraph.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return reachable;
  }

  /**
   * Validate relationship integrity
   */
  validateRelationships<TSchema extends Record<string, AnyTableType>>(
    schema: TSchema,
    relations: Record<string, Relations>
  ): void {
    for (const [tableName, tableRelations] of Object.entries(relations)) {
      for (const [relationName, relation] of Object.entries(tableRelations)) {
        if (relation.type === 'one' || relation.type === 'many') {
          const targetTable = relation.table;
          const targetTableName = this.getTableName(targetTable);

          if (!targetTableName) {
            throw new RelationshipError(
              `Invalid target table in relationship ${tableName}.${relationName}`,
              { tableName, relationName, targetTable }
            );
          }

          if (!schema[targetTableName]) {
            throw new RelationshipError(`Target table ${targetTableName} not found in schema`, {
              tableName,
              relationName,
              targetTableName,
            } as unknown as Parameters<typeof tableRelations.config>[0]);
          }

          // Validate field references
          if (relation.fields.length !== relation.references.length) {
            throw new RelationshipError(
              `Mismatched field and reference counts in relationship ${tableName}.${relationName}`,
              { tableName, relationName, fields: relation.fields, references: relation.references }
            );
          }
        }
      }
    }
  }

  /**
   * Infer relationship keys for many() relationships without explicit mappings
   * Strategy: Inspect the target table's columns for .references() to the source table
   */
  private inferManyRelationshipKeys(
    fromTable: string,
    toTable: string
  ): { localKey: string; foreignKey: string } {
    // Get both table schemas (fromTable and toTable are now schema keys)
    const targetTableSchema = this.schema?.[toTable];
    const sourceTableSchema = this.schema?.[fromTable];

    if (!targetTableSchema || typeof targetTableSchema !== 'object') {
      return { localKey: '', foreignKey: '' };
    }
    if (!sourceTableSchema || typeof sourceTableSchema !== 'object') {
      return { localKey: '', foreignKey: '' };
    }

    // Get database table name from source table schema key for comparison
    // FK metadata stores database table names, so we need to compare DB names
    const sourceTableDbName = this.getTableName(sourceTableSchema);
    if (!sourceTableDbName) {
      return { localKey: '', foreignKey: '' };
    }

    const targetTableObj = targetTableSchema as Record<string, unknown>;
    const sourceTableObj = sourceTableSchema as Record<string, unknown>;

    // Strategy 1: Look for column with .references() pointing to source table
    for (const [propName, propValue] of Object.entries(targetTableObj)) {
      if (propValue && typeof propValue === 'object') {
        const columnObj = propValue as Record<string, unknown>;

        // Check for Drizzle column with references
        // Drizzle stores foreign key info in column metadata
        const columnSymbols = Object.getOwnPropertySymbols(columnObj);
        for (const sym of columnSymbols) {
          const symValue = (columnObj as Record<symbol, unknown>)[sym];
          if (symValue && typeof symValue === 'object') {
            const metaObj = symValue as Record<string, unknown>;

            // Check if this is foreign key metadata
            if ('foreignKeys' in metaObj && Array.isArray(metaObj.foreignKeys)) {
              for (const fk of metaObj.foreignKeys) {
                if (fk && typeof fk === 'object') {
                  const fkObj = fk as Record<string, unknown>;
                  const refTable = fkObj.table;
                  const refTableName = this.getTableName(refTable);

                  // Compare database table names (refTableName is DB name, sourceTableDbName is DB name)
                  if (refTableName === sourceTableDbName) {
                    // Found it! The foreign key column in target table
                    const foreignKey = propName;
                    // The referenced column in source table
                    const columns = fkObj.columns;
                    const localKey = this.getFieldName(
                      (Array.isArray(columns) ? columns[0] : undefined) || fkObj.column,
                      fromTable
                    );

                    if (localKey) {
                      return { localKey, foreignKey };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Strategy 2: Check table-level inline foreign keys (SQLite specific)
    const foreignKeysSymbol = Symbol.for('drizzle:SQLiteInlineForeignKeys');
    if (foreignKeysSymbol in targetTableObj) {
      const foreignKeys = (targetTableObj as Record<symbol, unknown>)[foreignKeysSymbol];
      if (Array.isArray(foreignKeys)) {
        for (const fk of foreignKeys) {
          if (fk && typeof fk === 'object') {
            const fkObj = fk as Record<string, unknown>;

            if ('reference' in fkObj && fkObj.reference && typeof fkObj.reference === 'function') {
              // Call the reference function to get the target column
              try {
                const refColumn = fkObj.reference();
                const refTableName = this.getTableName(refColumn);

                // Compare database table names (refTableName is DB name, sourceTableDbName is DB name)
                if (refTableName === sourceTableDbName) {
                  // Find which column in target table has this FK
                  const columns = fkObj.columns;
                  const foreignKey = String(
                    (Array.isArray(columns) ? columns[0] : undefined) || ''
                  );
                  const localKey = this.getFieldName(refColumn, fromTable);

                  if (foreignKey && localKey) {
                    return { localKey, foreignKey };
                  }
                }
              } catch {
                // Ignore if reference() fails
              }
            }
          }
        }
      }
    }

    // Strategy 3: Convention-based fallback
    // For users->posts, try posts.userId or posts.user_id referencing users.id
    const conventionalForeignKeys = [
      `${fromTable}Id`,
      `${fromTable}_id`,
      `${fromTable.slice(0, -1)}Id`, // singular: users -> userId
      `${fromTable.slice(0, -1)}_id`,
    ];

    for (const fkName of conventionalForeignKeys) {
      if (fkName in targetTableObj) {
        // Assume it references the primary key of source table
        // Try to find 'id' column in source table
        if ('id' in sourceTableObj) {
          return { localKey: 'id', foreignKey: fkName };
        }
      }
    }

    return { localKey: '', foreignKey: '' };
  }

  /**
   * Get table name from table object - completely generic
   */
  private getTableName(table: unknown): string | null {
    if (typeof table === 'string') {
      return table;
    }

    if (table && typeof table === 'object') {
      const tableObj = table as Record<string, unknown>;

      // Check for Drizzle table name symbol
      if (Symbol.for('drizzle:Name') in tableObj) {
        const name = (tableObj as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
        if (typeof name === 'string') {
          return name;
        }
      }

      // Check for Drizzle original name symbol
      if (Symbol.for('drizzle:OriginalName') in tableObj) {
        const name = (tableObj as Record<symbol, unknown>)[Symbol.for('drizzle:OriginalName')];
        if (typeof name === 'string') {
          return name;
        }
      }

      // Check for Drizzle base name symbol
      if (Symbol.for('drizzle:BaseName') in tableObj) {
        const name = (tableObj as Record<symbol, unknown>)[Symbol.for('drizzle:BaseName')];
        if (typeof name === 'string') {
          return name;
        }
      }

      // Check for _name property (common in Drizzle)
      if ('_name' in tableObj && typeof tableObj._name === 'string') {
        return tableObj._name;
      }

      // Check for name property
      if ('name' in tableObj && typeof tableObj.name === 'string') {
        return tableObj.name;
      }

      // Check for _ property with name
      if ('_' in tableObj && tableObj._ && typeof tableObj._ === 'object') {
        const meta = tableObj._ as Record<string, unknown>;
        if ('name' in meta && typeof meta.name === 'string') {
          return meta.name;
        }
      }

      // Check for tableName property
      if ('tableName' in tableObj && typeof tableObj.tableName === 'string') {
        return tableObj.tableName;
      }
    }

    return null;
  }

  /**
   * Find the schema key from a database table name with fallback
   *
   * Strategy:
   * 1. Try to find schema key by matching DB name via getTableName()
   * 2. If not found, check if DB name exists as schema key directly (fallback)
   * 3. Return null only if both fail
   *
   * This handles both naming conventions:
   * - { usersTable: usersTable } where DB name is 'users' → finds 'usersTable'
   * - { users: usersTable } where schema key matches DB name → returns 'users'
   */
  private findSchemaKeyByTableName(
    schema: Record<string, unknown>,
    dbTableName: string
  ): string | null {
    // Strategy 1: Find schema key by matching database table name
    for (const [schemaKey, tableSchema] of Object.entries(schema)) {
      if (!tableSchema || typeof tableSchema !== 'object') continue;
      const tableDbName = this.getTableName(tableSchema);
      if (tableDbName === dbTableName) {
        return schemaKey;
      }
    }

    // Strategy 2: Fallback - check if DB name exists as schema key directly
    // This handles cases where schema keys match DB names: { users: usersTable }
    if (dbTableName in schema) {
      return dbTableName;
    }

    return null;
  }

  /**
   * Resolve schema key from table reference with fallback
   *
   * This is a convenience method that handles both table objects and strings.
   * It's used when we have a table reference (object or string) and need to
   * find the corresponding schema key.
   *
   * Generic method that works for any table reference format.
   */
  private resolveSchemaKey(table: unknown, schema: Record<string, unknown>): string | null {
    // If it's already a string, check if it's a schema key
    if (typeof table === 'string') {
      if (table in schema) {
        return table; // It's already a schema key
      }
      // Try to find schema key by DB name
      return this.findSchemaKeyByTableName(schema, table);
    }

    // If it's a table object, try multiple strategies to find the schema key

    // Strategy 1: Direct reference equality - check if table object matches a schema table
    if (table && typeof table === 'object') {
      for (const [schemaKey, schemaTable] of Object.entries(schema)) {
        if (schemaTable === table) {
          return schemaKey; // Direct match found
        }
      }
    }

    // Strategy 2: Get DB name from table object, then find schema key
    const dbName = this.getTableName(table);
    if (dbName) {
      // First check if DB name matches a schema key directly
      if (dbName in schema) {
        return dbName;
      }
      // Then try to find schema key by DB name
      const schemaKey = this.findSchemaKeyByTableName(schema, dbName);
      if (schemaKey) {
        return schemaKey;
      }
    }

    // Strategy 3: If table object has a name property, try matching by name
    if (table && typeof table === 'object') {
      const tableObj = table as Record<string, unknown>;
      if ('name' in tableObj && typeof tableObj.name === 'string') {
        const nameMatch = this.findSchemaKeyByTableName(schema, tableObj.name);
        if (nameMatch) {
          return nameMatch;
        }
      }
    }

    return null;
  }

  /**
   * Get field name from field object
   *
   * Generic method that resolves column names from column objects.
   * Works by matching column objects to property names in the table schema.
   */
  private getFieldName(field: unknown, tableName: string): string {
    if (typeof field === 'string') return field;

    if (field && typeof field === 'object') {
      const fieldObj = field as Record<string, unknown>;

      // Strategy 1: Find the property name by matching the field object with the table schema
      // This is the most reliable method - use reference equality
      if (this?.schema?.[tableName]) {
        const tableSchema = this.schema[tableName] as Record<string, unknown>;

        // Iterate through all properties in the table schema
        for (const [propName, propValue] of Object.entries(tableSchema)) {
          // Check if this property value matches our field object (reference equality)
          if (propValue === field) {
            return propName;
          }
        }
      }

      // Strategy 2: Try to extract from the field object itself
      // Check for name property
      if ('name' in fieldObj && typeof fieldObj.name === 'string') {
        return fieldObj.name;
      }

      // Strategy 3: Check for _name property (used in some Drizzle column metadata)
      if ('_name' in fieldObj && typeof fieldObj._name === 'string') {
        return fieldObj._name;
      }

      // Strategy 4: Check for Drizzle name symbol
      const nameSymbol = Symbol.for('drizzle:Name');
      if (nameSymbol in fieldObj && typeof fieldObj[nameSymbol] === 'string') {
        return fieldObj[nameSymbol] as string;
      }

      // Strategy 5: Check column metadata symbols for name
      const fieldSymbols = Object.getOwnPropertySymbols(fieldObj);
      for (const sym of fieldSymbols) {
        const symValue = (fieldObj as Record<symbol, unknown>)[sym];
        if (symValue && typeof symValue === 'object') {
          const metaObj = symValue as Record<string, unknown>;

          // Check for name in metadata
          if ('name' in metaObj && typeof metaObj.name === 'string') {
            return metaObj.name;
          }

          // Check for _name in metadata
          if ('_name' in metaObj && typeof metaObj._name === 'string') {
            return metaObj._name;
          }
        }
      }

      // Strategy 6: Check _ property for name
      if ('_' in fieldObj && fieldObj._ && typeof fieldObj._ === 'object') {
        const fieldUnder = fieldObj._ as Record<string, unknown>;
        if ('name' in fieldUnder && typeof fieldUnder.name === 'string') {
          return fieldUnder.name;
        }
      }
    }

    return '';
  }

  /**
   * Infer cardinality from relation
   */
  private inferCardinalityFromRelation(relation: DrizzleRelationConfig): 'one' | 'many' {
    // Check if relation has a type property
    if (relation.type === 'one' || relation.type === 'many') {
      return relation.type;
    }

    // Check if relation has a cardinality property
    if (relation.cardinality === 'one' || relation.cardinality === 'many') {
      return relation.cardinality;
    }

    // Default to 'one' for most relationships
    return 'one';
  }

  /**
   * Get reverse relation name
   */
  private getReverseRelationName(tableName: string, relationName: string): string {
    // Simple heuristic - could be improved with more sophisticated logic
    return `${tableName}_${relationName}`;
  }

  /**
   * Reverse a relationship path
   */
  private reverseRelationshipPath(path: RelationshipPath): RelationshipPath {
    const reversed: RelationshipPath = {
      from: path.to,
      to: path.from,
      foreignKey: path.localKey,
      localKey: path.foreignKey,
      cardinality: path.cardinality === 'one' ? 'many' : 'one',
      nullable: true, // Reverse relationships are typically nullable
      joinType: 'left',
    };

    // Preserve array flag if it exists
    if (path.isArray !== undefined) {
      reversed.isArray = path.isArray;
    }

    return reversed;
  }

  /**
   * Detect circular references
   */
  detectCircularReferences(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const tableName of this.relationshipGraph.keys()) {
      if (!visited.has(tableName)) {
        this.detectCycleDFS(tableName, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  /**
   * DFS to detect cycles
   */
  private detectCycleDFS(
    current: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(current);
    recursionStack.add(current);
    path.push(current);

    const neighbors = this.relationshipGraph.get(current) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.detectCycleDFS(neighbor, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      }
    }

    recursionStack.delete(current);
    path.pop();
  }
}
