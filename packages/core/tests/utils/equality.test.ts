import { describe, expect, it } from 'bun:test';
import {
  deepEqual,
  equalFilterValues,
  shallowEqualArrays,
  shallowEqualObjects,
} from '../../src/utils/equality';

describe('Equality Utilities', () => {
  describe('shallowEqualArrays', () => {
    it('should return true for same reference', () => {
      const arr = [1, 2, 3];
      expect(shallowEqualArrays(arr, arr)).toBe(true);
    });

    it('should return true for arrays with same elements', () => {
      expect(shallowEqualArrays([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return false for arrays with different elements', () => {
      expect(shallowEqualArrays([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with different lengths', () => {
      expect(shallowEqualArrays([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for empty array and non-empty array', () => {
      expect(shallowEqualArrays([], [1])).toBe(false);
    });

    it('should return true for empty arrays', () => {
      expect(shallowEqualArrays([], [])).toBe(true);
    });

    it('should compare references, not deep equality', () => {
      const obj = { a: 1 };
      expect(shallowEqualArrays([obj], [obj])).toBe(true);
      expect(shallowEqualArrays([obj], [{ a: 1 }])).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(shallowEqualArrays([null], [null])).toBe(true);
      expect(shallowEqualArrays([undefined], [undefined])).toBe(true);
      expect(shallowEqualArrays([null], [undefined])).toBe(false);
    });

    it('should handle mixed types', () => {
      expect(shallowEqualArrays([1, 'a', true], [1, 'a', true])).toBe(true);
      expect(shallowEqualArrays([1, 'a'], [1, 'b'])).toBe(false);
    });
  });

  describe('shallowEqualObjects', () => {
    it('should return true for same reference', () => {
      const obj = { a: 1, b: 2 };
      expect(shallowEqualObjects(obj, obj)).toBe(true);
    });

    it('should return true for objects with same properties', () => {
      expect(shallowEqualObjects({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return false for objects with different properties', () => {
      expect(shallowEqualObjects({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should return false for objects with different keys', () => {
      expect(shallowEqualObjects({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should return false for objects with different key counts', () => {
      expect(shallowEqualObjects({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should compare references, not deep equality', () => {
      const nested = { x: 1 };
      expect(shallowEqualObjects({ a: nested }, { a: nested })).toBe(true);
      expect(shallowEqualObjects({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
    });

    it('should handle empty objects', () => {
      expect(shallowEqualObjects({}, {})).toBe(true);
    });

    it('should handle null and undefined values', () => {
      expect(shallowEqualObjects({ a: null }, { a: null })).toBe(true);
      expect(shallowEqualObjects({ a: undefined }, { a: undefined })).toBe(true);
      expect(shallowEqualObjects({ a: null }, { a: undefined })).toBe(false);
    });

    it('should ignore property order', () => {
      expect(shallowEqualObjects({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });
  });

  describe('deepEqual', () => {
    it('should return true for same reference', () => {
      const obj = { a: 1 };
      expect(deepEqual(obj, obj)).toBe(true);
    });

    it('should return true for primitives with same value', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
    });

    it('should return false for different types', () => {
      expect(deepEqual(1, '1')).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should handle Date objects', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-01');
      const date3 = new Date('2023-01-02');

      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });

    it('should handle Set objects', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      const set3 = new Set([1, 2, 4]);

      expect(deepEqual(set1, set2)).toBe(true);
      expect(deepEqual(set1, set3)).toBe(false);
    });

    it('should handle Set objects with different sizes', () => {
      expect(deepEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
    });

    it('should handle Map objects', () => {
      const map1 = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const map2 = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const map3 = new Map([
        ['a', 1],
        ['b', 3],
      ]);

      expect(deepEqual(map1, map2)).toBe(true);
      expect(deepEqual(map1, map3)).toBe(false);
    });

    it('should handle nested Maps', () => {
      const map1 = new Map([['a', new Map([['b', 1]])]]);
      const map2 = new Map([['a', new Map([['b', 1]])]]);
      const map3 = new Map([['a', new Map([['b', 2]])]]);

      expect(deepEqual(map1, map2)).toBe(true);
      expect(deepEqual(map1, map3)).toBe(false);
    });

    it('should handle arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should handle nested arrays', () => {
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ]
        )
      ).toBe(true);
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 5],
          ]
        )
      ).toBe(false);
    });

    it('should handle objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });

    it('should handle nested objects', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it('should handle complex nested structures', () => {
      const obj1 = {
        a: 1,
        b: [2, { c: 3 }],
        d: new Map([['e', new Set([4, 5])]]),
      };
      const obj2 = {
        a: 1,
        b: [2, { c: 3 }],
        d: new Map([['e', new Set([4, 5])]]),
      };
      const obj3 = {
        a: 1,
        b: [2, { c: 4 }],
        d: new Map([['e', new Set([4, 5])]]),
      };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
      expect(deepEqual({ a: null }, { a: null })).toBe(true);
      expect(deepEqual({ a: undefined }, { a: undefined })).toBe(true);
    });

    it('should handle empty objects and arrays', () => {
      expect(deepEqual({}, {})).toBe(true);
      expect(deepEqual([], [])).toBe(true);
    });

    it('should return false for Date and non-Date', () => {
      expect(deepEqual(new Date('2023-01-01'), '2023-01-01')).toBe(false);
    });

    it('should handle invalid Date objects', () => {
      const invalidDate1 = new Date('invalid');
      const invalidDate2 = new Date('invalid');
      // Invalid dates should not be equal even if created the same way
      expect(deepEqual(invalidDate1, invalidDate2)).toBe(false);
    });
  });

  describe('equalFilterValues', () => {
    it('should return true for same reference', () => {
      const arr = [1, 2, 3];
      expect(equalFilterValues(arr, arr)).toBe(true);
    });

    it('should return true for arrays with same primitive values', () => {
      expect(equalFilterValues([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return false for arrays with different values', () => {
      expect(equalFilterValues([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with different lengths', () => {
      expect(equalFilterValues([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should handle Date objects', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-01');
      const date3 = new Date('2023-01-02');

      expect(equalFilterValues([date1], [date2])).toBe(true);
      expect(equalFilterValues([date1], [date3])).toBe(false);
    });

    it('should handle mixed types', () => {
      const date = new Date('2023-01-01');
      expect(equalFilterValues([1, 'a', date], [1, 'a', date])).toBe(true);
    });

    it('should handle nested arrays using deep equality', () => {
      expect(equalFilterValues([[1, 2]], [[1, 2]])).toBe(true);
      expect(equalFilterValues([[1, 2]], [[1, 3]])).toBe(false);
    });

    it('should handle nested objects using deep equality', () => {
      expect(equalFilterValues([{ a: 1 }], [{ a: 1 }])).toBe(true);
      expect(equalFilterValues([{ a: 1 }], [{ a: 2 }])).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(equalFilterValues([], [])).toBe(true);
    });

    it('should handle null and undefined values', () => {
      expect(equalFilterValues([null], [null])).toBe(true);
      expect(equalFilterValues([undefined], [undefined])).toBe(true);
      expect(equalFilterValues([null], [undefined])).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large arrays', () => {
      const large1 = Array.from({ length: 1000 }, (_, i) => i);
      const large2 = Array.from({ length: 1000 }, (_, i) => i);

      expect(shallowEqualArrays(large1, large2)).toBe(true);
      expect(deepEqual(large1, large2)).toBe(true);
    });

    it('should handle very deep nesting', () => {
      let deep1: unknown = 1;
      let deep2: unknown = 1;
      for (let i = 0; i < 10; i++) {
        deep1 = { value: deep1 };
        deep2 = { value: deep2 };
      }

      expect(deepEqual(deep1, deep2)).toBe(true);
    });

    it('should handle special number values', () => {
      expect(deepEqual(NaN, NaN)).toBe(false); // NaN !== NaN by design
      expect(deepEqual(Infinity, Infinity)).toBe(true);
      expect(deepEqual(-Infinity, -Infinity)).toBe(true);
      expect(deepEqual(Infinity, -Infinity)).toBe(false);
    });
  });
});
