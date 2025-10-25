/**
 * @fileoverview Relationship path resolution and join optimization for Drizzle ORM
 * @module @better-tables/drizzle-adapter/relationship-manager
 *
 * @description
 * Manages relationship paths and optimizes join strategies for efficient query execution.
 * This module is responsible for:
 * - Resolving column paths with dot notation (e.g., 'profile.bio')
 * - Determining which tables need to be joined
 * - Optimizing join order for best performance
 * - Building join conditions from relationships
 * - Validating column access
 * - Providing helpful error messages with suggestions
 *
 * Key features:
 * - Resolves simple fields: 'email' → main table column
 * - Resolves relationship fields: 'profile.bio' → joins profile table and accesses bio column
 * - Resolves multi-level paths: 'profile.company.name' → joins profile and company
 * - Optimizes join order to minimize query complexity
 * - Caches join paths for performance
 * - Provides detailed error messages with suggestions
 *
 * @note This class maintains internal caches for performance optimization. While the class
 * is designed to be safe for concurrent use (all methods accept primaryTable as a parameter
 * rather than storing it as mutable state), the internal cache may be mutated during operations.
 * Call clearJoinPathCache() if you need to reset cached state.
 *
 * @example
 * ```typescript
 * const manager = new RelationshipManager(schema, relationships);
 *
 * // Resolve a column path
 * const path = manager.resolveColumnPath('profile.bio', 'users');
 * // Returns: { columnId: 'profile.bio', table: 'profile', field: 'bio', isNested: true, ... }
 *
 * // Get required joins
 * const joins = manager.getRequiredJoins(['profile.bio', 'posts.title'], 'users');
 * // Returns: Map of required join paths
 *
 * // Optimize join order
 * const optimized = manager.optimizeJoinOrder(joins, 'users');
 * // Returns: Array of relationships in optimal order
 * ```
 *
 * @see {@link RelationshipPath} for relationship structure
 * @see {@link ColumnPath} for column path structure
 * @since 1.0.0
 */

import type { SQL } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type {
  AnyColumnType,
  AnyTableType,
  ColumnPath,
  ColumnReference,
  JoinConfig,
  QueryContext,
  RelationshipMap,
  RelationshipPath,
} from './types';
import { RelationshipError } from './types';
import { getColumnNames } from './utils/drizzle-schema-utils';
import { calculateLevenshteinDistance } from './utils/levenshtein';

/**
 * Relationship manager that handles column path resolution and join optimization.
 *
 * @class RelationshipManager
 * @description Manages relationships between tables and optimizes query joins
 *
 * @property {RelationshipMap} relationships - Map of all relationships
 * @property {Record<string, AnyTableType>} schema - The schema containing all tables
 * @property {Map} joinPathCache - Cache for join paths to improve performance
 *
 * @example
 * ```typescript
 * const manager = new RelationshipManager(schema, relationships);
 * const context = manager.buildQueryContext(
 *   { columns: ['email', 'profile.bio'] },
 *   'users'
 * );
 * ```
 *
 * @since 1.0.0
 */
export class RelationshipManager {
  private relationships: RelationshipMap;
  private schema: Record<string, AnyTableType>;
  private joinPathCache = new Map<string, RelationshipPath[]>();

  constructor(schema: Record<string, AnyTableType>, relationships: RelationshipMap) {
    this.schema = schema;
    this.relationships = relationships;
  }

  /**
   * Get all relationships
   */
  getRelationships(): RelationshipMap {
    return this.relationships;
  }

  /**
   * Resolve column path (e.g., "profile.bio" -> table + field)
   * @param columnId - The column identifier to resolve
   * @param primaryTable - The primary table for this query context
   */
  resolveColumnPath(columnId: string, primaryTable: string): ColumnPath {
    // Validate input
    this.validateColumnIdInput(columnId);

    const parts = columnId.split('.');

    if (parts.length === 1) {
      // Direct column or relationship alias
      const fieldOrAlias = parts[0];
      if (!fieldOrAlias) {
        throw new RelationshipError(`Invalid column path: ${columnId}`, {
          columnId,
          reason: 'Empty field name',
          suggestion: 'Provide a valid field name',
        });
      }

      // Check if it's actually a field in the primary table first
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        const fieldExists = (primaryTableSchema as unknown as Record<string, AnyColumnType>)[
          fieldOrAlias
        ];
        if (fieldExists) {
          // It's a direct field
          return {
            columnId,
            table: primaryTable,
            field: fieldOrAlias,
            isNested: false,
          };
        }
      }

      // If not a field, check if this matches a relationship alias from the primary table
      const relKey = `${primaryTable}.${fieldOrAlias}`;
      const relationship = this.relationships[relKey];
      if (relationship) {
        return {
          columnId,
          table: fieldOrAlias,
          field: '',
          isNested: true,
          relationshipPath: [relationship],
        };
      }

      // If neither field nor relationship, throw error with helpful message
      const availableFields = primaryTableSchema ? this.getTableColumns(primaryTableSchema) : [];
      const availableRelationships = this.getAvailableRelationships(primaryTable);

      throw new RelationshipError(
        `Field '${fieldOrAlias}' not found in primary table '${primaryTable}'`,
        {
          field: fieldOrAlias,
          primaryTable: primaryTable,
          availableFields: availableFields.slice(0, 10),
          totalFields: availableFields.length,
          availableRelationships,
          suggestion:
            this.findSimilarField(fieldOrAlias, availableFields) ||
            this.findSimilarRelationship(fieldOrAlias, availableRelationships) ||
            'Check spelling or use table.field format for related columns',
        }
      );
    }

    if (parts.length === 2) {
      // Single level relationship (e.g., "profile.bio")
      const [relationshipName, fieldName] = parts;

      if (!relationshipName || !fieldName) {
        throw new RelationshipError(`Invalid column path: ${columnId}`, {
          columnId,
          reason: 'Missing relationship or field name',
          suggestion: 'Use format: relationship.field',
        });
      }

      // Find the relationship from primary table to the relationship name
      const relationshipKey = `${primaryTable}.${relationshipName}`;
      const relationship = this.relationships[relationshipKey];

      if (!relationship) {
        const availableRelationships = this.getAvailableRelationships(primaryTable);
        throw new RelationshipError(
          `No relationship found from ${primaryTable} to ${relationshipName}`,
          {
            primaryTable: primaryTable,
            relationshipName,
            columnId,
            availableRelationships,
            suggestion: this.findSimilarRelationship(relationshipName, availableRelationships),
          }
        );
      }

      // Validate field exists in target table (use real table from relationship)
      this.validateRelatedTableField(relationship.to, fieldName);

      return {
        columnId,
        table: relationshipName, // expose alias (e.g., "profile")
        field: fieldName,
        isNested: true,
        relationshipPath: [relationship],
      };
    }

    if (parts.length > 2) {
      // Multi-level relationship (e.g., "profile.company.name")
      this.validateMultiLevelPath(parts);

      const relationshipPath = this.resolveMultiLevelPath(primaryTable, parts);
      const fieldName = parts[parts.length - 1];

      if (!fieldName) {
        throw new RelationshipError(`Invalid column path: ${columnId}`, {
          columnId,
          reason: 'Missing field name in multi-level path',
          suggestion: 'Use format: table1.table2.field',
        });
      }

      // Determine alias table name from the path parts
      const aliasTableName = parts[parts.length - 2];
      if (!aliasTableName) {
        throw new RelationshipError(`Invalid multi-level path: missing table name`, {
          columnId,
          parts,
          suggestion: 'Use format: table1.table2.field',
        });
      }

      // Validate field exists in real final table
      const realFinalTableName =
        relationshipPath.length > 0
          ? relationshipPath[relationshipPath.length - 1]?.to || primaryTable
          : primaryTable;
      this.validateRelatedTableField(realFinalTableName, fieldName);

      return {
        columnId,
        table: aliasTableName, // expose alias in path
        field: fieldName,
        isNested: true,
        relationshipPath,
      };
    }

    throw new RelationshipError(`Invalid column path: ${columnId}`, {
      columnId,
      primaryTable: primaryTable,
      reason: 'Unsupported path format',
      suggestion: 'Use format: field, table.field, or table1.table2.field',
    });
  }

  /**
   * Resolve multi-level relationship path
   */
  private resolveMultiLevelPath(mainTable: string, parts: string[]): RelationshipPath[] {
    const paths: RelationshipPath[] = [];
    let currentTable = mainTable;

    // Process all parts except the last one (which is the field)
    for (let i = 0; i < parts.length - 1; i++) {
      const relationshipName = parts[i];
      if (!relationshipName) {
        throw new RelationshipError(`Invalid relationship name in path`, {
          currentTable,
          parts,
        });
      }

      // Find relationship by name from current table
      const relationshipKey = `${currentTable}.${relationshipName}`;
      const relationship = this.relationships[relationshipKey];

      if (!relationship) {
        throw new RelationshipError(
          `No relationship found from ${currentTable} to ${relationshipName}`,
          {
            currentTable,
            relationshipName,
            parts,
            availableRelationships: this.getAvailableRelationshipsFromTable(currentTable),
          }
        );
      }

      paths.push(relationship);
      currentTable = relationship.to;
    }

    return paths;
  }

  /**
   * Get required joins for a set of columns
   * Returns map keyed by relationship alias (e.g., 'profile', 'posts')
   * @param columns - Column IDs to analyze
   * @param primaryTable - The primary table for this query context
   * @param existingJoins - Set of already-joined tables
   */
  getRequiredJoins(
    columns: string[],
    primaryTable: string,
    existingJoins: Set<string> = new Set()
  ): Map<string, RelationshipPath[]> {
    const requiredJoins = new Map<string, RelationshipPath[]>();

    for (const columnId of columns) {
      const columnPath = this.resolveColumnPath(columnId, primaryTable);

      if (columnPath.isNested && columnPath.relationshipPath) {
        // Use the alias from the first part of the columnId
        const alias = columnId.split('.')[0];

        if (alias && !existingJoins.has(alias)) {
          requiredJoins.set(alias, columnPath.relationshipPath);
        }
      }
    }

    return requiredJoins;
  }

  /**
   * Optimize join order for best performance
   * @param requiredJoins - Map of required joins
   * @param primaryTable - The primary table for this query context
   */
  optimizeJoinOrder(
    requiredJoins: Map<string, RelationshipPath[]>,
    primaryTable: string
  ): RelationshipPath[] {
    const joinOrder: RelationshipPath[] = [];
    const processed = new Set<string>([primaryTable]);
    const remaining = new Map(requiredJoins);

    // Process joins in dependency order
    while (remaining.size > 0) {
      let foundJoin = false;

      for (const [targetTable, paths] of remaining) {
        // Check if all dependencies are satisfied
        const canJoin = paths.every((path) => processed.has(path.from));

        if (canJoin) {
          // Add the first path (they should all be equivalent)
          const firstPath = paths[0];
          if (firstPath) {
            joinOrder.push(firstPath);
            processed.add(targetTable);
            remaining.delete(targetTable);
            foundJoin = true;
            break;
          }
        }
      }

      if (!foundJoin) {
        // Circular dependency or missing relationship
        const remainingTables = Array.from(remaining.keys());
        throw new RelationshipError(
          `Cannot resolve join order. Remaining tables: ${remainingTables.join(', ')}`,
          { remainingTables, processed: Array.from(processed) }
        );
      }
    }

    return joinOrder;
  }

  /**
   * Validate column access
   * @param columnId - Column ID to validate
   * @param primaryTable - The primary table for this query context
   */
  validateColumnAccess(columnId: string, primaryTable: string): boolean {
    try {
      this.resolveColumnPath(columnId, primaryTable);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all accessible columns for a table
   * @param primaryTable - The primary table for this query context
   */
  getAccessibleColumns(primaryTable: string): string[] {
    const accessibleColumns: string[] = [];

    // Add direct columns from primary table
    const primaryTableSchema = this.schema[primaryTable];
    if (primaryTableSchema) {
      // Generic way to get columns from any Drizzle table
      const columns = this.getTableColumns(primaryTableSchema);
      accessibleColumns.push(...columns);
    }

    // Add columns from related tables (use alias names for exposure)
    for (const key of Object.keys(this.relationships)) {
      if (key.startsWith(`${primaryTable}.`)) {
        const alias = key.substring(`${primaryTable}.`.length);
        const relationship = this.relationships[key];
        if (relationship) {
          const relatedTableSchema = this.schema[relationship.to];

          if (relatedTableSchema) {
            const columns = this.getTableColumns(relatedTableSchema);
            accessibleColumns.push(...columns.map((col) => `${alias}.${col}`));
          }
        }
      }
    }

    return accessibleColumns;
  }

  /**
   * Build query context from parameters
   * @param params - Query parameters including columns, filters, and sorts
   * @param primaryTable - The primary table for this query context
   */
  buildQueryContext(
    params: {
      columns?: string[];
      filters?: Array<{ columnId: string }>;
      sorts?: Array<{ columnId: string }>;
    },
    primaryTable: string
  ): QueryContext {
    const context: QueryContext = {
      requiredTables: new Set([primaryTable]),
      joinPaths: new Map(),
      columns: new Set(),
      filters: new Set(),
      sorts: new Set(),
    };

    // Process columns
    if (params.columns) {
      for (const columnId of params.columns) {
        context.columns.add(columnId);
        const columnPath = this.resolveColumnPath(columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          // Use alias from columnId (e.g., 'profile' from 'profile.bio')
          const alias = columnId.split('.')[0];
          if (alias) {
            context.requiredTables.add(alias);
            context.joinPaths.set(alias, columnPath.relationshipPath);
          }
        }
      }
    }

    // Process filters
    if (params.filters) {
      for (const filter of params.filters) {
        context.filters.add(filter.columnId);
        const columnPath = this.resolveColumnPath(filter.columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          const alias = filter.columnId.split('.')[0];
          if (alias) {
            context.requiredTables.add(alias);
            context.joinPaths.set(alias, columnPath.relationshipPath);
          }
        }
      }
    }

    // Process sorts
    if (params.sorts) {
      for (const sort of params.sorts) {
        context.sorts.add(sort.columnId);
        const columnPath = this.resolveColumnPath(sort.columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          const alias = sort.columnId.split('.')[0];
          if (alias) {
            context.requiredTables.add(alias);
            context.joinPaths.set(alias, columnPath.relationshipPath);
          }
        }
      }
    }

    return context;
  }

  /**
   * Check if a table is reachable from main table
   * @param targetTable - The target table to check
   * @param primaryTable - The primary table for this query context
   */
  isTableReachable(targetTable: string, primaryTable: string): boolean {
    if (primaryTable === targetTable) {
      return true;
    }

    try {
      this.getJoinPath(primaryTable, targetTable);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get relationship statistics
   */
  getRelationshipStats(): {
    totalRelationships: number;
    oneToMany: number;
    manyToOne: number;
    oneToOne: number;
    manyToMany: number;
  } {
    const stats = {
      totalRelationships: 0,
      oneToMany: 0,
      manyToOne: 0,
      oneToOne: 0,
      manyToMany: 0,
    };

    for (const relationship of Object.values(this.relationships)) {
      stats.totalRelationships++;

      if (relationship.cardinality === 'one') {
        stats.oneToOne++;
      } else {
        stats.oneToMany++;
      }
    }

    return stats;
  }

  /**
   * Get all tables in the schema
   */
  getAllTables(): string[] {
    return Object.keys(this.schema);
  }

  /**
   * Get table schema
   */
  getTableSchema(tableName: string): AnyTableType | null {
    return this.schema[tableName] || null;
  }

  /**
   * Check if a table exists in the schema
   */
  hasTable(tableName: string): boolean {
    return tableName in this.schema;
  }

  /**
   * Get required joins for a specific column
   * @param columnPath - The column path to analyze
   * @param primaryTable - The primary table for this query context
   */
  getRequiredJoinsForColumn(columnPath: ColumnPath, primaryTable: string): JoinConfig[] {
    if (!columnPath.isNested) {
      return []; // No joins needed for main table columns
    }

    // Build join path to the target table (map alias to real table)
    const finalRelationship = columnPath.relationshipPath?.[columnPath.relationshipPath.length - 1];
    const realTargetTable = finalRelationship?.to || columnPath.table;
    const joinPath = this.getJoinPath(primaryTable, realTargetTable);

    return joinPath.map((relationship) => {
      const table = this.schema[relationship.to];
      if (!table) {
        throw new RelationshipError(`Table not found: ${relationship.to}`, {
          relationship,
          availableTables: Object.keys(this.schema),
        });
      }

      return {
        type: relationship.joinType || 'left',
        table,
        condition: this.buildJoinCondition(relationship),
        alias: `${relationship.to}_${relationship.from}`,
      };
    });
  }

  /**
   * Get join path between two tables
   */
  getJoinPath(fromTable: string, toTable: string): RelationshipPath[] {
    const cacheKey = `${fromTable}->${toTable}`;

    // Check cache first
    if (this.joinPathCache.has(cacheKey)) {
      const cachedPath = this.joinPathCache.get(cacheKey);
      if (cachedPath) {
        return cachedPath;
      }
    }

    const joinPath = this.computeJoinPath(fromTable, toTable);
    this.joinPathCache.set(cacheKey, joinPath);

    return joinPath;
  }

  /**
   * Build join condition from relationship
   */
  private buildJoinCondition(relationship: RelationshipPath): SQL {
    const fromTable = this.schema[relationship.from];
    const toTable = this.schema[relationship.to];

    if (!fromTable || !toTable) {
      throw new RelationshipError(`Table not found in schema`, {
        fromTable: relationship.from,
        toTable: relationship.to,
        relationship,
      });
    }

    // Access columns using Drizzle's direct property access with proper type conversion
    const fromColumn = (fromTable as unknown as Record<string, AnyColumnType>)[
      relationship.localKey
    ];
    const toColumn = (toTable as unknown as Record<string, AnyColumnType>)[relationship.foreignKey];

    if (!fromColumn || !toColumn) {
      throw new RelationshipError(`Column not found in table`, {
        fromTable: relationship.from,
        toTable: relationship.to,
        localKey: relationship.localKey,
        foreignKey: relationship.foreignKey,
        relationship,
      });
    }

    return eq(fromColumn, toColumn);
  }

  /**
   * Compute join path between two tables using BFS
   */
  private computeJoinPath(fromTable: string, toTable: string): RelationshipPath[] {
    if (fromTable === toTable) {
      return []; // Same table, no joins needed
    }

    // BFS to find shortest path
    const queue: Array<{ table: string; path: RelationshipPath[] }> = [
      { table: fromTable, path: [] },
    ];
    const visited = new Set<string>([fromTable]);

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const { table, path } = item;

      // Check direct relationships
      for (const [, relationship] of Object.entries(this.relationships)) {
        if (relationship.from === table && !visited.has(relationship.to)) {
          const newPath = [...path, relationship];

          if (relationship.to === toTable) {
            return newPath; // Found target table
          }

          visited.add(relationship.to);
          queue.push({ table: relationship.to, path: newPath });
        }
      }
    }

    throw new RelationshipError(`No path found from ${fromTable} to ${toTable}`, {
      fromTable,
      toTable,
      availableTables: Object.keys(this.schema),
    });
  }

  /**
   * Get column reference for query building
   * @param columnPath - The column path to get reference for
   * @param primaryTable - The primary table for this query context
   */
  getColumnReference(columnPath: ColumnPath, primaryTable: string): ColumnReference {
    if (columnPath.isNested) {
      // Handle related table columns
      const realTableName =
        columnPath.relationshipPath?.[columnPath.relationshipPath.length - 1]?.to ||
        columnPath.table;
      const relatedTable = this.schema[realTableName];
      if (!relatedTable) {
        throw new RelationshipError(`Related table not found: ${columnPath.table}`, {
          columnPath,
          availableTables: Object.keys(this.schema),
        });
      }

      const column = (relatedTable as unknown as Record<string, AnyColumnType>)[columnPath.field];
      if (!column) {
        throw new RelationshipError(`Column not found: ${columnPath.field}`, {
          columnPath,
          availableColumns: Object.keys(relatedTable as unknown as Record<string, unknown>),
        });
      }

      return {
        column,
        tableAlias: `${columnPath.table}_${primaryTable}`,
        isRelated: true,
        joinPath: columnPath.relationshipPath || [],
      };
    } else {
      // Handle primary table columns
      const primaryTableSchema = this.schema[primaryTable];
      if (!primaryTableSchema) {
        throw new RelationshipError(`Primary table not found: ${primaryTable}`, {
          columnPath,
          primaryTable: primaryTable,
        });
      }

      const column = (primaryTableSchema as unknown as Record<string, AnyColumnType>)[
        columnPath.field
      ];
      if (!column) {
        throw new RelationshipError(`Column not found: ${columnPath.field}`, {
          columnPath,
          availableColumns: Object.keys(primaryTableSchema as unknown as Record<string, unknown>),
        });
      }

      return {
        column,
        isRelated: false,
      };
    }
  }

  /**
   * Validate column path exists in schema
   * @param columnId - Column ID to validate
   * @param primaryTable - The primary table for this query context
   */
  validateColumnPath(columnId: string, primaryTable: string): boolean {
    try {
      const columnPath = this.resolveColumnPath(columnId, primaryTable);

      if (columnPath.isNested) {
        // Check if related table exists
        if (!this.schema[columnPath.table]) {
          throw new RelationshipError(`Related table not found: ${columnPath.table}`, {
            columnId,
            table: columnPath.table,
          });
        }

        // Check if field exists in related table
        const tableSchema = this.schema[columnPath.table];
        if (
          !tableSchema ||
          !(tableSchema as unknown as Record<string, AnyColumnType>)[columnPath.field]
        ) {
          throw new RelationshipError(
            `Field not found in table: ${columnPath.table}.${columnPath.field}`,
            {
              columnId,
              table: columnPath.table,
              field: columnPath.field,
            }
          );
        }
      } else {
        // Check if field exists in primary table
        const primaryTableSchema = this.schema[primaryTable];
        if (
          !primaryTableSchema ||
          !(primaryTableSchema as unknown as Record<string, AnyColumnType>)[columnPath.field]
        ) {
          throw new RelationshipError(`Field not found in primary table: ${columnPath.field}`, {
            columnId,
            table: primaryTable,
            field: columnPath.field,
          });
        }
      }

      return true;
    } catch (error) {
      throw new RelationshipError(`Invalid column path: ${columnId}`, {
        columnId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear join path cache
   */
  clearJoinPathCache(): void {
    this.joinPathCache.clear();
  }

  /**
   * Generic method to get columns from any Drizzle table
   * Uses Drizzle schema utilities for accurate column detection
   */
  private getTableColumns(table: AnyTableType): string[] {
    return getColumnNames(table);
  }

  /**
   * Validate column ID input format
   */
  private validateColumnIdInput(columnId: string): void {
    if (!columnId || typeof columnId !== 'string') {
      throw new RelationshipError('Column ID must be a non-empty string', {
        columnId,
        type: typeof columnId,
      });
    }

    if (columnId.trim() !== columnId) {
      throw new RelationshipError('Column ID cannot have leading or trailing whitespace', {
        columnId,
        suggestion: columnId.trim(),
      });
    }

    if (columnId.includes('..')) {
      throw new RelationshipError('Column ID cannot contain consecutive dots', {
        columnId,
        suggestion: 'Use single dots to separate table and field names',
      });
    }

    if (columnId.startsWith('.') || columnId.endsWith('.')) {
      throw new RelationshipError('Column ID cannot start or end with a dot', {
        columnId,
        suggestion: 'Use format: field, table.field, or table1.table2.field',
      });
    }
  }

  /**
   * Validate that a field exists in a related table
   */
  private validateRelatedTableField(tableName: string, field: string): void {
    const tableSchema = this.schema[tableName];
    if (!tableSchema) {
      throw new RelationshipError(`Table '${tableName}' not found in schema`, {
        tableName,
        availableTables: Object.keys(this.schema),
      });
    }

    const fieldExists = (tableSchema as unknown as Record<string, AnyColumnType>)[field];
    if (!fieldExists) {
      const availableFields = Object.keys(tableSchema as unknown as Record<string, unknown>);
      throw new RelationshipError(`Field '${field}' not found in table '${tableName}'`, {
        field,
        tableName,
        availableFields: availableFields.slice(0, 10), // Show first 10 for brevity
        totalFields: availableFields.length,
        suggestion: this.findSimilarField(field, availableFields),
      });
    }
  }

  /**
   * Validate multi-level path structure
   */
  private validateMultiLevelPath(parts: string[]): void {
    // Check for empty parts
    for (let i = 0; i < parts.length - 1; i++) {
      // Exclude last part (field name)
      const part = parts[i];
      if (!part || part.trim() === '') {
        throw new RelationshipError('Multi-level path contains empty table names', {
          parts,
          suggestion: 'Use format: table1.table2.field',
        });
      }
    }

    // Check for duplicate consecutive table names
    for (let i = 0; i < parts.length - 2; i++) {
      // Exclude last two parts (table.field)
      if (parts[i] === parts[i + 1]) {
        throw new RelationshipError('Multi-level path contains duplicate consecutive table names', {
          parts,
          duplicateTable: parts[i],
          suggestion: 'Remove duplicate table names',
        });
      }
    }
  }

  /**
   * Find similar field name for better error messages
   */
  private findSimilarField(targetField: string, availableFields: string[]): string | null {
    const target = targetField.toLowerCase();

    // Exact match (case insensitive)
    const exactMatch = availableFields.find((field) => field.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    // Partial match
    const partialMatch = availableFields.find(
      (field) => field.toLowerCase().includes(target) || target.includes(field.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Levenshtein distance match
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const field of availableFields) {
      const distance = calculateLevenshteinDistance(target, field.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        // Max 2 character difference
        bestDistance = distance;
        bestMatch = field;
      }
    }

    return bestMatch;
  }

  /**
   * Get available relationship names from main table
   * @param primaryTable - The primary table for this query context
   */
  private getAvailableRelationships(primaryTable: string): string[] {
    return this.getAvailableRelationshipsFromTable(primaryTable);
  }

  /**
   * Get available relationship names from any table
   */
  private getAvailableRelationshipsFromTable(tableName: string): string[] {
    const relationships: string[] = [];
    for (const key of Object.keys(this.relationships)) {
      if (key.startsWith(`${tableName}.`)) {
        const relationshipName = key.substring(`${tableName}.`.length);
        relationships.push(relationshipName);
      }
    }
    return relationships;
  }

  /**
   * Find similar relationship name
   */
  private findSimilarRelationship(target: string, availableRelationships: string[]): string | null {
    if (availableRelationships.length === 0) return null;

    // Exact match
    const exactMatch = availableRelationships.find((rel) => rel === target);
    if (exactMatch) return exactMatch;

    // Partial match
    const partialMatch = availableRelationships.find(
      (rel) =>
        rel.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(rel.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Levenshtein distance match
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const rel of availableRelationships) {
      const distance = calculateLevenshteinDistance(target.toLowerCase(), rel.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        // Max 2 character difference
        bestDistance = distance;
        bestMatch = rel;
      }
    }

    return bestMatch;
  }
}
