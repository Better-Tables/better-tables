import { describe, expect, it } from 'bun:test';
import type { FilterState } from '../../src/types/filter';
import {
  assertFilterValueType,
  isBooleanFilterState,
  isCustomFilterState,
  isDateFilterState,
  isDateFilterValues,
  isDateLike,
  isFilterValuesOfType,
  isJsonFilterState,
  isMultiOptionFilterState,
  isNumberFilterState,
  isNumberFilterValues,
  isOptionFilterState,
  isTextFilterState,
  isTextFilterValues,
  isValidDate,
} from '../../src/utils/type-guards';

describe('Type Guards', () => {
  describe('Filter State Type Guards', () => {
    describe('isTextFilterState', () => {
      it('should return true for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isTextFilterState(filter)).toBe(true);
      });

      it('should return true for email filter', () => {
        const filter = { type: 'email', values: ['test@example.com'] } as FilterState;
        expect(isTextFilterState(filter)).toBe(true);
      });

      it('should return true for url filter', () => {
        const filter = { type: 'url', values: ['https://example.com'] } as FilterState;
        expect(isTextFilterState(filter)).toBe(true);
      });

      it('should return true for phone filter', () => {
        const filter = { type: 'phone', values: ['1234567890'] } as FilterState;
        expect(isTextFilterState(filter)).toBe(true);
      });

      it('should return false for number filter', () => {
        const filter = { type: 'number', values: [1, 2] } as FilterState;
        expect(isTextFilterState(filter)).toBe(false);
      });

      it('should return false for date filter', () => {
        const filter = { type: 'date', values: [new Date()] } as FilterState;
        expect(isTextFilterState(filter)).toBe(false);
      });
    });

    describe('isNumberFilterState', () => {
      it('should return true for number filter', () => {
        const filter = { type: 'number', values: [1, 2] } as FilterState;
        expect(isNumberFilterState(filter)).toBe(true);
      });

      it('should return true for currency filter', () => {
        const filter = { type: 'currency', values: [100.5] } as FilterState;
        expect(isNumberFilterState(filter)).toBe(true);
      });

      it('should return true for percentage filter', () => {
        const filter = { type: 'percentage', values: [50] } as FilterState;
        expect(isNumberFilterState(filter)).toBe(true);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isNumberFilterState(filter)).toBe(false);
      });

      it('should return false for date filter', () => {
        const filter = { type: 'date', values: [new Date()] } as FilterState;
        expect(isNumberFilterState(filter)).toBe(false);
      });
    });

    describe('isDateFilterState', () => {
      it('should return true for date filter', () => {
        const filter = { type: 'date', values: [new Date()] } as FilterState;
        expect(isDateFilterState(filter)).toBe(true);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isDateFilterState(filter)).toBe(false);
      });

      it('should return false for number filter', () => {
        const filter = { type: 'number', values: [1] } as FilterState;
        expect(isDateFilterState(filter)).toBe(false);
      });
    });

    describe('isBooleanFilterState', () => {
      it('should return true for boolean filter', () => {
        const filter = { type: 'boolean', values: [true] } as FilterState;
        expect(isBooleanFilterState(filter)).toBe(true);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isBooleanFilterState(filter)).toBe(false);
      });

      it('should return false for number filter', () => {
        const filter = { type: 'number', values: [1] } as FilterState;
        expect(isBooleanFilterState(filter)).toBe(false);
      });
    });

    describe('isOptionFilterState', () => {
      it('should return true for option filter', () => {
        const filter = { type: 'option', values: ['active'] } as FilterState;
        expect(isOptionFilterState(filter)).toBe(true);
      });

      it('should return false for multiOption filter', () => {
        const filter = { type: 'multiOption', values: ['active'] } as FilterState;
        expect(isOptionFilterState(filter)).toBe(false);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isOptionFilterState(filter)).toBe(false);
      });
    });

    describe('isMultiOptionFilterState', () => {
      it('should return true for multiOption filter', () => {
        const filter = { type: 'multiOption', values: ['active', 'pending'] } as FilterState;
        expect(isMultiOptionFilterState(filter)).toBe(true);
      });

      it('should return false for option filter', () => {
        const filter = { type: 'option', values: ['active'] } as FilterState;
        expect(isMultiOptionFilterState(filter)).toBe(false);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isMultiOptionFilterState(filter)).toBe(false);
      });
    });

    describe('isJsonFilterState', () => {
      it('should return true for json filter', () => {
        const filter = { type: 'json', values: [{ a: 1 }] } as FilterState;
        expect(isJsonFilterState(filter)).toBe(true);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isJsonFilterState(filter)).toBe(false);
      });
    });

    describe('isCustomFilterState', () => {
      it('should return true for custom filter', () => {
        const filter = { type: 'custom', values: [1] } as FilterState;
        expect(isCustomFilterState(filter)).toBe(true);
      });

      it('should return false for text filter', () => {
        const filter = { type: 'text', values: ['test'] } as FilterState;
        expect(isCustomFilterState(filter)).toBe(false);
      });
    });
  });

  describe('Filter Value Type Guards', () => {
    describe('isTextFilterValues', () => {
      it('should return true for filter with string values', () => {
        const filter = { type: 'text', values: ['a', 'b', 'c'] } as FilterState;
        expect(isTextFilterValues(filter)).toBe(true);
      });

      it('should return false for filter with number values', () => {
        const filter = { type: 'text', values: [1, 2, 3] } as unknown as FilterState;
        expect(isTextFilterValues(filter)).toBe(false);
      });

      it('should return false for filter with mixed types', () => {
        const filter = { type: 'text', values: ['a', 1] } as unknown as FilterState;
        expect(isTextFilterValues(filter)).toBe(false);
      });

      it('should return true for empty array', () => {
        const filter = { type: 'text', values: [] } as unknown as FilterState;
        expect(isTextFilterValues(filter)).toBe(true);
      });
    });

    describe('isNumberFilterValues', () => {
      it('should return true for filter with number values', () => {
        const filter = { type: 'number', values: [1, 2, 3] } as FilterState;
        expect(isNumberFilterValues(filter)).toBe(true);
      });

      it('should return false for filter with string values', () => {
        const filter = { type: 'number', values: ['1', '2'] } as unknown as FilterState;
        expect(isNumberFilterValues(filter)).toBe(false);
      });

      it('should return false for filter with mixed types', () => {
        const filter = { type: 'number', values: [1, '2'] } as unknown as FilterState;
        expect(isNumberFilterValues(filter)).toBe(false);
      });

      it('should handle NaN', () => {
        const filter = { type: 'number', values: [NaN] } as FilterState;
        expect(isNumberFilterValues(filter)).toBe(true); // NaN is still a number type
      });

      it('should handle Infinity', () => {
        const filter = { type: 'number', values: [Infinity] } as FilterState;
        expect(isNumberFilterValues(filter)).toBe(true);
      });
    });

    describe('isDateFilterValues', () => {
      it('should return true for filter with Date values', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-02');
        const filter = { type: 'date', values: [date1, date2] } as FilterState;
        expect(isDateFilterValues(filter)).toBe(true);
      });

      it('should return false for filter with invalid Date', () => {
        const invalidDate = new Date('invalid');
        const filter = { type: 'date', values: [invalidDate] } as FilterState;
        expect(isDateFilterValues(filter)).toBe(false);
      });

      it('should return false for filter with string values', () => {
        const filter = { type: 'date', values: ['2023-01-01'] } as unknown as FilterState;
        expect(isDateFilterValues(filter)).toBe(false);
      });

      it('should return false for filter with mixed types', () => {
        const filter = {
          type: 'date',
          values: [new Date(), '2023-01-01'],
        } as unknown as FilterState;
        expect(isDateFilterValues(filter)).toBe(false);
      });
    });

    describe('isFilterValuesOfType', () => {
      it('should validate all values match type checker', () => {
        const filter = { type: 'text', values: ['a', 'b', 'c'] } as FilterState;
        const checker = (value: unknown): value is string => typeof value === 'string';
        expect(isFilterValuesOfType(filter, checker)).toBe(true);
      });

      it('should return false when any value fails type checker', () => {
        const filter = { type: 'text', values: ['a', 1, 'c'] } as unknown as FilterState;
        const checker = (value: unknown): value is string => typeof value === 'string';
        expect(isFilterValuesOfType(filter, checker)).toBe(false);
      });

      it('should return true for empty array', () => {
        const filter = { type: 'text', values: [] } as unknown as FilterState;
        const checker = (value: unknown): value is string => typeof value === 'string';
        expect(isFilterValuesOfType(filter, checker)).toBe(true);
      });
    });

    describe('assertFilterValueType', () => {
      it('should return true when types match', () => {
        const filter = { type: 'text', values: ['a'] } as FilterState;
        expect(assertFilterValueType(filter, 'text')).toBe(true);
      });

      it('should throw error when types do not match', () => {
        const filter = { type: 'text', values: ['a'] } as FilterState;
        expect(() => assertFilterValueType(filter, 'number')).toThrow(
          'Expected filter type number, got text'
        );
      });

      it('should narrow type correctly', () => {
        const filter = { type: 'text', values: ['a'] } as FilterState;
        if (assertFilterValueType<string>(filter, 'text')) {
          expect(filter.values).toEqual(['a']);
        }
      });
    });
  });

  describe('Date Utilities', () => {
    describe('isValidDate', () => {
      it('should return true for valid Date object', () => {
        const date = new Date('2023-01-01');
        expect(isValidDate(date)).toBe(true);
      });

      it('should return false for invalid Date object', () => {
        const invalidDate = new Date('invalid');
        expect(isValidDate(invalidDate)).toBe(false);
      });

      it('should return false for string', () => {
        expect(isValidDate('2023-01-01')).toBe(false);
      });

      it('should return false for number', () => {
        expect(isValidDate(1672531200000)).toBe(false);
      });

      it('should return false for null', () => {
        expect(isValidDate(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isValidDate(undefined)).toBe(false);
      });

      it('should return false for object', () => {
        expect(isValidDate({})).toBe(false);
      });
    });

    describe('isDateLike', () => {
      it('should return true for valid Date object', () => {
        const date = new Date('2023-01-01');
        expect(isDateLike(date)).toBe(true);
      });

      it('should return false for invalid Date object', () => {
        const invalidDate = new Date('invalid');
        expect(isDateLike(invalidDate)).toBe(false);
      });

      it('should return true for valid date string', () => {
        expect(isDateLike('2023-01-01')).toBe(true);
      });

      it('should return false for invalid date string', () => {
        expect(isDateLike('invalid-date')).toBe(false);
      });

      it('should return true for valid timestamp number', () => {
        expect(isDateLike(1672531200000)).toBe(true);
      });

      it('should return false for invalid timestamp number', () => {
        expect(isDateLike(NaN)).toBe(false);
      });

      it('should return false for null', () => {
        expect(isDateLike(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isDateLike(undefined)).toBe(false);
      });

      it('should return false for object', () => {
        expect(isDateLike({})).toBe(false);
      });

      it('should return false for array', () => {
        expect(isDateLike([])).toBe(false);
      });

      it('should return false for boolean', () => {
        expect(isDateLike(true)).toBe(false);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle edge case with empty string in date check', () => {
      expect(isDateLike('')).toBe(false);
    });

    it('should handle edge case with 0 as timestamp', () => {
      expect(isDateLike(0)).toBe(true); // Epoch time is valid
    });

    it('should handle negative timestamps', () => {
      expect(isDateLike(-1000)).toBe(true);
    });

    it('should handle very large numbers', () => {
      // Use a valid large timestamp (year 2100)
      const largeTimestamp = new Date('2100-01-01').getTime();
      expect(isDateLike(largeTimestamp)).toBe(true);
    });

    it('should handle numbers beyond valid date range', () => {
      // MAX_SAFE_INTEGER is beyond valid date range
      expect(isDateLike(Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('should handle date string with time component', () => {
      expect(isDateLike('2023-01-01T00:00:00.000Z')).toBe(true);
    });

    it('should handle ISO date string', () => {
      expect(isDateLike('2023-01-01')).toBe(true);
    });
  });
});
