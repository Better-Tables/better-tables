import { describe, expect, it } from 'vitest';
import { getNumberInputConfig } from '../number-format-utils';

describe('getNumberInputConfig', () => {
  describe('basic number type', () => {
    it('should return default config for number type', () => {
      const config = getNumberInputConfig('number');
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
      expect(config.allowNegative).toBe(true);
      expect(config.allowDecimal).toBe(true);
      expect(config.useGrouping).toBe(true);
    });

    it('should use column meta for number type', () => {
      const meta = {
        decimals: 3,
        minDecimals: 1,
        maxDecimals: 4,
        min: 0,
        max: 1000,
        step: 0.1,
      };
      
      const config = getNumberInputConfig('number', meta);
      
      expect(config.decimals).toBe(3);
      expect(config.minDecimals).toBe(1);
      expect(config.maxDecimals).toBe(4);
      expect(config.min).toBe(0);
      expect(config.max).toBe(1000);
      expect(config.step).toBe(0.1);
    });
  });

  describe('currency type', () => {
    it('should return currency config with defaults', () => {
      const config = getNumberInputConfig('currency');
      
      expect(config.type).toBe('currency');
      expect(config.currency).toBe('USD');
      expect(config.decimals).toBe(2);
      expect(config.minDecimals).toBe(2);
      expect(config.maxDecimals).toBe(2);
      expect(config.placeholder).toBe('Enter amount...');
    });

    it('should use custom currency from meta', () => {
      const meta = {
        currency: 'EUR',
        decimals: 3,
      };
      
      const config = getNumberInputConfig('currency', meta);
      
      expect(config.currency).toBe('EUR');
      expect(config.decimals).toBe(3);
      expect(config.minDecimals).toBe(2);
      expect(config.maxDecimals).toBe(2);
    });

    it('should handle missing currency meta', () => {
      const meta = {
        decimals: 1,
      };
      
      const config = getNumberInputConfig('currency', meta);
      
      expect(config.currency).toBe('USD');
      expect(config.decimals).toBe(1);
    });
  });

  describe('percentage type', () => {
    it('should return percentage config with defaults', () => {
      const config = getNumberInputConfig('percentage');
      
      expect(config.type).toBe('percentage');
      expect(config.decimals).toBe(2);
      expect(config.minDecimals).toBe(0);
      expect(config.maxDecimals).toBe(2);
      expect(config.placeholder).toBe('Enter percentage...');
      expect(config.min).toBe(0);
      expect(config.max).toBe(100);
    });

    it('should use custom percentage settings from meta', () => {
      const meta = {
        decimals: 1,
        min: 10,
        max: 90,
      };
      
      const config = getNumberInputConfig('percentage', meta);
      
      expect(config.decimals).toBe(1);
      expect(config.min).toBe(10);
      expect(config.max).toBe(90);
    });
  });

  describe('unknown type', () => {
    it('should return default config for unknown type', () => {
      const config = getNumberInputConfig('unknown');
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
      expect(config.allowNegative).toBe(true);
      expect(config.allowDecimal).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null meta', () => {
      const config = getNumberInputConfig('number', null as unknown as Record<string, unknown>);
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
    });

    it('should handle undefined meta', () => {
      const config = getNumberInputConfig('number', undefined);
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
    });

    it('should handle empty meta object', () => {
      const config = getNumberInputConfig('number', {});
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
    });

    it('should handle invalid meta values gracefully', () => {
      const meta = {
        decimals: 'invalid',
        min: 'not-a-number',
        max: null,
        currency: 123,
      };
      
      const config = getNumberInputConfig('currency', meta);
      
      expect(config.currency).toBe('USD'); // Should fallback to default
      expect(config.decimals).toBe(2); // Should use default
      expect(config.min).toBeUndefined(); // Invalid values should be ignored
      expect(config.max).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should work with complex meta configuration', () => {
      const meta = {
        currency: 'JPY',
        decimals: 0,
        minDecimals: 0,
        maxDecimals: 0,
        min: 1,
        max: 999999,
        step: 1,
        locale: 'ja-JP',
        prefix: '¥',
        suffix: '',
        useGrouping: true,
        allowNegative: false,
        allowDecimal: false,
        placeholder: '金額を入力してください',
      };
      
      const config = getNumberInputConfig('currency', meta);
      
      expect(config.type).toBe('currency');
      expect(config.currency).toBe('JPY');
      expect(config.decimals).toBe(0);
      expect(config.minDecimals).toBe(0);
      expect(config.maxDecimals).toBe(0);
      expect(config.min).toBe(1);
      expect(config.max).toBe(999999);
      expect(config.step).toBe(1);
      expect(config.locale).toBe('ja-JP');
      expect(config.prefix).toBe('¥');
      expect(config.suffix).toBeUndefined();
      expect(config.useGrouping).toBe(true);
      expect(config.allowNegative).toBe(false);
      expect(config.allowDecimal).toBe(false);
      expect(config.placeholder).toBe('Enter amount...');
    });

    it('should preserve base config when meta is minimal', () => {
      const meta = {
        decimals: 1,
      };
      
      const config = getNumberInputConfig('number', meta);
      
      expect(config.type).toBe('number');
      expect(config.locale).toBe('en-US');
      expect(config.decimals).toBe(1);
      expect(config.allowNegative).toBe(true);
      expect(config.allowDecimal).toBe(true);
      expect(config.useGrouping).toBe(true);
    });
  });
});
