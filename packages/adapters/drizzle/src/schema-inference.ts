import type {
  AnyColumn,
  InferInsertModel,
  InferSelectModel,
  Relations,
  SQL,
  SQLWrapper,
} from 'drizzle-orm';
import type { AnyColumnType, AnyTableType } from './types';

/**
 * Utility type to extract the table type from a Drizzle schema
 */
export type InferTableType<T> = T extends AnyTableType ? T : never;

/**
 * Utility type to extract all table types from a schema
 */
export type InferSchemaTables<T extends Record<string, AnyTableType>> = {
  [K in keyof T]: InferTableType<T[K]>;
};

/**
 * Utility type to extract select model from a table
 */
export type InferTableSelectModel<T extends AnyTableType> = InferSelectModel<T>;

/**
 * Utility type to extract insert model from a table
 */
export type InferTableInsertModel<T extends AnyTableType> = InferInsertModel<T>;

/**
 * Utility type to extract relations from a schema
 */
export type InferSchemaRelations<T extends Record<string, Relations>> = T;

/**
 * Utility type to build nested type from main table and relations
 */
export type BuildNestedType<
  TMainTable extends AnyTableType,
  TRelations extends Relations,
  TSchema extends Record<string, AnyTableType>,
> = InferTableSelectModel<TMainTable> & {
  [K in keyof TRelations]: TRelations[K] extends {
    type: 'one';
    table: infer TTable;
  }
    ? TTable extends keyof TSchema
      ? InferTableSelectModel<TSchema[TTable]> | null
      : never
    : TRelations[K] extends {
          type: 'many';
          table: infer TTable;
        }
      ? TTable extends keyof TSchema
        ? Array<InferTableSelectModel<TSchema[TTable]>>
        : never
      : never;
};

/**
 * Utility type to extract column types from a table
 */
export type InferTableColumns<T extends AnyTableType> = T['_']['columns'];

/**
 * Utility type to get a specific column from a table
 */
export type GetTableColumn<
  T extends AnyTableType,
  K extends keyof InferTableColumns<T>,
> = InferTableColumns<T>[K];

/**
 * Utility type to check if a column is nullable
 */
export type IsColumnNullable<T extends AnyColumn> = T['notNull'] extends false ? true : false;

/**
 * Utility type to extract the base type of a column
 */
export type InferColumnType<T extends AnyColumn> = T['dataType'];

/**
 * Utility type to create a flattened type from nested relationships
 */
export type FlattenNestedType<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? T[K] extends Array<infer U>
      ? U extends Record<string, unknown>
        ? FlattenNestedType<U>
        : U
      : FlattenNestedType<T[K]>
    : T[K];
};

/**
 * Utility type to create a type with dot notation access
 */
export type DotNotationType<T, Prefix extends string = ''> = {
  [K in keyof T as K extends string
    ? Prefix extends ''
      ? K
      : `${Prefix}.${K}`
    : never]: T[K] extends Record<string, unknown>
    ? T[K] extends Array<infer U>
      ? U extends Record<string, unknown>
        ? DotNotationType<U, `${Prefix}.${K & string}`>
        : T[K]
      : DotNotationType<T[K], `${Prefix}.${K & string}`>
    : T[K];
};

/**
 * Utility type to extract all possible column paths from a schema
 */
export type ExtractColumnPaths<
  TSchema extends Record<string, AnyTableType>,
  TMainTable extends keyof TSchema,
  TRelations extends Record<string, Relations> = Record<string, never>,
> = {
  // Main table columns
  [K in keyof InferTableColumns<TSchema[TMainTable]> as K extends string
    ? K
    : never]: InferTableColumns<TSchema[TMainTable]>[K];
} & {
  // Related table columns
  [K in keyof TRelations as K extends string ? K : never]: TRelations[K] extends {
    table: infer TTable;
  }
    ? TTable extends keyof TSchema
      ? {
          [FK in keyof InferTableColumns<TSchema[TTable]> as FK extends string
            ? `${string}.${string}`
            : never]: InferTableColumns<TSchema[TTable]>[FK];
        }
      : never
    : never;
};

/**
 * Utility type to validate column access
 */
export type ValidateColumnAccess<
  TColumnPaths,
  TColumnId extends string,
> = TColumnId extends keyof TColumnPaths ? TColumnPaths[TColumnId] : never;

/**
 * Utility type to create aggregate types
 */
export type AggregateType<T> = {
  count: number;
  sum: T extends number ? number : never;
  avg: T extends number ? number : never;
  min: T;
  max: T;
};

/**
 * Utility type to create virtual column types
 */
export type VirtualColumnType<T> = T | AggregateType<T> | Array<T>;

/**
 * Utility type to extract relationship information from Drizzle relations
 */
export type ExtractRelationshipInfo<T extends Relations> = {
  [K in keyof T]: T[K] extends {
    type: 'one' | 'many';
    table: infer TTable;
    fields: infer TFields;
    references: infer TReferences;
  }
    ? {
        type: T[K]['type'];
        table: TTable;
        fields: TFields;
        references: TReferences;
        nullable: T[K] extends { nullable: true } ? true : false;
      }
    : never;
};

/**
 * Utility type to create a type-safe column accessor
 */
export type ColumnAccessor<TData, TValue> = (data: TData) => TValue;

/**
 * Utility type to create a type-safe filter function
 */
export type FilterFunction<TValue> = (value: TValue) => boolean;

/**
 * Utility type to create a type-safe sort comparator
 */
export type SortComparator<TValue> = (a: TValue, b: TValue) => number;

/**
 * Utility type to extract the return type of a Drizzle query
 */
export type InferQueryResult<T> = T extends Promise<infer R> ? R : T;

/**
 * Utility type to create a type-safe query builder
 */
export type QueryBuilder<TTable extends AnyTableType> = {
  select: () => QueryBuilder<TTable>;
  from: (table: TTable) => QueryBuilder<TTable>;
  where: (condition: SQL | SQLWrapper) => QueryBuilder<TTable>;
  orderBy: (
    column: AnyColumnType | SQL | SQLWrapper,
    direction?: 'asc' | 'desc'
  ) => QueryBuilder<TTable>;
  limit: (count: number) => QueryBuilder<TTable>;
  offset: (count: number) => QueryBuilder<TTable>;
  leftJoin: (table: AnyTableType, condition: SQL | SQLWrapper) => QueryBuilder<TTable>;
  innerJoin: (table: AnyTableType, condition: SQL | SQLWrapper) => QueryBuilder<TTable>;
  groupBy: (column: AnyColumnType | SQL | SQLWrapper) => QueryBuilder<TTable>;
  having: (condition: SQL | SQLWrapper) => QueryBuilder<TTable>;
};

/**
 * Utility type to create a type-safe aggregate query builder
 */
export type AggregateQueryBuilder<TTable extends AnyTableType> = {
  select: (
    aggregates: Record<string, AnyColumnType | SQL | SQLWrapper>
  ) => AggregateQueryBuilder<TTable>;
  from: (table: TTable) => AggregateQueryBuilder<TTable>;
  where: (condition: SQL | SQLWrapper) => AggregateQueryBuilder<TTable>;
  groupBy: (column: AnyColumnType | SQL | SQLWrapper) => AggregateQueryBuilder<TTable>;
  having: (condition: SQL | SQLWrapper) => AggregateQueryBuilder<TTable>;
};
