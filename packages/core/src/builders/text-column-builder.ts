/**
 * @fileoverview Text column builder with specialized text handling methods.
 *
 * This module provides a specialized column builder for text-based columns,
 * including search functionality, text transformations, and type conversions.
 *
 * @module builders/text-column-builder
 */

import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Text column builder with text-specific methods.
 *
 * Extends the base column builder with specialized methods for text columns,
 * including search functionality, text transformations, and type conversions.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value (defaults to `string`; narrowed by `.accessor()`)
 *
 * @example
 * ```typescript
 * const nameColumn = new TextColumnBuilder<User>()
 *   .id('name')
 *   .displayName('Full Name')
 *   .accessor(user => user.name)
 *   .searchable({ debounce: 500 })
 *   .transform('capitalize')
 *   .truncate({ maxLength: 50 })
 *   .build();
 * ```
 */
export class TextColumnBuilder<
  TData = unknown,
  TValue extends string = string,
  TId extends string = string,
> extends ColumnBuilder<TData, TValue, TId> {
  constructor() {
    super('text');
  }

  /**
   * Set the column identifier.
   *
   * Rebinds the builder's id type to the literal passed in, so subsequent
   * chained methods (and `build()`) see the narrowed id type.
   *
   * @param id - Unique column identifier
   * @returns A `TextColumnBuilder` rebound to the id literal
   */
  override id<const K extends string>(id: K): TextColumnBuilder<TData, TValue, K> {
    this.config.id = id as unknown as TId;
    return this as unknown as TextColumnBuilder<TData, TValue, K>;
  }

  /**
   * Set the data accessor function.
   *
   * Rebinds the builder's value type to the accessor's return type, so
   * subsequent chained methods see the narrowed string type.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns A `TextColumnBuilder` rebound to the accessor's return type
   */
  override accessor<V extends string>(
    accessor: (data: TData) => V
  ): TextColumnBuilder<TData, V, TId> {
    this.config.accessor = accessor as unknown as (data: TData) => TValue;
    return this as unknown as TextColumnBuilder<TData, V, TId>;
  }

  /**
   * Enable search functionality with text operators.
   *
   * Configures the column for text-based searching with debouncing,
   * null handling, and custom validation options.
   *
   * @param options - Search configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const searchableColumn = new TextColumnBuilder<User>()
   *   .id('email')
   *   .displayName('Email')
   *   .accessor(user => user.email)
   *   .searchable({
   *     debounce: 500,
   *     includeNull: false,
   *     validation: (value) => value.length > 2 || 'Minimum 3 characters'
   *   })
   *   .build();
   * ```
   */
  searchable(
    options: {
      /** Debounce delay in milliseconds (default: 300) */
      debounce?: number;
      /** Whether to include null values in search (default: false) */
      includeNull?: boolean;
      /** Custom validation for search input */
      validation?: (value: string) => boolean | string;
    } = {}
  ): this {
    const { debounce = 300, includeNull = false, validation } = options;

    const filterConfig: FilterConfig<string> = {
      operators: ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
      debounce,
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig } as FilterConfig<TValue>;
    return this;
  }

  /**
   * Set specific text operators for filtering.
   *
   * Configures which text-based filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of text filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const filteredColumn = new TextColumnBuilder<User>()
   *   .id('name')
   *   .displayName('Name')
   *   .accessor(user => user.name)
   *   .textOperators(['contains', 'equals', 'startsWith'])
   *   .build();
   * ```
   */
  textOperators(
    operators: Array<'contains' | 'equals' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty'>
  ): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Configure column as URL type.
   *
   * Changes the column type to 'url' for specialized URL handling,
   * including validation and formatting.
   *
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const urlColumn = new TextColumnBuilder<User>()
   *   .id('website')
   *   .displayName('Website')
   *   .accessor(user => user.website)
   *   .asUrl()
   *   .build();
   * ```
   */
  asUrl(): this {
    this.config.type = 'url';
    return this;
  }

  /**
   * Configure column as email type.
   *
   * Changes the column type to 'email' for specialized email handling,
   * including validation and formatting.
   *
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const emailColumn = new TextColumnBuilder<User>()
   *   .id('email')
   *   .displayName('Email Address')
   *   .accessor(user => user.email)
   *   .asEmail()
   *   .build();
   * ```
   */
  asEmail(): this {
    this.config.type = 'email';
    return this;
  }

  /**
   * Configure column as phone type.
   *
   * Changes the column type to 'phone' for specialized phone number handling,
   * including validation and formatting.
   *
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const phoneColumn = new TextColumnBuilder<User>()
   *   .id('phone')
   *   .displayName('Phone Number')
   *   .accessor(user => user.phone)
   *   .asPhone()
   *   .build();
   * ```
   */
  asPhone(): this {
    this.config.type = 'phone';
    return this;
  }

  /**
   * Set text truncation options.
   *
   * Configures how long text values are displayed, including
   * maximum length, tooltip behavior, and truncation suffix.
   *
   * @param options - Truncation configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const truncatedColumn = new TextColumnBuilder<User>()
   *   .id('description')
   *   .displayName('Description')
   *   .accessor(user => user.description)
   *   .truncate({
   *     maxLength: 100,
   *     showTooltip: true,
   *     suffix: '...'
   *   })
   *   .build();
   * ```
   */
  truncate(
    options: {
      /** Maximum characters to show (default: 100) */
      maxLength?: number;
      /** Suffix to show when truncated (default: "...") */
      suffix?: string;
      /** Show tooltip with full text when truncated (default: true) */
      showTooltip?: boolean;
    } = {}
  ): this {
    const { maxLength = 100, suffix = '...', showTooltip = true } = options;

    this.config.meta = {
      ...this.config.meta,
      truncate: {
        maxLength,
        suffix,
        showTooltip,
      },
    };
    return this;
  }

  /**
   * Set text transformation options.
   *
   * Applies text case transformations to displayed values,
   * such as uppercase, lowercase, or capitalize.
   *
   * @param transformation - Text transformation to apply
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const transformedColumn = new TextColumnBuilder<User>()
   *   .id('name')
   *   .displayName('Name')
   *   .accessor(user => user.name)
   *   .transform('capitalize')
   *   .build();
   * ```
   */
  transform(transformation: 'uppercase' | 'lowercase' | 'capitalize' | 'none' = 'none'): this {
    this.config.meta = {
      ...this.config.meta,
      textTransform: transformation,
    };
    return this;
  }
}
