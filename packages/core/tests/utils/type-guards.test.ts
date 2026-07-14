import { describe, expect, it, mock } from 'bun:test';
import type { FilterGroupNode, FilterState } from '../../src/types/filter';
import {
  assertFilterValueType,
  isBooleanFilterState,
  isCustomFilterState,
  isDateFilterState,
  isDateFilterValues,
  isDateLike,
  isFilterGroupNode,
  isFilterNodeShape,
  isFilterStateShape,
  isFilterValuesOfType,
  isJsonFilterState,
  isMultiOptionFilterState,
  isNumberFilterState,
  isNumberFilterValues,
  isOptionFilterState,
  isTextFilterState,
  isTextFilterValues,
  isValidDate,
  normalizeFilterNode,
} from '../../src/utils/type-guards';

function withSilencedWarn<T>(fn: () => T): T {
  const originalWarn = console.warn;
  console.warn = mock(() => {});
  try {
    return fn();
  } finally {
    console.warn = originalWarn;
  }
}

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

  describe('Filter Group Guards (plan 015 -- contract v2 Step 1)', () => {
    const leaf = (columnId: string, values: unknown[] = ['x']): FilterState =>
      ({ columnId, type: 'text', operator: 'contains', values }) as FilterState;

    describe('isFilterGroupNode', () => {
      it('should return true for a group node', () => {
        const group: FilterGroupNode = { kind: 'group', logic: 'and', children: [leaf('a')] };
        expect(isFilterGroupNode(group)).toBe(true);
      });

      it('should return false for a filter leaf', () => {
        expect(isFilterGroupNode(leaf('a'))).toBe(false);
      });

      it('should return false for non-object input', () => {
        expect(isFilterGroupNode(null)).toBe(false);
        expect(isFilterGroupNode(undefined)).toBe(false);
        expect(isFilterGroupNode('group')).toBe(false);
        expect(isFilterGroupNode(42)).toBe(false);
      });
    });

    describe('isFilterNodeShape', () => {
      it('should accept a valid leaf', () => {
        expect(isFilterNodeShape(leaf('status'))).toBe(true);
      });

      it('should accept a nested (AND (OR)) tree within depth 3', () => {
        const tree = {
          kind: 'group',
          logic: 'and',
          children: [
            leaf('status'),
            { kind: 'group', logic: 'or', children: [leaf('role'), leaf('role2')] },
          ],
        };
        expect(isFilterNodeShape(tree)).toBe(true);
      });

      it('should reject a group with unknown logic', () => {
        const group = { kind: 'group', logic: 'xor', children: [leaf('a')] };
        expect(isFilterNodeShape(group)).toBe(false);
      });

      it('should reject an empty group', () => {
        const group = { kind: 'group', logic: 'and', children: [] };
        expect(isFilterNodeShape(group)).toBe(false);
      });

      it('should reject a group with non-array children', () => {
        const group = { kind: 'group', logic: 'and', children: 'not-an-array' };
        expect(isFilterNodeShape(group)).toBe(false);
      });

      it('should reject an invalid leaf', () => {
        expect(isFilterNodeShape({ columnId: 'x' })).toBe(false);
      });

      it('should accept a group nested exactly at the default max depth (3 group levels: root -> nested -> one more nested)', () => {
        const depth3 = {
          kind: 'group', // depth 1 (root)
          logic: 'and',
          children: [
            {
              kind: 'group', // depth 2
              logic: 'and',
              children: [
                {
                  kind: 'group', // depth 3
                  logic: 'and',
                  children: [leaf('deep')],
                },
              ],
            },
          ],
        };
        expect(isFilterNodeShape(depth3)).toBe(true);
      });

      it('should reject a group nested beyond the default max depth (a 4th group level)', () => {
        const depth4 = {
          kind: 'group', // depth 1 (root)
          logic: 'and',
          children: [
            {
              kind: 'group', // depth 2
              logic: 'and',
              children: [
                {
                  kind: 'group', // depth 3
                  logic: 'and',
                  children: [
                    {
                      kind: 'group', // depth 4 -- over the cap
                      logic: 'and',
                      children: [leaf('deep')],
                    },
                  ],
                },
              ],
            },
          ],
        };
        expect(isFilterNodeShape(depth4)).toBe(false);
      });
    });

    describe('normalizeFilterNode', () => {
      it('should pass through a valid leaf unchanged', () => {
        const filter = leaf('status');
        expect(normalizeFilterNode(filter)).toEqual(filter);
      });

      it('should pass through a valid multi-child group unchanged', () => {
        const group: FilterGroupNode = {
          kind: 'group',
          logic: 'or',
          children: [leaf('a'), leaf('b')],
        };
        expect(normalizeFilterNode(group)).toEqual(group);
      });

      it('should unwrap a single-child group to its sole child', () => {
        withSilencedWarn(() => {
          const group = { kind: 'group', logic: 'and', children: [leaf('solo')] };
          expect(normalizeFilterNode(group)).toEqual(leaf('solo'));
        });
      });

      it('should drop an empty group and warn (value-free)', () => {
        withSilencedWarn(() => {
          const warnSpy = mock(() => {});
          console.warn = warnSpy;
          const group = { kind: 'group', logic: 'and', children: [] };
          expect(normalizeFilterNode(group)).toBeNull();
          expect(warnSpy).toHaveBeenCalled();
        });
      });

      it('should drop a group with unknown logic and warn', () => {
        withSilencedWarn(() => {
          const warnSpy = mock(() => {});
          console.warn = warnSpy;
          const group = { kind: 'group', logic: 'xor', children: [leaf('a')] };
          expect(normalizeFilterNode(group)).toBeNull();
          expect(warnSpy).toHaveBeenCalled();
        });
      });

      it('should drop an invalid leaf and cascade to dropping its now-empty parent group', () => {
        withSilencedWarn(() => {
          const group = {
            kind: 'group',
            logic: 'and',
            children: [{ columnId: 'broken' }], // missing type/operator/values
          };
          expect(normalizeFilterNode(group)).toBeNull();
        });
      });

      it('should drop an invalid child but keep valid siblings (unwrapping the survivor)', () => {
        withSilencedWarn(() => {
          const group = {
            kind: 'group',
            logic: 'and',
            children: [leaf('good'), { kind: 'group', logic: 'xor', children: [leaf('bad')] }],
          };
          // The 'xor' child is dropped; one valid child remains -> unwrapped.
          expect(normalizeFilterNode(group)).toEqual(leaf('good'));
        });
      });

      it('should drop an over-deep subtree (fail closed) rather than throwing', () => {
        withSilencedWarn(() => {
          const depth4 = {
            kind: 'group', // depth 1 (root)
            logic: 'and',
            children: [
              {
                kind: 'group', // depth 2
                logic: 'and',
                children: [
                  {
                    kind: 'group', // depth 3
                    logic: 'and',
                    children: [
                      { kind: 'group', logic: 'and', children: [leaf('deep')] }, // depth 4 -- over the cap
                    ],
                  },
                ],
              },
            ],
          };
          expect(() => normalizeFilterNode(depth4)).not.toThrow();
          expect(normalizeFilterNode(depth4)).toBeNull();
        });
      });

      it('should never include values in a warning message (value-free convention)', () => {
        withSilencedWarn(() => {
          const messages: string[] = [];
          console.warn = mock((msg: string) => {
            messages.push(msg);
          });
          // Invalid (missing operator) so it is dropped and a warning fires;
          // the sensitive value must not leak into the warning text.
          const result = normalizeFilterNode({
            columnId: 'secret',
            type: 'text',
            values: ['super-secret-value'],
          });
          expect(result).toBeNull();
          expect(messages.length).toBeGreaterThan(0);
          for (const msg of messages) {
            expect(msg).not.toContain('super-secret-value');
          }
        });
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

  describe('isFilterStateShape - id field (plan 031 Step 3, finding 2)', () => {
    it('accepts a filter with no id (backwards compatible)', () => {
      expect(
        isFilterStateShape({ columnId: 'name', type: 'text', operator: 'contains', values: [] })
      ).toBe(true);
    });

    it('accepts a filter with a string id', () => {
      expect(
        isFilterStateShape({
          id: 'f-1',
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: [],
        })
      ).toBe(true);
    });

    it('rejects a filter with a non-string id', () => {
      expect(
        isFilterStateShape({
          id: 42,
          columnId: 'name',
          type: 'text',
          operator: 'contains',
          values: [],
        })
      ).toBe(false);
    });
  });
});
