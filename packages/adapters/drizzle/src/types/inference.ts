/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { InferSelectModel } from 'drizzle-orm';
import type { AnyTableType } from './core';

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