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
 * Relationship manager that handles column path resolution and join optimization
 */
export class RelationshipManager {
  private relationships: RelationshipMap;
  private schema: Record<string, AnyTableType>;
  private mainTable: string;
  private joinPathCache = new Map<string, RelationshipPath[]>();

  constructor(
    schema: Record<string, AnyTableType>,
    relationships: RelationshipMap,
    mainTable: string
  ) {
    this.schema = schema;
    this.relationships = relationships;
    this.mainTable = mainTable;
  }

  /**
   * Get all relationships
   */
  getRelationships(): RelationshipMap {
    return this.relationships;
  }

  /**
   * Resolve column path (e.g., "profile.bio" -> table + field)
   */
  resolveColumnPath(columnId: string): ColumnPath {
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

      // Check if it's actually a field in the main table first
      const mainTableSchema = this.schema[this.mainTable];
      if (mainTableSchema) {
        const fieldExists = (mainTableSchema as unknown as Record<string, AnyColumnType>)[
          fieldOrAlias
        ];
        if (fieldExists) {
          // It's a direct field
          return {
            columnId,
            table: this.mainTable,
            field: fieldOrAlias,
            isNested: false,
          };
        }
      }

      // If not a field, check if this matches a relationship alias from the main table
      const relKey = `${this.mainTable}.${fieldOrAlias}`;
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
      const availableFields = mainTableSchema ? this.getTableColumns(mainTableSchema) : [];
      const availableRelationships = this.getAvailableRelationships();

      throw new RelationshipError(
        `Field '${fieldOrAlias}' not found in main table '${this.mainTable}'`,
        {
          field: fieldOrAlias,
          mainTable: this.mainTable,
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

      // Find the relationship from main table to the relationship name
      const relationshipKey = `${this.mainTable}.${relationshipName}`;
      const relationship = this.relationships[relationshipKey];

      if (!relationship) {
        const availableRelationships = this.getAvailableRelationships();
        throw new RelationshipError(
          `No relationship found from ${this.mainTable} to ${relationshipName}`,
          {
            mainTable: this.mainTable,
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

      const relationshipPath = this.resolveMultiLevelPath(this.mainTable, parts);
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
          ? relationshipPath[relationshipPath.length - 1]?.to || this.mainTable
          : this.mainTable;
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
      mainTable: this.mainTable,
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
   */
  getRequiredJoins(
    columns: string[],
    existingJoins: Set<string> = new Set()
  ): Map<string, RelationshipPath[]> {
    const requiredJoins = new Map<string, RelationshipPath[]>();

    for (const columnId of columns) {
      const columnPath = this.resolveColumnPath(columnId);

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
   */
  optimizeJoinOrder(requiredJoins: Map<string, RelationshipPath[]>): RelationshipPath[] {
    const joinOrder: RelationshipPath[] = [];
    const processed = new Set<string>([this.mainTable]);
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
   */
  validateColumnAccess(columnId: string): boolean {
    try {
      this.resolveColumnPath(columnId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all accessible columns for a table
   */
  getAccessibleColumns(): string[] {
    const accessibleColumns: string[] = [];

    // Add direct columns from main table
    const mainTableSchema = this.schema[this.mainTable];
    if (mainTableSchema) {
      // Generic way to get columns from any Drizzle table
      const columns = this.getTableColumns(mainTableSchema);
      accessibleColumns.push(...columns);
    }

    // Add columns from related tables (use alias names for exposure)
    for (const key of Object.keys(this.relationships)) {
      if (key.startsWith(`${this.mainTable}.`)) {
        const alias = key.substring(`${this.mainTable}.`.length);
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
   */
  buildQueryContext(params: {
    columns?: string[];
    filters?: Array<{ columnId: string }>;
    sorts?: Array<{ columnId: string }>;
  }): QueryContext {
    const context: QueryContext = {
      requiredTables: new Set([this.mainTable]),
      joinPaths: new Map(),
      columns: new Set(),
      filters: new Set(),
      sorts: new Set(),
    };

    // Process columns
    if (params.columns) {
      for (const columnId of params.columns) {
        context.columns.add(columnId);
        const columnPath = this.resolveColumnPath(columnId);

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
        const columnPath = this.resolveColumnPath(filter.columnId);

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
        const columnPath = this.resolveColumnPath(sort.columnId);

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
   */
  isTableReachable(targetTable: string): boolean {
    if (this.mainTable === targetTable) {
      return true;
    }

    try {
      this.getJoinPath(this.mainTable, targetTable);
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
   */
  getRequiredJoinsForColumn(columnPath: ColumnPath): JoinConfig[] {
    if (!columnPath.isNested) {
      return []; // No joins needed for main table columns
    }

    // Build join path to the target table (map alias to real table)
    const finalRelationship = columnPath.relationshipPath?.[columnPath.relationshipPath.length - 1];
    const realTargetTable = finalRelationship?.to || columnPath.table;
    const joinPath = this.getJoinPath(this.mainTable, realTargetTable);

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
   */
  getColumnReference(columnPath: ColumnPath): ColumnReference {
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
        tableAlias: `${columnPath.table}_${this.mainTable}`,
        isRelated: true,
        joinPath: columnPath.relationshipPath || [],
      };
    } else {
      // Handle main table columns
      const mainTableSchema = this.schema[this.mainTable];
      if (!mainTableSchema) {
        throw new RelationshipError(`Main table not found: ${this.mainTable}`, {
          columnPath,
          mainTable: this.mainTable,
        });
      }

      const column = (mainTableSchema as unknown as Record<string, AnyColumnType>)[
        columnPath.field
      ];
      if (!column) {
        throw new RelationshipError(`Column not found: ${columnPath.field}`, {
          columnPath,
          availableColumns: Object.keys(mainTableSchema as unknown as Record<string, unknown>),
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
   */
  validateColumnPath(columnId: string): boolean {
    try {
      const columnPath = this.resolveColumnPath(columnId);

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
        // Check if field exists in main table
        const mainTableSchema = this.schema[this.mainTable];
        if (
          !mainTableSchema ||
          !(mainTableSchema as unknown as Record<string, AnyColumnType>)[columnPath.field]
        ) {
          throw new RelationshipError(`Field not found in main table: ${columnPath.field}`, {
            columnId,
            table: this.mainTable,
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
   * Validate that a field exists in the main table
   */
  private validateMainTableField(field: string): void {
    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new RelationshipError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
        availableTables: Object.keys(this.schema),
      });
    }

    const fieldExists = (mainTableSchema as unknown as Record<string, AnyColumnType>)[field];
    if (!fieldExists) {
      const availableFields = Object.keys(mainTableSchema as unknown as Record<string, unknown>);
      throw new RelationshipError(`Field '${field}' not found in main table '${this.mainTable}'`, {
        field,
        mainTable: this.mainTable,
        availableFields: availableFields.slice(0, 10), // Show first 10 for brevity
        totalFields: availableFields.length,
        suggestion: this.findSimilarField(field, availableFields),
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
   */
  private getAvailableRelationships(): string[] {
    return this.getAvailableRelationshipsFromTable(this.mainTable);
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
