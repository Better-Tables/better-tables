import { describe, expect, it } from 'bun:test';
import { formatDateRange, formatDateWithConfig, resolveDateFnsLocale } from '../../src/lib/date-utils';

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

    it('does not append a misleading timezone label without converting', () => {
      const formatted = formatDateWithConfig(date, {
        format: 'PPP',
        showTime: true,
        timeZone: 'America/New_York',
      });

      expect(formatted).not.toContain('(New_York)');
      expect(formatted).not.toContain('America/New_York');
    });
  });

  describe('formatDateRange', () => {
    it('respects locale for range formatting', () => {
      const from = new Date(2024, 0, 15);
      const to = new Date(2024, 0, 20);
      const de = formatDateRange(from, to, { locale: 'de-DE', format: 'PPP' });

      expect(de).toContain('Januar');
    });
  });
});
