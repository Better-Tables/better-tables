import type {
  ColumnMeta,
  CurrencyFormatMeta,
  DateFormatMeta,
  NumberFormatMeta,
  TextFormatMeta,
} from '../types/column-meta';

/**
 * Safely get number format metadata
 */
export function getNumberFormat(meta?: ColumnMeta): NumberFormatMeta {
  return meta?.numberFormat || {};
}

/**
 * Safely get currency format metadata
 */
export function getCurrencyFormat(meta?: ColumnMeta): CurrencyFormatMeta {
  return {
    ...meta?.numberFormat,
    ...meta?.currencyFormat,
  };
}

/**
 * Safely get date format metadata
 */
export function getDateFormat(meta?: ColumnMeta): DateFormatMeta {
  return meta?.dateFormat || {};
}

/**
 * Safely get text format metadata
 */
export function getTextFormat(meta?: ColumnMeta): TextFormatMeta {
  return meta?.textFormat || {};
}

/**
 * Safely get column style properties
 */
export function getColumnStyle(meta?: ColumnMeta) {
  return {
    className: meta?.className,
    width: meta?.width,
    minWidth: meta?.minWidth,
    maxWidth: meta?.maxWidth,
    headerClassName: meta?.headerClassName,
  };
}

/**
 * Safely get option colors mapping
 */
export function getOptionColors(meta?: ColumnMeta): Record<string, string> {
  return meta?.optionColors || {};
}
