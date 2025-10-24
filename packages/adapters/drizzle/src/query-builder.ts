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
import { calculateLevenshteinDistance } from './utils/levenshtein';
import { getPrimaryKeyInfo, getPrimaryKeyMap } from './utils/schema-introspection';

/**
 * Query builder that generates efficient SQL queries with smart joins
 */
export class DrizzleQueryBuilder {
  private db: DrizzleDatabase;
  private schema: Record<string, AnyTableType>;
  private relationshipManager: RelationshipManager;
  private filterHandler: FilterHandler;
  private mainTable: string;
  private primaryKeyMap: Record<string, { columnName: string; column: AnyColumnType }>;

  constructor(
    db: DrizzleDatabase,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    mainTable: string,
    databaseType: DatabaseDriver = 'postgres',
    primaryKeyMap?: Record<string, string>
  ) {
    // Validate main table exists in schema
    if (!schema[mainTable]) {
      throw new QueryError(`Main table '${mainTable}' not found in schema`, {
        mainTable,
        availableTables: Object.keys(schema),
      });
    }

    this.db = db;
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.filterHandler = new FilterHandler(schema, relationshipManager, databaseType);
    this.mainTable = mainTable;

    // Initialize primary key map
    this.primaryKeyMap = getPrimaryKeyMap(schema, primaryKeyMap);
  }

  /**
   * Build SELECT query with joins
   */
  buildSelectQuery(context: QueryContext, columns?: string[]): QueryBuilderWithJoins {
    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new QueryError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
      });
    }

    // Build column selections first
    // Always create explicit selections when we have joins to ensure flat structure
    let selections: Record<string, AnyColumnType> | undefined;

    if (columns && columns.length > 0) {
      selections = this.buildColumnSelections(columns);
    } else if (context.joinPaths.size > 0) {
      // When filtering across relationships without explicit columns, create flat selections
      selections = this.buildFlatSelectionsForRelationships();
    }

    let query = selections
      ? this.db.select(selections).from(mainTableSchema)
      : this.db.select().from(mainTableSchema);

    // Add joins
    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths);

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
   * Build COUNT query for pagination
   */
  buildCountQuery(context: QueryContext): QueryBuilderWithJoins {
    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new QueryError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
      });
    }

    let query = this.db.select({ count: count() }).from(mainTableSchema);

    // Add joins
    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths);

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
    aggregateFunction: AggregateFunction = 'count'
  ): QueryBuilderWithJoins {
    // Validate inputs
    this.validateColumnId(columnId);
    this.validateAggregateFunction(aggregateFunction);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId);
    const columnReference = this.relationshipManager.getColumnReference(columnPath);

    // Validate column compatibility with aggregate function
    this.validateAggregateColumnCompatibility(columnReference.column, aggregateFunction);

    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new QueryError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
      });
    }

    let query = this.db
      .select({
        value: columnReference.column,
        count: this.getAggregateFunction(columnReference.column, aggregateFunction),
      })
      .from(mainTableSchema);

    // Add required joins for the column
    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(columnPath);

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
  applyFilters(query: QueryBuilderWithJoins, filters: FilterState[]): QueryBuilderWithJoins {
    if (!filters || filters.length === 0) {
      return query;
    }

    const { conditions } = this.filterHandler.handleCrossTableFilters(filters);

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
  applySorting(query: QueryBuilderWithJoins, sorting: SortingParams[]): QueryBuilderWithJoins {
    if (!sorting || sorting.length === 0) {
      return query;
    }

    const orderByClauses = sorting.map((sort) => {
      const columnPath = this.relationshipManager.resolveColumnPath(sort.columnId);
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
  private buildFlatSelectionsForRelationships(): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};

    // Always include all main table columns - this is generic and works with any schema
    const mainTableSchema = this.schema[this.mainTable];
    if (mainTableSchema && typeof mainTableSchema === 'object') {
      const mainTableObj = mainTableSchema as unknown as Record<string, AnyColumnType>;

      // Get all column names from the main table schema
      const mainTableColumnNames = Object.keys(mainTableObj).filter(
        (key) =>
          !key.startsWith('_') &&
          typeof mainTableObj[key] === 'object' &&
          mainTableObj[key] !== null
      );

      // Add all main table columns to selections
      for (const colName of mainTableColumnNames) {
        const col = mainTableObj[colName];
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
  private buildColumnSelections(columns: string[]): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};
    const tablesIncluded = new Set<string>([this.mainTable]);

    // Check if we have any relationship-based columns
    const hasRelationshipColumns = columns.some((col) => col.includes('.'));

    // Always include main table's primary key for grouping
    const mainTablePrimaryKey = this.primaryKeyMap[this.mainTable];
    if (mainTablePrimaryKey) {
      selections[mainTablePrimaryKey.columnName] = mainTablePrimaryKey.column;
    }

    // If we're filtering across relationships, include essential main table fields
    if (hasRelationshipColumns) {
      const mainTableSchema = this.schema[this.mainTable];
      if (mainTableSchema && typeof mainTableSchema === 'object') {
        const mainTableObj = mainTableSchema as unknown as Record<string, AnyColumnType>;
        const mainTableColumnNames = Object.keys(mainTableObj).filter(
          (key) =>
            !key.startsWith('_') &&
            typeof mainTableObj[key] === 'object' &&
            mainTableObj[key] !== null
        );

        for (const colName of mainTableColumnNames) {
          const col = mainTableObj[colName];
          if (col && !selections[colName]) {
            selections[colName] = col;
          }
        }
      }
    }

    for (const columnId of columns) {
      const columnPath = this.relationshipManager.resolveColumnPath(columnId);
      const columnReference = this.relationshipManager.getColumnReference(columnPath);

      // For nested columns, select ALL columns from the related table
      if (columnPath.isNested && columnPath.relationshipPath) {
        const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
        const realTableName = relationship?.to || columnPath.table;

        if (!tablesIncluded.has(realTableName)) {
          // Select all columns from this related table with aliased names
          const relatedTable = this.schema[realTableName];
          if (relatedTable && typeof relatedTable === 'object') {
            // Get column names using direct property access (not _.columns)
            const tableObj = relatedTable as unknown as Record<string, AnyColumnType>;
            const columnNames = Object.keys(tableObj).filter(
              (key) =>
                !key.startsWith('_') && typeof tableObj[key] === 'object' && tableObj[key] !== null
            );

            for (const colName of columnNames) {
              const col = tableObj[colName];
              if (col) {
                const aliasedKey = `${realTableName}_${colName}`;
                selections[aliasedKey] = col;
              }
            }
            tablesIncluded.add(realTableName);
          }
        }
      } else {
        // Direct column from main table
        selections[columnId] = columnReference.column;
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
  }): { dataQuery: QueryBuilderWithJoins; countQuery: QueryBuilderWithJoins } {
    // Build query context
    const context = this.relationshipManager.buildQueryContext({
      columns: params.columns || [],
      filters: params.filters?.map((filter) => ({ columnId: filter.columnId })) || [],
      sorts: params.sorting?.map((sort) => ({ columnId: sort.columnId })) || [],
    });

    // Build data query
    let dataQuery = this.buildSelectQuery(context, params.columns);
    dataQuery = this.applyFilters(dataQuery, params.filters || []);
    dataQuery = this.applySorting(dataQuery, params.sorting || []);
    if (params.pagination) {
      dataQuery = this.applyPagination(dataQuery, params.pagination);
    }

    // Build count query
    let countQuery = this.buildCountQuery(context);
    countQuery = this.applyFilters(countQuery, params.filters || []);

    return { dataQuery, countQuery };
  }

  /**
   * Build filter options query
   */
  buildFilterOptionsQuery(columnId: string): QueryBuilderWithJoins {
    const columnPath = this.relationshipManager.resolveColumnPath(columnId);
    const column = this.getColumn(columnPath);

    if (!column) {
      throw new QueryError(`Column not found: ${columnId}`, { columnId });
    }

    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new QueryError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
      });
    }

    let query = this.db
      .select({
        value: column,
        count: count(),
      })
      .from(mainTableSchema);

    // Add joins if needed
    if (columnPath.isNested && columnPath.relationshipPath) {
      const joinOrder = this.relationshipManager.optimizeJoinOrder(
        new Map([[columnPath.table, columnPath.relationshipPath || []]])
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
  buildMinMaxQuery<TColumnId extends string>(columnId: TColumnId): QueryBuilderWithJoins {
    // Validate inputs
    this.validateColumnId(columnId);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId);
    const columnReference = this.relationshipManager.getColumnReference(columnPath);

    // Validate column compatibility with min/max functions
    this.validateMinMaxColumnCompatibility(columnReference.column);

    const mainTableSchema = this.schema[this.mainTable];
    if (!mainTableSchema) {
      throw new QueryError(`Main table not found: ${this.mainTable}`, {
        mainTable: this.mainTable,
      });
    }

    let query = this.db
      .select({
        min: min(columnReference.column),
        max: max(columnReference.column),
      })
      .from(mainTableSchema);

    // Add required joins for the column
    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(columnPath);

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
   */
  private validateColumnId(columnId: string): void {
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

    if (!this.relationshipManager.validateColumnAccess(columnId)) {
      const accessibleColumns = this.relationshipManager.getAccessibleColumns();
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
