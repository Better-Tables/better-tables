import { format, formatDistance, formatRelative, type Locale } from 'date-fns';
import { de } from 'date-fns/locale/de';
import { enGB } from 'date-fns/locale/en-GB';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { it } from 'date-fns/locale/it';
import { ja } from 'date-fns/locale/ja';
import { ptBR } from 'date-fns/locale/pt-BR';
import { zhCN } from 'date-fns/locale/zh-CN';

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

const LOCALE_MAP: Record<string, Locale> = {
  'en-US': enUS,
  en: enUS,
  'en-GB': enGB,
  'de-DE': de,
  de: de,
  'es-ES': es,
  es: es,
  'fr-FR': fr,
  fr: fr,
  'it-IT': it,
  it: it,
  'ja-JP': ja,
  ja: ja,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  zh: zhCN,
};

/**
 * Resolve a BCP 47 locale tag to a date-fns locale object.
 * Falls back to en-US when the locale is unrecognized.
 */
export function resolveDateFnsLocale(locale?: string): Locale {
  if (!locale) {
    return enUS;
  }

  return LOCALE_MAP[locale] ?? LOCALE_MAP[locale.split('-')[0] ?? ''] ?? enUS;
}

/**
 * Format a date according to column configuration.
 *
 * Note: `timeZone` is accepted for forward compatibility but is not applied
 * as a conversion (that requires a timezone library). Appending a bare TZ
 * label without converting would be misleading, so it is ignored for now.
 */
export function formatDateWithConfig(
  date: Date | null | undefined,
  config: DateFormatConfig
): string {
  if (!date) return '';

  const locale = resolveDateFnsLocale(config.locale);

  try {
    // Handle relative time formatting
    if (config.showRelative) {
      const now = new Date();
      const options = config.relativeOptions;

      if (options?.style === 'short') {
        return formatDistance(date, now, { addSuffix: true, locale });
      }

      return formatRelative(date, now, { locale });
    }

    // Handle standard date formatting
    const formatString = config.format || (config.showTime ? 'PPpp' : 'PPP');

    return format(date, formatString, { locale });
  } catch (_error) {
    return date.toLocaleDateString(config.locale);
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
  const locale = resolveDateFnsLocale(config.locale);

  try {
    if (!to) {
      return format(from, formatString, { locale });
    }

    // If same day, show only one date
    if (isSameDay(from, to)) {
      return format(from, formatString, { locale });
    }

    // Different days, show range
    return `${format(from, formatString, { locale })} - ${format(to, formatString, {
      locale,
    })}`;
  } catch (_error) {
    return `${from.toLocaleDateString(config.locale)}${to ? ` - ${to.toLocaleDateString(config.locale)}` : ''}`;
  }
}
