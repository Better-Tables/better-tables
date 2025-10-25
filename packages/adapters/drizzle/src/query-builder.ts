/**
 * @fileoverview SQL query builder for Drizzle ORM with join optimization
 * @module @better-tables/drizzle-adapter/query-builder
 *
 * @description
 * Builds efficient SQL queries with smart join optimization. This module is responsible for:
 * - Generating SELECT queries with proper column selections
 * - Building COUNT queries for pagination totals
 * - Constructing aggregate queries (COUNT, SUM, AVG, MIN, MAX)
 * - Applying filters as WHERE conditions
 * - Applying sorting with ORDER BY clauses
 * - Applying pagination with LIMIT and OFFSET
 * - Optimizing join order for performance
 * - Validating queries before execution
 *
 * Key features:
 * - Smart column selection based on relationships
 * - Automatic join condition generation
 * - Supports all filter operators
 * - Database-agnostic query building
 * - Type-safe query construction
 * - Comprehensive error messages with suggestions
 *
 * This class is immutable and thread-safe - all methods accept primaryTable as a parameter
 * rather than storing it as mutable state, preventing race conditions in concurrent requests.
 *
 * @example
 * ```typescript
 * const builder = new DrizzleQueryBuilder(db, schema, relationshipManager, 'postgres');
 *
 * const { dataQuery, countQuery } = builder.buildCompleteQuery({
 *   columns: ['id', 'email', 'profile.bio'],
 *   filters: [{ columnId: 'email', operator: 'contains', values: ['@example.com'] }],
 *   sorting: [{ columnId: 'id', direction: 'desc' }],
 *   pagination: { page: 1, limit: 10 },
 *   primaryTable: 'users'
 * });
 *
 * const data = await dataQuery.execute();
 * const count = await countQuery.execute();
 * ```
 *
 * @see {@link FilterHandler} for filter condition building
 * @see {@link RelationshipManager} for join optimization
 * @since 1.0.0
 */

import type { FilterState, PaginationParams, SortingParams } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { and, asc, avg, count, desc, eq, isNotNull, max, min, sum } from 'drizzle-orm';
import { FilterHandler } from './filter-handler';
import type { RelationshipManager } from './relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  ColumnPath,
  DatabaseDriver,
  DrizzleDatabase,
  QueryBuilderWithJoins,
  QueryContext,
  RelationshipPath,
} from './types';
import { QueryError } from './types';
import { getColumnNames } from './utils/drizzle-schema-utils';
import { calculateLevenshteinDistance } from './utils/levenshtein';
import { getPrimaryKeyMap } from './utils/schema-introspection';

/**
 * Type for accessing table columns by name.
 *
 * @typedef {object} TableWithColumns
 * @description Helper type for safely accessing columns from Drizzle table objects
 *
 * @since 1.0.0
 */
type TableWithColumns = Record<string, AnyColumnType>;

/**
 * Query builder that generates efficient SQL queries with smart joins.
 *
 * @class DrizzleQueryBuilder
 * @description Builds optimized SQL queries with automatic join handling
 *
 * @property {DrizzleDatabase} db - The Drizzle database instance
 * @property {Record<string, AnyTableType>} schema - The schema containing all tables
 * @property {RelationshipManager} relationshipManager - Manager for resolving relationships
 * @property {FilterHandler} filterHandler - Handler for building filter conditions
 * @property {Record<string, object>} primaryKeyMap - Map of primary keys for each table
 *
 * @example
 * ```typescript
 * const builder = new DrizzleQueryBuilder(db, schema, manager, 'postgres');
 * const { dataQuery, countQuery, columnMetadata } = builder.buildCompleteQuery({ ... });
 * ```
 *
 * @since 1.0.0
 */
export class DrizzleQueryBuilder {
  private db: DrizzleDatabase;
  private schema: Record<string, AnyTableType>;
  private relationshipManager: RelationshipManager;
  private filterHandler: FilterHandler;
  private primaryKeyMap: Record<string, { columnName: string; column: AnyColumnType }>;

  constructor(
    db: DrizzleDatabase,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver = 'postgres',
    primaryKeyMap?: Record<string, string>
  ) {
    this.db = db;
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.filterHandler = new FilterHandler(schema, relationshipManager, databaseType);

    // Initialize primary key map
    this.primaryKeyMap = getPrimaryKeyMap(schema, primaryKeyMap);
  }

  /**
   * Build SELECT query with joins
   * Returns both the query and metadata about column selections
   * @param context - Query context with join information
   * @param primaryTable - The primary table for this query
   * @param columns - Optional list of columns to select
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[]
  ): {
    query: QueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>; // Maps SQL result keys to original column IDs
    };
  } {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    // Build column selections first
    // Always create explicit selections when we have joins to ensure flat structure
    const selections: Record<string, AnyColumnType> = {};
    const columnMapping: Record<string, string> = {};

    if (columns && columns.length > 0) {
      Object.assign(selections, this.buildColumnSelections(columns, primaryTable));
      // Build mapping for explicit columns
      for (const columnId of columns) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
          const realTableName = relationship?.to || columnPath.table;
          const aliasedKey = `${realTableName}_${columnPath.field}`;
          columnMapping[aliasedKey] = columnId;
        } else {
          columnMapping[columnId] = columnId;
        }
      }
    } else if (context.joinPaths.size > 0) {
      // When filtering across relationships without explicit columns, create flat selections
      Object.assign(selections, this.buildFlatSelectionsForRelationships(primaryTable));
      // For flat selections, all columns map to themselves
      for (const key of Object.keys(selections)) {
        columnMapping[key] = key;
      }
    }

    let query =
      Object.keys(selections).length > 0
        ? this.db.select(selections).from(primaryTableSchema)
        : this.db.select().from(primaryTableSchema);

    // Add joins
    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    for (const relationship of joinOrder) {
      const targetTable = this.schema[relationship.to];
      if (!targetTable) {
        throw new QueryError(`Target table not found: ${relationship.to}`, {
          targetTable: relationship.to,
        });
      }

      const joinCondition = this.buildJoinCondition(relationship);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(targetTable, joinCondition);
      } else {
        query = query.innerJoin(targetTable, joinCondition);
      }
    }

    return {
      query,
      columnMetadata: {
        selections,
        columnMapping,
      },
    };
  }

  /**
   * Build COUNT query for pagination
   */
  buildCountQuery(context: QueryContext, primaryTable: string): QueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    let query = this.db.select({ count: count() }).from(primaryTableSchema);

    // Add joins
    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    for (const relationship of joinOrder) {
      const targetTable = this.schema[relationship.to];
      if (!targetTable) {
        throw new QueryError(`Target table not found: ${relationship.to}`, {
          targetTable: relationship.to,
        });
      }

      const joinCondition = this.buildJoinCondition(relationship);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(targetTable, joinCondition);
      } else {
        query = query.innerJoin(targetTable, joinCondition);
      }
    }

    return query;
  }

  /**
   * Build aggregate query for faceted values with proper type safety
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string
  ): QueryBuilderWithJoins {
    // Validate inputs
    this.validateColumnId(columnId, primaryTable);
    this.validateAggregateFunction(aggregateFunction);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

    // Validate column compatibility with aggregate function
    this.validateAggregateColumnCompatibility(columnReference.column, aggregateFunction);

    const mainTableSchema = this.schema[primaryTable];
    if (!mainTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    let query = this.db
      .select({
        value: columnReference.column,
        count: this.getAggregateFunction(columnReference.column, aggregateFunction),
      })
      .from(mainTableSchema);

    // Add required joins for the column
    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    for (const joinConfig of requiredJoins) {
      if (joinConfig.type === 'left') {
        query = query.leftJoin(joinConfig.table, joinConfig.condition);
      } else {
        query = query.innerJoin(joinConfig.table, joinConfig.condition);
      }
    }

    return query
      .where(isNotNull(columnReference.column))
      .groupBy(columnReference.column)
      .orderBy(columnReference.column);
  }

  /**
   * Apply filters to query
   */
  applyFilters(
    query: QueryBuilderWithJoins,
    filters: FilterState[],
    primaryTable: string
  ): QueryBuilderWithJoins {
    if (!filters || filters.length === 0) {
      return query;
    }

    const { conditions } = this.filterHandler.handleCrossTableFilters(filters, primaryTable);

    if (conditions.length === 0) {
      return query;
    }

    const validConditions = conditions.filter(
      (condition): condition is SQL | SQLWrapper => condition !== undefined
    );
    if (validConditions.length === 0) {
      return query;
    }

    return query.where(and(...validConditions) as SQL | SQLWrapper);
  }

  /**
   * Apply sorting to query
   */
  applySorting(
    query: QueryBuilderWithJoins,
    sorting: SortingParams[],
    primaryTable: string
  ): QueryBuilderWithJoins {
    if (!sorting || sorting.length === 0) {
      return query;
    }

    const orderByClauses = sorting.map((sort) => {
      const columnPath = this.relationshipManager.resolveColumnPath(sort.columnId, primaryTable);
      const column = this.getColumn(columnPath);

      if (!column) {
        throw new QueryError(`Column not found for sorting: ${sort.columnId}`, {
          columnId: sort.columnId,
        });
      }

      return sort.direction === 'desc' ? desc(column) : asc(column);
    });

    return query.orderBy(...orderByClauses);
  }

  /**
   * Apply pagination to query
   */
  applyPagination(
    query: QueryBuilderWithJoins,
    pagination: PaginationParams
  ): QueryBuilderWithJoins {
    if (!pagination) {
      return query;
    }

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    return query.limit(limit).offset(offset);
  }

  /**
   * Build join condition with proper type safety
   */
  private buildJoinCondition(relationship: RelationshipPath): SQL | SQLWrapper {
    const sourceTable = this.schema[relationship.from];
    const targetTable = this.schema[relationship.to];

    if (!sourceTable || !targetTable) {
      throw new QueryError(
        `Tables not found for join: ${relationship.from} -> ${relationship.to}`,
        { relationship }
      );
    }

    const sourceColumn = (sourceTable as unknown as Record<string, AnyColumnType>)[
      relationship.localKey
    ];
    const targetColumn = (targetTable as unknown as Record<string, AnyColumnType>)[
      relationship.foreignKey
    ];

    if (!sourceColumn || !targetColumn) {
      throw new QueryError(
        `Columns not found for join: ${relationship.localKey} -> ${relationship.foreignKey}`,
        { relationship }
      );
    }

    return eq(sourceColumn, targetColumn);
  }

  /**
   * Build flat selections for relationship filtering when no columns are specified
   * This ensures main table fields are at the top level and avoids nested structures
   * Generic approach that works with any Drizzle schema design
   */
  private buildFlatSelectionsForRelationships(primaryTable: string): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};

    // Always include all primary table columns - use Drizzle schema utilities
    const primaryTableSchema = this.schema[primaryTable];
    if (primaryTableSchema) {
      const primaryTableColumnNames = getColumnNames(primaryTableSchema);

      // Add all primary table columns to selections
      for (const colName of primaryTableColumnNames) {
        const col = (primaryTableSchema as unknown as TableWithColumns)[colName];
        if (col) {
          selections[colName] = col;
        }
      }
    }

    // Note: We deliberately do NOT include related table columns here
    // This ensures we get a flat structure with only main table fields
    // Related data will be handled by the data transformer if needed

    return selections;
  }

  /**
   * Build column selections with proper type safety
   * For relationships, selects all columns from related tables to enable proper nesting
   */
  private buildColumnSelections(
    columns: string[],
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};
    const relationshipPathsIncluded = new Set<string>();

    // Check if we have any relationship-based columns
    const hasRelationshipColumns = columns.some((col) => col.includes('.'));

    // Always include primary table's primary key for grouping
    const primaryTablePrimaryKey = this.primaryKeyMap[primaryTable];
    if (primaryTablePrimaryKey) {
      selections[primaryTablePrimaryKey.columnName] = primaryTablePrimaryKey.column;
    }

    // If we're filtering across relationships, include essential primary table fields
    if (hasRelationshipColumns) {
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        const primaryTableColumnNames = getColumnNames(primaryTableSchema);

        for (const colName of primaryTableColumnNames) {
          const col = (primaryTableSchema as unknown as TableWithColumns)[colName];
          if (col && !selections[colName]) {
            selections[colName] = col;
          }
        }
      }
    }

    for (const columnId of columns) {
      const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
      const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

      // For nested columns, select ALL columns from the related table
      if (columnPath.isNested && columnPath.relationshipPath) {
        // Create a unique key for this relationship path
        const relationshipPathKey = columnPath.relationshipPath
          .map((r) => `${r.from}.${r.to}`)
          .join('->');

        if (!relationshipPathsIncluded.has(relationshipPathKey)) {
          const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
          const realTableName = relationship?.to || columnPath.table;

          // Select all columns from this related table with aliased names
          const relatedTable = this.schema[realTableName];
          if (relatedTable) {
            // Use Drizzle schema utilities for column extraction
            const columnNames = getColumnNames(relatedTable);

            for (const colName of columnNames) {
              const col = (relatedTable as unknown as TableWithColumns)[colName];
              if (col) {
                const aliasedKey = `${realTableName}_${colName}`;
                selections[aliasedKey] = col;
              }
            }
          }
          relationshipPathsIncluded.add(relationshipPathKey);
        }
      } else {
        // Direct column from main table
        if (columnReference) {
          selections[columnId] = columnReference.column;
        }
      }
    }

    return selections;
  }

  /**
   * Get aggregate function with proper type safety
   */
  private getAggregateFunction(
    column: AnyColumnType,
    functionName: AggregateFunction
  ): SQL | SQLWrapper {
    switch (functionName) {
      case 'count':
        return count();
      case 'sum':
        return sum(column);
      case 'avg':
        return avg(column);
      case 'min':
        return min(column);
      case 'max':
        return max(column);
      case 'distinct':
        return count(column);
      default:
        return count();
    }
  }

  /**
   * Get column from schema with proper type safety
   */
  private getColumn(columnPath: ColumnPath): AnyColumnType | null {
    // If nested, use the real table name from relationshipPath
    const realTableName =
      columnPath.isNested && columnPath.relationshipPath
        ? columnPath.relationshipPath[columnPath.relationshipPath.length - 1]?.to ||
          columnPath.table
        : columnPath.table;

    const table = this.schema[realTableName];
    if (!table) {
      return null;
    }

    return (table as unknown as Record<string, AnyColumnType>)[columnPath.field] || null;
  }

  /**
   * Build query with all parameters
   */
  buildCompleteQuery(params: {
    columns?: string[];
    filters?: FilterState[];
    sorting?: SortingParams[];
    pagination?: PaginationParams;
    primaryTable: string;
  }): {
    dataQuery: QueryBuilderWithJoins;
    countQuery: QueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
  } {
    // Build query context
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: params.columns || [],
        filters: params.filters?.map((filter) => ({ columnId: filter.columnId })) || [],
        sorts: params.sorting?.map((sort) => ({ columnId: sort.columnId })) || [],
      },
      params.primaryTable
    );

    // Build data query
    const { query: dataQuery, columnMetadata } = this.buildSelectQuery(
      context,
      params.primaryTable,
      params.columns
    );
    let finalDataQuery = this.applyFilters(dataQuery, params.filters || [], params.primaryTable);
    finalDataQuery = this.applySorting(finalDataQuery, params.sorting || [], params.primaryTable);
    if (params.pagination) {
      finalDataQuery = this.applyPagination(finalDataQuery, params.pagination);
    }

    // Build count query
    let countQuery = this.buildCountQuery(context, params.primaryTable);
    countQuery = this.applyFilters(countQuery, params.filters || [], params.primaryTable);

    return { dataQuery: finalDataQuery, countQuery, columnMetadata };
  }

  /**
   * Build filter options query
   */
  buildFilterOptionsQuery(columnId: string, primaryTable: string): QueryBuilderWithJoins {
    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const column = this.getColumn(columnPath);

    if (!column) {
      throw new QueryError(`Column not found: ${columnId}`, { columnId });
    }

    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    let query = this.db
      .select({
        value: column,
        count: count(),
      })
      .from(primaryTableSchema);

    // Add joins if needed
    if (columnPath.isNested && columnPath.relationshipPath) {
      const joinOrder = this.relationshipManager.optimizeJoinOrder(
        new Map([[columnPath.table, columnPath.relationshipPath || []]]),
        primaryTable
      );

      for (const relationship of joinOrder) {
        const targetTable = this.schema[relationship.to];
        if (!targetTable) {
          throw new QueryError(`Target table not found: ${relationship.to}`, {
            targetTable: relationship.to,
          });
        }

        const joinCondition = this.buildJoinCondition(relationship);

        if (relationship.joinType === 'left') {
          query = query.leftJoin(targetTable, joinCondition);
        } else {
          query = query.innerJoin(targetTable, joinCondition);
        }
      }
    }

    return query.where(isNotNull(column)).groupBy(column).orderBy(column);
  }

  /**
   * Build min/max values query with proper type safety
   */
  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): QueryBuilderWithJoins {
    // Validate inputs
    this.validateColumnId(columnId, primaryTable);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

    // Validate column compatibility with min/max functions
    this.validateMinMaxColumnCompatibility(columnReference.column);

    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    let query = this.db
      .select({
        min: min(columnReference.column),
        max: max(columnReference.column),
      })
      .from(primaryTableSchema);

    // Add required joins for the column
    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    for (const joinConfig of requiredJoins) {
      if (joinConfig.type === 'left') {
        query = query.leftJoin(joinConfig.table, joinConfig.condition);
      } else {
        query = query.innerJoin(joinConfig.table, joinConfig.condition);
      }
    }

    return query.where(isNotNull(columnReference.column));
  }

  /**
   * Get query execution plan
   */
  getQueryPlan(query: QueryBuilderWithJoins): string {
    // This would be database-specific and might not be available in all drivers
    try {
      const queryObj = query as unknown as Record<string, unknown>;
      const explainResult = queryObj.explain;
      if (typeof explainResult === 'function') {
        const result = explainResult();
        return typeof result === 'string' ? result : 'Query plan not available';
      }
      return 'Query plan not available';
    } catch {
      return 'Query plan not available';
    }
  }

  /**
   * Validate query before execution
   */
  validateQuery(query: QueryBuilderWithJoins): boolean {
    try {
      // Basic validation - check if query exists and has execute method
      if (!query || query === null || query === undefined) {
        return false;
      }
      return typeof (query as unknown as Record<string, unknown>).execute === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Validate column ID format and accessibility
   * @param columnId - The column ID to validate
   * @param primaryTable - The primary table for this query context
   */
  private validateColumnId(columnId: string, primaryTable: string): void {
    if (!columnId || typeof columnId !== 'string') {
      throw new QueryError('Column ID must be a non-empty string', {
        columnId,
        type: typeof columnId,
      });
    }

    if (columnId.trim() !== columnId) {
      throw new QueryError('Column ID cannot have leading or trailing whitespace', {
        columnId,
        suggestion: columnId.trim(),
      });
    }

    if (!this.relationshipManager.validateColumnAccess(columnId, primaryTable)) {
      const accessibleColumns = this.relationshipManager.getAccessibleColumns(primaryTable);
      throw new QueryError(`Column '${columnId}' is not accessible`, {
        columnId,
        accessibleColumns: accessibleColumns.slice(0, 10), // Show first 10 for brevity
        totalAccessibleColumns: accessibleColumns.length,
        suggestion: this.findSimilarColumn(columnId, accessibleColumns),
      });
    }
  }

  /**
   * Validate aggregate function
   */
  private validateAggregateFunction(functionName: AggregateFunction): void {
    const validFunctions: AggregateFunction[] = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];

    if (!validFunctions.includes(functionName)) {
      throw new QueryError(`Invalid aggregate function: '${functionName}'`, {
        functionName,
        validFunctions,
        suggestion: this.findSimilarFunction(functionName, validFunctions),
      });
    }
  }

  /**
   * Validate column compatibility with aggregate functions
   */
  private validateAggregateColumnCompatibility(
    column: AnyColumnType,
    functionName: AggregateFunction
  ): void {
    // For count and distinct, any column type is valid
    if (functionName === 'count' || functionName === 'distinct') {
      return;
    }

    // For sum, avg, min, max, we need numeric or date columns
    // This is a basic check - in a real implementation, you'd inspect the column's data type
    try {
      // Try to use the column with the aggregate function
      // If it fails, we'll catch it and provide a meaningful error
      this.getAggregateFunction(column, functionName);
    } catch {
      throw new QueryError(`Column is not compatible with aggregate function '${functionName}'`, {
        functionName,
        columnType: 'unknown', // In a real implementation, you'd get the actual column type
        compatibleFunctions: ['count', 'distinct'],
        suggestion: 'Use count() or distinct() for this column type',
      });
    }
  }

  /**
   * Validate column compatibility with min/max functions
   */
  private validateMinMaxColumnCompatibility(column: AnyColumnType): void {
    // Min/max work with numeric, date, and string columns
    // This is a basic validation - in a real implementation, you'd check the actual column type
    try {
      min(column);
      max(column);
    } catch {
      throw new QueryError('Column is not compatible with min/max functions', {
        columnType: 'unknown', // In a real implementation, you'd get the actual column type
        suggestion: 'Min/max functions require numeric, date, or string columns',
      });
    }
  }

  /**
   * Find similar column name for better error messages
   */
  private findSimilarColumn(targetColumn: string, availableColumns: string[]): string | null {
    const target = targetColumn.toLowerCase();

    // Exact match (case insensitive)
    const exactMatch = availableColumns.find((col) => col.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    // Partial match
    const partialMatch = availableColumns.find(
      (col) => col.toLowerCase().includes(target) || target.includes(col.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Levenshtein distance match (simple implementation)
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const col of availableColumns) {
      const distance = calculateLevenshteinDistance(target, col.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        // Max 2 character difference
        bestDistance = distance;
        bestMatch = col;
      }
    }

    return bestMatch;
  }

  /**
   * Find similar function name for better error messages
   */
  private findSimilarFunction(
    targetFunction: string,
    validFunctions: AggregateFunction[]
  ): AggregateFunction | null {
    const target = targetFunction.toLowerCase();

    // Exact match (case insensitive)
    const exactMatch = validFunctions.find((func) => func.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    // Partial match
    const partialMatch = validFunctions.find(
      (func) => func.toLowerCase().includes(target) || target.includes(func.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    return null;
  }
}
