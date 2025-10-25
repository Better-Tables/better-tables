/**
 * @fileoverview Column metadata accessor utilities for safe property extraction.
 *
 * This module provides utility functions for safely accessing column metadata
 * properties with proper fallbacks and type safety.
 *
 * @module utils/meta-accessors
 */

import type {
  ColumnMeta,
  CurrencyFormatMeta,
  DateFormatMeta,
  NumberFormatMeta,
  TextFormatMeta,
} from '../types/column-meta';

/**
 * Safely get number format metadata from column metadata.
 *
 * Extracts number formatting configuration with safe fallbacks
 * for undefined or missing metadata.
 *
 * @param meta - Column metadata object
 * @returns Number format metadata with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   numberFormat: {
 *     locale: 'en-US',
 *     minimumFractionDigits: 2,
 *     useGrouping: true
 *   }
 * };
 *
 * const numberFormat = getNumberFormat(meta);
 * console.log(numberFormat.locale); // 'en-US'
 * console.log(numberFormat.useGrouping); // true
 * ```
 */
export function getNumberFormat(meta?: ColumnMeta): NumberFormatMeta {
  return meta?.numberFormat || {};
}

/**
 * Safely get currency format metadata from column metadata.
 *
 * Extracts currency formatting configuration by merging number format
 * and currency-specific settings with safe fallbacks.
 *
 * @param meta - Column metadata object
 * @returns Currency format metadata with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   numberFormat: { locale: 'en-US', useGrouping: true },
 *   currencyFormat: { currency: 'USD', currencyDisplay: 'symbol' }
 * };
 *
 * const currencyFormat = getCurrencyFormat(meta);
 * console.log(currencyFormat.currency); // 'USD'
 * console.log(currencyFormat.locale); // 'en-US'
 * ```
 */
export function getCurrencyFormat(meta?: ColumnMeta): CurrencyFormatMeta {
  return {
    ...meta?.numberFormat,
    ...meta?.currencyFormat,
  };
}

/**
 * Safely get date format metadata from column metadata.
 *
 * Extracts date formatting configuration with safe fallbacks
 * for undefined or missing metadata.
 *
 * @param meta - Column metadata object
 * @returns Date format metadata with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   dateFormat: {
 *     format: 'MMM dd, yyyy',
 *     locale: 'en-US',
 *     showTime: true
 *   }
 * };
 *
 * const dateFormat = getDateFormat(meta);
 * console.log(dateFormat.format); // 'MMM dd, yyyy'
 * console.log(dateFormat.showTime); // true
 * ```
 */
export function getDateFormat(meta?: ColumnMeta): DateFormatMeta {
  return meta?.dateFormat || {};
}

/**
 * Safely get text format metadata from column metadata.
 *
 * Extracts text formatting configuration with safe fallbacks
 * for undefined or missing metadata.
 *
 * @param meta - Column metadata object
 * @returns Text format metadata with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   textFormat: {
 *     truncate: { maxLength: 50, ellipsis: '...' },
 *     textTransform: 'capitalize',
 *     trim: true
 *   }
 * };
 *
 * const textFormat = getTextFormat(meta);
 * console.log(textFormat.textTransform); // 'capitalize'
 * console.log(textFormat.trim); // true
 * ```
 */
export function getTextFormat(meta?: ColumnMeta): TextFormatMeta {
  return meta?.textFormat || {};
}

/**
 * Safely get column style properties from column metadata.
 *
 * Extracts styling-related properties with safe fallbacks
 * for undefined or missing metadata.
 *
 * @param meta - Column metadata object
 * @returns Column style properties with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   className: 'custom-column',
 *   width: 200,
 *   minWidth: 100,
 *   maxWidth: 400,
 *   headerClassName: 'custom-header'
 * };
 *
 * const style = getColumnStyle(meta);
 * console.log(style.className); // 'custom-column'
 * console.log(style.width); // 200
 * ```
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
 * Safely get option colors mapping from column metadata.
 *
 * Extracts color mapping for option values with safe fallbacks
 * for undefined or missing metadata.
 *
 * @param meta - Column metadata object
 * @returns Option colors mapping with safe defaults
 *
 * @example
 * ```typescript
 * const meta: ColumnMeta = {
 *   optionColors: {
 *     'active': '#10b981',
 *     'inactive': '#6b7280',
 *     'pending': '#f59e0b'
 *   }
 * };
 *
 * const colors = getOptionColors(meta);
 * console.log(colors.active); // '#10b981'
 * console.log(colors.inactive); // '#6b7280'
 * ```
 */
export function getOptionColors(meta?: ColumnMeta): Record<string, string> {
  return meta?.optionColors || {};
}
