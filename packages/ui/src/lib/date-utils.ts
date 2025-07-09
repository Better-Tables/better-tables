import { format, formatRelative, formatDistance } from 'date-fns';
import { enUS } from 'date-fns/locale';

export interface DateFormatConfig {
  format?: string;
  locale?: string;
  showTime?: boolean;
  showRelative?: boolean;
  timeZone?: string;
  relativeOptions?: {
    numeric?: 'always' | 'auto';
    style?: 'long' | 'short' | 'narrow';
  };
}

/**
 * Format a date according to column configuration
 */
export function formatDateWithConfig(
  date: Date | null | undefined,
  config: DateFormatConfig
): string {
  if (!date) return '';

  try {
    // Handle relative time formatting
    if (config.showRelative) {
      const now = new Date();
      const options = config.relativeOptions;
      
      if (options?.style === 'short') {
        return formatDistance(date, now, { addSuffix: true, locale: enUS });
      }
      
      return formatRelative(date, now, { locale: enUS });
    }

    // Handle standard date formatting
    const formatString = config.format || (config.showTime ? 'PPpp' : 'PPP');
    
    // Use date-fns format with locale support
    let formattedDate = format(date, formatString, {
      locale: enUS, // For now, we'll use enUS. Later we can add locale support
    });
    
    // Add timezone information if configured
    if (config.timeZone && config.showTime) {
      const timeZoneShort = config.timeZone === 'UTC' ? 'UTC' : 
                           config.timeZone.split('/').pop() || config.timeZone;
      formattedDate += ` (${timeZoneShort})`;
    }
    
    return formattedDate;
  } catch (error) {
    console.warn('Error formatting date:', error);
    return date.toLocaleDateString();
  }
}

/**
 * Get appropriate format string for date range display
 */
export function getDateRangeFormat(config: DateFormatConfig): string {
  if (config.showTime) {
    return config.format || 'LLL dd, y HH:mm';
  }
  return config.format || 'LLL dd, y';
}

/**
 * Get appropriate format string for single date display
 */
export function getSingleDateFormat(config: DateFormatConfig): string {
  if (config.showTime) {
    return config.format || 'PPpp';
  }
  return config.format || 'PPP';
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format date range for display
 */
export function formatDateRange(
  from: Date | null | undefined,
  to: Date | null | undefined,
  config: DateFormatConfig
): string {
  if (!from) return '';
  
  const formatString = getDateRangeFormat(config);
  
  try {
    if (!to) {
      return format(from, formatString, { locale: enUS });
    }
    
    // If same day, show only one date
    if (isSameDay(from, to)) {
      return format(from, formatString, { locale: enUS });
    }
    
    // Different days, show range
    return `${format(from, formatString, { locale: enUS })} - ${format(to, formatString, { locale: enUS })}`;
  } catch (error) {
    console.warn('Error formatting date range:', error);
    return `${from.toLocaleDateString()}${to ? ` - ${to.toLocaleDateString()}` : ''}`;
  }
} 