/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { AnyTableType } from './core';
import type { InferColumnType } from './inference';

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