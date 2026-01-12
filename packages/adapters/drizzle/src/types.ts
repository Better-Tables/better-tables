/**
 * @fileoverview Core type definitions for Drizzle ORM adapter
 * @module @better-tables/drizzle-adapter/types
 *
 * @description
 * This module provides all the core type definitions, interfaces, and error classes
 * for the Drizzle adapter. These types enable:
 * - Type-safe query building across different database drivers
 * - Relationship mapping and navigation
 * - Query context tracking
 * - Error handling with detailed context
 * - Configuration and options management
 *
 * All types are designed to work seamlessly across PostgreSQL, MySQL, and SQLite
 * databases while maintaining full TypeScript type safety.
 */

import type { AdapterMeta, ColumnType, FilterState } from '@better-tables/core';
import type { AnyColumn, InferSelectModel, SQL, SQLWrapper } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { BaseQueryBuilder } from './query-builders';
import type { RelationshipManager } from './relationship-manager';

/**
 * Union type for all PostgreSQL-compatible Drizzle database drivers.
 * Supports postgres-js, node-postgres, neon-http, and other PostgreSQL drivers.
 *
 * @description All these drivers produce compatible SQL for PostgreSQL dialect.
 * The adapter uses this union type to accept any PostgreSQL-compatible driver
 * without requiring unsafe type casts.
 *
 * @since 1.1.0
 */
export type PostgresDatabaseType<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = PostgresJsDatabase<TSchema> | NodePgDatabase<TSchema> | NeonHttpDatabase<TSchema>;

/**
 * Union type for all MySQL-compatible Drizzle database drivers.
 * Currently supports mysql2 driver.
 *
 * @description The adapter uses this union type to accept any MySQL-compatible driver.
 *
 * @since 1.1.0
 */
export type MySqlDatabaseType<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  MySql2Database<TSchema>;

/**
 * Union type for all SQLite-compatible Drizzle database drivers.
 * Currently supports better-sqlite3 driver.
 *
 * @description The adapter uses this type to accept SQLite-compatible drivers.
 *
 * Note: LibSQLDatabase (drizzle-orm/libsql) is NOT included in this union because
 * its TypeScript type definitions have incompatible method signatures with
 * BetterSQLite3Database (specifically for select() overloads). However, at runtime
 * LibSQLDatabase is API-compatible, so users can cast their database instance:
 *
 * ```typescript
 * import { drizzle } from 'drizzle-orm/libsql';
 * const libsqlDb = drizzle(client);
 *
 * // Cast to SQLiteDatabaseType for use with the adapter
 * const adapter = new DrizzleAdapter({
 *   db: libsqlDb as unknown as SQLiteDatabaseType,
 *   schema,
 *   driver: 'sqlite',
 * });
 * ```
 *
 * @since 1.1.0
 */
export type SQLiteDatabaseType<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  BetterSQLite3Database<TSchema>;

/**
 * Mapping of database drivers to their corresponding Drizzle database types.
 * This is the single source of truth for supported database drivers.
 *
 * @description This type ensures that every database driver has a corresponding
 * database type. When you add a new driver, add it here and TypeScript will
 * ensure type safety throughout the codebase.
 *
 * Each driver maps to a union type that includes all compatible Drizzle database
 * implementations for that SQL dialect:
 * - postgres: PostgresJsDatabase, NodePgDatabase, NeonHttpDatabase
 * - mysql: MySql2Database
 * - sqlite: BetterSQLite3Database, LibSQLDatabase
 *
 * @since 1.0.0 (expanded in 1.1.0)
 */
type DatabaseTypeMap = {
  postgres: PostgresDatabaseType;
  mysql: MySqlDatabaseType;
  sqlite: SQLiteDatabaseType;
};

/**
 * Database driver types supported by the Drizzle adapter.
 *
 * @description Identifies which database driver is being used
 * Supported drivers are: postgres, mysql, sqlite.
 *
 * @example
 * ```typescript
 * const driver: DatabaseDriver = 'postgres';
 * ```
 *
 * @since 1.0.0
 */
export type DatabaseDriver = keyof DatabaseTypeMap;

/**
 * Generic table type that works across all database drivers.
 *
 * @typedef {object} AnyTableType
 * @description Union type for all supported Drizzle table types
 * @see {@link SQLiteTable} from drizzle-orm/sqlite-core
 * @see {@link PgTable} from drizzle-orm/pg-core
 * @see {@link MySqlTable} from drizzle-orm/mysql-core
 *
 * @since 1.0.0
 */
export type AnyTableType = SQLiteTable | PgTable | MySqlTable;

/**
 * Generic column type that works across all database drivers.
 *
 * @typedef {object} AnyColumnType
 * @description Union type for all supported Drizzle column types
 * @alias AnyColumn from drizzle-orm
 *
 * @since 1.0.0
 */
export type AnyColumnType = AnyColumn;

/**
 * Union type for column references or SQL expressions.
 * Used when a filter condition can operate on either a direct column
 * or a computed SQL expression (e.g., JSONB field extraction).
 *
 * @description
 * This type enables filter handlers to work with both:
 * - Direct column references: `users.email`
 * - SQL expressions: `users.metadata->>'title'` (JSONB extraction)
 *
 * @example
 * ```typescript
 * const column: ColumnOrExpression = users.email; // Direct column
 * const expression: ColumnOrExpression = sql`${users.metadata}->>'title'`; // SQL expression
 * ```
 *
 * @since 1.0.0
 */
export type ColumnOrExpression = AnyColumnType | SQL | SQLWrapper;

/**
 * Primary key information extracted from a Drizzle table schema.
 *
 * @interface PrimaryKeyInfo
 * @description Stores the primary key column information for a table
 *
 * @property {string} columnName - The name of the primary key column (e.g., 'id')
 * @property {AnyColumnType} column - The Drizzle column object for the primary key
 * @property {boolean} isComposite - Whether this is a composite primary key (multiple columns)
 *
 * @example
 * ```typescript
 * const pkInfo: PrimaryKeyInfo = {
 *   columnName: 'id',
 *   column: users.id,
 *   isComposite: false
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface PrimaryKeyInfo {
  /** The primary key column name */
  columnName: string;

  /** The primary key column object */
  column: AnyColumnType;

  /** Whether this is a composite primary key */
  isComposite: boolean;
}

/**
 * Supported aggregate functions for query operations.
 *
 * @typedef {string} AggregateFunction
 * @description Defines which aggregate functions can be applied to columns
 *
 * @property {'count'} count - Count all rows
 * @property {'sum'} sum - Sum numeric values
 * @property {'avg'} avg - Average numeric values
 * @property {'min'} min - Minimum value
 * @property {'max'} max - Maximum value
 * @property {'distinct'} distinct - Count distinct values
 *
 * @example
 * ```typescript
 * const fn: AggregateFunction = 'count';
 * ```
 *
 * @since 1.0.0
 */
export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

/**
 * Result type for aggregate queries with proper type inference.
 *
 * @template TColumnId - The column identifier (e.g., 'users.email')
 * @template TSchema - The schema containing all tables
 * @description Represents the result structure from aggregate queries
 * @returns An object with the value, count, and aggregate result
 *
 * @example
 * ```typescript
 * type Result = AggregateResult<'users.age', Schema>;
 * // { value: number, count: number, aggregate: number }
 * ```
 *
 * @since 1.0.0
 */
export type AggregateResult<
  TColumnId extends string,
  TSchema extends Record<string, AnyTableType> = Record<string, AnyTableType>,
> = {
  value: InferColumnType<TColumnId, TSchema>;
  count: number;
  aggregate: number;
};

/**
 * Result type for min/max queries with proper type inference.
 *
 * @template TColumnId - The column identifier
 * @template TSchema - The schema containing all tables
 * @description Represents the result structure from min/max queries
 * @returns An object with min and max values
 *
 * @example
 * ```typescript
 * type Result = MinMaxResult<'users.age', Schema>;
 * // { min: number, max: number }
 * ```
 *
 * @since 1.0.0
 */
export type MinMaxResult<
  TColumnId extends string,
  TSchema extends Record<string, AnyTableType> = Record<string, AnyTableType>,
> = {
  min: InferColumnType<TColumnId, TSchema>;
  max: InferColumnType<TColumnId, TSchema>;
};

/**
 * Utility type to infer column type from column ID using Drizzle's type system
 */
export type InferColumnType<
  TColumnId extends string,
  TSchema extends Record<string, AnyTableType>,
> = TColumnId extends `${infer TTable}.${infer TField}`
  ? InferFieldType<TTable, TField, TSchema>
  : InferAnyTableFieldType<TColumnId, TSchema>;

/**
 * Infer field type from table and field names using Drizzle's InferSelectModel
 */
export type InferFieldType<
  TTable extends string,
  TField extends string,
  TSchema extends Record<string, AnyTableType>,
> = TTable extends keyof TSchema
  ? TSchema[TTable] extends AnyTableType
    ? TField extends keyof InferSelectModel<TSchema[TTable]>
      ? InferSelectModel<TSchema[TTable]>[TField]
      : never
    : never
  : never;

/**
 * Infer field type from any table using Drizzle's InferSelectModel
 */
export type InferAnyTableFieldType<
  TField extends string,
  TSchema extends Record<string, AnyTableType>,
> = {
  [K in keyof TSchema]: TSchema[K] extends AnyTableType
    ? TField extends keyof InferSelectModel<TSchema[K]>
      ? InferSelectModel<TSchema[K]>[TField]
      : never
    : never;
}[keyof TSchema];

/**
 * Get column type from Drizzle table using the `_` property
 */
export type GetTableColumnType<
  TTable extends AnyTableType,
  TField extends string,
> = TTable extends AnyTableType
  ? TField extends keyof TTable['_']['columns']
    ? TTable['_']['columns'][TField]['_']['data']
    : never
  : never;

/**
 * Get all column names from a Drizzle table
 */
export type GetTableColumnNames<TTable extends AnyTableType> = TTable extends AnyTableType
  ? keyof TTable['_']['columns']
  : never;

/**
 * Table type that has an id field
 */
export type TableWithId = AnyTableType & {
  id: AnyColumnType;
};

/**
 * Database instance type for Drizzle ORM
 *
 * @description Represents the actual Drizzle database instance returned by drizzle().
 * It provides full type safety and access to all Drizzle methods like .select(), .insert(), etc.
 *
 * @template TDriver - The specific database driver type
 *
 * @example
 * ```typescript
 * // Specific driver - fully typed
 * const db: DrizzleDatabase<'postgres'> = drizzle(connection);
 *
 * // Generic - requires runtime handling
 * const db: DrizzleDatabase<DatabaseDriver> = drizzle(connection);
 * ```
 */
export type DrizzleDatabase<TDriver extends DatabaseDriver> = DatabaseTypeMap[TDriver];

/**
 * Common interface for database operations across all drivers.
 * This follows the Strategy Pattern and ensures consistent behavior.
 *
 * @template TRecord - The record type for the table
 * @description Defines the contract that all database operation implementations must follow
 *
 * @example
 * ```typescript
 * const operations: DatabaseOperations<User> = new PostgresOperations(db);
 * const user = await operations.insert(usersTable, { name: 'John' });
 * ```
 *
 * @since 1.0.0
 */
export interface DatabaseOperations<TRecord> {
  /**
   * Insert a new record into the table
   * @param table - The table to insert into
   * @param data - The data to insert
   * @returns Promise with the inserted record
   */
  insert(table: TableWithId, data: Partial<TRecord>): Promise<TRecord>;

  /**
   * Update an existing record by ID
   * @param table - The table to update
   * @param id - The ID of the record to update
   * @param data - The data to update
   * @returns Promise with the updated record
   */
  update(table: TableWithId, id: string, data: Partial<TRecord>): Promise<TRecord>;

  /**
   * Delete a record by ID
   * @param table - The table to delete from
   * @param id - The ID of the record to delete
   * @returns Promise with the deleted record
   */
  delete(table: TableWithId, id: string): Promise<TRecord>;

  /**
   * Bulk update multiple records
   * @param table - The table to update
   * @param ids - Array of IDs to update
   * @param data - The data to update
   * @returns Promise with array of updated records
   */
  bulkUpdate(table: TableWithId, ids: string[], data: Partial<TRecord>): Promise<TRecord[]>;

  /**
   * Bulk delete multiple records
   * @param table - The table to delete from
   * @param ids - Array of IDs to delete
   * @returns Promise with array of deleted records
   */
  bulkDelete(table: TableWithId, ids: string[]): Promise<TRecord[]>;

  /**
   * Build count query for the specific database driver
   * @param primaryTable - The primary table schema
   * @returns Promise with the count result
   */
  buildCountQuery(primaryTable: AnyTableType): Promise<{ count: number }[]>;
}

/**
 * Factory function type for creating database operations.
 * This follows the Factory Pattern for operations instantiation.
 *
 * @template TRecord - The record type for the table
 * @template TDriver - The database driver type
 * @param db - The Drizzle database instance
 * @returns The appropriate database operations implementation
 *
 * @example
 * ```typescript
 * const createOperations = getOperationsFactory<'postgres'>();
 * const operations = createOperations<User>(postgresDb);
 * ```
 *
 * @since 1.0.0
 */
export type OperationsFactory<TDriver extends DatabaseDriver> = <TRecord>(
  db: DrizzleDatabase<TDriver>
) => DatabaseOperations<TRecord>;

/**
 * Factory function type for creating database query builders.
 * This follows the Factory Pattern for query builder instantiation.
 * Primary keys are auto-detected from the schema - no manual configuration needed.
 *
 * @template TDriver - The database driver type
 * @param db - The Drizzle database instance
 * @param schema - The schema containing all tables
 * @param relationshipManager - The relationship manager instance
 * @returns The appropriate query builder implementation
 *
 * @example
 * ```typescript
 * const createQueryBuilder = getQueryBuilderFactory<'postgres'>();
 * const queryBuilder = createQueryBuilder(postgresDb, schema, relationshipManager);
 * ```
 *
 * @since 1.0.0
 */
export type QueryBuilderFactory<TDriver extends DatabaseDriver> = (
  db: DrizzleDatabase<TDriver>,
  schema: Record<string, AnyTableType>,
  relationshipManager: RelationshipManager,
  hooks?: FilterHandlerHooks
) => BaseQueryBuilder;

/**
 * Query builder interface for type safety
 */
export interface QueryBuilder {
  from(table: AnyTableType): QueryBuilderWithJoins;
}

/**
 * Base query builder with joins interface
 * This interface defines the common methods that all database query builders must implement
 */
export interface QueryBuilderWithJoins {
  leftJoin(table: AnyTableType, condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  innerJoin(table: AnyTableType, condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  select(selections?: Record<string, AnyColumnType | SQL | SQLWrapper>): QueryBuilderWithJoins;
  where(condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins;
  limit(count: number): QueryBuilderWithJoins;
  offset(count: number): QueryBuilderWithJoins;
  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins;
  execute(): Promise<Record<string, unknown>[]>;
}

/**
 * PostgreSQL-specific query builder with joins interface
 */
export interface PostgresQueryBuilderWithJoins extends QueryBuilderWithJoins {
  leftJoin(table: AnyTableType, condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins;
  innerJoin(table: AnyTableType, condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins;
  select(
    selections?: Record<string, AnyColumnType | SQL | SQLWrapper>
  ): PostgresQueryBuilderWithJoins;
  where(condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins;
  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins;
  limit(count: number): PostgresQueryBuilderWithJoins;
  offset(count: number): PostgresQueryBuilderWithJoins;
  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins;
}

/**
 * MySQL-specific query builder with joins interface
 */
export interface MySQLQueryBuilderWithJoins extends QueryBuilderWithJoins {
  leftJoin(table: AnyTableType, condition: SQL | SQLWrapper): MySQLQueryBuilderWithJoins;
  innerJoin(table: AnyTableType, condition: SQL | SQLWrapper): MySQLQueryBuilderWithJoins;
  select(selections?: Record<string, AnyColumnType | SQL | SQLWrapper>): MySQLQueryBuilderWithJoins;
  where(condition: SQL | SQLWrapper): MySQLQueryBuilderWithJoins;
  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): MySQLQueryBuilderWithJoins;
  limit(count: number): MySQLQueryBuilderWithJoins;
  offset(count: number): MySQLQueryBuilderWithJoins;
  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): MySQLQueryBuilderWithJoins;
}

/**
 * SQLite-specific query builder with joins interface
 */
export interface SQLiteQueryBuilderWithJoins extends QueryBuilderWithJoins {
  leftJoin(table: AnyTableType, condition: SQL | SQLWrapper): SQLiteQueryBuilderWithJoins;
  innerJoin(table: AnyTableType, condition: SQL | SQLWrapper): SQLiteQueryBuilderWithJoins;
  select(
    selections?: Record<string, AnyColumnType | SQL | SQLWrapper>
  ): SQLiteQueryBuilderWithJoins;
  where(condition: SQL | SQLWrapper): SQLiteQueryBuilderWithJoins;
  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): SQLiteQueryBuilderWithJoins;
  limit(count: number): SQLiteQueryBuilderWithJoins;
  offset(count: number): SQLiteQueryBuilderWithJoins;
  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): SQLiteQueryBuilderWithJoins;
}

/**
 * Configuration for the Drizzle adapter
 *
 * @template TSchema - The schema containing all tables
 * @template TDriver - The specific database driver type (REQUIRED - must be specified)
 *
 * @description Configuration object for creating a DrizzleAdapter instance.
 * The driver type parameter is required and must be explicitly specified to ensure
 * proper type safety for all database operations. The `db` property will automatically
 * be typed based on the `driver` value.
 *
 * @example
 * ```typescript
 * // For PostgreSQL - db will be typed as PostgresJsDatabase
 * const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
 *   db: postgresDb, // TypeScript knows this should be PostgresJsDatabase
 *   schema: { users, profiles },
 *   driver: 'postgres'
 * };
 *
 * // For SQLite - db will be typed as BetterSQLite3Database
 * const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
 *   db: sqliteDb, // TypeScript knows this should be BetterSQLite3Database
 *   schema: { users, profiles },
 *   driver: 'sqlite'
 * };
 * ```
 */
export interface DrizzleAdapterConfig<
  TSchema extends Record<string, AnyTableType>,
  TDriver extends DatabaseDriver,
> {
  /** Drizzle database instance - automatically typed based on driver */
  db: DrizzleDatabase<TDriver>;

  /** Schema containing tables and relations */
  schema: TSchema;

  /** Database driver type - determines the type of the `db` property */
  driver: TDriver;

  /** Auto-detect relationships from schema */
  autoDetectRelationships?: boolean;

  /** Raw Drizzle relations for auto-detection */
  relations?: Record<string, unknown>;

  /** Manual relationship mappings (overrides auto-detection) */
  relationships?: RelationshipMap;

  /** Computed/virtual fields that don't exist in the database schema */
  computedFields?: {
    [K in keyof TSchema]?: ComputedFieldConfig<InferSelectModel<TSchema[K]>>[];
  };

  /** Adapter options */
  options?: DrizzleAdapterOptions;

  /** Filter handler hooks for customizing filter behavior */
  hooks?: FilterHandlerHooks;

  /** Adapter metadata */
  meta?: Partial<AdapterMeta>;
}

/**
 * Relationship mapping configuration
 */
export interface RelationshipMap {
  /** Maps column IDs to relationship paths */
  [columnId: string]: RelationshipPath;
}

/**
 * Relationship path definition
 */
export interface RelationshipPath {
  /** Source table */
  from: string;

  /** Target table */
  to: string;

  /** Foreign key field in target table */
  foreignKey: string;

  /** Local key field in source table */
  localKey: string;

  /** Relationship cardinality */
  cardinality: 'one' | 'many';

  /** Whether the relationship is nullable */
  nullable?: boolean;

  /** Join type */
  joinType?: 'left' | 'inner';

  /** Whether this is an array foreign key relationship */
  isArray?: boolean;
}

/**
 * Context provided to computed field functions
 */
export interface ComputedFieldContext<
  TSchema extends Record<string, AnyTableType> = Record<string, AnyTableType>,
  TDriver extends DatabaseDriver = DatabaseDriver,
> {
  /** Primary table name */
  primaryTable: string;

  /** All rows being processed (for batch computation) */
  allRows: unknown[];

  /** Database instance (for querying related tables) */
  db: DrizzleDatabase<TDriver>;

  /** Schema */
  schema: TSchema;
}

/**
 * Configuration for a computed/virtual field that doesn't exist in the database schema
 *
 * @description
 * Computed fields allow you to add virtual columns that are calculated at runtime.
 * These fields can be computed from the row data, related tables, or any other source.
 *
 * @example
 * ```typescript
 * {
 *   field: 'attendeeCount',
 *   type: 'number',
 *   compute: async (row, context) => {
 *     const count = await context.db
 *       .select({ count: count() })
 *       .from(eventAttendeesTable)
 *       .where(eq(eventAttendeesTable.eventId, row.id));
 *     return count[0]?.count || 0;
 *   },
 *   filter: async (filter, context) => {
 *     // Transform filter to query related table
 *     const matchingIds = await getMatchingEventIds(filter, context);
 *     return [{
 *       columnId: 'id',
 *       operator: 'isAnyOf',
 *       values: matchingIds,
 *       type: 'text',
 *     }];
 *   },
 * }
 * ```
 */
export interface ComputedFieldConfig<TData = Record<string, unknown>> {
  /** Field name (e.g., 'attendeeCount') */
  field: string;

  /** Function to compute the field value from the row data */
  compute: (row: TData, context: ComputedFieldContext) => Promise<unknown> | unknown;

  /** Function to handle filtering on this computed field */
  filter?: (
    filter: FilterState,
    context: ComputedFieldContext
  ) => Promise<FilterState[]> | FilterState[];

  /**
   * Function to handle filtering on this computed field by returning a SQL condition directly.
   * This is more efficient than `filter` for large result sets because the SQL condition
   * is applied in the WHERE clause before pagination, rather than querying all matching IDs first.
   *
   * If both `filter` and `filterSql` are provided, `filterSql` takes precedence.
   *
   * @example
   * ```typescript
   * filterSql: async (filter, context) => {
   *   const languageCode = filter.values?.[0];
   *   const languageArrayJson = JSON.stringify([{ code: languageCode }]);
   *   return sql`(${usersTable.demographics}->'language') @> ${languageArrayJson}`;
   * }
   * ```
   */
  filterSql?: (
    filter: FilterState,
    context: ComputedFieldContext
  ) => Promise<SQL | SQLWrapper> | SQL | SQLWrapper;

  /**
   * Function to handle sorting on this computed field by returning a SQL expression directly.
   * This is more efficient than in-memory sorting because the SQL expression is used in the
   * ORDER BY clause, allowing the database to handle sorting efficiently.
   *
   * The SQL expression will be added to the SELECT clause with an alias matching the field name,
   * and then used in the ORDER BY clause. This allows sorting by computed values without fetching
   * all data into memory.
   *
   * @example
   * ```typescript
   * sortSql: async (context) => {
   *   return sql`(
   *     SELECT COUNT(*)
   *     FROM user_segment_mappings
   *     WHERE segment_id = ${userSegmentsTable.id}
   *   )`;
   * }
   * ```
   *
   * This will generate SQL like:
   * ```sql
   * SELECT
   *   "userSegmentsTable".*,
   *   (SELECT COUNT(*) FROM user_segment_mappings WHERE segment_id = "userSegmentsTable".id) AS "userCount"
   * FROM user_segments "userSegmentsTable"
   * ORDER BY "userCount" DESC
   * ```
   */
  sortSql?: (context: ComputedFieldContext) => Promise<SQL | SQLWrapper> | SQL | SQLWrapper;

  /** Type of the computed field (for validation) */
  type?: ColumnType;

  /** Whether this field should be included by default when no columns specified */
  includeByDefault?: boolean;

  /** Whether this computed field requires the underlying database column to be fetched.
   * When true, the column will be included in the SELECT statement even though it's a computed field.
   * This is useful when a real column needs custom filter logic but the compute function
   * needs to access the actual column value.
   * @default false
   */
  requiresColumn?: boolean;
}

/**
 * Computed field configuration with resolved SQL expression for sorting.
 * This is an internal type used by the query builder after resolving sortSql expressions.
 *
 * @template TData - The type of data items
 */
export interface ComputedFieldWithResolvedSortSql<TData = Record<string, unknown>>
  extends ComputedFieldConfig<TData> {
  /** Resolved SQL expression from sortSql function (pre-resolved in adapter) */
  __resolvedSortSql: SQL | SQLWrapper;
}

/**
 * Adapter options
 */
/**
 * Hooks for customizing filter handler behavior
 *
 * @description
 * Allows overriding or extending filter processing behavior for edge cases.
 * Hooks are called at specific points in the filter processing pipeline,
 * allowing custom implementations when the default behavior doesn't work.
 *
 * @example
 * ```typescript
 * import { inArray } from 'drizzle-orm';
 *
 * const hooks: FilterHandlerHooks = {
 *   buildLargeArrayCondition: (column, values, operator) => {
 *     // Custom implementation for very large arrays using parameterized queries
 *     if (operator === 'isAnyOf') {
 *       return inArray(column, values);
 *     }
 *     // Return null to use default behavior for other operators
 *     return null;
 *   }
 * };
 * ```
 */
export interface FilterHandlerHooks {
  /**
   * Called before building a filter condition.
   * Can modify the filter or return null to skip processing.
   *
   * @param filter - The filter state to process
   * @param primaryTable - The primary table name
   * @returns Modified filter, or null to skip processing
   */
  beforeBuildFilterCondition?: (filter: FilterState, primaryTable: string) => FilterState | null;

  /**
   * Called after building a filter condition.
   * Can modify the resulting SQL condition.
   *
   * @param condition - The SQL condition that was built
   * @param filter - The original filter state
   * @returns Modified SQL condition
   */
  afterBuildFilterCondition?: (
    condition: SQL | SQLWrapper,
    filter: FilterState
  ) => SQL | SQLWrapper;

  /**
   * Called when building conditions for very large arrays.
   * Can provide a custom implementation or return null to use default behavior.
   *
   * @param column - The column to compare against
   * @param values - Array of values
   * @param operator - The operator ('isAnyOf' or 'isNoneOf')
   * @returns Custom SQL condition, or null to use default behavior
   */
  buildLargeArrayCondition?: (
    column: ColumnOrExpression,
    values: unknown[],
    operator: 'isAnyOf' | 'isNoneOf'
  ) => SQL | SQLWrapper | null;
}

export interface DrizzleAdapterOptions {
  /** Query caching configuration */
  cache?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };

  /** Query optimization settings */
  optimization?: {
    /** Maximum number of joins per query */
    maxJoins?: number;

    /** Enable query result batching for large datasets */
    enableBatching?: boolean;

    /** Batch size for large queries */
    batchSize?: number;
  };

  /** Logging configuration */
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    logQueries?: boolean;
  };

  /** Performance monitoring */
  performance?: {
    /** Track query execution times */
    trackTiming?: boolean;

    /** Maximum query execution time before warning */
    maxQueryTime?: number;
  };

  /** Batching configuration for large arrays */
  batching?: {
    /** Batch size for large array conditions (default: 50) */
    batchSize?: number;

    /** Maximum batches per group before using nested grouping (default: 200) */
    maxBatchesPerGroup?: number;

    /** Enable nested OR/AND grouping for very large arrays (default: true) */
    enableNestedGrouping?: boolean;
  };
}

/**
 * Options for the drizzleAdapter factory function.
 *
 * @description
 * Configuration options for creating a Drizzle adapter instance via the factory function.
 * Allows overriding auto-detected values and providing additional configuration.
 *
 * @template TSchema - The schema type (optional, auto-inferred from db)
 * @template TDriver - The driver type (optional, auto-inferred from db)
 */
export interface DrizzleAdapterFactoryOptions<
  TSchema extends Record<string, AnyTableType> = Record<string, AnyTableType>,
  TDriver extends DatabaseDriver = DatabaseDriver,
> {
  /** Override auto-detected schema */
  schema?: TSchema;

  /** Override auto-detected driver */
  driver?: TDriver;

  /** Override or provide relations */
  relations?: Record<string, unknown>;

  /** Manual relationship mappings */
  relationships?: RelationshipMap;

  /** Whether to auto-detect relationships (default: true) */
  autoDetectRelationships?: boolean;

  /** Adapter options */
  options?: DrizzleAdapterOptions;

  /** Adapter metadata */
  meta?: Partial<AdapterMeta>;
}

/**
 * Query context for tracking required joins and tables
 */
export interface QueryContext {
  /** Tables that need to be joined */
  requiredTables: Set<string>;

  /** Join paths to required tables */
  joinPaths: Map<string, RelationshipPath[]>;

  /** Columns being accessed */
  columns: Set<string>;

  /** Filters being applied */
  filters: Set<string>;

  /** Sort columns */
  sorts: Set<string>;
}

/**
 * Join configuration for query building
 */
export interface JoinConfig {
  /** Join type */
  type: 'left' | 'inner';

  /** Join condition */
  condition: SQL | SQLWrapper;

  /** Target table */
  table: AnyTableType;

  /** Alias for the joined table */
  alias?: string;
}

/**
 * Parsed column path
 */
export interface ColumnPath {
  /** Full column ID (e.g., "profile.bio") */
  columnId: string;

  /** Table name (e.g., "profile") */
  table: string;

  /** Field name (e.g., "bio") */
  field: string;

  /** Whether this is a nested path */
  isNested: boolean;

  /** Relationship path to the table */
  relationshipPath?: RelationshipPath[];
}

/**
 * Column reference for query building
 */
export interface ColumnReference {
  /** The actual Drizzle column object */
  column: AnyColumnType;
  /** Table alias for joins */
  tableAlias?: string;
  /** Whether this is a related table column */
  isRelated: boolean;
  /** Join path to reach this column */
  joinPath?: RelationshipPath[];
}

/**
 * Aggregate column configuration
 */
export interface AggregateColumn {
  /** Column ID */
  columnId: string;

  /** Aggregate function */
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

  /** Target field for aggregation */
  field: string;

  /** Relationship path to the field */
  relationshipPath: RelationshipPath[];
}

/**
 * Query result metadata
 */
export interface QueryMetadata {
  /** Query execution time in milliseconds */
  executionTime?: number;

  /** Number of joins used */
  joinCount?: number;

  /** Whether query was cached */
  cached?: boolean;

  /** Query SQL (if logging enabled) */
  sql?: string;
}

/**
 * Filter out relations from a schema, keeping only actual table types.
 *
 * @description
 * This utility type filters a schema object to include only properties that are
 * actual table types (extending AnyTableType), excluding relation objects.
 * This is necessary because Drizzle schemas often include both tables and relations
 * (e.g., `{ users, profiles, usersRelations }`), but the adapter only needs tables.
 *
 * @template TSchema - The schema type that may include both tables and relations
 * @returns A schema type containing only table types
 *
 * @example
 * ```typescript
 * type SchemaWithRelations = {
 *   users: PgTable;
 *   profiles: PgTable;
 *   usersRelations: Relations<...>; // This will be filtered out
 * };
 *
 * type TablesOnly = FilterTablesFromSchema<SchemaWithRelations>;
 * // Result: { users: PgTable; profiles: PgTable; }
 * ```
 *
 * @since 1.1.0
 */
export type FilterTablesFromSchema<TSchema> = TSchema extends Record<string, unknown>
  ? {
      [K in keyof TSchema as TSchema[K] extends AnyTableType ? K : never]: TSchema[K];
    }
  : Record<string, AnyTableType>;

/**
 * Extract schema type from Drizzle database instance.
 *
 * @description
 * Attempts to extract the schema type parameter from a Drizzle database instance.
 * This enables automatic type inference when using the factory function.
 * The extracted schema is filtered to include only tables, excluding relations.
 *
 * @template TDB - The Drizzle database instance type
 * @returns The schema type filtered to only include tables (not relations)
 *
 * @example
 * ```typescript
 * type MySchema = ExtractSchemaFromDB<typeof db>;
 * // Returns the schema type passed to drizzle(connection, { schema })
 * // but filtered to only include tables, not relations
 * ```
 */
export type ExtractSchemaFromDB<TDB> =
  // PostgreSQL drivers
  TDB extends PostgresJsDatabase<infer S>
    ? FilterTablesFromSchema<S>
    : TDB extends NodePgDatabase<infer S>
      ? FilterTablesFromSchema<S>
      : TDB extends NeonHttpDatabase<infer S>
        ? FilterTablesFromSchema<S>
        : // MySQL drivers
          TDB extends MySql2Database<infer S>
          ? FilterTablesFromSchema<S>
          : // SQLite drivers
            TDB extends BetterSQLite3Database<infer S>
            ? FilterTablesFromSchema<S>
            : Record<string, AnyTableType>;

/**
 * Extract driver type from Drizzle database instance.
 *
 * @template {any} TDB - The Drizzle database instance type
 *
 * @description
 * This conditional type automatically determines the database driver string from a Drizzle instance type
 * at compile-time, enabling full type safety when working with different database drivers.
 * It performs pattern matching on the database instance type and returns the corresponding driver identifier.
 *
 * Supported database types and their corresponding driver strings:
 *
 * PostgreSQL drivers (all return 'postgres'):
 * - `PostgresJsDatabase` (drizzle-orm/postgres-js)
 * - `NodePgDatabase` (drizzle-orm/node-postgres)
 * - `NeonHttpDatabase` (drizzle-orm/neon-http)
 *
 * MySQL drivers (all return 'mysql'):
 * - `MySql2Database` (drizzle-orm/mysql2)
 *
 * SQLite drivers (all return 'sqlite'):
 * - `BetterSQLite3Database` (drizzle-orm/better-sqlite3)
 *
 * Other types → Falls back to `DatabaseDriver` union type
 *
 * @returns {DatabaseDriver} The driver type as a string literal or union type
 *
 * @example
 * ```typescript
 * import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
 * import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
 * import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
 *
 * // All PostgreSQL drivers return 'postgres'
 * type PostgresDriver = ExtractDriverFromDB<PostgresJsDatabase<any>>;
 * // Result: 'postgres'
 *
 * type NodePgDriver = ExtractDriverFromDB<NodePgDatabase<any>>;
 * // Result: 'postgres'
 *
 * // SQLite driver returns 'sqlite'
 * type SQLiteDriver = ExtractDriverFromDB<BetterSQLite3Database<any>>;
 * // Result: 'sqlite'
 * ```
 *
 * @see {@link DatabaseDriver} The returned driver type
 * @see {@link DatabaseTypeMap} The mapping of drivers to database types
 * @see {@link PostgresDatabaseType} Union of all PostgreSQL drivers
 * @see {@link SQLiteDatabaseType} SQLite driver type
 *
 * @since 1.0.0 (expanded in 1.1.0)
 */
export type ExtractDriverFromDB<TDB> =
  // PostgreSQL drivers
  TDB extends PostgresJsDatabase<infer _>
    ? 'postgres'
    : TDB extends NodePgDatabase<infer _>
      ? 'postgres'
      : TDB extends NeonHttpDatabase<infer _>
        ? 'postgres'
        : // MySQL drivers
          TDB extends MySql2Database<infer _>
          ? 'mysql'
          : // SQLite drivers
            TDB extends BetterSQLite3Database<infer _>
            ? 'sqlite'
            : DatabaseDriver;

/**
 * Error types for the adapter
 */
export class DrizzleAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DrizzleAdapterError';
  }
}

export class RelationshipError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RELATIONSHIP_ERROR', details);
    this.name = 'RelationshipError';
  }
}

export class QueryError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUERY_ERROR', details);
    this.name = 'QueryError';
  }
}

export class SchemaError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCHEMA_ERROR', details);
    this.name = 'SchemaError';
  }
}
