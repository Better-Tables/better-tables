import { describe, expect, it } from 'bun:test';
import { NumberColumnBuilder } from '../../src/builders/number-column-builder';

interface TestProduct {
  id: string;
  name: string;
  price: number;
  rating: number;
  views: number;
  stock: number;
}

describe('NumberColumnBuilder Enhancements', () => {
  describe('format method', () => {
    it('should configure format with default options', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format()
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.useGrouping).toBe(true);
      expect(column.meta?.numberFormat?.notation).toBe('standard');
    });

    it('should configure format with custom locale', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ locale: 'de-DE' })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('de-DE');
    });

    it('should configure format with fraction digits', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })
        .build();

      expect(column.meta?.numberFormat?.minimumFractionDigits).toBe(2);
      expect(column.meta?.numberFormat?.maximumFractionDigits).toBe(4);
    });

    it('should configure format with grouping disabled', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ useGrouping: false })
        .build();

      expect(column.meta?.numberFormat?.useGrouping).toBe(false);
    });

    it('should configure format with different notation styles', () => {
      const scientific = new NumberColumnBuilder<TestProduct>()
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ notation: 'scientific' })
        .build();

      const engineering = new NumberColumnBuilder<TestProduct>()
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ notation: 'engineering' })
        .build();

      const compact = new NumberColumnBuilder<TestProduct>()
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ notation: 'compact' })
        .build();

      expect(scientific.meta?.numberFormat?.notation).toBe('scientific');
      expect(engineering.meta?.numberFormat?.notation).toBe('engineering');
      expect(compact.meta?.numberFormat?.notation).toBe('compact');
    });

    it('should support method chaining with format', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ locale: 'fr-FR', notation: 'standard' })
        .precision(2)
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('fr-FR');
      expect(column.meta?.precision).toBe(2);
    });

    it('should merge format options with existing meta', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ locale: 'en-US' })
        .format({ notation: 'compact' })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.notation).toBe('compact');
    });
  });

  describe('precision method', () => {
    it('should set decimal precision for display', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('rating')
        .displayName('Rating')
        .accessor((product) => product.rating)
        .precision(2)
        .build();

      expect(column.meta?.precision).toBe(2);
    });

    it('should support different precision values', () => {
      const zero = new NumberColumnBuilder<TestProduct>()
        .id('stock')
        .displayName('Stock')
        .accessor((product) => product.stock)
        .precision(0)
        .build();

      const high = new NumberColumnBuilder<TestProduct>()
        .id('rating')
        .displayName('Rating')
        .accessor((product) => product.rating)
        .precision(4)
        .build();

      expect(zero.meta?.precision).toBe(0);
      expect(high.meta?.precision).toBe(4);
    });

    it('should support method chaining with precision', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .precision(2)
        .format({ locale: 'en-US' })
        .build();

      expect(column.meta?.precision).toBe(2);
      expect(column.meta?.numberFormat?.locale).toBe('en-US');
    });

    it('should override precision when set multiple times', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .precision(2)
        .precision(4)
        .build();

      expect(column.meta?.precision).toBe(4);
    });
  });

  describe('compact method', () => {
    it('should configure compact notation with default options', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .compact()
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.numberFormat?.compactDisplay).toBe('short');
    });

    it('should configure compact notation with custom locale', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .compact({ locale: 'fr-FR' })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('fr-FR');
      expect(column.meta?.numberFormat?.notation).toBe('compact');
    });

    it('should configure compact notation with long display', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .compact({ compactDisplay: 'long' })
        .build();

      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.numberFormat?.compactDisplay).toBe('long');
    });

    it('should preserve existing numberFormat properties when setting compact', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .format({ locale: 'de-DE', useGrouping: true })
        .compact({ locale: 'de-DE', compactDisplay: 'short' })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('de-DE');
      expect(column.meta?.numberFormat?.useGrouping).toBe(true);
      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.numberFormat?.compactDisplay).toBe('short');
    });

    it('should use default locale when compact is called without locale option', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .format({ locale: 'de-DE', useGrouping: true })
        .compact({ compactDisplay: 'short' })
        .build();

      // compact() defaults to 'en-US' if locale not provided, overriding previous locale
      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.useGrouping).toBe(true);
      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.numberFormat?.compactDisplay).toBe('short');
    });

    it('should support method chaining with compact', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .compact({ locale: 'en-US' })
        .precision(0)
        .build();

      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.precision).toBe(0);
    });
  });

  describe('numberOperators method', () => {
    it('should set specific number operators', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators(['equals', 'greaterThan', 'lessThan'])
        .build();

      expect(column.filter?.operators).toEqual(['equals', 'greaterThan', 'lessThan']);
    });

    it('should set all available number operators', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators([
          'equals',
          'notEquals',
          'greaterThan',
          'greaterThanOrEqual',
          'lessThan',
          'lessThanOrEqual',
          'between',
          'notBetween',
        ])
        .build();

      expect(column.filter?.operators).toHaveLength(8);
      expect(column.filter?.operators).toContain('equals');
      expect(column.filter?.operators).toContain('between');
      expect(column.filter?.operators).toContain('notBetween');
    });

    it('should override operators when set multiple times', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators(['equals', 'greaterThan'])
        .numberOperators(['lessThan'])
        .build();

      expect(column.filter?.operators).toEqual(['lessThan']);
    });

    it('should work with range method', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .range(0, 1000)
        .numberOperators(['equals', 'between'])
        .build();

      expect(column.filter?.min).toBe(0);
      expect(column.filter?.max).toBe(1000);
      expect(column.filter?.operators).toEqual(['equals', 'between']);
    });

    it('should support method chaining with numberOperators', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators(['equals', 'greaterThan'])
        .format({ locale: 'en-US' })
        .build();

      expect(column.filter?.operators).toEqual(['equals', 'greaterThan']);
      expect(column.meta?.numberFormat?.locale).toBe('en-US');
    });

    it('should handle empty operators array', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators([])
        .build();

      expect(column.filter?.operators).toEqual([]);
    });
  });

  describe('Method combinations', () => {
    it('should combine format, precision, and compact', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('views')
        .displayName('Views')
        .accessor((product) => product.views)
        .format({ locale: 'en-US', useGrouping: true })
        .precision(2)
        .compact({ compactDisplay: 'short' })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.useGrouping).toBe(true);
      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.numberFormat?.compactDisplay).toBe('short');
      expect(column.meta?.precision).toBe(2);
    });

    it('should combine numberOperators with format options', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .numberOperators(['equals', 'between'])
        .format({ notation: 'standard', locale: 'en-US' })
        .precision(2)
        .build();

      expect(column.filter?.operators).toEqual(['equals', 'between']);
      expect(column.meta?.numberFormat?.notation).toBe('standard');
      expect(column.meta?.precision).toBe(2);
    });

    it('should combine all enhancement methods', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({ locale: 'en-US', useGrouping: true })
        .precision(2)
        .compact({ compactDisplay: 'short' })
        .numberOperators(['equals', 'greaterThan', 'lessThan', 'between'])
        .build();

      expect(column.meta?.numberFormat?.notation).toBe('compact');
      expect(column.meta?.precision).toBe(2);
      expect(column.filter?.operators).toHaveLength(4);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined values in format options', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .format({
          locale: 'en-US',
          minimumFractionDigits: undefined,
          maximumFractionDigits: undefined,
        })
        .build();

      expect(column.meta?.numberFormat?.locale).toBe('en-US');
      expect(column.meta?.numberFormat?.minimumFractionDigits).toBeUndefined();
      expect(column.meta?.numberFormat?.maximumFractionDigits).toBeUndefined();
    });

    it('should handle very high precision values', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('price')
        .displayName('Price')
        .accessor((product) => product.price)
        .precision(10)
        .build();

      expect(column.meta?.precision).toBe(10);
    });

    it('should handle zero precision', () => {
      const builder = new NumberColumnBuilder<TestProduct>();
      const column = builder
        .id('stock')
        .displayName('Stock')
        .accessor((product) => product.stock)
        .precision(0)
        .build();

      expect(column.meta?.precision).toBe(0);
    });
  });
});
