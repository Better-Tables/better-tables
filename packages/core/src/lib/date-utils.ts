import { TZDate, tzOffset } from '@date-fns/tz';
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

const warnedUnknownTimeZones = new Set<string>();

/**
 * Convert `date` into a `TZDate` anchored to `timeZone` so that date-fns
 * `format`/`formatRelative` calls read wall-clock fields (year/month/day/
 * hour) in that zone instead of the host system's local zone.
 *
 * Soft-fails on an unrecognized IANA name: this is a render path, so it must
 * never throw. An unknown zone logs one `console.warn` (deduped per zone
 * name for the process lifetime) and returns `date` unconverted.
 */
function toZonedDate(date: Date, timeZone?: string): Date {
  if (!timeZone) return date;

  if (Number.isNaN(tzOffset(timeZone, date))) {
    if (!warnedUnknownTimeZones.has(timeZone)) {
      warnedUnknownTimeZones.add(timeZone);
      // biome-ignore lint: Intentional warning logging for unknown timezone soft-fail
      console.warn(
        `[better-tables] Unknown IANA time zone "${timeZone}"; rendering without timezone conversion.`
      );
    }
    return date;
  }

  return TZDate.tz(timeZone, date);
}

/**
 * Format a date according to column configuration.
 *
 * `timeZone` (an IANA name, e.g. `'America/New_York'`) is applied as a real
 * conversion via `@date-fns/tz`'s `TZDate` — the formatted output reflects
 * wall-clock time in that zone, not the viewer's local zone. An unrecognized
 * zone name soft-fails to unconverted rendering (see `toZonedDate`).
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
        // Elapsed-time distances ("3 hours ago") are timezone-invariant —
        // the duration between two instants doesn't change with the zone
        // used to read their calendar fields, so no conversion is needed.
        return formatDistance(date, now, { addSuffix: true, locale });
      }

      // Unlike formatDistance, formatRelative picks calendar-relative
      // phrasing ("today", "yesterday", "last Friday at 2:30 PM") that
      // depends on which calendar day each instant falls on — that IS
      // zone-sensitive, so both anchors must be converted together.
      return formatRelative(toZonedDate(date, config.timeZone), toZonedDate(now, config.timeZone), {
        locale,
      });
    }

    // Handle standard date formatting
    const formatString = config.format || (config.showTime ? 'PPpp' : 'PPP');

    return format(toZonedDate(date, config.timeZone), formatString, { locale });
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
  const zonedFrom = toZonedDate(from, config.timeZone);

  try {
    if (!to) {
      return format(zonedFrom, formatString, { locale });
    }

    const zonedTo = toZonedDate(to, config.timeZone);

    // Same-day check must happen on the zoned values too — a range that
    // spans a UTC day boundary can collapse to a single day (or vice versa)
    // once both ends are read in the configured zone.
    if (isSameDay(zonedFrom, zonedTo)) {
      return format(zonedFrom, formatString, { locale });
    }

    // Different days, show range
    return `${format(zonedFrom, formatString, { locale })} - ${format(zonedTo, formatString, {
      locale,
    })}`;
  } catch (_error) {
    return `${from.toLocaleDateString(config.locale)}${to ? ` - ${to.toLocaleDateString(config.locale)}` : ''}`;
  }
}
