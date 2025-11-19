import { describe, expect, it, mock } from 'bun:test';
import { DateColumnBuilder } from '../../src/builders/date-column-builder';

interface TestEvent {
  id: string;
  eventDate: Date;
  createdAt: Date;
  startTime: Date;
  endTime: Date;
  scheduledAt: Date;
  lastActive: Date;
}

describe('DateColumnBuilder', () => {
  describe('relative method', () => {
    it('should support being called on a fresh DateColumnBuilder', () => {
      const builder = new DateColumnBuilder();

      // This should not throw and should return the builder instance
      const result = builder.relative();

      expect(result).toBe(builder);
    });

    it('should configure relative time options', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .relative({
          locale: 'en-US',
          numeric: 'always',
          style: 'short',
        });

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        showRelative?: boolean;
        relativeOptions?: {
          numeric?: 'always' | 'auto';
          style?: 'long' | 'short' | 'narrow';
        };
      };
      expect(dateFormat?.showRelative).toBe(true);
      expect(dateFormat?.relativeOptions?.numeric).toBe('always');
      expect(dateFormat?.relativeOptions?.style).toBe('short');
    });

    it('should use default options when none provided', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .relative();

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        showRelative?: boolean;
        relativeOptions?: {
          numeric?: 'always' | 'auto';
          style?: 'long' | 'short' | 'narrow';
        };
      };
      expect(dateFormat?.showRelative).toBe(true);
      expect(dateFormat?.relativeOptions?.numeric).toBe('auto');
      expect(dateFormat?.relativeOptions?.style).toBe('long');
    });

    it('should preserve existing date format configuration', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .format('yyyy-MM-dd', { locale: 'en-US' })
        .relative({ style: 'short' });

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        format?: string;
        locale?: string;
        showRelative?: boolean;
        relativeOptions?: {
          style?: 'long' | 'short' | 'narrow';
        };
      };
      expect(dateFormat?.format).toBe('yyyy-MM-dd');
      expect(dateFormat?.locale).toBe('en-US');
      expect(dateFormat?.showRelative).toBe(true);
      expect(dateFormat?.relativeOptions?.style).toBe('short');
    });

    it('should chain with other methods', () => {
      const builder = new DateColumnBuilder();

      const result = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((row: unknown) => (row as { createdAt: Date }).createdAt)
        .relative({ style: 'narrow' })
        .sortable()
        .filterable();

      expect(result).toBe(builder);

      const config = builder.build();
      expect(config.id).toBe('createdAt');
      expect(config.displayName).toBe('Created At');
      expect(config.sortable).toBe(true);
      expect(config.filterable).toBe(true);
      const dateFormat = config.meta?.dateFormat as {
        showRelative?: boolean;
      };
      expect(dateFormat?.showRelative).toBe(true);
    });
  });

  describe('integration with other methods', () => {
    it('should work with format method', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .format('MMM dd, yyyy', { locale: 'en-US', showTime: true })
        .relative({ numeric: 'always', style: 'short' });

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        format?: string;
        showTime?: boolean;
        showRelative?: boolean;
        relativeOptions?: {
          numeric?: 'always' | 'auto';
        };
      };
      expect(dateFormat?.format).toBe('MMM dd, yyyy');
      expect(dateFormat?.showTime).toBe(true);
      expect(dateFormat?.showRelative).toBe(true);
      expect(dateFormat?.relativeOptions?.numeric).toBe('always');
    });

    it('should work with dateOperators method', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .relative({ style: 'narrow' })
        .dateOperators(['is', 'before', 'after']);

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        showRelative?: boolean;
      };
      expect(dateFormat?.showRelative).toBe(true);
      expect(config.filter?.operators).toEqual(['is', 'before', 'after']);
    });

    it('should work with validation method', () => {
      const builder = new DateColumnBuilder();

      builder
        .id('testDate')
        .displayName('Test Date')
        .accessor((row: unknown) => (row as { date: Date }).date)
        .relative()
        .validation([
          {
            id: 'required',
            validate: (value: Date) => value != null,
            message: 'Date is required',
          },
        ]);

      const config = builder.build();
      const dateFormat = config.meta?.dateFormat as {
        showRelative?: boolean;
      };
      expect(dateFormat?.showRelative).toBe(true);
      expect(config.validation).toHaveLength(1);
      expect(config.validation?.[0].id).toBe('required');
    });
  });

  describe('format method', () => {
    it('should configure format with format string and default options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy')
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect(column.meta?.dateFormat?.locale).toBe('en-US');
      expect(column.meta?.dateFormat?.timeZone).toBe('UTC');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
      expect(column.meta?.dateFormat?.showRelative).toBe(false);
    });

    it('should configure format with custom locale', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { locale: 'de-DE' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect(column.meta?.dateFormat?.locale).toBe('de-DE');
    });

    it('should configure format with custom timeZone', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { timeZone: 'America/New_York' })
        .build();

      expect(column.meta?.dateFormat?.timeZone).toBe('America/New_York');
    });

    it('should configure format with showTime enabled', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { showTime: true })
        .build();

      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure format with showRelative enabled', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { showRelative: true })
        .build();

      expect(column.meta?.dateFormat?.showRelative).toBe(true);
    });

    it('should configure format with all options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMMM dd, yyyy HH:mm', {
          locale: 'en-GB',
          timeZone: 'Europe/London',
          showTime: true,
          showRelative: false,
        })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMMM dd, yyyy HH:mm');
      expect(column.meta?.dateFormat?.locale).toBe('en-GB');
      expect(column.meta?.dateFormat?.timeZone).toBe('Europe/London');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect(column.meta?.dateFormat?.showRelative).toBe(false);
    });

    it('should support method chaining with format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { locale: 'en-US' })
        .sortable()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect(column.sortable).toBe(true);
    });

    it('should override format when set multiple times', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy')
        .format('yyyy-MM-dd', { locale: 'en-US' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
    });
  });

  describe('dateOperators method', () => {
    it('should set specific date operators', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOperators(['is', 'before', 'after'])
        .build();

      expect(column.filter?.operators).toEqual(['is', 'before', 'after']);
    });

    it('should set all available date operators', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOperators([
          'is',
          'isNot',
          'before',
          'after',
          'isToday',
          'isYesterday',
          'isThisWeek',
          'isThisMonth',
          'isThisYear',
        ])
        .build();

      expect(column.filter?.operators).toHaveLength(9);
      expect(column.filter?.operators).toContain('is');
      expect(column.filter?.operators).toContain('isToday');
      expect(column.filter?.operators).toContain('isThisYear');
    });

    it('should override operators when set multiple times', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOperators(['is', 'before'])
        .dateOperators(['after', 'isToday'])
        .build();

      expect(column.filter?.operators).toEqual(['after', 'isToday']);
    });

    it('should work with dateRange method', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ includeNull: false })
        .dateOperators(['is', 'before'])
        .build();

      expect(column.filter?.operators).toEqual(['is', 'before']);
      expect(column.filter?.includeNull).toBe(false);
    });

    it('should support method chaining with dateOperators', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOperators(['is', 'before'])
        .format('MMM dd, yyyy')
        .build();

      expect(column.filter?.operators).toEqual(['is', 'before']);
      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
    });

    it('should handle empty operators array', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOperators([])
        .build();

      expect(column.filter?.operators).toEqual([]);
    });
  });

  describe('dateRange method', () => {
    it('should configure date range with default options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange()
        .build();

      expect(column.filter?.includeNull).toBe(false);
      expect(column.filter?.operators).toContain('is');
      expect(column.filter?.operators).toContain('isToday');
      expect(column.filter?.operators).toContain('isThisYear');
    });

    it('should configure date range with includeNull', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure date range with validation', () => {
      const validation = mock<(value: Date) => boolean | string>().mockReturnValue(true);

      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ validation })
        .build();

      expect(column.filter?.validation).toBe(validation);
    });

    it('should configure date range with minDate', () => {
      const minDate = new Date('2024-01-01');
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ minDate })
        .build();

      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate).toEqual(
        minDate
      );
      expect(
        (column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate
      ).toBeUndefined();
    });

    it('should configure date range with maxDate', () => {
      const maxDate = new Date('2024-12-31');
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ maxDate })
        .build();

      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate).toEqual(
        maxDate
      );
      expect(
        (column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate
      ).toBeUndefined();
    });

    it('should configure date range with both minDate and maxDate', () => {
      const minDate = new Date('2024-01-01');
      const maxDate = new Date('2024-12-31');
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ minDate, maxDate })
        .build();

      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate).toEqual(
        minDate
      );
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate).toEqual(
        maxDate
      );
    });

    it('should configure date range with all options', () => {
      const minDate = new Date('2024-01-01');
      const maxDate = new Date('2024-12-31');
      const validation = mock<(value: Date) => boolean | string>().mockReturnValue(true);

      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({
          includeNull: true,
          validation,
          minDate,
          maxDate,
        })
        .build();

      expect(column.filter?.includeNull).toBe(true);
      expect(column.filter?.validation).toBe(validation);
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate).toEqual(
        minDate
      );
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate).toEqual(
        maxDate
      );
    });

    it('should set correct operators for date range', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange()
        .build();

      expect(column.filter?.operators).toEqual([
        'is',
        'isNot',
        'before',
        'after',
        'isToday',
        'isYesterday',
        'isThisWeek',
        'isThisMonth',
        'isThisYear',
      ]);
    });

    it('should support method chaining with dateRange', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ includeNull: false })
        .format('MMM dd, yyyy')
        .build();

      expect(column.filter?.includeNull).toBe(false);
      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
    });
  });

  describe('dateOnly method', () => {
    it('should configure date-only with default options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
      expect(column.meta?.dateFormat?.locale).toBe('en-US');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
    });

    it('should configure date-only with custom format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ format: 'MM/dd/yyyy' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MM/dd/yyyy');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
    });

    it('should configure date-only with custom locale', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ locale: 'de-DE' })
        .build();

      expect(column.meta?.dateFormat?.locale).toBe('de-DE');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
    });

    it('should configure date-only with all options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ format: 'dd.MM.yyyy', locale: 'de-DE' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('dd.MM.yyyy');
      expect(column.meta?.dateFormat?.locale).toBe('de-DE');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
    });

    it('should support method chaining with dateOnly', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ format: 'yyyy-MM-dd' })
        .sortable()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
      expect(column.sortable).toBe(true);
    });

    it('should override format when set multiple times', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ format: 'yyyy-MM-dd' })
        .dateOnly({ format: 'MM/dd/yyyy' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MM/dd/yyyy');
    });
  });

  describe('dateTime method', () => {
    it('should configure date-time with default options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd HH:mm:ss');
      expect(column.meta?.dateFormat?.locale).toBe('en-US');
      expect(column.meta?.dateFormat?.timeZone).toBe('UTC');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure date-time with custom format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ format: 'MMM dd, yyyy HH:mm' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy HH:mm');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure date-time with custom locale', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ locale: 'de-DE' })
        .build();

      expect(column.meta?.dateFormat?.locale).toBe('de-DE');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure date-time with custom timeZone', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ timeZone: 'America/New_York' })
        .build();

      expect(column.meta?.dateFormat?.timeZone).toBe('America/New_York');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure date-time with all options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({
          format: 'yyyy-MM-dd HH:mm:ss',
          locale: 'en-GB',
          timeZone: 'Europe/London',
        })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd HH:mm:ss');
      expect(column.meta?.dateFormat?.locale).toBe('en-GB');
      expect(column.meta?.dateFormat?.timeZone).toBe('Europe/London');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should support method chaining with dateTime', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ format: 'yyyy-MM-dd HH:mm:ss' })
        .sortable()
        .build();

      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect(column.sortable).toBe(true);
    });

    it('should override format when set multiple times', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ format: 'yyyy-MM-dd HH:mm:ss' })
        .dateTime({ format: 'MMM dd, yyyy HH:mm' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy HH:mm');
    });
  });

  describe('timeOnly method', () => {
    it('should configure time-only with default options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('HH:mm:ss');
      expect(column.meta?.dateFormat?.locale).toBe('en-US');
      expect(column.meta?.dateFormat?.timeZone).toBe('UTC');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect(column.meta?.dateFormat?.showSeconds).toBe(true);
    });

    it('should configure time-only with custom format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ format: 'HH:mm' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('HH:mm');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure time-only with showSeconds disabled', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ showSeconds: false })
        .build();

      expect(column.meta?.dateFormat?.showSeconds).toBe(false);
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure time-only with custom locale', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ locale: 'de-DE' })
        .build();

      expect(column.meta?.dateFormat?.locale).toBe('de-DE');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure time-only with custom timeZone', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ timeZone: 'America/New_York' })
        .build();

      expect(column.meta?.dateFormat?.timeZone).toBe('America/New_York');
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should configure time-only with all options', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({
          format: 'HH:mm',
          locale: 'en-US',
          timeZone: 'America/New_York',
          showSeconds: false,
        })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('HH:mm');
      expect(column.meta?.dateFormat?.locale).toBe('en-US');
      expect(column.meta?.dateFormat?.timeZone).toBe('America/New_York');
      expect(column.meta?.dateFormat?.showSeconds).toBe(false);
      expect(column.meta?.dateFormat?.showTime).toBe(true);
    });

    it('should support method chaining with timeOnly', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ format: 'HH:mm' })
        .sortable()
        .build();

      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect(column.sortable).toBe(true);
    });
  });

  describe('chronological method', () => {
    it('should configure chronological sorting', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .chronological()
        .build();

      expect(column.meta?.sortType).toBe('chronological');
    });

    it('should support method chaining with chronological', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .chronological()
        .format('MMM dd, yyyy')
        .sortable()
        .build();

      expect(column.meta?.sortType).toBe('chronological');
      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect(column.sortable).toBe(true);
    });

    it('should work with dateRange', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .chronological()
        .dateRange({ includeNull: false })
        .build();

      expect(column.meta?.sortType).toBe('chronological');
      expect(column.filter?.includeNull).toBe(false);
    });

    it('should work with dateOnly', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .chronological()
        .dateOnly({ format: 'yyyy-MM-dd' })
        .build();

      expect(column.meta?.sortType).toBe('chronological');
      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
    });
  });

  describe('Method combinations', () => {
    it('should combine format with dateOperators', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { locale: 'en-US' })
        .dateOperators(['is', 'before', 'after'])
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect(column.filter?.operators).toEqual(['is', 'before', 'after']);
    });

    it('should combine dateRange with format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ minDate: new Date('2024-01-01'), includeNull: false })
        .format('MMM dd, yyyy')
        .build();

      expect((column.meta?.dateRange as { minDate?: Date })?.minDate).toBeDefined();
      expect(column.filter?.includeNull).toBe(false);
      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
    });

    it('should combine dateOnly with dateOperators', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateOnly({ format: 'yyyy-MM-dd' })
        .dateOperators(['is', 'isToday'])
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
      expect(column.filter?.operators).toEqual(['is', 'isToday']);
    });

    it('should combine dateTime with dateRange', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((event) => event.createdAt)
        .dateTime({ format: 'yyyy-MM-dd HH:mm:ss' })
        .dateRange({ maxDate: new Date('2024-12-31') })
        .build();

      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect((column.meta?.dateRange as { maxDate?: Date })?.maxDate).toBeDefined();
    });

    it('should combine timeOnly with chronological', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('startTime')
        .displayName('Start Time')
        .accessor((event) => event.startTime)
        .timeOnly({ format: 'HH:mm', showSeconds: false })
        .chronological()
        .build();

      expect(column.meta?.dateFormat?.showTime).toBe(true);
      expect(column.meta?.dateFormat?.showSeconds).toBe(false);
      expect(column.meta?.sortType).toBe('chronological');
    });

    it('should combine all enhancement methods', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { locale: 'en-US', showTime: false })
        .dateRange({
          minDate: new Date('2024-01-01'),
          maxDate: new Date('2024-12-31'),
          includeNull: false,
        })
        .dateOperators(['is', 'before', 'after', 'isToday'])
        .chronological()
        .build();

      expect(column.meta?.dateFormat?.format).toBe('MMM dd, yyyy');
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate).toBeDefined();
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate).toBeDefined();
      expect(column.filter?.operators).toHaveLength(4);
      expect(column.meta?.sortType).toBe('chronological');
    });
  });

  describe('Edge cases', () => {
    it('should handle format with empty format string', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('')
        .build();

      expect(column.meta?.dateFormat?.format).toBe('');
    });

    it('should handle dateRange with minDate equal to maxDate', () => {
      const sameDate = new Date('2024-06-01');
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateRange({ minDate: sameDate, maxDate: sameDate })
        .build();

      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.minDate).toEqual(
        sameDate
      );
      expect((column.meta?.dateRange as { minDate?: Date; maxDate?: Date })?.maxDate).toEqual(
        sameDate
      );
    });

    it('should handle dateOnly overriding dateTime', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .dateTime({ format: 'yyyy-MM-dd HH:mm:ss' })
        .dateOnly({ format: 'yyyy-MM-dd' })
        .build();

      expect(column.meta?.dateFormat?.format).toBe('yyyy-MM-dd');
      expect(column.meta?.dateFormat?.showTime).toBe(false);
    });

    it('should handle relative overriding showRelative from format', () => {
      const builder = new DateColumnBuilder<TestEvent>();
      const column = builder
        .id('eventDate')
        .displayName('Event Date')
        .accessor((event) => event.eventDate)
        .format('MMM dd, yyyy', { showRelative: false })
        .relative({ style: 'short' })
        .build();

      expect(column.meta?.dateFormat?.showRelative).toBe(true);
      expect(column.meta?.dateFormat?.relativeOptions?.style).toBe('short');
    });
  });
});
