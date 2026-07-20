/**
 * @fileoverview PostgreSQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/postgres
 *
 * @description
 * PostgreSQL query builder implementation with driver-specific optimizations.
 * The select/count/aggregate/filter-options/min-max skeletons live in
 * `BaseQueryBuilder` (plan 007 step 5); this class supplies the
 * PostgreSQL-specific pieces: relational-query support (nested results via
 * Drizzle's query API), native array-FK join syntax, `->>'field'` JSONB
 * column selections, and the identifier quote character.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @since 1.0.0 (expanded to support all PostgreSQL drivers in 1.1.0)
 */

import { and, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AnyColumnType,
  AnyTableType,
  ComputedFieldWithResolvedSortSql,
  FilterHandlerHooks,
  PostgresDatabaseType,
  PostgresQueryBuilderWithJoins,
  QueryContext,
} from '../types';
import { QueryError } from '../types';
import { BaseQueryBuilder, type DialectDb } from './base-query-builder';

/**
 * Wrapper class for Drizzle relational queries to implement QueryBuilderWithJoins interface
 * This allows relational queries to be used seamlessly with the existing query builder pattern
 */
class RelationalQueryWrapper implements PostgresQueryBuilderWithJoins {
  private queryFn: (options?: {
    where?: unknown;
    orderBy?: unknown;
    limit?: number;
    offset?: number;
  }) => Promise<unknown[]>;
  private whereConditions: (SQL | SQLWrapper)[] = [];
  private orderByClauses: (AnyColumnType | SQL | SQLWrapper)[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private groupByColumns: (AnyColumnType | SQL | SQLWrapper)[] = [];

  constructor(
    queryFn: (options?: {
      where?: unknown;
      orderBy?: unknown;
      limit?: number;
      offset?: number;
    }) => Promise<unknown[]>
  ) {
    this.queryFn = queryFn;
  }

  leftJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    // Relational queries don't support manual joins - they use 'with' instead
    // Return self to allow chaining, but joins are ignored
    return this;
  }

  innerJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    // Relational queries don't support manual joins - they use 'with' instead
    // Return self to allow chaining, but joins are ignored
    return this;
  }

  select(
    _selections?: Record<string, AnyColumnType | SQL | SQLWrapper>
  ): PostgresQueryBuilderWithJoins {
    // Selections are already handled in the relational query setup
    // Return self to allow chaining
    return this;
  }

  where(condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins {
    this.orderByClauses.push(...clauses);
    return this;
  }

  limit(count: number): PostgresQueryBuilderWithJoins {
    this.limitValue = count;
    return this;
  }

  offset(count: number): PostgresQueryBuilderWithJoins {
    this.offsetValue = count;
    return this;
  }

  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins {
    this.groupByColumns.push(...columns);
    return this;
  }

  async execute(): Promise<Record<string, unknown>[]> {
    // Build options object from accumulated query modifiers
    const options: {
      where?: unknown;
      orderBy?: unknown;
      limit?: number;
      offset?: number;
    } = {};

    // Combine where conditions if any
    if (this.whereConditions.length > 0) {
      // For relational queries, we need to pass the where condition
      // Drizzle's relational API expects a where object, not SQL
      // Combine multiple conditions using and() to ensure all predicates are applied
      if (this.whereConditions.length === 1) {
        options.where = this.whereConditions[0];
      } else {
        // Combine multiple conditions using and()
        options.where = and(...this.whereConditions);
      }
    }

    // Combine orderBy clauses if any
    if (this.orderByClauses.length > 0) {
      options.orderBy =
        this.orderByClauses.length === 1 ? this.orderByClauses[0] : this.orderByClauses;
    }

    if (this.limitValue !== undefined) {
      options.limit = this.limitValue;
    }

    if (this.offsetValue !== undefined) {
      options.offset = this.offsetValue;
    }

    // Execute the relational query
    const results = await this.queryFn(options);

    // Convert results to Record<string, unknown>[] format
    // Results from Drizzle relational queries are already nested objects
    return results as Record<string, unknown>[];
  }
}

/**
 * PostgreSQL query builder implementation.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @class PostgresQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0 (expanded to support all PostgreSQL drivers in 1.1.0)
 */
export class PostgresQueryBuilder extends BaseQueryBuilder {
  private db: PostgresDatabaseType;

  protected readonly quoteChar = '"' as const;

  constructor(
    db: PostgresDatabaseType,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    hooks?: FilterHandlerHooks
  ) {
    super(schema, relationshipManager, 'postgres', hooks);
    this.db = db;
  }

  /**
   * Dialect hook: view the PostgreSQL db handle through the structural
   * DialectDb interface the shared skeletons use. The cast is safe because
   * Drizzle's PostgreSQL select builders implement every method the
   * interface declares — the previous per-call-site `asPgTable`/`asPgColumn`
   * casts were compile-time-only and this single cast replaces them all.
   */
  protected getDb(): DialectDb {
    return this.db as unknown as DialectDb;
  }

  /**
   * Type-safe helper to cast AnyColumnType to PgColumn.
   * At runtime, this query builder only receives PostgreSQL columns via the factory pattern.
   */
  private asPgColumn(column: AnyColumnType): PgColumn {
    return column as PgColumn;
  }

  /**
   * Build join condition for array foreign keys in PostgreSQL
   * Uses PostgreSQL's ANY() operator: targetColumn = ANY(sourceArrayColumn)
   */
  protected buildArrayJoinCondition(
    targetColumn: AnyColumnType,
    sourceArrayColumn: AnyColumnType
  ): SQL {
    const pgTargetColumn = this.asPgColumn(targetColumn);
    const pgSourceArrayColumn = this.asPgColumn(sourceArrayColumn);

    // PostgreSQL syntax: targetColumn = ANY(sourceArrayColumn)
    return sql`${pgTargetColumn} = ANY(${pgSourceArrayColumn})`;
  }

  /**
   * Build relational query using Drizzle's relational query API
   * This returns nested objects instead of flattened fields
   */
  private buildRelationalQuery(
    primaryTable: string,
    columns?: string[],
    context?: QueryContext
  ): {
    query: PostgresQueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
    isNested: boolean; // Flag to indicate data is already nested
  } | null {
    // Check if db.query is available (requires schema with relations passed to drizzle())
    const dbWithQuery = this.db as unknown as { query?: Record<string, unknown> };
    if (!dbWithQuery.query || !dbWithQuery.query[primaryTable]) {
      return null; // Relational query API not available, fall back to manual joins
    }

    const tableQuery = dbWithQuery.query[primaryTable] as {
      findMany?: (options?: {
        with?: Record<string, unknown>;
        where?: unknown;
        orderBy?: unknown;
        limit?: number;
        offset?: number;
        columns?: Record<string, boolean>;
      }) => Promise<unknown[]>;
    };

    if (!tableQuery?.findMany) {
      return null;
    }

    // Build with object from requested columns
    const withObject: Record<string, unknown> = {};
    const selections: Record<string, AnyColumnType> = {};
    const columnMapping: Record<string, string> = {};

    // Group columns by relationship
    const relationshipColumns = new Map<string, Set<string>>();
    const primaryTableColumns = new Set<string>();
    let hasArrayRelationship = false;

    if (columns && columns.length > 0) {
      for (const columnId of columns) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          // Check if this is an array relationship
          if (this.relationshipManager.isArrayRelationship(columnPath.relationshipPath)) {
            // Array relationships can't use Drizzle relational API - need manual joins
            hasArrayRelationship = true;
            continue;
          }

          // Extract relationship alias (first part of columnId)
          const alias = columnId.split('.')[0];
          if (alias) {
            if (!relationshipColumns.has(alias)) {
              relationshipColumns.set(alias, new Set());
            }
            relationshipColumns.get(alias)?.add(columnPath.field);
          }
        } else {
          // Primary table column
          primaryTableColumns.add(columnPath.field);
        }
      }

      // If we have array relationships, we can't use relational queries - need manual joins
      if (hasArrayRelationship) {
        return null;
      }

      // Process joinPaths from context to include relationships required by filters
      if (context && context.joinPaths.size > 0) {
        for (const [targetTable, relationshipPath] of context.joinPaths) {
          // Get the relationship alias from the path
          if (relationshipPath.length > 0) {
            // Find the relationship by target table
            const relationship = this.relationshipManager.getRelationshipByAlias(
              primaryTable,
              targetTable
            );

            // If relationship exists and not already in relationshipColumns, add it
            if (relationship && !relationshipColumns.has(targetTable)) {
              relationshipColumns.set(targetTable, new Set());
              // Add all fields from the relationship (or at least id)
              relationshipColumns.get(targetTable)?.add('id');
            }
          }
        }
      }

      // Row identity is required for cell edits / selection even when `columns`
      // omits the PK (manual-join path already does this in buildColumnSelections).
      const primaryPk = this.primaryKeyMap[primaryTable];
      if (primaryPk) {
        primaryTableColumns.add(primaryPk.columnName);
      }

      // Build with object for each relationship
      for (const [alias, fields] of relationshipColumns) {
        const relationship = this.relationshipManager.getRelationshipByAlias(primaryTable, alias);
        if (relationship) {
          const relatedPk = this.primaryKeyMap[relationship.to];
          if (relatedPk) {
            fields.add(relatedPk.columnName);
          }
          // Build columns object for this relationship
          const relationshipColumnsObj: Record<string, boolean> = {};
          for (const field of fields) {
            relationshipColumnsObj[field] = true;
          }

          // Add to with object - use alias as the key (should match relation name in schema)
          withObject[alias] = {
            columns: relationshipColumnsObj,
          };
        }
      }

      // Build primary table columns selection
      const primaryColumnsObj: Record<string, boolean> = {};
      for (const field of primaryTableColumns) {
        primaryColumnsObj[field] = true;
      }

      // Create a query function that will be executed later
      const queryFn = async (options?: {
        where?: unknown;
        orderBy?: unknown;
        limit?: number;
        offset?: number;
      }) => {
        const queryOptions: {
          columns: Record<string, boolean>;
          with?: Record<string, unknown>;
          where?: unknown;
          orderBy?: unknown;
          limit?: number;
          offset?: number;
        } = {
          columns: primaryColumnsObj,
          ...options,
        };

        if (Object.keys(withObject).length > 0) {
          queryOptions.with = withObject;
        }

        return tableQuery.findMany?.(queryOptions) || [];
      };

      // Build column metadata
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        for (const field of primaryTableColumns) {
          const col = (primaryTableSchema as unknown as Record<string, AnyColumnType>)[field];
          if (col) {
            selections[field] = col;
            columnMapping[field] = field;
          }
        }
      }

      for (const [alias, fields] of relationshipColumns) {
        const relationship = this.relationshipManager.getRelationshipByAlias(primaryTable, alias);
        if (relationship) {
          const relatedTableSchema = this.schema[relationship.to];
          if (relatedTableSchema) {
            for (const field of fields) {
              const col = (relatedTableSchema as unknown as Record<string, AnyColumnType>)[field];
              if (col) {
                const columnId = `${alias}.${field}`;
                selections[columnId] = col;
                columnMapping[columnId] = columnId;
              }
            }
          }
        }
      }

      // Create wrapper that implements PostgresQueryBuilderWithJoins
      const wrapper = new RelationalQueryWrapper(queryFn);

      return {
        query: wrapper,
        columnMetadata: {
          selections,
          columnMapping,
        },
        isNested: true, // Relational queries return nested data
      };
    }

    return null;
  }

  /**
   * Build SELECT query with joins
   * Attempts to use Drizzle relational queries first, falls back to the
   * shared manual-join skeleton in BaseQueryBuilder
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[],
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): ReturnType<BaseQueryBuilder['buildSelectQuery']> {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    // Skip relational queries if we have computed fields with sortSql
    // Relational queries don't support raw SQL expressions in SELECT
    // We need to use manual joins to add computed field SQL expressions
    const hasComputedFieldsForSorting = computedFields && Object.keys(computedFields).length > 0;

    // Try to use Drizzle relational queries first (for non-array relationships)
    // But skip if we have computed fields that need SQL expressions
    const relationalQuery = hasComputedFieldsForSorting
      ? null
      : this.buildRelationalQuery(primaryTable, columns, context);
    if (relationalQuery) {
      return {
        query: relationalQuery.query,
        columnMetadata: relationalQuery.columnMetadata,
        isNested: relationalQuery.isNested,
      };
    }

    // Fall back to the shared manual-join skeleton (for array relationships
    // or when the relational API is unavailable)
    return super.buildSelectQuery(context, primaryTable, columns, computedFields);
  }

  /**
   * Override buildColumnSelections to handle JSON accessor columns
   * For PostgreSQL, we need to use the ->> operator to extract nested JSONB fields
   */
  protected buildColumnSelections(
    columns: string[],
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const baseSelections = super.buildColumnSelections(columns, primaryTable);
    const selections: Record<string, AnyColumnType> = { ...baseSelections };

    // Process each column to detect and handle JSON accessors
    for (const columnId of columns) {
      // Check if this is a JSON accessor (contains dot but isNested is false)
      if (columnId.includes('.')) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        // If it's not nested but has a dot, it's a JSON accessor
        if (!columnPath.isNested && columnPath.field) {
          const parts = columnId.split('.');
          if (parts.length === 2) {
            const [baseColumnName, jsonField] = parts;
            const columnReference = this.relationshipManager.getColumnReference(
              columnPath,
              primaryTable
            );

            if (columnReference && baseColumnName && jsonField) {
              const pgColumn = this.asPgColumn(columnReference.column);
              // Use ->> operator to extract the nested JSONB field as text
              // Format: column->>'field'
              const jsonExtract = sql<string>`${pgColumn}->>${jsonField}`;
              selections[columnId] = jsonExtract as unknown as AnyColumnType;
            }
          }
        }
      }
    }

    return selections;
  }
}
