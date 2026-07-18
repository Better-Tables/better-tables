/**
 * @fileoverview Number column builder with specialized numeric handling methods.
 *
 * This module provides a specialized column builder for numeric columns,
 * including range filtering, currency formatting, percentage display, and number formatting.
 *
 * @module builders/number-column-builder
 */

import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Number column builder with number-specific methods.
 *
 * Extends the base column builder with specialized methods for numeric columns,
 * including range filtering, currency formatting, percentage display, and precision control.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value (defaults to `number`; narrowed by `.accessor()`)
 *
 * @example
 * ```typescript
 * const priceColumn = new NumberColumnBuilder<Product>()
 *   .id('price')
 *   .displayName('Price')
 *   .accessor(product => product.price)
 *   .currency({ currency: 'USD', locale: 'en-US' })
 *   .range(0, 1000, { step: 0.01 })
 *   .build();
 * ```
 */
export class NumberColumnBuilder<
  TData = unknown,
  TValue extends number = number,
  TId extends string = string,
> extends ColumnBuilder<TData, TValue, TId> {
  constructor() {
    super('number');
  }

  /**
   * Set the column identifier.
   *
   * Rebinds the builder's id type to the literal passed in, so subsequent
   * chained methods (and `build()`) see the narrowed id type.
   *
   * @param id - Unique column identifier
   * @returns A `NumberColumnBuilder` rebound to the id literal
   */
  override id<const K extends string>(id: K): NumberColumnBuilder<TData, TValue, K> {
    return super.id(id) as unknown as NumberColumnBuilder<TData, TValue, K>;;
  }

  /**
   * Set the data accessor function.
   *
   * Rebinds the builder's value type to the accessor's return type, so
   * subsequent chained methods see the narrowed numeric type.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns A `NumberColumnBuilder` rebound to the accessor's return type
   */
  override accessor<V extends number>(
    accessor: (data: TData) => V
  ): NumberColumnBuilder<TData, V, TId> {
    this.config.accessor = accessor as unknown as (data: TData) => TValue;
    return this as unknown as NumberColumnBuilder<TData, V, TId>;
  }

  /**
   * Set min/max range for number filtering.
   *
   * Configures numeric range filtering with validation, step size,
   * and null handling options.
   *
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @param options - Range configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const ageColumn = new NumberColumnBuilder<User>()
   *   .id('age')
   *   .displayName('Age')
   *   .accessor(user => user.age)
   *   .range(18, 100, {
   *     includeNull: false,
   *     step: 1,
   *     validation: (value) => value >= 18 || 'Must be 18 or older'
   *   })
   *   .build();
   * ```
   */
  range(
    min: number,
    max: number,
    options: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Step size for range inputs (default: 1) */
      step?: number;
      /** Custom validation for range values */
      validation?: (value: number) => boolean | string;
    } = {}
  ): this {
    const { includeNull = false, step = 1, validation } = options;

    const filterConfig: FilterConfig<number> = {
      operators: [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
      ],
      min,
      max,
      includeNull,
      ...(validation !== undefined && { validation }),
    };

    this.config.filter = { ...this.config.filter, ...filterConfig } as FilterConfig<TValue>;
    this.config.meta = {
      ...this.config.meta,
      range: { min, max, step },
    };
    return this;
  }

  /**
   * Set specific number operators for filtering.
   *
   * Configures which numeric filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of numeric filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const scoreColumn = new NumberColumnBuilder<Test>()
   *   .id('score')
   *   .displayName('Score')
   *   .accessor(test => test.score)
   *   .numberOperators(['equals', 'greaterThan', 'lessThan', 'between'])
   *   .build();
   * ```
   */
  numberOperators(
    operators: Array<
      | 'equals'
      | 'notEquals'
      | 'greaterThan'
      | 'greaterThanOrEqual'
      | 'lessThan'
      | 'lessThanOrEqual'
      | 'between'
      | 'notBetween'
    >
  ): this {
    return this.applyOperators(operators);
  }

  /**
   * Configure as currency column.
   *
   * Changes the column type to 'currency' and configures
   * currency-specific formatting and display options.
   *
   * @param options - Currency configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const priceColumn = new NumberColumnBuilder<Product>()
   *   .id('price')
   *   .displayName('Price')
   *   .accessor(product => product.price)
   *   .currency({
   *     currency: 'EUR',
   *     locale: 'de-DE',
   *     minimumFractionDigits: 2,
   *     showSymbol: true
   *   })
   *   .build();
   * ```
   */
  currency(
    options: {
      /** Currency code (default: 'USD') */
      currency?: string;
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Minimum fraction digits (default: 2) */
      minimumFractionDigits?: number;
      /** Maximum fraction digits (default: 2) */
      maximumFractionDigits?: number;
      /** Whether to display currency symbol (default: true) */
      showSymbol?: boolean;
    } = {}
  ): this {
    const {
      currency = 'USD',
      locale = 'en-US',
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
      showSymbol = true,
    } = options;

    this.config.type = 'currency';
    this.config.meta = {
      ...this.config.meta,
      currency: {
        currency,
        locale,
        minimumFractionDigits,
        maximumFractionDigits,
        showSymbol,
      },
    };
    return this;
  }

  /**
   * Configure as percentage column.
   *
   * Changes the column type to 'percentage' and configures
   * percentage-specific formatting and display options.
   *
   * @param options - Percentage configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const completionColumn = new NumberColumnBuilder<Task>()
   *   .id('completion')
   *   .displayName('Completion %')
   *   .accessor(task => task.completionPercentage)
   *   .percentage({
   *     locale: 'en-US',
   *     minimumFractionDigits: 0,
   *     maximumFractionDigits: 1,
   *     format: 'percentage'
   *   })
   *   .build();
   * ```
   */
  percentage(
    options: {
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Minimum fraction digits (default: 0) */
      minimumFractionDigits?: number;
      /** Maximum fraction digits (default: 2) */
      maximumFractionDigits?: number;
      /** Whether input is already in percentage (0-100) or decimal (0-1) format (default: 'decimal') */
      format?: 'decimal' | 'percentage';
    } = {}
  ): this {
    const {
      locale = 'en-US',
      minimumFractionDigits = 0,
      maximumFractionDigits = 2,
      format = 'decimal',
    } = options;

    this.config.type = 'percentage';
    this.config.meta = {
      ...this.config.meta,
      percentage: {
        locale,
        minimumFractionDigits,
        maximumFractionDigits,
        format,
      },
    };
    return this;
  }

  /**
   * Set number formatting options.
   *
   * Configures how numeric values are displayed, including
   * locale settings, decimal places, and notation styles.
   *
   * @param options - Number formatting configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const countColumn = new NumberColumnBuilder<Item>()
   *   .id('count')
   *   .displayName('Count')
   *   .accessor(item => item.count)
   *   .format({
   *     locale: 'en-US',
   *     minimumFractionDigits: 0,
   *     maximumFractionDigits: 0,
   *     useGrouping: true,
   *     notation: 'standard'
   *   })
   *   .build();
   * ```
   */
  format(
    options: {
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Minimum fraction digits */
      minimumFractionDigits?: number;
      /** Maximum fraction digits */
      maximumFractionDigits?: number;
      /** Whether to use grouping separators (default: true) */
      useGrouping?: boolean;
      /** Notation style (default: 'standard') */
      notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
    } = {}
  ): this {
    const {
      locale = 'en-US',
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping = true,
      notation = 'standard',
    } = options;

    this.config.meta = {
      ...this.config.meta,
      numberFormat: {
        locale,
        useGrouping,
        notation,
        ...(minimumFractionDigits !== undefined && { minimumFractionDigits }),
        ...(maximumFractionDigits !== undefined && { maximumFractionDigits }),
      },
    };
    return this;
  }

  /**
   * Set decimal precision for display.
   *
   * Configures the number of decimal places to show
   * for numeric values in the column.
   *
   * @param digits - Number of decimal places to display
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const ratingColumn = new NumberColumnBuilder<Review>()
   *   .id('rating')
   *   .displayName('Rating')
   *   .accessor(review => review.rating)
   *   .precision(2)
   *   .build();
   * ```
   */
  precision(digits: number): this {
    this.config.meta = {
      ...this.config.meta,
      precision: digits,
    };
    return this;
  }

  /**
   * Set number display as compact notation (e.g., 1K, 1M).
   *
   * Configures numeric values to be displayed in compact
   * notation for better readability of large numbers.
   *
   * @param options - Compact notation configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const viewsColumn = new NumberColumnBuilder<Video>()
   *   .id('views')
   *   .displayName('Views')
   *   .accessor(video => video.viewCount)
   *   .compact({
   *     locale: 'en-US',
   *     compactDisplay: 'short'
   *   })
   *   .build();
   * ```
   */
  compact(
    options: {
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Compactness style (default: 'short') */
      compactDisplay?: 'short' | 'long';
    } = {}
  ): this {
    const { locale = 'en-US', compactDisplay = 'short' } = options;

    this.config.meta = {
      ...this.config.meta,
      numberFormat: {
        ...((this.config.meta?.numberFormat as Record<string, unknown>) || {}),
        locale,
        notation: 'compact',
        compactDisplay,
      },
    };
    return this;
  }
}
