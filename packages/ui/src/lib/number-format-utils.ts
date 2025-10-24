/**
 * Number input utilities for filter inputs
 * Uses existing format utilities from format-utils.ts
 */

import {
  type CurrencyFormatConfig,
  formatCurrency,
  formatNumber as formatNumberDisplay,
  formatPercentage,
  type NumberFormatConfig,
  type PercentageFormatConfig,
} from './format-utils';

export interface NumberInputConfig {
  /** Type of number formatting */
  type?: 'number' | 'currency' | 'percentage';
  /** Locale for formatting */
  locale?: string;
  /** Currency code (e.g., 'USD', 'EUR') */
  currency?: string;
  /** Number of decimal places */
  decimals?: number;
  /** Minimum decimal places */
  minDecimals?: number;
  /** Maximum decimal places */
  maxDecimals?: number;
  /** Whether to show thousands separator */
  useGrouping?: boolean;
  /** Custom prefix */
  prefix?: string;
  /** Custom suffix */
  suffix?: string;
  /** Whether to allow negative numbers */
  allowNegative?: boolean;
  /** Whether to allow decimal input */
  allowDecimal?: boolean;
  /** Input placeholder text */
  placeholder?: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step value */
  step?: number;
}

/**
 * Format a number value using existing format utilities
 */
export function formatNumber(
  value: number | string | null | undefined,
  config: NumberInputConfig = {}
): string {
  const {
    type = 'number',
    locale = 'en-US',
    currency = 'USD',
    decimals,
    minDecimals,
    maxDecimals,
    useGrouping = true,
    prefix = '',
    suffix = '',
  } = config;

  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (Number.isNaN(numValue)) {
    return '';
  }

  let formatted: string;

  try {
    switch (type) {
      case 'currency':
        formatted = formatCurrency(numValue, {
          locale,
          currency,
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals ?? decimals,
          useGrouping,
        } as CurrencyFormatConfig);
        break;

      case 'percentage':
        formatted = formatPercentage(numValue, {
          locale,
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals ?? decimals,
          useGrouping,
        } as PercentageFormatConfig);
        break;

      default:
        formatted = formatNumberDisplay(numValue, {
          locale,
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals ?? decimals,
          useGrouping,
        } as NumberFormatConfig);
        break;
    }
  } catch (_error) {
    // Fallback to basic formatting if locale/currency is not supported
    formatted = numValue.toString();
  }

  return `${prefix}${formatted}${suffix}`;
}

/**
 * Parse a formatted number string back to a number
 */
export function parseFormattedNumber(value: string, config: NumberInputConfig = {}): number | null {
  const { type = 'number', locale = 'en-US', currency = 'USD', prefix = '', suffix = '' } = config;

  if (!value || value.trim() === '') {
    return null;
  }

  // Remove prefix and suffix
  let cleanValue = value;
  if (prefix && cleanValue.startsWith(prefix)) {
    cleanValue = cleanValue.substring(prefix.length);
  }
  if (suffix && cleanValue.endsWith(suffix)) {
    cleanValue = cleanValue.substring(0, cleanValue.length - suffix.length);
  }

  // Handle percentage
  if (type === 'percentage' && cleanValue.endsWith('%')) {
    cleanValue = cleanValue.substring(0, cleanValue.length - 1);
    const numValue = parseFloat(cleanValue.replace(/[^\d.-]/g, ''));
    return Number.isNaN(numValue) ? null : numValue;
  }

  // Handle currency symbols
  if (type === 'currency') {
    // Try to get currency symbol from locale
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      });
      const parts = formatter.formatToParts(1);
      const currencySymbol = parts.find((part) => part.type === 'currency')?.value;

      if (currencySymbol) {
        cleanValue = cleanValue.replace(new RegExp(escapeRegExp(currencySymbol), 'g'), '');
      }
    } catch (_error) {
      // Fallback - remove common currency symbols
      cleanValue = cleanValue.replace(/[$€£¥₹]/g, '');
    }
  }

  // Remove thousand separators and non-numeric characters except decimal point and minus
  cleanValue = cleanValue.replace(/[^\d.-]/g, '');

  const numValue = parseFloat(cleanValue);
  return Number.isNaN(numValue) ? null : numValue;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to safely get string values from metadata
function getStringValue(
  meta: Record<string, unknown>,
  key: string,
  defaultValue?: string
): string | undefined {
  const value = meta[key];
  return typeof value === 'string' ? value : defaultValue;
}

// Helper function to safely get number values from metadata
function getNumberValue(
  meta: Record<string, unknown>,
  key: string,
  defaultValue?: number
): number | undefined {
  const value = meta[key];
  return typeof value === 'number' ? value : defaultValue;
}

// Helper function to safely get boolean values from metadata
function getBooleanValue(
  meta: Record<string, unknown>,
  key: string,
  defaultValue?: boolean
): boolean | undefined {
  const value = meta[key];
  return typeof value === 'boolean' ? value : defaultValue;
}

/**
 * Get input configuration based on column type and metadata
 */
export function getNumberInputConfig(
  columnType: string,
  columnMeta?: Record<string, unknown>
): NumberInputConfig {
  const baseConfig: NumberInputConfig = {
    type: 'number',
    locale: 'en-US',
    allowNegative: true,
    allowDecimal: true,
    useGrouping: true,
  };

  // Column type specific configuration
  switch (columnType) {
    case 'currency':
      baseConfig.type = 'currency';
      baseConfig.currency = getStringValue(columnMeta || {}, 'currency') || 'USD';
      baseConfig.decimals = getNumberValue(columnMeta || {}, 'decimals') ?? 2;
      baseConfig.minDecimals = 2;
      baseConfig.maxDecimals = 2;
      baseConfig.placeholder = 'Enter amount...';
      break;

    case 'percentage':
      baseConfig.type = 'percentage';
      baseConfig.decimals = getNumberValue(columnMeta || {}, 'decimals') ?? 2;
      baseConfig.minDecimals = 0;
      baseConfig.maxDecimals = 2;
      baseConfig.placeholder = 'Enter percentage...';
      baseConfig.min = 0;
      baseConfig.max = 100;
      break;

    default:
      baseConfig.type = 'number';
      baseConfig.decimals = getNumberValue(columnMeta || {}, 'decimals');
      baseConfig.minDecimals = getNumberValue(columnMeta || {}, 'minDecimals');
      baseConfig.maxDecimals = getNumberValue(columnMeta || {}, 'maxDecimals');
      baseConfig.placeholder = 'Enter number...';
      break;
  }

  // Override with column metadata
  if (columnMeta) {
    return {
      ...baseConfig,
      locale: getStringValue(columnMeta, 'locale') || baseConfig.locale,
      currency: getStringValue(columnMeta, 'currency') || baseConfig.currency,
      decimals: getNumberValue(columnMeta, 'decimals') ?? baseConfig.decimals,
      minDecimals: getNumberValue(columnMeta, 'minDecimals') ?? baseConfig.minDecimals,
      maxDecimals: getNumberValue(columnMeta, 'maxDecimals') ?? baseConfig.maxDecimals,
      useGrouping: getBooleanValue(columnMeta, 'useGrouping') ?? baseConfig.useGrouping,
      prefix: getStringValue(columnMeta, 'prefix') || baseConfig.prefix,
      suffix: getStringValue(columnMeta, 'suffix') || baseConfig.suffix,
      allowNegative: getBooleanValue(columnMeta, 'allowNegative') ?? baseConfig.allowNegative,
      allowDecimal: getBooleanValue(columnMeta, 'allowDecimal') ?? baseConfig.allowDecimal,
      min: getNumberValue(columnMeta, 'min') ?? baseConfig.min,
      max: getNumberValue(columnMeta, 'max') ?? baseConfig.max,
      step: getNumberValue(columnMeta, 'step') ?? baseConfig.step,
    };
  }

  return baseConfig;
}

/**
 * Validate number input value
 */
export function validateNumberInput(
  value: string,
  config: NumberInputConfig
): { isValid: boolean; error?: string } {
  const { min, max, allowNegative = true, allowDecimal = true, maxDecimals } = config;

  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  const numValue = parseFormattedNumber(value, config);

  if (numValue === null) {
    return { isValid: false, error: 'Invalid number format' };
  }

  if (!allowNegative && numValue < 0) {
    return { isValid: false, error: 'Negative numbers not allowed' };
  }

  if (!allowDecimal && numValue % 1 !== 0) {
    return { isValid: false, error: 'Decimal numbers not allowed' };
  }

  if (maxDecimals !== undefined) {
    const decimalPlaces = (numValue.toString().split('.')[1] || '').length;
    if (decimalPlaces > maxDecimals) {
      return {
        isValid: false,
        error: `Maximum ${maxDecimals} decimal places allowed`,
      };
    }
  }

  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `Value must be at most ${max}` };
  }

  return { isValid: true };
}

/**
 * Format placeholder text based on configuration
 */
export function getFormattedPlaceholder(config: NumberInputConfig): string {
  const { type, placeholder, currency, min, max } = config;

  if (placeholder) {
    return placeholder;
  }

  let basePlaceholder = '';
  switch (type) {
    case 'currency':
      basePlaceholder = `Enter amount in ${currency}...`;
      break;
    case 'percentage':
      basePlaceholder = 'Enter percentage...';
      break;
    default:
      basePlaceholder = 'Enter number...';
      break;
  }

  if (min !== undefined || max !== undefined) {
    if (min !== undefined && max !== undefined) {
      basePlaceholder += ` (${min}-${max})`;
    } else if (min !== undefined) {
      basePlaceholder += ` (min: ${min})`;
    } else if (max !== undefined) {
      basePlaceholder += ` (max: ${max})`;
    }
  }

  return basePlaceholder;
}

/**
 * Get step value for number input
 */
export function getNumberInputStep(config: NumberInputConfig): number | string {
  const { type, decimals, step } = config;

  if (step !== undefined) {
    return step;
  }

  switch (type) {
    case 'percentage':
      return decimals === 0 ? 1 : 0.01;
    case 'currency':
      return decimals === 0 ? 1 : 0.01;
    default:
      return decimals === 0 ? 1 : 'any';
  }
}
