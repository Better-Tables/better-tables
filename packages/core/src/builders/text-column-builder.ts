import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Text column builder with text-specific methods
 */
export class TextColumnBuilder<TData = any> extends ColumnBuilder<TData, string> {
  constructor() {
    super('text');
  }

  /**
   * Enable search functionality with text operators
   */
  searchable(options: {
    /** Debounce delay in milliseconds (default: 300) */
    debounce?: number;
    /** Whether to include null values in search (default: false) */
    includeNull?: boolean;
    /** Custom validation for search input */
    validation?: (value: string) => boolean | string;
  } = {}): this {
    const { debounce = 300, includeNull = false, validation } = options;
    
    const filterConfig: FilterConfig<string> = {
      operators: ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
      debounce,
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };
    return this;
  }

  /**
   * Set specific text operators
   */
  textOperators(operators: Array<'contains' | 'equals' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty'>): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Configure for URL column type
   */
  asUrl(): this {
    this.config.type = 'url';
    return this;
  }

  /**
   * Configure for email column type
   */
  asEmail(): this {
    this.config.type = 'email';
    return this;
  }

  /**
   * Configure for phone column type
   */
  asPhone(): this {
    this.config.type = 'phone';
    return this;
  }

  /**
   * Set text truncation options
   */
  truncate(options: {
    /** Maximum characters to show (default: 100) */
    maxLength?: number;
    /** Whether to show tooltip with full text (default: true) */
    showTooltip?: boolean;
    /** Suffix to show when truncated (default: "...") */
    suffix?: string;
  } = {}): this {
    const { maxLength = 100, showTooltip = true, suffix = '...' } = options;
    
    this.config.meta = {
      ...this.config.meta,
      truncate: {
        maxLength,
        showTooltip,
        suffix,
      },
    };
    return this;
  }

  /**
   * Set text transformation options
   */
  transform(transformation: 'uppercase' | 'lowercase' | 'capitalize' | 'none' = 'none'): this {
    this.config.meta = {
      ...this.config.meta,
      textTransform: transformation,
    };
    return this;
  }
} 