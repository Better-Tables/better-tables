import { describe, expect, it } from 'bun:test';
import type { CustomFilterState, FilterGroupNode, FilterState } from '../../src/types/filter';
import {
  filterHasEffect,
  getEffectiveFilterKey,
  getEffectiveFilters,
} from '../../src/utils/filter-effect';
import { serializeTableStateToUrl } from '../../src/utils/url-serialization';

/**
 * Plan 063 follow-up: an incomplete filter (a chip added before its value is
 * chosen) must not constrain results, so it must not trigger a fetch / facet
 * refresh / URL write. These tests pin the predicate and the serializer's use
 * of it.
 */

describe('filterHasEffect', () => {
  it('a value-taking operator with no values has no effect', () => {
    const empty: FilterState = { columnId: 'name', type: 'text', operator: 'contains', values: [] };
    expect(filterHasEffect(empty)).toBe(false);
  });

  it('a value-taking operator with a value has effect', () => {
    const filled: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'contains',
      values: ['john'],
    };
    expect(filterHasEffect(filled)).toBe(true);
  });

  it('an empty option filter (isAnyOf, no values) has no effect', () => {
    const empty: FilterState = {
      columnId: 'status',
      type: 'option',
      operator: 'isAnyOf',
      values: [],
    };
    expect(filterHasEffect(empty)).toBe(false);
  });

  it('a no-value operator (isEmpty / isNull) constrains without values', () => {
    const isEmpty: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'isEmpty',
      values: [],
    };
    const isNull: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'isNull',
      values: [],
    };
    expect(filterHasEffect(isEmpty)).toBe(true);
    expect(filterHasEffect(isNull)).toBe(true);
  });

  it('a boolean no-value operator (isTrue) constrains without values', () => {
    const isTrue: FilterState = {
      columnId: 'active',
      type: 'boolean',
      operator: 'isTrue',
      values: [],
    };
    expect(filterHasEffect(isTrue)).toBe(true);
  });
});

describe('getEffectiveFilters', () => {
  it('drops no-effect leaves from a flat list, keeps the rest', () => {
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['a'] },
      { columnId: 'status', type: 'option', operator: 'isAnyOf', values: [] },
      { columnId: 'bio', type: 'text', operator: 'isEmpty', values: [] },
    ];
    const effective = getEffectiveFilters(filters) as FilterState[];
    expect(effective).toHaveLength(2);
    expect(effective.map((f) => f.columnId)).toEqual(['name', 'bio']);
  });

  it('returns an empty array when every filter is incomplete', () => {
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: [] },
    ];
    expect(getEffectiveFilters(filters)).toEqual([]);
  });

  it('passes a FilterGroupNode tree through unchanged', () => {
    const tree: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['a'] }],
    };
    expect(getEffectiveFilters(tree)).toBe(tree);
  });
});

describe('getEffectiveFilterKey (BigInt/circular-safe)', () => {
  it('returns "null" for undefined and a stable key for equal effective filters', () => {
    expect(getEffectiveFilterKey(undefined)).toBe('null');
    const a: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['x'] },
    ];
    const b: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['x'] },
      // an incomplete chip is dropped, so the key matches `a`
      { columnId: 'status', type: 'option', operator: 'isAnyOf', values: [] },
    ];
    expect(getEffectiveFilterKey(b)).toBe(getEffectiveFilterKey(a));
  });

  it('does NOT throw on a BigInt custom filter value (would crash the hook render)', () => {
    const custom: CustomFilterState = {
      columnId: 'big',
      type: 'custom',
      operator: 'equals',
      values: [10n as unknown as string],
    };
    let key = '';
    expect(() => {
      key = getEffectiveFilterKey([custom]);
    }).not.toThrow();
    expect(key).toContain('10n');
    // Distinguishes different bigints.
    const other: CustomFilterState = { ...custom, values: [11n as unknown as string] };
    expect(getEffectiveFilterKey([other])).not.toBe(key);
  });

  it('handles a circular value without throwing AND stays value-sensitive', () => {
    const makeCircular = (label: string) => {
      const circular: Record<string, unknown> = { label };
      circular.self = circular;
      return circular;
    };
    const custom: CustomFilterState = {
      columnId: 'c',
      type: 'custom',
      operator: 'equals',
      values: [makeCircular('a') as unknown as string],
    };
    let key = '';
    expect(() => {
      key = getEffectiveFilterKey([custom]);
    }).not.toThrow();
    // Circular reference is marked, not dropped — value content survives.
    expect(key).toContain('[Circular]');
    expect(key).toContain('"label":"a"');
    // Changing the (circular) value's non-circular content changes the key —
    // the fallback must NOT collapse to a value-insensitive signature.
    const changed: CustomFilterState = { ...custom, values: [makeCircular('b') as unknown as string] };
    expect(getEffectiveFilterKey([changed])).not.toBe(key);
  });
});

describe('serializeTableStateToUrl drops no-effect filters', () => {
  it('an added empty chip does not change the serialized filters param', () => {
    const withValue: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['john'] },
    ];
    const withValueAndEmptyChip: FilterState[] = [
      ...withValue,
      { columnId: 'status', type: 'option', operator: 'isAnyOf', values: [] },
    ];

    const a = serializeTableStateToUrl({ filters: withValue });
    const b = serializeTableStateToUrl({ filters: withValueAndEmptyChip });
    // Identical serialized filters — the empty chip left no trace, so an
    // adapter that navigates on setParams sees no change.
    expect(b.filters).toBe(a.filters);
  });

  it('a lone empty chip serializes to null (nothing to write)', () => {
    const params = serializeTableStateToUrl({
      filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: [] }],
    });
    expect(params.filters).toBeNull();
  });

  it('a no-value operator (isEmpty) still serializes (it constrains)', () => {
    const params = serializeTableStateToUrl({
      filters: [{ columnId: 'name', type: 'text', operator: 'isEmpty', values: [] }],
    });
    expect(typeof params.filters).toBe('string');
    expect(params.filters).toContain('c2:');
  });
});
