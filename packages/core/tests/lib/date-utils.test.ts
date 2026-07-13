import { describe, expect, it, spyOn } from 'bun:test';
import {
  formatDateRange,
  formatDateWithConfig,
  resolveDateFnsLocale,
} from '../../src/lib/date-utils';

describe('date-utils', () => {
  describe('resolveDateFnsLocale', () => {
    it('defaults to en-US', () => {
      expect(resolveDateFnsLocale()).toBe(resolveDateFnsLocale('en-US'));
    });

    it('resolves known locales and language fallbacks', () => {
      expect(resolveDateFnsLocale('de-DE').code).toBe('de');
      expect(resolveDateFnsLocale('fr').code).toBe('fr');
    });

    it('falls back to en-US for unknown locales', () => {
      expect(resolveDateFnsLocale('xx-YY')).toBe(resolveDateFnsLocale('en-US'));
    });
  });

  describe('formatDateWithConfig', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024 local

    it('formats with the configured locale', () => {
      const en = formatDateWithConfig(date, { format: 'PPP', locale: 'en-US' });
      const de = formatDateWithConfig(date, { format: 'PPP', locale: 'de-DE' });

      expect(en).toContain('January');
      expect(de).toContain('Januar');
      expect(en).not.toBe(de);
    });

    it('does not append a misleading timezone label', () => {
      const formatted = formatDateWithConfig(date, {
        format: 'PPP',
        showTime: true,
        timeZone: 'America/New_York',
      });

      expect(formatted).not.toContain('(New_York)');
      expect(formatted).not.toContain('America/New_York');
    });

    it('converts to the configured IANA zone, flipping the calendar date near midnight UTC', () => {
      // 2024-01-15T02:00:00Z: 02:00 UTC on Jan 15, but 21:00 EST on Jan 14
      // (America/New_York is UTC-5 in January, outside DST).
      const nearMidnightUtc = new Date('2024-01-15T02:00:00Z');

      const utc = formatDateWithConfig(nearMidnightUtc, { format: 'PPP', timeZone: 'UTC' });
      const nyc = formatDateWithConfig(nearMidnightUtc, {
        format: 'PPP',
        timeZone: 'America/New_York',
      });

      expect(utc).toContain('January 15th');
      expect(nyc).toContain('January 14th');
      expect(utc).not.toBe(nyc);
    });

    it('applies the correct DST offset either side of a spring-forward transition', () => {
      // America/New_York DST starts 2024-03-10 at 02:00 local (EST -> EDT).
      // Same UTC hour, one day apart: before the transition it's EST (-05:00),
      // after it's EDT (-04:00), so the rendered local hour differs by one.
      const beforeDst = new Date('2024-03-09T12:00:00Z');
      const afterDst = new Date('2024-03-11T12:00:00Z');

      const beforeFormatted = formatDateWithConfig(beforeDst, {
        format: 'HH:mm',
        timeZone: 'America/New_York',
      });
      const afterFormatted = formatDateWithConfig(afterDst, {
        format: 'HH:mm',
        timeZone: 'America/New_York',
      });

      expect(beforeFormatted).toBe('07:00');
      expect(afterFormatted).toBe('08:00');
    });

    it('soft-fails an unknown IANA zone: no throw, single warning, unconverted output', () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const withUnknownZone = formatDateWithConfig(date, {
        format: 'PPP',
        timeZone: 'Not/AZone',
      });
      const withoutZone = formatDateWithConfig(date, { format: 'PPP' });
      // Call again with the same unknown zone to prove dedup.
      formatDateWithConfig(date, { format: 'PPP', timeZone: 'Not/AZone' });

      expect(withUnknownZone).toBe(withoutZone);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('Not/AZone');

      warnSpy.mockRestore();
    });

    it('produces unchanged output when no timeZone is configured (no-op regression guard)', () => {
      expect(formatDateWithConfig(date, { format: 'PPP' })).toBe('January 15th, 2024');
      expect(formatDateWithConfig(date, { format: 'yyyy-MM-dd', showTime: true })).toBe(
        '2024-01-15'
      );
    });

    it('composes locale and timeZone together', () => {
      const nearMidnightUtc = new Date('2024-01-15T02:00:00Z');

      const formatted = formatDateWithConfig(nearMidnightUtc, {
        format: 'PPP',
        locale: 'de-DE',
        timeZone: 'America/New_York',
      });

      expect(formatted).toContain('Januar');
      expect(formatted).toContain('14.');
    });
  });

  describe('formatDateRange', () => {
    it('respects locale for range formatting', () => {
      const from = new Date(2024, 0, 15);
      const to = new Date(2024, 0, 20);
      const de = formatDateRange(from, to, { locale: 'de-DE', format: 'PPP' });

      expect(de).toContain('Januar');
    });

    it('converts both range endpoints to the configured timeZone', () => {
      // Both instants land on Jan 15 UTC but on Jan 14 in America/New_York,
      // so the zoned range should collapse to a single (converted) day.
      const from = new Date('2024-01-15T02:00:00Z');
      const to = new Date('2024-01-15T04:00:00Z');

      const utcRange = formatDateRange(from, to, { format: 'PPP', timeZone: 'UTC' });
      const nycRange = formatDateRange(from, to, {
        format: 'PPP',
        timeZone: 'America/New_York',
      });

      expect(utcRange).toContain('January 15th');
      expect(nycRange).toBe('January 14th, 2024');
      expect(nycRange).not.toContain(' - ');
    });
  });
});
