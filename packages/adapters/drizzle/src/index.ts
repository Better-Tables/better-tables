// Main exports

export { DataTransformer } from './data-transformer';
export { DrizzleAdapter } from './drizzle-adapter';
export { FilterHandler } from './filter-handler';
export { DrizzleQueryBuilder } from './query-builder';
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
  JoinConfig,
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
