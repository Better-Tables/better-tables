import { describe, expect, it } from 'vitest';
import { DateColumnBuilder } from '../../src/builders/date-column-builder';

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
});
