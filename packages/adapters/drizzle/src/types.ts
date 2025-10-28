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
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DrizzleAdapter } from './drizzle-adapter';
import type { BaseQueryBuilder } from './query-builders';
import type { RelationshipManager } from './relationship-manager';

/**
 * Mapping of database drivers to their corresponding Drizzle database types.
 * This is the single source of truth for supported database drivers.
 *
 * @description This type ensures that every database driver has a corresponding
 * database type. When you add a new driver, add it here and TypeScript will
 * ensure type safety throughout the codebase.
 */
type DatabaseTypeMap = {
  postgres: PostgresJsDatabase;
  mysql: MySql2Database;
  sqlite: BetterSQLite3Database;
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
  relationshipManager: RelationshipManager
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
 * Extract schema type from Drizzle database instance.
 *
 * @description
 * Attempts to extract the schema type parameter from a Drizzle database instance.
 * This enables automatic type inference when using the factory function.
 *
 * @template TDB - The Drizzle database instance type
 * @returns The schema type if available, otherwise a generic record
 *
 * @example
 * ```typescript
 * type MySchema = ExtractSchemaFromDB<typeof db>;
 * // Returns the schema type passed to drizzle(connection, { schema })
 * ```
 */
export type ExtractSchemaFromDB<TDB> = TDB extends PostgresJsDatabase<infer S>
  ? S extends Record<string, AnyTableType>
    ? S
    : Record<string, AnyTableType>
  : TDB extends MySql2Database<infer S>
    ? S extends Record<string, AnyTableType>
      ? S
      : Record<string, AnyTableType>
    : TDB extends BetterSQLite3Database<infer S>
      ? S extends Record<string, AnyTableType>
        ? S
        : Record<string, AnyTableType>
      : Record<string, AnyTableType>;

/**
 * Extract driver type from Drizzle database instance.
 *
 * @template {any} TDB - The Drizzle database instance type (e.g., PostgresJsDatabase, MySql2Database, BetterSQLite3Database)
 *
 * @description
 * This conditional type automatically determines the database driver string from a Drizzle instance type
 * at compile-time, enabling full type safety when working with different database drivers.
 * It performs pattern matching on the database instance type and returns the corresponding driver identifier.
 *
 * Supported database types and their corresponding driver strings:
 * - `PostgresJsDatabase` → `'postgres'`
 * - `MySql2Database` → `'mysql'`
 * - `BetterSQLite3Database` → `'sqlite'`
 * - Other types → Falls back to `DatabaseDriver` union type
 *
 * @returns {DatabaseDriver} The driver type as a string literal or union type
 *
 * @example
 * ```typescript
 * import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
 * import type { MySql2Database } from 'drizzle-orm/mysql2';
 * import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
 *
 * // Extract driver from specific database types
 * type PostgresDriver = ExtractDriverFromDB<PostgresJsDatabase<any>>;
 * // Result: 'postgres'
 *
 * type MySqlDriver = ExtractDriverFromDB<MySql2Database<any>>;
 * // Result: 'mysql'
 *
 * type SQLiteDriver = ExtractDriverFromDB<BetterSQLite3Database<any>>;
 * // Result: 'sqlite'
 *
 * // Usage in generic functions
 * function withDriver<TDB>() {
 *   type Driver = ExtractDriverFromDB<TDB>;
 *   // Driver is inferred based on TDB
 * }
 * ```
 *
 * @see {@link DatabaseDriver} The returned driver type
 * @see {@link DatabaseTypeMap} The mapping of drivers to database types
 *
 * @since 1.0.0
 */
export type ExtractDriverFromDB<TDB> = TDB extends PostgresJsDatabase<infer _>
  ? 'postgres'
  : TDB extends MySql2Database<infer _>
    ? 'mysql'
    : TDB extends BetterSQLite3Database<infer _>
      ? 'sqlite'
      : DatabaseDriver;

/**
 * Infer adapter type from Drizzle database instance.
 *
 * @description
 * Combines schema and driver extraction to infer the complete adapter type
 * from a Drizzle database instance. This is used by the factory function.
 *
 * @template TDB - The Drizzle database instance type
 * @returns The DrizzleAdapter type with inferred generics
 */
export type InferAdapterFromDB<TDB> = DrizzleAdapter<
  ExtractSchemaFromDB<TDB>,
  ExtractDriverFromDB<TDB>
>;

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
