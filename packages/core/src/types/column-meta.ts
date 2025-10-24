/**
 * Base column metadata
 */
export interface BaseColumnMeta {
  /** CSS class name */
  className?: string;

  /** Column width */
  width?: number | string;

  /** Minimum width */
  minWidth?: number | string;

  /** Maximum width */
  maxWidth?: number | string;

  /** Column header class */
  headerClassName?: string;
}

/**
 * Number formatting metadata
 */
export interface NumberFormatMeta {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  compactDisplay?: 'short' | 'long';
}

/**
 * Currency formatting metadata
 */
export interface CurrencyFormatMeta extends NumberFormatMeta {
  currency?: string;
  currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
}

/**
 * Date formatting metadata
 */
export interface DateFormatMeta {
  format?: string;
  locale?: string;
  showTime?: boolean;
  showSeconds?: boolean;
  showRelative?: boolean;
  timeZone?: string;
  relativeOptions?: {
    maxDays?: number;
    short?: boolean;
    numeric?: 'always' | 'auto';
    style?: 'long' | 'short' | 'narrow';
  };
}

/**
 * Text formatting metadata
 */
export interface TextFormatMeta {
  truncate?: {
    maxLength: number;
    ellipsis?: string;
  };
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize';
  trim?: boolean;
}

/**
 * Type-specific column metadata
 */
export type ColumnMeta = BaseColumnMeta & {
  // Number types
  numberFormat?: NumberFormatMeta;

  // Currency type
  currencyFormat?: CurrencyFormatMeta;

  // Date type
  dateFormat?: DateFormatMeta;

  // Text types
  textFormat?: TextFormatMeta;

  // Option/MultiOption types
  optionColors?: Record<string, string>;

  // Percentage type (for builder compatibility)
  percentage?: {
    format?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  };

  // Currency type (for builder compatibility)
  currency?: {
    currency?: string;
    currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  };

  // Allow extensions
  [key: string]: unknown;
};
