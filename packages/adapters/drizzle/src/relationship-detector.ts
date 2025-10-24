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
 * Relationship detector that parses Drizzle schema relations
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

    // Backfill missing keys for forward relations using reverse relations when available
    this.backfillKeysFromReverse();

    return Object.fromEntries(this.relationships);
  }

  /**
   * Backfill missing local/foreign keys for relationships using reverse relationships
   */
  private backfillKeysFromReverse(): void {
    for (const [key, relationship] of this.relationships.entries()) {
      if (!relationship.localKey || !relationship.foreignKey) {
        const reverse = this.findRelationship(relationship.to, relationship.from);
        if (reverse?.localKey && reverse.foreignKey) {
          this.relationships.set(key, {
            ...relationship,
            localKey: reverse.foreignKey,
            foreignKey: reverse.localKey,
          });
        }
      }
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
            const targetTableName = this.getTableName(targetTable);

            if (targetTableName) {
              const sourceSet = this.relationshipGraph.get(tableName);
              if (sourceSet) {
                sourceSet.add(targetTableName);
              }

              // Directed graph: edge from source table to target table only
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
            const targetTableName = this.getTableName(targetTable);

            if (targetTableName) {
              // Determine cardinality based on relation type
              const cardinality = this.inferCardinalityFromRelation(relation);

              // Extract field names from column objects using property names
              const getFieldName = (field: unknown, tableName: string): string => {
                if (typeof field === 'string') return field;

                if (field && typeof field === 'object') {
                  const fieldObj = field as Record<string, unknown>;

                  // First, try to find the property name by matching the field object with the table schema
                  if (schema && schema[tableName]) {
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
                ? getFieldName(relation.references[0], targetTableName)
                : getFieldName(relation.references, targetTableName);

              // Handle many() relationships without explicit field mappings
              if (!localKey && !foreignKey && relation.type === 'many') {
                // For many() relationships, infer from foreign key constraints
                const inferredKeys = this.inferManyRelationshipKeys(tableName, targetTableName);
                localKey = inferredKeys.localKey;
                foreignKey = inferredKeys.foreignKey;
              }

              const relationshipPath: RelationshipPath = {
                from: tableName,
                to: targetTableName,
                foreignKey,
                localKey,
                cardinality,
                // Default to nullable (LEFT JOIN) for safety - only use INNER if explicitly non-nullable
                nullable: relation.nullable ?? true,
                joinType: relation.nullable === false ? 'inner' : 'left',
              };

              // Store both directions
              const forwardKey = `${tableName}.${relationName}`;
              const backwardKey = `${targetTableName}.${this.getReverseRelationName(tableName, relationName)}`;

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
    // Get both table schemas
    const targetTableSchema = this.schema?.[toTable];
    const sourceTableSchema = this.schema?.[fromTable];

    if (!targetTableSchema || typeof targetTableSchema !== 'object') {
      return { localKey: '', foreignKey: '' };
    }
    if (!sourceTableSchema || typeof sourceTableSchema !== 'object') {
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

                  if (refTableName === fromTable) {
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

                if (refTableName === fromTable) {
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
   * Get field name from field object
   */
  private getFieldName(field: unknown, tableName: string): string {
    if (typeof field === 'string') return field;

    if (field && typeof field === 'object') {
      const fieldObj = field as Record<string, unknown>;

      // First, try to find the property name by matching the field object with the table schema
      if (this?.schema?.[tableName]) {
        const tableSchema = this.schema[tableName] as Record<string, unknown>;

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
    return {
      from: path.to,
      to: path.from,
      foreignKey: path.localKey,
      localKey: path.foreignKey,
      cardinality: path.cardinality === 'one' ? 'many' : 'one',
      nullable: true, // Reverse relationships are typically nullable
      joinType: 'left',
    };
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
