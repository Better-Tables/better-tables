import { describe, expect, it } from 'vitest';
import type { ColumnMeta } from '../../src/types/column-meta';
import {
  getColumnStyle,
  getCurrencyFormat,
  getDateFormat,
  getNumberFormat,
  getOptionColors,
  getTextFormat,
} from '../../src/utils/meta-accessors';

describe('Meta Accessors', () => {
  describe('getNumberFormat', () => {
    it('should return number format when present', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true,
        },
      };

      const format = getNumberFormat(meta);

      expect(format).toEqual({
        locale: 'en-US',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      });
    });

    it('should return empty object when meta is undefined', () => {
      const format = getNumberFormat(undefined);

      expect(format).toEqual({});
    });

    it('should return empty object when numberFormat is missing', () => {
      const meta: ColumnMeta = {};

      const format = getNumberFormat(meta);

      expect(format).toEqual({});
    });

    it('should return partial format configuration', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
        },
      };

      const format = getNumberFormat(meta);

      expect(format).toEqual({
        locale: 'en-US',
      });
    });
  });

  describe('getCurrencyFormat', () => {
    it('should merge numberFormat and currencyFormat', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
          useGrouping: true,
        },
        currencyFormat: {
          currency: 'USD',
          currencyDisplay: 'symbol',
        },
      };

      const format = getCurrencyFormat(meta);

      expect(format).toEqual({
        locale: 'en-US',
        useGrouping: true,
        currency: 'USD',
        currencyDisplay: 'symbol',
      });
    });

    it('should prioritize currencyFormat over numberFormat when keys overlap', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-GB',
          minimumFractionDigits: 0,
        },
        currencyFormat: {
          locale: 'en-US',
          currency: 'EUR',
          minimumFractionDigits: 2,
        },
      };

      const format = getCurrencyFormat(meta);

      expect(format.locale).toBe('en-US'); // currencyFormat takes precedence
      expect(format.minimumFractionDigits).toBe(2);
      expect(format.currency).toBe('EUR');
    });

    it('should return empty object when meta is undefined', () => {
      const format = getCurrencyFormat(undefined);

      expect(format).toEqual({});
    });

    it('should return only currencyFormat when numberFormat is missing', () => {
      const meta: ColumnMeta = {
        currencyFormat: {
          currency: 'USD',
        },
      };

      const format = getCurrencyFormat(meta);

      expect(format).toEqual({
        currency: 'USD',
      });
    });

    it('should return only numberFormat when currencyFormat is missing', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
        },
      };

      const format = getCurrencyFormat(meta);

      expect(format).toEqual({
        locale: 'en-US',
      });
    });
  });

  describe('getDateFormat', () => {
    it('should return date format when present', () => {
      const meta: ColumnMeta = {
        dateFormat: {
          format: 'MMM dd, yyyy',
          locale: 'en-US',
          showTime: true,
        },
      };

      const format = getDateFormat(meta);

      expect(format).toEqual({
        format: 'MMM dd, yyyy',
        locale: 'en-US',
        showTime: true,
      });
    });

    it('should return empty object when meta is undefined', () => {
      const format = getDateFormat(undefined);

      expect(format).toEqual({});
    });

    it('should return empty object when dateFormat is missing', () => {
      const meta: ColumnMeta = {};

      const format = getDateFormat(meta);

      expect(format).toEqual({});
    });

    it('should return partial date format configuration', () => {
      const meta: ColumnMeta = {
        dateFormat: {
          format: 'yyyy-MM-dd',
        },
      };

      const format = getDateFormat(meta);

      expect(format).toEqual({
        format: 'yyyy-MM-dd',
      });
    });
  });

  describe('getTextFormat', () => {
    it('should return text format when present', () => {
      const meta: ColumnMeta = {
        textFormat: {
          truncate: {
            maxLength: 50,
            suffix: '...',
            showTooltip: true,
          },
          textTransform: 'capitalize',
          trim: true,
        },
      };

      const format = getTextFormat(meta);

      expect(format).toEqual({
        truncate: {
          maxLength: 50,
          suffix: '...',
          showTooltip: true,
        },
        textTransform: 'capitalize',
        trim: true,
      });
    });

    it('should return empty object when meta is undefined', () => {
      const format = getTextFormat(undefined);

      expect(format).toEqual({});
    });

    it('should return empty object when textFormat is missing', () => {
      const meta: ColumnMeta = {};

      const format = getTextFormat(meta);

      expect(format).toEqual({});
    });

    it('should return partial text format configuration', () => {
      const meta: ColumnMeta = {
        textFormat: {
          textTransform: 'uppercase',
        },
      };

      const format = getTextFormat(meta);

      expect(format).toEqual({
        textTransform: 'uppercase',
      });
    });
  });

  describe('getColumnStyle', () => {
    it('should return all style properties when present', () => {
      const meta: ColumnMeta = {
        className: 'custom-column',
        width: 200,
        minWidth: 100,
        maxWidth: 400,
        headerClassName: 'custom-header',
      };

      const style = getColumnStyle(meta);

      expect(style).toEqual({
        className: 'custom-column',
        width: 200,
        minWidth: 100,
        maxWidth: 400,
        headerClassName: 'custom-header',
      });
    });

    it('should return undefined for missing properties', () => {
      const meta: ColumnMeta = {
        className: 'test',
      };

      const style = getColumnStyle(meta);

      expect(style).toEqual({
        className: 'test',
        width: undefined,
        minWidth: undefined,
        maxWidth: undefined,
        headerClassName: undefined,
      });
    });

    it('should return all undefined when meta is undefined', () => {
      const style = getColumnStyle(undefined);

      expect(style).toEqual({
        className: undefined,
        width: undefined,
        minWidth: undefined,
        maxWidth: undefined,
        headerClassName: undefined,
      });
    });

    it('should return all undefined when meta is empty', () => {
      const meta: ColumnMeta = {};
      const style = getColumnStyle(meta);

      expect(style).toEqual({
        className: undefined,
        width: undefined,
        minWidth: undefined,
        maxWidth: undefined,
        headerClassName: undefined,
      });
    });

    it('should handle partial style configuration', () => {
      const meta: ColumnMeta = {
        width: 150,
        headerClassName: 'header',
      };

      const style = getColumnStyle(meta);

      expect(style).toEqual({
        className: undefined,
        width: 150,
        minWidth: undefined,
        maxWidth: undefined,
        headerClassName: 'header',
      });
    });
  });

  describe('getOptionColors', () => {
    it('should return option colors when present', () => {
      const meta: ColumnMeta = {
        optionColors: {
          active: '#10b981',
          inactive: '#6b7280',
          pending: '#f59e0b',
        },
      };

      const colors = getOptionColors(meta);

      expect(colors).toEqual({
        active: '#10b981',
        inactive: '#6b7280',
        pending: '#f59e0b',
      });
    });

    it('should return empty object when meta is undefined', () => {
      const colors = getOptionColors(undefined);

      expect(colors).toEqual({});
    });

    it('should return empty object when optionColors is missing', () => {
      const meta: ColumnMeta = {};

      const colors = getOptionColors(meta);

      expect(colors).toEqual({});
    });

    it('should handle empty optionColors object', () => {
      const meta: ColumnMeta = {
        optionColors: {},
      };

      const colors = getOptionColors(meta);

      expect(colors).toEqual({});
    });

    it('should return single color mapping', () => {
      const meta: ColumnMeta = {
        optionColors: {
          success: '#10b981',
        },
      };

      const colors = getOptionColors(meta);

      expect(colors).toEqual({
        success: '#10b981',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle meta with all properties set', () => {
      const meta: ColumnMeta = {
        numberFormat: { locale: 'en-US' },
        currencyFormat: { currency: 'USD' },
        dateFormat: { format: 'yyyy-MM-dd' },
        textFormat: { textTransform: 'uppercase' },
        className: 'test',
        width: 100,
        minWidth: 50,
        maxWidth: 200,
        headerClassName: 'header',
        optionColors: { success: '#10b981' },
      };

      expect(getNumberFormat(meta).locale).toBe('en-US');
      expect(getCurrencyFormat(meta).currency).toBe('USD');
      expect(getDateFormat(meta).format).toBe('yyyy-MM-dd');
      expect(getTextFormat(meta).textTransform).toBe('uppercase');
      expect(getColumnStyle(meta).width).toBe(100);
      expect(getOptionColors(meta).success).toBe('#10b981');
    });

    it('should handle nested undefined values safely', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
          minimumFractionDigits: undefined,
        },
      };

      const format = getNumberFormat(meta);

      expect(format.locale).toBe('en-US');
      expect(format.minimumFractionDigits).toBeUndefined();
    });

    it('should not mutate original meta object', () => {
      const meta: ColumnMeta = {
        numberFormat: {
          locale: 'en-US',
        },
      };

      const format = getNumberFormat(meta);
      format.locale = 'en-GB'; // Modifying returned object

      expect(meta.numberFormat?.locale).toBe('en-US'); // Original unchanged
    });
  });
});
