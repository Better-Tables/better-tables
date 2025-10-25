/**
 * @fileoverview TypeScript utility types for Drizzle ORM schema inference
 * @module @better-tables/drizzle-adapter/schema-inference
 *
 * @description
 * Provides comprehensive TypeScript utility types for working with Drizzle ORM schemas
 * in a type-safe manner. These types enable:
 * - Inferring table and column types from schemas
 * - Building nested types for related data
 * - Creating type-safe query builders
 * - Extracting relationship information
 * - Flattening nested data structures
 *
 * These utility types are used throughout the adapter to provide full type safety
 * when working with Drizzle schemas, ensuring that relationships, columns, and queries
 * are all properly typed at compile time.
 *
 * @example
 * ```typescript
 * import { users, profiles } from './schema';
 *
 * // Infer select model
 * type User = InferTableSelectModel<typeof users>;
 *
 * // Build nested type with relations
 * type UserWithProfile = BuildNestedType<
 *   typeof users,
 *   Relations<typeof users>,
 *   { users: typeof users; profiles: typeof profiles }
 * >;
 *
 * // Flatten nested structure
 * type FlatUser = FlattenNestedType<UserWithProfile>;
 * ```
 *
 * @see {@link https://www.typescriptlang.org/docs/handbook/utility-types.html|TypeScript Utility Types}
 */

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
 * Utility type to extract the table type from a Drizzle schema.
 *
 * @template T - The type to check and extract
 * @description Ensures that the type T is a valid Drizzle table type
 * @returns The table type if valid, `never` otherwise
 *
 * @example
 * ```typescript
 * type UserTable = InferTableType<typeof users>; // SQLiteTable
 * type Invalid = InferTableType<string>; // never
 * ```
 *
 * @since 1.0.0
 */
export type InferTableType<T> = T extends AnyTableType ? T : never;

/**
 * Utility type to extract all table types from a schema.
 *
 * @template T - The schema record containing table definitions
 * @description Maps over all tables in a schema and extracts their types
 * @returns A mapped type with all table types from the schema
 *
 * @example
 * ```typescript
 * const schema = { users, posts, comments };
 * type SchemaTables = InferSchemaTables<typeof schema>;
 * // {
 * //   users: SQLiteTable,
 * //   posts: SQLiteTable,
 * //   comments: SQLiteTable
 * // }
 * ```
 *
 * @since 1.0.0
 */
export type InferSchemaTables<T extends Record<string, AnyTableType>> = {
  [K in keyof T]: InferTableType<T[K]>;
};

/**
 * Utility type to extract the select model from a Drizzle table.
 *
 * This represents the shape of data returned when selecting from a table.
 *
 * @template T - The Drizzle table type
 * @description Extracts the TypeScript type for the data returned from SELECT queries
 * @returns The inferred select model type
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * type User = InferTableSelectModel<typeof users>;
 * // { id: string, email: string, name: string, ... }
 * ```
 *
 * @see {@link InferSelectModel} from Drizzle ORM
 * @since 1.0.0
 */
export type InferTableSelectModel<T extends AnyTableType> = InferSelectModel<T>;

/**
 * Utility type to extract the insert model from a Drizzle table.
 *
 * This represents the shape of data required when inserting into a table.
 *
 * @template T - The Drizzle table type
 * @description Extracts the TypeScript type for the data required for INSERT operations
 * @returns The inferred insert model type
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * type NewUser = InferTableInsertModel<typeof users>;
 * // { email: string, name: string, ... }
 * ```
 *
 * @see {@link InferInsertModel} from Drizzle ORM
 * @since 1.0.0
 */
export type InferTableInsertModel<T extends AnyTableType> = InferInsertModel<T>;

/**
 * Utility type to extract relations from a Drizzle schema.
 *
 * @template T - The relations record type
 * @description Returns the relations type as-is for type inference
 * @returns The relations type
 *
 * @since 1.0.0
 */
export type InferSchemaRelations<T extends Record<string, Relations>> = T;

/**
 * Utility type to build a nested type from a main table and its relations.
 *
 * This type combines the main table's data with nested related data,
 * handling both one-to-one and one-to-many relationships.
 *
 * @template TMainTable - The main table type
 * @template TRelations - The relations type from Drizzle
 * @template TSchema - The complete schema containing all tables
 * @description Builds a nested type by combining the main table's select model with related tables
 * @returns A nested type with main table properties and nested relations
 *
 * @example
 * ```typescript
 * type UserWithProfile = BuildNestedType<
 *   typeof users,
 *   typeof usersRelations,
 *   { users: typeof users; profiles: typeof profiles }
 * >;
 * // User with nested profile relation
 * ```
 *
 * @since 1.0.0
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
 * Utility type to extract all column types from a Drizzle table.
 *
 * @template T - The Drizzle table type
 * @description Accesses Drizzle's internal column metadata to extract column types
 * @returns A record of column names to their Drizzle column types
 *
 * @example
 * ```typescript
 * type UserColumns = InferTableColumns<typeof users>;
 * // {
 * //   id: SQLiteColumn,
 * //   email: SQLiteColumn,
 * //   name: SQLiteColumn
 * // }
 * ```
 *
 * @since 1.0.0
 */
export type InferTableColumns<T extends AnyTableType> = T['_']['columns'];

/**
 * Utility type to get a specific column from a table by column name.
 *
 * @template T - The Drizzle table type
 * @template K - The column name as a key
 * @description Extracts a specific column's type from a table
 * @returns The Drizzle column type for the specified column
 *
 * @example
 * ```typescript
 * type IdColumn = GetTableColumn<typeof users, 'id'>;
 * // SQLiteColumn type for the id column
 * ```
 *
 * @since 1.0.0
 */
export type GetTableColumn<
  T extends AnyTableType,
  K extends keyof InferTableColumns<T>,
> = InferTableColumns<T>[K];

/**
 * Utility type to check if a Drizzle column is nullable.
 *
 * @template T - The Drizzle column type
 * @description Checks the `notNull` property to determine nullability
 * @returns `true` if the column is nullable, `false` otherwise
 *
 * @example
 * ```typescript
 * type IsEmailNullable = IsColumnNullable<typeof users.email>;
 * // true if email can be null, false otherwise
 * ```
 *
 * @since 1.0.0
 */
export type IsColumnNullable<T extends AnyColumn> = T['notNull'] extends false ? true : false;

/**
 * Utility type to extract the base data type from a Drizzle column.
 *
 * @template T - The Drizzle column type
 * @description Extracts the underlying data type (e.g., 'string', 'number', 'boolean')
 * @returns The inferred column data type
 *
 * @example
 * ```typescript
 * type EmailType = InferColumnType<typeof users.email>;
 * // 'string' or whatever the email column's data type is
 * ```
 *
 * @since 1.0.0
 */
export type InferColumnType<T extends AnyColumn> = T['dataType'];

/**
 * Utility type to create a flattened type from nested relationships.
 *
 * Recursively flattens nested object structures while preserving array types.
 *
 * @template T - The nested type to flatten
 * @description Converts nested objects into their flat representation
 * @returns A flattened version of the type
 *
 * @example
 * ```typescript
 * type Nested = { user: { profile: { bio: string } } };
 * type Flat = FlattenNestedType<Nested>;
 * // Flattened version removes the nesting
 * ```
 *
 * @since 1.0.0
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
 * Utility type to create a type with dot notation access for nested properties.
 *
 * Builds a type where nested properties are accessible via dot notation (e.g., "profile.bio").
 *
 * @template T - The type to create dot notation for
 * @template Prefix - The prefix for the current nesting level
 * @description Creates dot-notation paths for accessing nested properties
 * @returns A type with dot notation access to all nested properties
 *
 * @example
 * ```typescript
 * type User = { id: string; profile: { bio: string } };
 * type UserWithDotNotation = DotNotationType<User>;
 * // { id: string, profile: User['profile'], 'profile.bio': string }
 * ```
 *
 * @since 1.0.0
 */
export type DotNotationType<T, Prefix extends string = ''> = {
  [K in keyof T as K extends string
    ? Prefix extends ''
      ? K
      : `${Prefix}.${K}`
    : never]: T[K] extends Record<string, unknown>
    ? T[K] extends Array<infer U>
      ? U extends Record<string, unknown>
        ? DotNotationType<U, Prefix extends '' ? K & string : `${Prefix}.${K & string}`>
        : T[K]
      : DotNotationType<T[K], Prefix extends '' ? K & string : `${Prefix}.${K & string}`>
    : T[K];
};

/**
 * Utility type to extract all possible column paths from a schema.
 *
 * Creates a union type of all accessible columns, including nested relationship columns.
 *
 * @template TSchema - The complete schema with all tables
 * @template TMainTable - The main table key
 * @template TRelations - The relations definition
 * @description Maps all columns from the main table and related tables into dot notation paths
 * @returns A record type with all possible column paths
 *
 * @example
 * ```typescript
 * type ColumnPaths = ExtractColumnPaths<
 *   { users: typeof users; profiles: typeof profiles },
 *   'users',
 *   { profile: { type: 'one', table: 'profiles', ... } }
 * >;
 * // { id: Column, email: Column, 'profile.bio': Column, ... }
 * ```
 *
 * @since 1.0.0
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
            ? `${K & string}.${FK & string}`
            : never]: InferTableColumns<TSchema[TTable]>[FK];
        }
      : never
    : never;
};

/**
 * Utility type to validate that a column access is safe.
 *
 * Ensures that only valid column paths can be accessed from a schema.
 *
 * @template TColumnPaths - The column paths type
 * @template TColumnId - The column identifier to validate
 * @description Validates that a column ID exists in the column paths
 * @returns The column type if valid, `never` otherwise
 *
 * @example
 * ```typescript
 * type IsValid = ValidateColumnAccess<ColumnPaths, 'email'>; // Column type
 * type IsInvalid = ValidateColumnAccess<ColumnPaths, 'bad'>; // never
 * ```
 *
 * @since 1.0.0
 */
export type ValidateColumnAccess<
  TColumnPaths,
  TColumnId extends string,
> = TColumnId extends keyof TColumnPaths ? TColumnPaths[TColumnId] : never;

/**
 * Utility type to create aggregate types for numeric operations.
 *
 * Defines the structure for aggregate function results (count, sum, avg, min, max).
 *
 * @template T - The base type to aggregate over
 * @description Creates a type with aggregate function results
 * @returns A type containing all possible aggregate results
 *
 * @example
 * ```typescript
 * type AgeAggregate = AggregateType<number>;
 * // { count: number, sum: number, avg: number, min: number, max: number }
 * ```
 *
 * @since 1.0.0
 */
export type AggregateType<T> = {
  count: number;
  sum: T extends number ? number : never;
  avg: T extends number ? number : never;
  min: T;
  max: T;
};

/**
 * Utility type to create virtual column types.
 *
 * Allows a column to represent either the raw value, an aggregate, or an array.
 *
 * @template T - The base type
 * @description Creates a union type of possible column representations
 * @returns A union type of the base value, aggregates, or arrays
 *
 * @example
 * ```typescript
 * type VirtualColumn = VirtualColumnType<string>;
 * // string | AggregateType<string> | Array<string>
 * ```
 *
 * @since 1.0.0
 */
export type VirtualColumnType<T> = T | AggregateType<T> | Array<T>;

/**
 * Utility type to extract relationship information from Drizzle relations.
 *
 * Extracts type information about relationships including cardinality, target table,
 * fields, and references.
 *
 * @template T - The relations type
 * @description Extracts metadata about all relationships
 * @returns A record of relationship names to their metadata
 *
 * @example
 * ```typescript
 * type RelationsInfo = ExtractRelationshipInfo<typeof usersRelations>;
 * // { profile: { type: 'one', table: ..., fields: ..., ... } }
 * ```
 *
 * @since 1.0.0
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
 * Utility type to create a type-safe column accessor function.
 *
 * @template TData - The data type to access from
 * @template TValue - The value type to return
 * @description Defines a function that extracts a value from data
 * @returns A function type that extracts a value from data
 *
 * @example
 * ```typescript
 * type EmailAccessor = ColumnAccessor<User, string>;
 * // (data: User) => string
 * ```
 *
 * @since 1.0.0
 */
export type ColumnAccessor<TData, TValue> = (data: TData) => TValue;

/**
 * Utility type to create a type-safe filter function.
 *
 * @template TValue - The value type to filter
 * @description Defines a function that evaluates whether a value matches a condition
 * @returns A function type that returns a boolean
 *
 * @example
 * ```typescript
 * type StringFilter = FilterFunction<string>;
 * // (value: string) => boolean
 * ```
 *
 * @since 1.0.0
 */
export type FilterFunction<TValue> = (value: TValue) => boolean;

/**
 * Utility type to create a type-safe sort comparator function.
 *
 * @template TValue - The value type to compare
 * @description Defines a function that compares two values for sorting
 * @returns A function type that returns a comparison number
 *
 * @example
 * ```typescript
 * type NumberComparator = SortComparator<number>;
 * // (a: number, b: number) => number
 * ```
 *
 * @since 1.0.0
 */
export type SortComparator<TValue> = (a: TValue, b: TValue) => number;

/**
 * Utility type to extract the return type of a Drizzle query.
 *
 * Extracts the actual return type from a Promise if applicable.
 *
 * @template T - The query type (may be a Promise)
 * @description Unwraps Promise types to get the underlying result type
 * @returns The unwrapped result type
 *
 * @example
 * ```typescript
 * type QueryResult = InferQueryResult<Promise<User[]>>;
 * // User[]
 * ```
 *
 * @since 1.0.0
 */
export type InferQueryResult<T> = T extends Promise<infer R> ? R : T;

/**
 * Utility type to define a type-safe query builder interface.
 *
 * Provides a fluent API for building SQL queries with proper type safety.
 *
 * @template TTable - The table type this builder works with
 * @description Defines a query builder with all standard SQL operations
 * @returns A query builder interface with full type safety
 *
 * @example
 * ```typescript
 * const builder: QueryBuilder<typeof users> = {
 *   select: () => builder,
 *   from: (table) => builder,
 *   // ... all methods
 * };
 * ```
 *
 * @since 1.0.0
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
 * Utility type to define a type-safe aggregate query builder interface.
 *
 * Specialized query builder for aggregate functions (COUNT, SUM, AVG, etc.).
 *
 * @template TTable - The table type this builder works with
 * @description Defines an aggregate query builder with group-by capabilities
 * @returns An aggregate query builder interface
 *
 * @example
 * ```typescript
 * const aggBuilder: AggregateQueryBuilder<typeof users> = {
 *   select: (aggregates) => aggBuilder,
 *   from: (table) => aggBuilder,
 *   // ... aggregate methods
 * };
 * ```
 *
 * @since 1.0.0
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
