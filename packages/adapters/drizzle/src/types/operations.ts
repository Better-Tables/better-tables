/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { AdapterMeta } from '@better-tables/core';
import type { InferSelectModel, SQL, SQLWrapper } from 'drizzle-orm';
import type { BaseQueryBuilder } from '../query-builders';
import type { RelationshipManager } from '../relationship-manager';
import type { ComputedFieldConfig } from './computed-fields';
import type {
  AnyColumnType,
  AnyTableType,
  DrizzleDatabase,
  FilterTablesFromSchema,
  TableWithId,
} from './core';
import type { DatabaseDriver } from './drivers';
import type { FilterHandlerHooks, InvalidFilterBehavior } from './filter-hooks';
import type { RelationshipMap } from './relationships';

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
  hooks?: FilterHandlerHooks,
  onInvalidFilter?: InvalidFilterBehavior
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
 * Computed/virtual field configurations keyed by table.
 *
 * Shared between {@link DrizzleAdapterConfig} (the `new DrizzleAdapter(...)`
 * constructor) and {@link DrizzleAdapterFactoryOptions} (the `drizzleAdapter()`
 * factory) so both entry points accept the identical shape.
 */
export type ComputedFieldsConfig<TSchema> = {
  [K in keyof FilterTablesFromSchema<TSchema>]?: K extends string
    ? FilterTablesFromSchema<TSchema>[K] extends AnyTableType
      ? ComputedFieldConfig<InferSelectModel<FilterTablesFromSchema<TSchema>[K]>>[]
      : never
    : never;
};

export interface DrizzleAdapterConfig<
  TSchema extends Record<string, unknown>,
  TDriver extends DatabaseDriver,
> {
  /** Drizzle database instance - automatically typed based on driver */
  db: DrizzleDatabase<TDriver>;

  /** Schema containing tables and relations (relations will be filtered out automatically) */
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
  computedFields?: ComputedFieldsConfig<TSchema>;

  /** Adapter options */
  options?: DrizzleAdapterOptions;

  /** Filter handler hooks for customizing filter behavior */
  hooks?: FilterHandlerHooks;

  /** Adapter metadata */
  meta?: Partial<AdapterMeta>;
}

export interface DrizzleAdapterOptions {
  /**
   * The table that record mutations (createRecord, updateRecord, deleteRecord,
   * bulkUpdate, bulkDelete) should target.
   *
   * Required when the schema contains more than one table — mutation methods
   * have no per-call table hint, so the adapter cannot infer which table to
   * write to. Schemas with exactly one table don't need this set; that single
   * table is used automatically.
   *
   * @example
   * ```typescript
   * const adapter = drizzleAdapter(db, {
   *   options: { defaultMutationTable: 'users' }
   * });
   * ```
   */
  defaultMutationTable?: string;

  /**
   * The table that READ methods (fetchData, getFilterOptions,
   * getFacetedValues, getMinMaxValues) should target when a call provides
   * neither `columns` nor a per-call `primaryTable` to disambiguate.
   *
   * Required when the schema contains more than one table and callers rely
   * on this no-signal case — those reads throw a `SchemaError` instead of
   * silently guessing "the first table" (plan 030 / finding 9). Prefer
   * passing `columns` or `primaryTable` per call, or querying through a
   * table-scoped surface, where possible; this option is the adapter-level
   * fallback for callers that can't. Schemas with exactly one table don't
   * need this set. A per-call `primaryTable` always takes precedence over
   * this default.
   *
   * @example
   * ```typescript
   * const adapter = drizzleAdapter(db, {
   *   options: { defaultPrimaryTable: 'users' }
   * });
   * ```
   */
  defaultPrimaryTable?: string;

  /** Query caching configuration */
  cache?: {
    enabled: boolean;
    ttl: number;
    /**
     * Max cached entries (LRU eviction). Default 500.
     * Non-positive values disable caching (no entries retained).
     */
    maxSize?: number;
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

  /**
   * How to handle a filter leaf that cannot be translated to a WHERE
   * condition — an operator invalid for the filter's type, or a supported
   * operator with missing/incomplete values. Defaults to `'skip'` (drop and
   * continue, preserving partial UI state). Set to `'throw'` for
   * server-side scoping filters that must never be silently dropped, since a
   * dropped predicate widens results (see {@link InvalidFilterBehavior}).
   *
   * @default 'skip'
   * @example
   * ```typescript
   * const adapter = drizzleAdapter(db, {
   *   options: { onInvalidFilter: 'throw' }
   * });
   * ```
   */
  onInvalidFilter?: InvalidFilterBehavior;
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

  /**
   * Computed/virtual fields that don't exist in the database schema.
   * Same shape as {@link DrizzleAdapterConfig.computedFields} — the factory
   * used to silently drop this, forcing consumers onto the class constructor.
   */
  computedFields?: ComputedFieldsConfig<TSchema>;

  /** Adapter options */
  options?: DrizzleAdapterOptions;

  /**
   * Filter handler hooks for customizing filter behavior.
   * Same as {@link DrizzleAdapterConfig.hooks} — previously factory-dropped.
   */
  hooks?: FilterHandlerHooks;

  /** Adapter metadata */
  meta?: Partial<AdapterMeta>;
}
