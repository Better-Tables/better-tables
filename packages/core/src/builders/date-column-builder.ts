import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Date column builder with date-specific methods
 */
export class DateColumnBuilder<TData = any> extends ColumnBuilder<TData, Date> {
  constructor() {
    super('date');
  }

  /**
   * Set date format for display
   */
  format(formatString: string, options: {
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
    /** Time zone for formatting (default: 'UTC') */
    timeZone?: string;
    /** Whether to show time (default: false) */
    showTime?: boolean;
    /** Whether to show relative time (e.g., "2 hours ago") (default: false) */
    showRelative?: boolean;
  } = {}): this {
    const { locale = 'en-US', timeZone = 'UTC', showTime = false, showRelative = false } = options;
    
    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        format: formatString,
        locale,
        timeZone,
        showTime,
        showRelative,
      },
    };
    return this;
  }

  /**
   * Set specific date operators
   */
  dateOperators(operators: Array<'is' | 'isNot' | 'before' | 'after' | 'isToday' | 'isYesterday' | 'isThisWeek' | 'isThisMonth' | 'isThisYear'>): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Enable date range filtering
   */
  dateRange(options: {
    /** Whether to include null values (default: false) */
    includeNull?: boolean;
    /** Custom validation for date values */
    validation?: (value: Date) => boolean | string;
    /** Minimum date */
    minDate?: Date;
    /** Maximum date */
    maxDate?: Date;
  } = {}): this {
    const { includeNull = false, validation, minDate, maxDate } = options;
    
    const filterConfig: FilterConfig<Date> = {
      operators: ['is', 'isNot', 'before', 'after', 'isToday', 'isYesterday', 'isThisWeek', 'isThisMonth', 'isThisYear'],
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };
    
    if (minDate || maxDate) {
      this.config.meta = {
        ...this.config.meta,
        dateRange: { minDate, maxDate },
      };
    }
    
    return this;
  }

  /**
   * Configure as date-only (no time)
   */
  dateOnly(options: {
    /** Date format (default: 'yyyy-MM-dd') */
    format?: string;
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
  } = {}): this {
    const { format = 'yyyy-MM-dd', locale = 'en-US' } = options;
    
    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        format,
        locale,
        showTime: false,
      },
    };
    return this;
  }

  /**
   * Configure as date-time
   */
  dateTime(options: {
    /** Date-time format (default: 'yyyy-MM-dd HH:mm:ss') */
    format?: string;
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
    /** Time zone for formatting (default: 'UTC') */
    timeZone?: string;
  } = {}): this {
    const { format = 'yyyy-MM-dd HH:mm:ss', locale = 'en-US', timeZone = 'UTC' } = options;
    
    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        format,
        locale,
        timeZone,
        showTime: true,
      },
    };
    return this;
  }

  /**
   * Configure as time-only
   */
  timeOnly(options: {
    /** Time format (default: 'HH:mm:ss') */
    format?: string;
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
    /** Time zone for formatting (default: 'UTC') */
    timeZone?: string;
    /** Whether to show seconds (default: true) */
    showSeconds?: boolean;
  } = {}): this {
    const { format = 'HH:mm:ss', locale = 'en-US', timeZone = 'UTC', showSeconds = true } = options;
    
    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        format,
        locale,
        timeZone,
        showTime: true,
        showSeconds,
      },
    };
    return this;
  }

  /**
   * Show relative time (e.g., "2 hours ago", "in 3 days")
   */
  relative(options: {
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
    /** Whether to show numeric values (default: 'auto') */
    numeric?: 'always' | 'auto';
    /** Style of relative time (default: 'long') */
    style?: 'long' | 'short' | 'narrow';
  } = {}): this {
    const { locale = 'en-US', numeric = 'auto', style = 'long' } = options;
    
    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        ...this.config.meta?.dateFormat,
        locale,
        showRelative: true,
        relativeOptions: {
          numeric,
          style,
        },
      },
    };
    return this;
  }

  /**
   * Set date sorting to be chronological
   */
  chronological(): this {
    this.config.meta = {
      ...this.config.meta,
      sortType: 'chronological',
    };
    return this;
  }
} 