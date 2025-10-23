import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Number column builder with number-specific methods
 */
export class NumberColumnBuilder<TData = unknown> extends ColumnBuilder<TData, number> {
  constructor() {
    super('number');
  }

  /**
   * Set min/max range for number filtering
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
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };
    this.config.meta = {
      ...this.config.meta,
      range: { min, max, step },
    };
    return this;
  }

  /**
   * Set specific number operators
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
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Configure as currency column
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
   * Configure as percentage column
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
   * Set number formatting options
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
        minimumFractionDigits,
        maximumFractionDigits,
        useGrouping,
        notation,
      },
    };
    return this;
  }

  /**
   * Set decimal precision
   */
  precision(digits: number): this {
    this.config.meta = {
      ...this.config.meta,
      precision: digits,
    };
    return this;
  }

  /**
   * Set number display as compact notation (e.g., 1K, 1M)
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
        ...this.config.meta?.numberFormat,
        locale,
        notation: 'compact',
        compactDisplay,
      },
    };
    return this;
  }
}
