import { describe, expect, it } from 'bun:test';
import type { FilterState } from '../../src/types/filter';
import { filterHasValue } from '../../src/utils/filter-value';

describe('filterHasValue', () => {
  it('checks membership on a text filter without narrowing by type', () => {
    const filter: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'contains',
      values: ['john', 'jane'],
    };

    expect(filterHasValue(filter, 'john')).toBe(true);
    expect(filterHasValue(filter, 'bob')).toBe(false);
  });

  it('checks membership on a number filter', () => {
    const filter: FilterState = {
      columnId: 'age',
      type: 'number',
      operator: 'between',
      values: [18, 65],
    };

    expect(filterHasValue(filter, 18)).toBe(true);
    expect(filterHasValue(filter, 19)).toBe(false);
    // No accidental string/number coercion.
    expect(filterHasValue(filter, '18')).toBe(false);
  });

  it('checks membership on a boolean filter', () => {
    const filter: FilterState = {
      columnId: 'active',
      type: 'boolean',
      operator: 'isTrue',
      values: [true],
    };

    expect(filterHasValue(filter, true)).toBe(true);
    expect(filterHasValue(filter, false)).toBe(false);
  });

  it('checks membership on an option filter', () => {
    const filter: FilterState = {
      columnId: 'status',
      type: 'option',
      operator: 'isAnyOf',
      values: ['active', 'pending'],
    };

    expect(filterHasValue(filter, 'active')).toBe(true);
    expect(filterHasValue(filter, 'inactive')).toBe(false);
  });

  it('checks membership on a multiOption filter', () => {
    const filter: FilterState = {
      columnId: 'tags',
      type: 'multiOption',
      operator: 'includesAny',
      values: ['tag1', 'tag2'],
    };

    expect(filterHasValue(filter, 'tag1')).toBe(true);
    expect(filterHasValue(filter, 'tag3')).toBe(false);
  });

  it('checks membership on a date filter using the same representation stored', () => {
    const date = new Date('2024-01-01');
    const filter: FilterState = {
      columnId: 'createdAt',
      type: 'date',
      operator: 'is',
      values: [date],
    };

    expect(filterHasValue(filter, date)).toBe(true);
    // Different Date instance with the same time is NOT the same reference --
    // no date-aware coercion, matching Array.prototype.includes semantics.
    expect(filterHasValue(filter, new Date('2024-01-01'))).toBe(false);
  });

  it('checks membership on a json filter by reference', () => {
    const obj = { k: 1 };
    const filter: FilterState = {
      columnId: 'meta',
      type: 'json',
      operator: 'equals',
      values: [obj],
    };

    expect(filterHasValue(filter, obj)).toBe(true);
    expect(filterHasValue(filter, { k: 1 })).toBe(false);
  });

  it('returns false for an empty values array', () => {
    const filter: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'isEmpty',
      values: [],
    };

    expect(filterHasValue(filter, 'anything')).toBe(false);
  });

  it('checks membership on a custom filter', () => {
    const filter: FilterState = {
      columnId: 'custom',
      type: 'custom',
      operator: 'equals',
      values: [1, 'two', true],
    };

    expect(filterHasValue(filter, 'two')).toBe(true);
    expect(filterHasValue(filter, 'three')).toBe(false);
  });
});
