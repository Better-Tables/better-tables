/**
 * @fileoverview Main entry point for the Drizzle adapter package
 * @module @better-tables/adapters-drizzle
 *
 * @description
 * This is the main export file for the Drizzle adapter package. It exports all
 * public APIs including classes, types, and utilities that developers need to
 * integrate the adapter with their Drizzle ORM schemas.
 *
 * Main exports:
 * - **DrizzleAdapter**: The main adapter class implementing TableAdapter
 * - **Query Builders**: Database-specific query builders (Postgres, MySQL, SQLite)
 * - **DataTransformer**: Transforms flat SQL results to nested structures
 * - **FilterHandler**: Handles filter operator mapping to SQL
 * - **RelationshipDetector**: Auto-detects relationships from Drizzle schemas
 * - **RelationshipManager**: Manages relationship paths and joins
 * - **Types**: All TypeScript types and interfaces
 * - **Error Classes**: DrizzleAdapterError, QueryError, RelationshipError, SchemaError
 *
 * The package provides complete integration between Drizzle ORM and the Better Tables
 * framework, enabling powerful table management with automatic relationship handling,
 * type-safe queries, and efficient data operations.
 *
 * @example
 * ```typescript
 * import { DrizzleAdapter } from '@better-tables/drizzle-adapter';
 *
 * const adapter = new DrizzleAdapter({
 *   db: drizzleDb,
 *   schema: { users, profiles },
 *   driver: 'postgres'
 * });
 *
 * const result = await adapter.fetchData({ columns: ['email', 'profile.bio'] });
 * ```
 *
 * @see {@link https://github.com/drizzle-team/drizzle-orm|Drizzle ORM}
 * @since 1.0.0
 */

// Main exports

export { DataTransformer } from './data-transformer';
export { DrizzleAdapter } from './drizzle-adapter';
export { createDrizzleAdapter, drizzleAdapter } from './factory';
export { FilterHandler } from './filter-handler';
export {
  BaseQueryBuilder,
  getQueryBuilderFactory,
  MySQLQueryBuilder,
  PostgresQueryBuilder,
  SQLiteQueryBuilder,
} from './query-builders';
export { RelationshipDetector } from './relationship-detector';
export { RelationshipManager } from './relationship-manager';
export type {
  AggregateQueryBuilder,
  AggregateType,
  BuildNestedType,
  ColumnAccessor,
  DotNotationType,
  ExtractColumnPaths,
  ExtractRelationshipInfo,
  FilterFunction,
  FlattenNestedType,
  GetTableColumn,
  InferColumnType,
  InferQueryResult,
  InferSchemaRelations,
  InferSchemaTables,
  InferTableColumns,
  InferTableInsertModel,
  InferTableSelectModel,
  InferTableType,
  IsColumnNullable,
  QueryBuilder,
  SortComparator,
  ValidateColumnAccess,
  VirtualColumnType,
} from './schema-inference';
// Type exports
export type {
  AggregateColumn,
  ColumnPath,
  DatabaseDriver,
  DrizzleAdapterConfig,
  DrizzleAdapterFactoryOptions,
  ExtractDriverFromDB,
  ExtractSchemaFromDB,
  InferAdapterFromDB,
  JoinConfig,
  QueryBuilderFactory,
  QueryContext,
  QueryMetadata,
  RelationshipMap,
  RelationshipPath,
} from './types';

// Error class exports (as values, not types)
export {
  DrizzleAdapterError,
  QueryError,
  RelationshipError,
  SchemaError,
} from './types';
