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

import type { AdapterMeta } from '@better-tables/core';
import type { AnyColumn, InferSelectModel, SQL, SQLWrapper } from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * Database driver types supported by the Drizzle adapter.
 *
 * @description Identifies which database driver is being used
 *
 * @example
 * ```typescript
 * const driver: DatabaseDriver = 'postgres';
 * ```
 *
 * @since 1.0.0
 */
export type DatabaseDriver = 'postgres' | 'mysql' | 'sqlite';

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
 * Drizzle supports multiple database drivers (SQLite, PostgreSQL, MySQL), each with
 * slightly different method signatures. TypeScript cannot reconcile union types with
 * different method signatures, which causes type errors when calling methods like
 * select(), insert(), update(), delete().
 *
 * Following Drizzle's own adapter pattern and common ORM practices, we use `any` here
 * to support all three database types. The actual type safety is maintained through:
 * 1. The driver parameter which specifies which database is being used
 * 2. Runtime behavior that correctly handles each database type
 * 3. The schema type parameter which provides type safety for table operations
 *
 * This is the same approach used in Drizzle's documentation examples and other
 * multi-database ORMs.
 *
 *
 */

// TODO: should this have a proper type? ideally yes but we need to support all three database types
// biome-ignore lint/suspicious/noExplicitAny: we need to support all three database types
export type DrizzleDatabase = any;

/**
 * Query builder interface for type safety
 */
export interface QueryBuilder {
  from(table: AnyTableType): QueryBuilderWithJoins;
}

/**
 * Query builder with joins interface
 */
export interface QueryBuilderWithJoins {
  leftJoin(table: AnyTableType, condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  innerJoin(table: AnyTableType, condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  select(selections: Record<string, AnyColumnType | SQL | SQLWrapper>): QueryBuilderWithJoins;
  where(condition: SQL | SQLWrapper): QueryBuilderWithJoins;
  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins;
  limit(count: number): QueryBuilderWithJoins;
  offset(count: number): QueryBuilderWithJoins;
  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins;
  execute(): Promise<Record<string, unknown>[]>;
}

/**
 * Configuration for the Drizzle adapter
 */
export interface DrizzleAdapterConfig<TSchema extends Record<string, AnyTableType>> {
  /** Drizzle database instance */
  db: DrizzleDatabase;

  /** Schema containing tables and relations */
  schema: TSchema;

  /** Database driver type */
  driver: DatabaseDriver;

  /** Auto-detect relationships from schema */
  autoDetectRelationships?: boolean;

  /** Raw Drizzle relations for auto-detection */
  relations?: Record<string, unknown>;

  /** Manual relationship mappings (overrides auto-detection) */
  relationships?: RelationshipMap;

  /** Adapter options */
  options?: DrizzleAdapterOptions;

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
}

/**
 * Adapter options
 */
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

  /** Primary key configuration */
  primaryKey?: {
    /** Custom primary key column name for the main table (defaults to 'id') */
    mainTableKey?: string;

    /** Map of table names to their primary key column names */
    tableKeys?: Record<string, string>;
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
