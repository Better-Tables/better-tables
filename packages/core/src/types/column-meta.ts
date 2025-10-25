/**
 * @fileoverview Column metadata types for formatting and styling configuration.
 *
 * This module defines metadata interfaces for different column types,
 * enabling rich formatting, styling, and display customization.
 *
 * @module types/column-meta
 */

/**
 * Base column metadata interface.
 *
 * Provides common styling and layout properties that apply to all column types.
 *
 * @example
 * ```typescript
 * const baseMeta: BaseColumnMeta = {
 *   className: 'custom-column',
 *   width: 200,
 *   minWidth: 100,
 *   maxWidth: 400,
 *   headerClassName: 'custom-header'
 * };
 * ```
 */
export interface BaseColumnMeta {
  /** CSS class name to apply to the column */
  className?: string;

  /** Column width in pixels or CSS units */
  width?: number | string;

  /** Minimum allowed column width */
  minWidth?: number | string;

  /** Maximum allowed column width */
  maxWidth?: number | string;

  /** CSS class name to apply to the column header */
  headerClassName?: string;
}

/**
 * Number formatting metadata interface.
 *
 * Configures how numeric values are displayed, including locale-specific
 * formatting, decimal places, and notation styles.
 *
 * @example
 * ```typescript
 * const numberMeta: NumberFormatMeta = {
 *   locale: 'en-US',
 *   minimumFractionDigits: 2,
 *   maximumFractionDigits: 4,
 *   useGrouping: true,
 *   notation: 'standard'
 * };
 * ```
 */
export interface NumberFormatMeta {
  /** Locale for number formatting (e.g., 'en-US', 'de-DE') */
  locale?: string;
  /** Minimum number of decimal places to display */
  minimumFractionDigits?: number;
  /** Maximum number of decimal places to display */
  maximumFractionDigits?: number;
  /** Whether to use thousands separators */
  useGrouping?: boolean;
  /** Number notation style */
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  /** Display style for compact notation */
  compactDisplay?: 'short' | 'long';
}

/**
 * Currency formatting metadata interface.
 *
 * Extends number formatting with currency-specific options like
 * currency code, symbol display, and currency-specific formatting.
 *
 * @example
 * ```typescript
 * const currencyMeta: CurrencyFormatMeta = {
 *   currency: 'USD',
 *   currencyDisplay: 'symbol',
 *   locale: 'en-US',
 *   minimumFractionDigits: 2,
 *   useGrouping: true
 * };
 * ```
 */
export interface CurrencyFormatMeta extends NumberFormatMeta {
  /** ISO 4217 currency code (e.g., 'USD', 'EUR', 'JPY') */
  currency?: string;
  /** How to display the currency symbol */
  currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
}

/**
 * Date formatting metadata interface.
 *
 * Configures how date and time values are displayed, including
 * format strings, locale settings, and relative time options.
 *
 * @example
 * ```typescript
 * const dateMeta: DateFormatMeta = {
 *   format: 'MMM dd, yyyy',
 *   locale: 'en-US',
 *   showTime: true,
 *   showSeconds: false,
 *   timeZone: 'America/New_York',
 *   showRelative: true,
 *   relativeOptions: {
 *     maxDays: 7,
 *     short: true,
 *     numeric: 'auto'
 *   }
 * };
 * ```
 */
export interface DateFormatMeta {
  /** Custom date format string */
  format?: string;
  /** Locale for date formatting */
  locale?: string;
  /** Whether to include time in the display */
  showTime?: boolean;
  /** Whether to include seconds in time display */
  showSeconds?: boolean;
  /** Whether to show relative time (e.g., "2 hours ago") */
  showRelative?: boolean;
  /** Timezone for date display */
  timeZone?: string;
  /** Configuration for relative time display */
  relativeOptions?: {
    /** Maximum days to show relative time before switching to absolute */
    maxDays?: number;
    /** Whether to use short relative format */
    short?: boolean;
    /** Numeric style for relative time */
    numeric?: 'always' | 'auto';
    /** Style of relative time display */
    style?: 'long' | 'short' | 'narrow';
  };
}

/**
 * Text formatting metadata interface.
 *
 * Configures text display options including truncation, case transformation,
 * and whitespace handling for text-based columns.
 *
 * @example
 * ```typescript
 * const textMeta: TextFormatMeta = {
 *   truncate: {
 *     maxLength: 50,
 *     ellipsis: '...'
 *   },
 *   textTransform: 'capitalize',
 *   trim: true
 * };
 * ```
 */
export interface TextFormatMeta {
  /** Text truncation configuration */
  truncate?: {
    /** Maximum length before truncation */
    maxLength: number;
    /** Ellipsis string to append when truncated */
    ellipsis?: string;
  };
  /** Text case transformation */
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize';
  /** Whether to trim whitespace from text */
  trim?: boolean;
}

/**
 * Comprehensive column metadata type.
 *
 * Combines all metadata interfaces into a single type that can be used
 * with any column type. Properties are optional and only relevant ones
 * will be applied based on the column type.
 *
 * @example
 * ```typescript
 * const columnMeta: ColumnMeta = {
 *   className: 'user-name-column',
 *   width: 200,
 *   textFormat: {
 *     truncate: { maxLength: 30 },
 *     textTransform: 'capitalize'
 *   },
 *   numberFormat: {
 *     locale: 'en-US',
 *     minimumFractionDigits: 2
 *   },
 *   dateFormat: {
 *     format: 'MMM dd, yyyy',
 *     showTime: true
 *   }
 * };
 * ```
 */
export type ColumnMeta = BaseColumnMeta & {
  // Number types formatting
  /** Number formatting configuration for numeric columns */
  numberFormat?: NumberFormatMeta;

  // Currency type formatting
  /** Currency formatting configuration for currency columns */
  currencyFormat?: CurrencyFormatMeta;

  // Date type formatting
  /** Date formatting configuration for date columns */
  dateFormat?: DateFormatMeta;

  // Text types formatting
  /** Text formatting configuration for text-based columns */
  textFormat?: TextFormatMeta;

  // Option/MultiOption types styling
  /** Color mapping for option values */
  optionColors?: Record<string, string>;

  // Percentage type formatting (for builder compatibility)
  /** Percentage formatting configuration */
  percentage?: {
    /** Custom format string */
    format?: string;
    /** Locale for formatting */
    locale?: string;
    /** Minimum decimal places */
    minimumFractionDigits?: number;
    /** Maximum decimal places */
    maximumFractionDigits?: number;
  };

  // Currency type formatting (for builder compatibility)
  /** Currency formatting configuration */
  currency?: {
    /** ISO currency code */
    currency?: string;
    /** Currency display style */
    currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
    /** Locale for formatting */
    locale?: string;
    /** Minimum decimal places */
    minimumFractionDigits?: number;
    /** Maximum decimal places */
    maximumFractionDigits?: number;
    /** Whether to show currency symbol */
    showSymbol?: boolean;
  };

  // Allow extensions for custom metadata
  /** Additional custom metadata properties */
  [key: string]: unknown;
};
