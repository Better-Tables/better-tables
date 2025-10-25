/**
 * Format utilities for different data types
 */

import type { ColumnType } from '@better-tables/core';
import { formatDateWithConfig } from './date-utils';

export interface NumberFormatConfig {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
}

export interface CurrencyFormatConfig extends NumberFormatConfig {
  currency?: string;
  currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
}

export interface PercentageFormatConfig extends NumberFormatConfig {
  // Inherits all number formatting options
}

/**
 * Format a number according to configuration
 */
export function formatNumber(
  value: number | null | undefined,
  config: NumberFormatConfig = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  const {
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping = true,
    notation = 'standard',
  } = config;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      notation,
    }).format(value);
  } catch (error) {
    console.warn('Error formatting number:', error);
    return value.toString();
  }
}

/**
 * Format a currency value
 */
export function formatCurrency(
  value: number | null | undefined,
  config: CurrencyFormatConfig = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  const {
    locale = 'en-US',
    currency = 'USD',
    currencyDisplay = 'symbol',
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping = true,
    notation = 'standard',
  } = config;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      notation,
    }).format(value);
  } catch (error) {
    console.warn('Error formatting currency:', error);
    return `${currency} ${value}`;
  }
}

/**
 * Format a percentage value
 */
export function formatPercentage(
  value: number | null | undefined,
  config: PercentageFormatConfig = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  const {
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits = 1,
    useGrouping = true,
    notation = 'standard',
  } = config;

  try {
    // Assume value is already in percentage form (e.g., 85 for 85%)
    // If it's in decimal form (e.g., 0.85), multiply by 100
    const percentValue = value > 1 ? value : value * 100;

    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      notation,
    }).format(percentValue / 100);
  } catch (error) {
    console.warn('Error formatting percentage:', error);
    return `${value}%`;
  }
}

/**
 * Format an email address
 */
export function formatEmail(email: string | null | undefined): string {
  if (!email) return '';

  // Basic email validation and formatting
  const trimmed = email.trim().toLowerCase();

  // Check if it looks like an email
  if (trimmed.includes('@') && trimmed.includes('.')) {
    return trimmed;
  }

  return email; // Return original if doesn't look like email
}

/**
 * Format a URL
 */
export function formatUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Add protocol if missing
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Format a phone number (basic formatting)
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Format based on length
  if (cleaned.length === 10) {
    // US format: (555) 123-4567
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US format with country code: +1 (555) 123-4567
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Return original for other formats
  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(
  text: string | null | undefined,
  maxLength = 50,
  options?: { suffix?: string }
): string {
  if (!text) return '';

  if (text.length <= maxLength) {
    return text;
  }

  const suffix = options?.suffix || '...';
  return `${text.slice(0, maxLength - suffix.length)}${suffix}`;
}

/**
 * Apply text transformations (uppercase, lowercase, capitalize)
 */
function applyTextTransform(
  text: string,
  transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
): string {
  if (!transform || transform === 'none') return text;

  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    default:
      return text;
  }
}

/**
 * Format JSON for display
 */
export function formatJson(value: unknown, options: { pretty?: boolean } = {}): string {
  const { pretty = false } = options;

  if (value === null || value === undefined) {
    return '';
  }

  try {
    if (typeof value === 'string') {
      // Try to parse if it's a JSON string
      try {
        const parsed = JSON.parse(value);
        return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      } catch {
        return value;
      }
    }

    return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  } catch (error) {
    console.warn('Error formatting JSON:', error);
    return String(value);
  }
}

/**
 * Get appropriate formatter for column type
 */
export function getFormatterForType(
  columnType: ColumnType,
  value: unknown,
  meta?: Record<string, unknown>
): string {
  switch (columnType) {
    case 'number':
      return formatNumber(
        typeof value === 'number' ? value : null,
        meta?.numberFormat as Record<string, unknown>
      );
    case 'currency':
      return formatCurrency(typeof value === 'number' ? value : null, {
        ...((meta?.numberFormat as Record<string, unknown>) || {}),
        ...((meta?.currencyFormat as Record<string, unknown>) || {}),
      });
    case 'percentage':
      return formatPercentage(
        typeof value === 'number' ? value : null,
        meta?.numberFormat as Record<string, unknown>
      );
    case 'email':
      return formatEmail(typeof value === 'string' ? value : null);
    case 'url':
      return formatUrl(typeof value === 'string' ? value : null);
    case 'phone':
      return formatPhone(typeof value === 'string' ? value : null);
    case 'date':
      if (value instanceof Date || (value && typeof value === 'object' && 'getTime' in value)) {
        const dateConfig = meta?.dateFormat as Record<string, unknown> | undefined;
        return formatDateWithConfig(value as Date, dateConfig || {});
      }
      return String(value || '');
    case 'json':
      return formatJson(value, { pretty: false });
    default: {
      // For text columns, apply transformations and truncation
      const textValue = String(value || '');
      const transformed = applyTextTransform(
        textValue,
        meta?.textTransform as 'uppercase' | 'lowercase' | 'capitalize' | 'none' | undefined
      );

      // Apply truncation if configured in meta
      if (meta?.truncate && typeof meta.truncate === 'object') {
        const truncateConfig = meta.truncate as { maxLength?: number; suffix?: string };
        return truncateText(transformed, truncateConfig.maxLength || 50, {
          suffix: truncateConfig.suffix,
        });
      }

      return transformed;
    }
  }
}
