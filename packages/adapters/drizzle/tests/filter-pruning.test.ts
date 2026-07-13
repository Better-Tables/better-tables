/**
 * @fileoverview Unit tests for `pruneFilterNodeForColumn` (plan 021, ADAPTER-06).
 *
 * Pure function tests -- no database, no query builder -- covering the
 * self-exclusion pruning rule `FacetQueryParams` documents: when computing a
 * facet for `columnId`, every filter leaf targeting that same column must be
 * removed before the remaining filters are applied. Row-set proof that the
 * pruned result actually changes the SQL/rows lives in
 * `filter-aware-facets.test.ts`; this file is about the pruning function's
 * shape-handling in isolation (flat arrays, groups, nesting, unwrap/drop).
 */

import { describe, expect, it } from 'bun:test';
import type { FilterGroupNode, FilterState } from '@better-tables/core';
import { pruneFilterNodeForColumn } from '../src/filter-handler';

const ageEquals30: FilterState = {
  columnId: 'age',
  type: 'number',
  operator: 'equals',
  values: [30],
};
const ageLessThan40: FilterState = {
  columnId: 'age',
  type: 'number',
  operator: 'lessThan',
  values: [40],
};
const nameEqualsJane: FilterState = {
  columnId: 'name',
  type: 'text',
  operator: 'equals',
  values: ['Jane Smith'],
};
const statusEqualsActive: FilterState = {
  columnId: 'status',
  type: 'text',
  operator: 'equals',
  values: ['active'],
};

describe('pruneFilterNodeForColumn (plan 021, ADAPTER-06)', () => {
  it('returns undefined unchanged for undefined input', () => {
    expect(pruneFilterNodeForColumn(undefined, 'age')).toBeUndefined();
  });

  describe('flat FilterState[] input', () => {
    it('drops every leaf targeting the excluded column, keeps the rest', () => {
      const result = pruneFilterNodeForColumn([ageEquals30, nameEqualsJane], 'age');
      expect(result).toEqual([nameEqualsJane]);
    });

    it('returns an empty array when every leaf targets the excluded column', () => {
      const result = pruneFilterNodeForColumn([ageEquals30, ageLessThan40], 'age');
      expect(result).toEqual([]);
    });

    it('returns the same-shaped array unchanged when no leaf matches', () => {
      const result = pruneFilterNodeForColumn([nameEqualsJane, statusEqualsActive], 'age');
      expect(result).toEqual([nameEqualsJane, statusEqualsActive]);
    });

    it('is a no-op on an empty array', () => {
      expect(pruneFilterNodeForColumn([], 'age')).toEqual([]);
    });
  });

  describe('FilterGroupNode tree input', () => {
    it('drops a matching leaf from inside an OR group, leaving the sibling as a flat single-leaf array', () => {
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [ageEquals30, nameEqualsJane],
      };

      // Two children -> one survives -> unwrapped to a bare leaf -> wrapped
      // back in a single-element array (DrizzleAdapter's own
      // normalizeIncomingFilters convention for "one surviving leaf").
      expect(pruneFilterNodeForColumn(group, 'age')).toEqual([nameEqualsJane]);
    });

    it('drops an entire AND group that becomes empty after pruning', () => {
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'and',
        children: [ageEquals30, ageLessThan40],
      };

      expect(pruneFilterNodeForColumn(group, 'age')).toEqual([]);
    });

    it('preserves a group untouched by pruning as a real FilterGroupNode (not unwrapped/flattened)', () => {
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [nameEqualsJane, statusEqualsActive],
      };

      expect(pruneFilterNodeForColumn(group, 'age')).toEqual(group);
    });

    it('prunes a matching leaf out of a nested subgroup, dropping the now-empty subgroup', () => {
      // (name = 'Jane Smith') AND (age = 30 OR age < 40)
      // Pruning 'age' empties the nested OR group entirely, which then
      // drops out of the outer AND -- leaving just the surviving AND child,
      // unwrapped to a bare leaf array.
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'and',
        children: [
          nameEqualsJane,
          { kind: 'group', logic: 'or', children: [ageEquals30, ageLessThan40] },
        ],
      };

      expect(pruneFilterNodeForColumn(group, 'age')).toEqual([nameEqualsJane]);
    });

    it('prunes a matching leaf out of a nested subgroup, keeping the subgroup when a sibling survives', () => {
      // (name = 'Jane Smith') AND (age = 30 OR status = 'active')
      // Pruning 'age' leaves the nested group with one surviving child,
      // which unwraps to a bare leaf -- so the outer AND ends up with two
      // plain leaves, both real FilterState, not a group.
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'and',
        children: [
          nameEqualsJane,
          { kind: 'group', logic: 'or', children: [ageEquals30, statusEqualsActive] },
        ],
      };

      const result = pruneFilterNodeForColumn(group, 'age');
      expect(result).toEqual({
        kind: 'group',
        logic: 'and',
        children: [nameEqualsJane, statusEqualsActive],
      });
    });

    it('drops the whole tree to an empty array when every leaf targets the excluded column', () => {
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [
          ageEquals30,
          { kind: 'group', logic: 'and', children: [ageLessThan40, ageEquals30] },
        ],
      };

      expect(pruneFilterNodeForColumn(group, 'age')).toEqual([]);
    });
  });
});
