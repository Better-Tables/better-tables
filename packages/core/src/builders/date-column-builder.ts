/**
 * @fileoverview Date column builder with specialized date handling methods.
 *
 * This module provides a specialized column builder for date columns,
 * including date formatting, range filtering, and relative time display.
 *
 * @module builders/date-column-builder
 */

import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Date column builder with date-specific methods.
 *
 * Extends the base column builder with specialized methods for date columns,
 * including formatting, range filtering, and relative time display.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const createdColumn = new DateColumnBuilder<User>()
 *   .id('createdAt')
 *   .displayName('Created')
 *   .accessor(user => user.createdAt)
 *   .format('MMM dd, yyyy', { locale: 'en-US' })
 *   .dateRange({ includeNull: false })
 *   .build();
 * ```
 */
export class DateColumnBuilder<TData = unknown> extends ColumnBuilder<TData, Date> {
  constructor() {
    super('date');
  }

  /**
   * Set date format for display.
   *
   * Configures how date values are formatted and displayed,
   * including locale, timezone, and time display options.
   *
   * @param formatString - Date format string
   * @param options - Formatting configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const dateColumn = new DateColumnBuilder<Event>()
   *   .id('eventDate')
   *   .displayName('Event Date')
   *   .accessor(event => event.date)
   *   .format('MMMM dd, yyyy', {
   *     locale: 'en-US',
   *     timeZone: 'America/New_York',
   *     showTime: false
   *   })
   *   .build();
   * ```
   */
  format(
    formatString: string,
    options: {
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Time zone for formatting (default: 'UTC') */
      timeZone?: string;
      /** Whether to show time (default: false) */
      showTime?: boolean;
      /** Whether to show relative time (e.g., "2 hours ago") (default: false) */
      showRelative?: boolean;
    } = {}
  ): this {
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
   * Set specific date operators for filtering.
   *
   * Configures which date-based filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of date filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const dateColumn = new DateColumnBuilder<Event>()
   *   .id('eventDate')
   *   .displayName('Event Date')
   *   .accessor(event => event.date)
   *   .dateOperators(['is', 'before', 'after', 'isToday', 'isThisWeek'])
   *   .build();
   * ```
   */
  dateOperators(
    operators: Array<
      | 'is'
      | 'isNot'
      | 'before'
      | 'after'
      | 'isToday'
      | 'isYesterday'
      | 'isThisWeek'
      | 'isThisMonth'
      | 'isThisYear'
    >
  ): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Enable date range filtering.
   *
   * Configures comprehensive date filtering with validation,
   * null handling, and optional min/max date constraints.
   *
   * @param options - Date range configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const dateColumn = new DateColumnBuilder<Event>()
   *   .id('eventDate')
   *   .displayName('Event Date')
   *   .accessor(event => event.date)
   *   .dateRange({
   *     includeNull: false,
   *     minDate: new Date('2024-01-01'),
   *     maxDate: new Date('2024-12-31'),
   *     validation: (date) => date >= new Date() || 'Event must be in the future'
   *   })
   *   .build();
   * ```
   */
  dateRange(
    options: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for date values */
      validation?: (value: Date) => boolean | string;
      /** Minimum date */
      minDate?: Date;
      /** Maximum date */
      maxDate?: Date;
    } = {}
  ): this {
    const { includeNull = false, validation, minDate, maxDate } = options;

    const filterConfig: FilterConfig<Date> = {
      operators: [
        'is',
        'isNot',
        'before',
        'after',
        'isToday',
        'isYesterday',
        'isThisWeek',
        'isThisMonth',
        'isThisYear',
      ],
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
   * Configure as date-only (no time).
   *
   * Sets the column to display only date information without time,
   * useful for birth dates, event dates, etc.
   *
   * @param options - Date-only configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const birthDateColumn = new DateColumnBuilder<User>()
   *   .id('birthDate')
   *   .displayName('Birth Date')
   *   .accessor(user => user.birthDate)
   *   .dateOnly({
   *     format: 'yyyy-MM-dd',
   *     locale: 'en-US'
   *   })
   *   .build();
   * ```
   */
  dateOnly(
    options: {
      /** Date format (default: 'yyyy-MM-dd') */
      format?: string;
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
    } = {}
  ): this {
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
   * Configure as date-time.
   *
   * Sets the column to display both date and time information,
   * useful for timestamps, log entries, etc.
   *
   * @param options - Date-time configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const timestampColumn = new DateColumnBuilder<Log>()
   *   .id('timestamp')
   *   .displayName('Timestamp')
   *   .accessor(log => log.timestamp)
   *   .dateTime({
   *     format: 'yyyy-MM-dd HH:mm:ss',
   *     locale: 'en-US',
   *     timeZone: 'UTC'
   *   })
   *   .build();
   * ```
   */
  dateTime(
    options: {
      /** Date-time format (default: 'yyyy-MM-dd HH:mm:ss') */
      format?: string;
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Time zone for formatting (default: 'UTC') */
      timeZone?: string;
    } = {}
  ): this {
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
   * Configure as time-only.
   *
   * Sets the column to display only time information without date,
   * useful for meeting times, opening hours, etc.
   *
   * @param options - Time-only configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const meetingTimeColumn = new DateColumnBuilder<Meeting>()
   *   .id('meetingTime')
   *   .displayName('Meeting Time')
   *   .accessor(meeting => meeting.time)
   *   .timeOnly({
   *     format: 'HH:mm',
   *     locale: 'en-US',
   *     timeZone: 'America/New_York',
   *     showSeconds: false
   *   })
   *   .build();
   * ```
   */
  timeOnly(
    options: {
      /** Time format (default: 'HH:mm:ss') */
      format?: string;
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Time zone for formatting (default: 'UTC') */
      timeZone?: string;
      /** Whether to show seconds (default: true) */
      showSeconds?: boolean;
    } = {}
  ): this {
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
   * Show relative time (e.g., "2 hours ago", "in 3 days").
   *
   * Configures the column to display relative time instead of absolute dates,
   * useful for showing how recent or upcoming events are.
   *
   * @param options - Relative time configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const lastActiveColumn = new DateColumnBuilder<User>()
   *   .id('lastActive')
   *   .displayName('Last Active')
   *   .accessor(user => user.lastActiveAt)
   *   .relative({
   *     locale: 'en-US',
   *     numeric: 'auto',
   *     style: 'short'
   *   })
   *   .build();
   * ```
   */
  relative(
    options: {
      /** Locale for formatting (default: 'en-US') */
      locale?: string;
      /** Whether to show numeric values (default: 'auto') */
      numeric?: 'always' | 'auto';
      /** Style of relative time (default: 'long') */
      style?: 'long' | 'short' | 'narrow';
    } = {}
  ): this {
    const { locale = 'en-US', numeric = 'auto', style = 'long' } = options;

    this.config.meta = {
      ...this.config.meta,
      dateFormat: {
        ...((this.config.meta?.dateFormat as Record<string, unknown>) || {}),
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
   * Set date sorting to be chronological.
   *
   * Configures the column to sort dates in chronological order,
   * ensuring proper temporal ordering regardless of format.
   *
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const eventDateColumn = new DateColumnBuilder<Event>()
   *   .id('eventDate')
   *   .displayName('Event Date')
   *   .accessor(event => event.date)
   *   .chronological()
   *   .build();
   * ```
   */
  chronological(): this {
    this.config.meta = {
      ...this.config.meta,
      sortType: 'chronological',
    };
    return this;
  }
}
