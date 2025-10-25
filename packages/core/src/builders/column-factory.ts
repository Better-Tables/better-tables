/**
 * @fileoverview Column factory for type-safe column creation and management.
 *
 * This module provides factory functions and utilities for creating column builders
 * with type safety, validation, and rapid prototyping capabilities.
 *
 * @module builders/column-factory
 */

import type { ColumnDefinition } from '../types/column';
import { BooleanColumnBuilder } from './boolean-column-builder';
import { ColumnBuilder } from './column-builder';
import { DateColumnBuilder } from './date-column-builder';
import { MultiOptionColumnBuilder } from './multi-option-column-builder';
import { NumberColumnBuilder } from './number-column-builder';
import { OptionColumnBuilder } from './option-column-builder';
import { TextColumnBuilder } from './text-column-builder';

/**
 * Column factory interface for type-safe column creation.
 *
 * Provides a fluent API for creating column builders with full type safety,
 * enabling IntelliSense and compile-time validation for column configurations.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 *   age: number;
 *   isActive: boolean;
 * }
 *
 * const factory = createColumnBuilder<User>();
 *
 * const nameColumn = factory.text()
 *   .id('name')
 *   .displayName('Full Name')
 *   .accessor(user => user.name)
 *   .searchable()
 *   .build();
 * ```
 */
export interface ColumnFactory<TData = unknown> {
  /** Create a text column builder */
  text(): TextColumnBuilder<TData>;

  /** Create a number column builder */
  number(): NumberColumnBuilder<TData>;

  /** Create a date column builder */
  date(): DateColumnBuilder<TData>;

  /** Create a boolean column builder */
  boolean(): BooleanColumnBuilder<TData>;

  /** Create an option (single-select) column builder */
  option(): OptionColumnBuilder<TData>;

  /** Create a multi-option (multi-select) column builder */
  multiOption(): MultiOptionColumnBuilder<TData>;

  /** Create a custom column builder for special types */
  custom<TValue = unknown>(type: 'json' | 'custom'): ColumnBuilder<TData, TValue>;
}

/**
 * Create a column factory for building type-safe columns
 *
 * @example
 * ```typescript
 ** // Create a column factory for a Contact type
 * const cb = createColumnBuilder<Contact>();
 *
 ** // Build columns using the fluent API
 * const columns = [
 *   cb.text()
 *     .id('name')
 *     .displayName('Full Name')
 *     .accessor(contact => `${contact.firstName} ${contact.lastName}`)
 *     .searchable()
 *     .build(),
 *
 *   cb.number()
 *     .id('age')
 *     .displayName('Age')
 *     .accessor(contact => contact.age)
 *     .range(0, 120)
 *     .build(),
 *
 *   cb.option()
 *     .id('status')
 *     .displayName('Status')
 *     .accessor(contact => contact.status)
 *     .options([
 *       { value: 'active', label: 'Active', color: 'green' },
 *       { value: 'inactive', label: 'Inactive', color: 'red' },
 *     ])
 *     .build(),
 * ];
 * ```
 */
export function createColumnBuilder<TData = unknown>(): ColumnFactory<TData> {
  return {
    text: () => new TextColumnBuilder<TData>(),
    number: () => new NumberColumnBuilder<TData>(),
    date: () => new DateColumnBuilder<TData>(),
    boolean: () => new BooleanColumnBuilder<TData>(),
    option: () => new OptionColumnBuilder<TData>(),
    multiOption: () => new MultiOptionColumnBuilder<TData>(),
    custom: <TValue = unknown>(type: 'json' | 'custom') => new ColumnBuilder<TData, TValue>(type),
  };
}

/**
 * Global column factory function (not type-safe).
 *
 * Provides a global factory instance for cases where type safety is not needed
 * or when working with dynamic data types. Use this when you don't have a
 * specific data type or need maximum flexibility.
 *
 * @example
 * ```typescript
 * // Create columns without type safety
 * const columns = [
 *   column.text()
 *     .id('name')
 *     .displayName('Name')
 *     .accessor(data => data.name)
 *     .searchable()
 *     .build(),
 *
 *   column.number()
 *     .id('count')
 *     .displayName('Count')
 *     .accessor(data => data.count)
 *     .range(0, 1000)
 *     .build(),
 * ];
 * ```
 */
export const column = createColumnBuilder();

/**
 * Utility function to create a column builder with explicit type.
 *
 * Provides a convenient way to create a typed column factory with
 * a shorter, more readable syntax.
 *
 * @template TData - The type of row data
 * @returns Typed column factory
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * // Create a typed column builder
 * const cb = createTypedColumnBuilder<User>();
 *
 * // Or use the shorter alias
 * const cb = typed<User>();
 *
 * const userColumns = [
 *   cb.text().id('name').displayName('Name').accessor(u => u.name).build(),
 *   cb.text().id('email').displayName('Email').accessor(u => u.email).build(),
 * ];
 * ```
 */
export function createTypedColumnBuilder<TData>(): ColumnFactory<TData> {
  return createColumnBuilder<TData>();
}

/**
 * Shorter alias for createTypedColumnBuilder.
 *
 * Provides a more concise way to create typed column builders
 * for improved readability in column definitions.
 *
 * @template TData - The type of row data
 * @returns Typed column factory
 *
 * @example
 * ```typescript
 * const cb = typed<User>();
 * const columns = [
 *   cb.text().id('name').displayName('Name').build(),
 * ];
 * ```
 */
export const typed = createTypedColumnBuilder;

/**
 * Utility function to create multiple column builders at once.
 *
 * Creates a set of typed column factories for different data types,
 * useful when building tables for multiple entities in the same application.
 *
 * @template T - Record of data types mapped to keys
 * @param types - Object with keys as names and values as type placeholders
 * @returns Object with typed column factories for each key
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * interface Order {
 *   id: string;
 *   userId: string;
 *   total: number;
 *   status: string;
 * }
 *
 * interface Product {
 *   id: string;
 *   name: string;
 *   price: number;
 *   category: string;
 * }
 *
 * // Create multiple column builders
 * const { users, orders, products } = createColumnBuilders({
 *   users: {} as User,
 *   orders: {} as Order,
 *   products: {} as Product,
 * });
 *
 * // Now you can use them independently
 * const userColumns = [
 *   users.text().id('name').displayName('Name').accessor(u => u.name).build(),
 *   users.text().id('email').displayName('Email').accessor(u => u.email).build(),
 * ];
 *
 * const orderColumns = [
 *   orders.number().id('total').displayName('Total').accessor(o => o.total).build(),
 *   orders.option().id('status').displayName('Status').accessor(o => o.status).build(),
 * ];
 * ```
 */
export function createColumnBuilders<T extends Record<string, unknown>>(
  types: T
): { [K in keyof T]: ColumnFactory<T[K]> } {
  const result = {} as { [K in keyof T]: ColumnFactory<T[K]> };

  for (const key in types) {
    result[key] = createColumnBuilder<T[typeof key]>();
  }

  return result;
}

/**
 * Utility function to validate column definitions.
 *
 * Performs comprehensive validation on an array of column definitions,
 * checking for required fields, duplicate IDs, and other common issues.
 *
 * @param columns - Array of column definitions to validate
 * @returns Validation result with success status and error messages
 *
 * @example
 * ```typescript
 * const cb = createColumnBuilder<Contact>();
 *
 * const columns = [
 *   cb.text().id('name').displayName('Name').accessor(c => c.name).build(),
 *   cb.number().id('age').displayName('Age').accessor(c => c.age).build(),
 * ];
 *
 * // Validate all columns
 * const validation = validateColumns(columns);
 * if (!validation.valid) {
 *   console.error('Column validation errors:', validation.errors);
 *   // Handle validation errors
 * }
 * ```
 */
export function validateColumns(columns: ColumnDefinition[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];

    // Check required fields
    if (!column.id) {
      errors.push(`Column at index ${i} is missing required 'id' field`);
    }

    if (!column.displayName) {
      errors.push(`Column at index ${i} is missing required 'displayName' field`);
    }

    if (!column.accessor) {
      errors.push(`Column at index ${i} is missing required 'accessor' field`);
    }

    if (!column.type) {
      errors.push(`Column at index ${i} is missing required 'type' field`);
    }

    // Check for duplicate IDs
    if (column.id && usedIds.has(column.id)) {
      errors.push(`Duplicate column ID '${column.id}' found at index ${i}`);
    } else if (column.id) {
      usedIds.add(column.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Utility function to create a column definition with minimal configuration.
 *
 * Provides a quick way to create column definitions for rapid prototyping
 * or simple use cases where the full builder API is not needed.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value
 * @param id - Unique column identifier
 * @param displayName - Human-readable column name
 * @param accessor - Function to extract value from row data
 * @param options - Optional column configuration
 * @returns Complete column definition
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 *
 * // Quick column creation
 * const columns = [
 *   quickColumn('name', 'Name', user => user.name),
 *   quickColumn('email', 'Email', user => user.email, { type: 'email' }),
 *   quickColumn('age', 'Age', user => user.age, { type: 'number' }),
 *   quickColumn('status', 'Status', user => user.isActive ? 'Active' : 'Inactive', {
 *     type: 'option',
 *     sortable: true,
 *     filterable: true,
 *     width: 120
 *   }),
 * ];
 * ```
 */
export function quickColumn<TData, TValue = unknown>(
  id: string,
  displayName: string,
  accessor: (data: TData) => TValue,
  options: {
    type?:
      | 'text'
      | 'number'
      | 'date'
      | 'boolean'
      | 'option'
      | 'multiOption'
      | 'email'
      | 'url'
      | 'phone';
    sortable?: boolean;
    filterable?: boolean;
    width?: number;
  } = {}
) {
  const { type = 'text', sortable = true, filterable = true, width } = options;

  const builder = new ColumnBuilder<TData, TValue>(type);

  const column = builder
    .id(id)
    .displayName(displayName)
    .accessor(accessor)
    .sortable(sortable)
    .filterable(filterable);

  if (width) {
    column.width(width);
  }

  return column.build();
}
