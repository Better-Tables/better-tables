/**
 * @fileoverview Base query builder with shared logic
 * @module @better-tables/drizzle-adapter/query-builders/base
 *
 * @description
 * Abstract base class for database-specific query builders. Contains shared
 * validation and utility methods used by all driver implementations.
 *
 * @since 1.0.0
 */

import type { FilterState, PaginationParams, SortingParams } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { and, asc, avg, count, countDistinct, desc, eq, max, min, sum } from 'drizzle-orm';
import { FilterHandler } from '../filter-handler';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  ColumnPath,
  DatabaseDriver,
  MySQLQueryBuilderWithJoins,
  PostgresQueryBuilderWithJoins,
  QueryBuilderWithJoins,
  QueryContext,
  RelationshipPath,
  SQLiteQueryBuilderWithJoins,
} from '../types';
import { QueryError } from '../types';
import { generateAlias, generatePathKey } from '../utils/alias-generator';
import { getColumnNames } from '../utils/drizzle-schema-utils';
import { calculateLevenshteinDistance } from '../utils/levenshtein';
import { getPrimaryKeyMap } from '../utils/schema-introspection';

/**
 * Abstract base class for query builders.
 * Contains shared logic for all database drivers.
 *
 * @abstract
 * @class BaseQueryBuilder
 * @since 1.0.0
 */
export abstract class BaseQueryBuilder {
  protected schema: Record<string, AnyTableType>;
  protected relationshipManager: RelationshipManager;
  protected filterHandler: FilterHandler;
  protected primaryKeyMap: Record<string, { columnName: string; column: AnyColumnType }>;

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.filterHandler = new FilterHandler(schema, relationshipManager, databaseType);
    // Primary keys are auto-detected from the schema
    this.primaryKeyMap = getPrimaryKeyMap(schema);
  }

  /**
   * Type-safe helper to cast Drizzle's complex query builder types to our QueryBuilderWithJoins interface.
   * This is safe because Drizzle's query builders implement all methods in our interface,
   * but TypeScript cannot statically verify this due to Drizzle's complex generic types.
   */
  protected asQueryBuilder<T>(query: T): QueryBuilderWithJoins {
    return query as QueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's PostgreSQL query builder types to our PostgresQueryBuilderWithJoins interface.
   */
  protected asPostgresQueryBuilder<T>(query: T): PostgresQueryBuilderWithJoins {
    return query as PostgresQueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's MySQL query builder types to our MySQLQueryBuilderWithJoins interface.
   */
  protected asMySQLQueryBuilder<T>(query: T): MySQLQueryBuilderWithJoins {
    return query as MySQLQueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's SQLite query builder types to our SQLiteQueryBuilderWithJoins interface.
   */
  protected asSQLiteQueryBuilder<T>(query: T): SQLiteQueryBuilderWithJoins {
    return query as SQLiteQueryBuilderWithJoins;
  }

  /**
   * Abstract method to build SELECT query - must be implemented by subclasses
   */
  abstract buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[]
  ): {
    query: QueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
  };

  /**
   * Abstract method to build COUNT query - must be implemented by subclasses
   */
  abstract buildCountQuery(context: QueryContext, primaryTable: string): QueryBuilderWithJoins;

  /**
   * Abstract method to build aggregate query - must be implemented by subclasses
   */
  abstract buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction,
    primaryTable: string
  ): QueryBuilderWithJoins;

  /**
   * Abstract method to build filter options query - must be implemented by subclasses
   */
  abstract buildFilterOptionsQuery(columnId: string, primaryTable: string): QueryBuilderWithJoins;

  /**
   * Abstract method to build min/max query - must be implemented by subclasses
   */
  abstract buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): QueryBuilderWithJoins;

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
   * Type helper to access columns from a table.
   * Tables in Drizzle have columns as properties, but the base type doesn't expose an index signature.
   * We use a type assertion through the table's actual structure to safely access columns.
   */
  private getTableColumn(table: AnyTableType, columnName: string): AnyColumnType | undefined {
    // TypeScript doesn't recognize that Drizzle tables have column index signatures,
    // so we assert to access them safely. This is type-safe at runtime.
    type TableWithIndex = typeof table & Record<string, AnyColumnType>;
    return (table as TableWithIndex)[columnName];
  }

  /**
   * Build join condition with proper type safety
   * Handles both regular foreign keys and array foreign keys
   */
  protected buildJoinCondition(relationship: RelationshipPath): SQL | SQLWrapper {
    const sourceTable = this.schema[relationship.from];
    const targetTable = this.schema[relationship.to];

    if (!sourceTable || !targetTable) {
      throw new QueryError(
        `Tables not found for join: ${relationship.from} -> ${relationship.to}`,
        { relationship }
      );
    }

    const sourceColumn = this.getTableColumn(sourceTable, relationship.localKey);
    const targetColumn = this.getTableColumn(targetTable, relationship.foreignKey);

    if (!sourceColumn || !targetColumn) {
      throw new QueryError(
        `Columns not found for join: ${relationship.localKey} -> ${relationship.foreignKey}`,
        { relationship }
      );
    }

    // Handle array foreign keys differently
    // For array FKs: targetTable.id = ANY(sourceTable.arrayColumn)
    // For regular FKs: sourceTable.fk = targetTable.id
    if (relationship.isArray) {
      return this.buildArrayJoinCondition(targetColumn, sourceColumn);
    }

    return eq(sourceColumn, targetColumn);
  }

  /**
   * Build join condition for array foreign keys
   * Uses database-specific syntax to check if target column value is in source array column
   *
   * @param _targetColumn - The target column to check (unused in base implementation, used in subclasses)
   * @param _sourceArrayColumn - The source array column (unused in base implementation, used in subclasses)
   * @returns SQL condition for array foreign key join
   *
   * @remarks
   * Subclasses must override this method with driver-specific implementations:
   * - PostgreSQL: Uses ANY() operator with native arrays
   * - MySQL: Uses JSON_SEARCH() for JSON array columns
   * - SQLite: Uses json_each() for JSON array columns
   */
  protected buildArrayJoinCondition(
    _targetColumn: AnyColumnType,
    _sourceArrayColumn: AnyColumnType
  ): SQL | SQLWrapper {
    // Base implementation throws - subclasses must override with driver-specific syntax
    throw new QueryError('Array foreign key joins are not supported for this database driver', {
      suggestion: 'This method must be overridden by database-specific query builder subclasses',
    });
  }

  /**
   * Build flat selections for relationship filtering
   */
  protected buildFlatSelectionsForRelationships(
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};

    const primaryTableSchema = this.schema[primaryTable];
    if (primaryTableSchema) {
      const primaryTableColumnNames = getColumnNames(primaryTableSchema);

      for (const colName of primaryTableColumnNames) {
        const col = this.getTableColumn(primaryTableSchema, colName);
        if (col) {
          selections[colName] = col;
        }
      }
    }

    return selections;
  }

  /**
   * Build column selections with proper type safety
   */
  protected buildColumnSelections(
    columns: string[],
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};
    const relationshipPathsIncluded = new Set<string>();

    const hasRelationshipColumns = columns.some((col) => col.includes('.'));

    const primaryTablePrimaryKey = this.primaryKeyMap[primaryTable];
    if (primaryTablePrimaryKey) {
      selections[primaryTablePrimaryKey.columnName] = primaryTablePrimaryKey.column;
    }

    if (hasRelationshipColumns) {
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        const primaryTableColumnNames = getColumnNames(primaryTableSchema);

        for (const colName of primaryTableColumnNames) {
          const col = this.getTableColumn(primaryTableSchema, colName);
          if (col && !selections[colName]) {
            selections[colName] = col;
          }
        }
      }
    }

    for (const columnId of columns) {
      const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
      const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

      if (columnPath.isNested && columnPath.relationshipPath) {
        const relationshipPathKey = generatePathKey(columnPath.relationshipPath);

        if (!relationshipPathsIncluded.has(relationshipPathKey)) {
          const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
          const realTableName = relationship?.to || columnPath.table;

          const relatedTable = this.schema[realTableName];
          if (relatedTable) {
            const columnNames = getColumnNames(relatedTable);

            for (const colName of columnNames) {
              const col = this.getTableColumn(relatedTable, colName);
              if (col) {
                const aliasedKey = generateAlias(columnPath.relationshipPath, colName);
                selections[aliasedKey] = col;
              }
            }
          }
          relationshipPathsIncluded.add(relationshipPathKey);
        }
      } else {
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
  protected getAggregateFunction(
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
        return countDistinct(column);
      default:
        return count();
    }
  }

  /**
   * Get column from schema
   */
  protected getColumn(columnPath: ColumnPath): AnyColumnType | null {
    const realTableName =
      columnPath.isNested && columnPath.relationshipPath
        ? columnPath.relationshipPath[columnPath.relationshipPath.length - 1]?.to ||
          columnPath.table
        : columnPath.table;

    const table = this.schema[realTableName];
    if (!table) {
      return null;
    }

    return this.getTableColumn(table, columnPath.field) || null;
  }

  /**
   * Build complete query with all parameters
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
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: params.columns || [],
        filters: params.filters?.map((filter) => ({ columnId: filter.columnId })) || [],
        sorts: params.sorting?.map((sort) => ({ columnId: sort.columnId })) || [],
      },
      params.primaryTable
    );

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

    let countQuery = this.buildCountQuery(context, params.primaryTable);
    countQuery = this.applyFilters(countQuery, params.filters || [], params.primaryTable);

    return { dataQuery: finalDataQuery, countQuery, columnMetadata };
  }

  /**
   * Type guard to check if an object has a specific property.
   */
  protected hasProperty<K extends PropertyKey>(obj: object, prop: K): obj is Record<K, unknown> {
    return prop in obj;
  }

  /**
   * Get query execution plan
   */
  getQueryPlan(query: QueryBuilderWithJoins): string {
    try {
      if (this.hasProperty(query, 'explain')) {
        const explainResult = query.explain;
        if (typeof explainResult === 'function') {
          // Bind the explain method to the query instance to preserve 'this' context
          const boundExplain = explainResult.bind(query);
          const result = boundExplain();
          return typeof result === 'string' ? result : 'Query plan not available';
        }
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
      if (!query || query === null || query === undefined) {
        return false;
      }
      return this.hasProperty(query, 'execute') && typeof query.execute === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Validation methods
   */
  protected validateColumnId(columnId: string, primaryTable: string): void {
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
        accessibleColumns: accessibleColumns.slice(0, 10),
        totalAccessibleColumns: accessibleColumns.length,
        suggestion: this.findSimilarColumn(columnId, accessibleColumns),
      });
    }
  }

  protected validateAggregateFunction(functionName: AggregateFunction): void {
    const validFunctions: AggregateFunction[] = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];

    if (!validFunctions.includes(functionName)) {
      throw new QueryError(`Invalid aggregate function: '${functionName}'`, {
        functionName,
        validFunctions,
        suggestion: this.findSimilarFunction(functionName, validFunctions),
      });
    }
  }

  protected validateAggregateColumnCompatibility(
    column: AnyColumnType,
    functionName: AggregateFunction
  ): void {
    if (functionName === 'count' || functionName === 'distinct') {
      return;
    }

    try {
      this.getAggregateFunction(column, functionName);
    } catch {
      throw new QueryError(`Column is not compatible with aggregate function '${functionName}'`, {
        functionName,
        columnType: 'unknown',
        compatibleFunctions: ['count', 'distinct'],
        suggestion: 'Use count() or distinct() for this column type',
      });
    }
  }

  protected validateMinMaxColumnCompatibility(column: AnyColumnType): void {
    try {
      min(column);
      max(column);
    } catch {
      throw new QueryError('Column is not compatible with min/max functions', {
        columnType: 'unknown',
        suggestion: 'Min/max functions require numeric, date, or string columns',
      });
    }
  }

  protected findSimilarColumn(targetColumn: string, availableColumns: string[]): string | null {
    const target = targetColumn.toLowerCase();

    const exactMatch = availableColumns.find((col) => col.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    const partialMatch = availableColumns.find(
      (col) => col.toLowerCase().includes(target) || target.includes(col.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const col of availableColumns) {
      const distance = calculateLevenshteinDistance(target, col.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        bestDistance = distance;
        bestMatch = col;
      }
    }

    return bestMatch;
  }

  protected findSimilarFunction(
    targetFunction: string,
    validFunctions: AggregateFunction[]
  ): AggregateFunction | null {
    const target = targetFunction.toLowerCase();

    const exactMatch = validFunctions.find((func) => func.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    const partialMatch = validFunctions.find(
      (func) => func.toLowerCase().includes(target) || target.includes(func.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    return null;
  }
}
