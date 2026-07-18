/**
 * @fileoverview Tests for the ORM-agnostic FilterRouter
 * @module @better-tables/adapters-toolkit/tests/filter-router
 *
 * Exercises FilterRouter against a stub PredicateEmitter, asserting:
 * - each operator routes to the correct emitter method with its values
 * - unknown operators throw FilterRouterError
 * - empty/invalid values (emitter returns undefined) yield a no-op (undefined)
 * - includeNull produces OR(isNull, condition) via the emitter's combinators
 * Modeled on the drizzle package's tests/filter-handler.test.ts structure.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import type { FilterGroupNode, FilterNode, FilterOperator, FilterState } from '@better-tables/core';
import { COLUMN_TYPES, getOperatorsForType } from '@better-tables/core';
import {
  computeDatePeriodRange,
  FilterRouter,
  FilterRouterError,
  type PredicateEmitter,
} from '../src/filter-router';

/** Toy predicate type: a tagged record so assertions can inspect structure. */
interface StubPredicate {
  kind: string;
  operator?: string;
  values?: unknown[];
  columnType?: string;
  children?: StubPredicate[];
}

type StubColumn = { name: string };

/** Records every call; returns tagged predicates for structural assertions. */
class StubEmitter implements PredicateEmitter<StubColumn, StubPredicate> {
  calls: { method: string; operator?: string; values?: unknown[] }[] = [];

  /** When true, leaf methods return undefined (simulates empty/invalid values). */
  emitNothing = false;

  /** Optional probe — assigned in individual tests that exercise the fallback. */
  prefersDateSemantics?: (column: StubColumn) => boolean;

  private leaf(method: string, operator: string, values?: unknown[]): StubPredicate | undefined {
    this.calls.push(values === undefined ? { method, operator } : { method, operator, values });
    if (this.emitNothing) {
      return undefined;
    }
    return values === undefined ? { kind: method, operator } : { kind: method, operator, values };
  }

  textOperator(_c: StubColumn, operator: string, values: unknown[]) {
    return this.leaf('textOperator', operator, values);
  }
  numberOperator(_c: StubColumn, operator: string, values: unknown[]) {
    return this.leaf('numberOperator', operator, values);
  }
  dateOperator(_c: StubColumn, operator: string, values: unknown[], columnType?: string) {
    const result = this.leaf('dateOperator', operator, values);
    if (result && columnType !== undefined) {
      result.columnType = columnType;
    }
    return result;
  }
  booleanOperator(_c: StubColumn, operator: string, values: unknown[]) {
    return this.leaf('booleanOperator', operator, values);
  }
  optionOperator(_c: StubColumn, operator: string, values: unknown[]) {
    return this.leaf('optionOperator', operator, values);
  }
  multiOptionOperator(_c: StubColumn, operator: string, values: unknown[]) {
    return this.leaf('multiOptionOperator', operator, values);
  }
  universalOperator(_c: StubColumn, operator: string) {
    return this.leaf('universalOperator', operator);
  }
  isNullCondition(_c: StubColumn): StubPredicate {
    this.calls.push({ method: 'isNullCondition' });
    return { kind: 'isNull' };
  }
  and(...conditions: StubPredicate[]): StubPredicate {
    return { kind: 'and', children: conditions };
  }
  or(...conditions: StubPredicate[]): StubPredicate {
    return { kind: 'or', children: conditions };
  }
}

const column: StubColumn = { name: 'col' };

describe('FilterRouter', () => {
  let emitter: StubEmitter;
  let router: FilterRouter<StubColumn, StubPredicate>;

  beforeEach(() => {
    emitter = new StubEmitter();
    router = new FilterRouter(emitter);
  });

  describe('Operator routing', () => {
    const cases: { operator: FilterOperator; method: string; values: unknown[] }[] = [
      { operator: 'contains', method: 'textOperator', values: ['abc'] },
      { operator: 'equals', method: 'textOperator', values: ['abc'] },
      { operator: 'startsWith', method: 'textOperator', values: ['abc'] },
      { operator: 'endsWith', method: 'textOperator', values: ['abc'] },
      { operator: 'isEmpty', method: 'textOperator', values: [] },
      { operator: 'isNotEmpty', method: 'textOperator', values: [] },
      { operator: 'notEquals', method: 'textOperator', values: ['abc'] },
      { operator: 'greaterThan', method: 'numberOperator', values: [1] },
      { operator: 'greaterThanOrEqual', method: 'numberOperator', values: [1] },
      { operator: 'lessThan', method: 'numberOperator', values: [1] },
      { operator: 'lessThanOrEqual', method: 'numberOperator', values: [1] },
      { operator: 'between', method: 'numberOperator', values: [1, 5] },
      { operator: 'notBetween', method: 'numberOperator', values: [1, 5] },
      { operator: 'is', method: 'dateOperator', values: ['2026-01-01'] },
      { operator: 'isNot', method: 'dateOperator', values: ['2026-01-01'] },
      { operator: 'before', method: 'dateOperator', values: ['2026-01-01'] },
      { operator: 'after', method: 'dateOperator', values: ['2026-01-01'] },
      { operator: 'isToday', method: 'dateOperator', values: [] },
      { operator: 'isYesterday', method: 'dateOperator', values: [] },
      { operator: 'isThisWeek', method: 'dateOperator', values: [] },
      { operator: 'isThisMonth', method: 'dateOperator', values: [] },
      { operator: 'isThisYear', method: 'dateOperator', values: [] },
      { operator: 'isTrue', method: 'booleanOperator', values: [] },
      { operator: 'isFalse', method: 'booleanOperator', values: [] },
      { operator: 'isAnyOf', method: 'optionOperator', values: ['a', 'b'] },
      { operator: 'isNoneOf', method: 'optionOperator', values: ['a', 'b'] },
      { operator: 'includes', method: 'multiOptionOperator', values: ['a'] },
      { operator: 'excludes', method: 'multiOptionOperator', values: ['a'] },
      { operator: 'includesAny', method: 'multiOptionOperator', values: ['a', 'b'] },
      { operator: 'includesAll', method: 'multiOptionOperator', values: ['a', 'b'] },
      { operator: 'excludesAny', method: 'multiOptionOperator', values: ['a', 'b'] },
      { operator: 'excludesAll', method: 'multiOptionOperator', values: ['a', 'b'] },
      { operator: 'isNull', method: 'universalOperator', values: [] },
      { operator: 'isNotNull', method: 'universalOperator', values: [] },
    ];

    for (const { operator, method, values } of cases) {
      it(`routes '${operator}' to ${method}`, () => {
        const result = router.mapOperatorToCondition(column, operator, values);

        expect(emitter.calls).toHaveLength(1);
        const call = emitter.calls[0];
        expect(call?.method).toBe(method);
        expect(call?.operator).toBe(operator);
        if (method !== 'universalOperator') {
          expect(call?.values).toEqual(values);
        }
        expect(result).toBeDefined();
        expect(result?.kind).toBe(method);
      });
    }

    it("routes date-typed 'between' to dateOperator", () => {
      router.mapOperatorToCondition(column, 'between', ['2026-01-01', '2026-01-31'], false, 'date');
      expect(emitter.calls[0]?.method).toBe('dateOperator');
    });

    it("routes untyped 'between' to dateOperator when prefersDateSemantics is true", () => {
      emitter.prefersDateSemantics = () => true;
      router.mapOperatorToCondition(column, 'between', ['2026-01-01', '2026-01-31']);
      expect(emitter.calls[0]?.method).toBe('dateOperator');
    });

    it("routes untyped 'between' to numberOperator when prefersDateSemantics is false", () => {
      emitter.prefersDateSemantics = () => false;
      router.mapOperatorToCondition(column, 'between', [1, 5]);
      expect(emitter.calls[0]?.method).toBe('numberOperator');
    });

    it("routes untyped 'between' to numberOperator when prefersDateSemantics is absent", () => {
      // StubEmitter has no prefersDateSemantics by default.
      router.mapOperatorToCondition(column, 'between', [1, 5]);
      expect(emitter.calls[0]?.method).toBe('numberOperator');
    });

    it("passes columnType through to the emitter's dateOperator", () => {
      const result = router.mapOperatorToCondition(column, 'is', ['2026-01-01'], false, 'date');
      expect(result?.columnType).toBe('date');
    });

    // Regression: `equals`/`notEquals` are shared between text and number
    // columns. Without a columnType guard, a number column's `equals` routed
    // to `textOperator`, whose value-type assertion throws on a numeric value.
    for (const operator of ['equals', 'notEquals'] as const) {
      it(`routes '${operator}' to numberOperator when columnType is 'number'`, () => {
        const result = router.mapOperatorToCondition(column, operator, [3], false, 'number');
        expect(emitter.calls[0]?.method).toBe('numberOperator');
        expect(result?.kind).toBe('numberOperator');
      });

      it(`still routes '${operator}' to textOperator without a number columnType`, () => {
        const result = router.mapOperatorToCondition(column, operator, ['abc']);
        expect(emitter.calls[0]?.method).toBe('textOperator');
        expect(result?.kind).toBe('textOperator');
      });
    }
  });

  describe('Unknown operators', () => {
    it('throws FilterRouterError for an unknown operator', () => {
      expect(() => {
        router.mapOperatorToCondition(column, 'frobnicate' as FilterOperator, ['x']);
      }).toThrow(FilterRouterError);
      // No emitter leaf method should have been reached
      expect(emitter.calls).toHaveLength(0);
    });
  });

  describe('Empty values (emitter yields no condition)', () => {
    it('returns undefined when the emitter produces no condition', () => {
      emitter.emitNothing = true;
      const result = router.mapOperatorToCondition(column, 'contains', []);
      expect(result).toBeUndefined();
    });

    it('returns just the isNull branch when includeNull is set and the leaf is empty', () => {
      emitter.emitNothing = true;
      const result = router.mapOperatorToCondition(column, 'contains', [], true);
      expect(result).toEqual({ kind: 'isNull' });
    });
  });

  describe('includeNull combination', () => {
    it('combines isNull + leaf with OR', () => {
      const result = router.mapOperatorToCondition(column, 'contains', ['x'], true);
      expect(result?.kind).toBe('or');
      expect(result?.children).toHaveLength(2);
      expect(result?.children?.[0]).toEqual({ kind: 'isNull' });
      expect(result?.children?.[1]?.kind).toBe('textOperator');
    });

    it('does not add an isNull branch for isNull/isNotNull operators', () => {
      const result = router.mapOperatorToCondition(column, 'isNull', [], true);
      expect(result?.kind).toBe('universalOperator');
      expect(emitter.calls.filter((c) => c.method === 'isNullCondition')).toHaveLength(0);
    });
  });

  describe('Value validation and operator metadata', () => {
    it('validateFilterValues accepts valid operator/values pairs', () => {
      expect(router.validateFilterValues('contains', ['x'], 'text')).toBe(true);
    });

    it('validateFilterValues rejects wrong value counts', () => {
      expect(router.validateFilterValues('between', [1], 'number')).toBe(false);
    });

    it('getExpectedValueCount reports 2 for between', () => {
      expect(router.getExpectedValueCount('between')).toBe(2);
    });

    it('getSupportedOperators lists text operators plus universal ones', () => {
      const ops = router.getSupportedOperators('text');
      expect(ops).toContain('contains');
      expect(ops).toContain('isNull');
      expect(ops).toContain('isNotNull');
      expect(ops).not.toContain('between');
    });

    it('getSupportedOperators(option) includes canonical is/isNot (plan 038)', () => {
      const ops = router.getSupportedOperators('option');
      expect(ops).toContain('is');
      expect(ops).toContain('isNot');
      expect(ops).toContain('isAnyOf');
      expect(ops).toContain('isNoneOf');
      expect(ops).toEqual(getOperatorsForType('option').map((o) => o.key));
    });

    it('routes option is/isNot to optionOperator, not dateOperator (plan 038)', () => {
      router.mapOperatorToCondition({ name: 'status' }, 'is', ['open'], false, 'option');
      expect(emitter.calls.at(-1)?.method).toBe('optionOperator');
      expect(emitter.calls.at(-1)?.operator).toBe('is');

      router.mapOperatorToCondition({ name: 'status' }, 'isNot', ['closed'], false, 'option');
      expect(emitter.calls.at(-1)?.method).toBe('optionOperator');
      expect(emitter.calls.at(-1)?.operator).toBe('isNot');
    });

    it('getSupportedOperators matches getOperatorsForType for every ColumnType (drift lock)', () => {
      for (const type of COLUMN_TYPES) {
        const fromRouter = router.getSupportedOperators(type);
        const fromCore = getOperatorsForType(type).map((o) => o.key);
        expect(fromRouter).toEqual(fromCore);
      }
    });
  });
});

describe('FilterRouter.buildNodeCondition (plan 017 group translation)', () => {
  let emitter: StubEmitter;
  let router: FilterRouter<StubColumn, StubPredicate>;

  beforeEach(() => {
    emitter = new StubEmitter();
    router = new FilterRouter(emitter);
  });

  /** Minimal FilterState leaf; `values` controls whether the stub leaf resolver "matches". */
  function leaf(columnId: string, values: unknown[] = ['x']): FilterState {
    return { columnId, type: 'text', operator: 'contains', values } as FilterState;
  }

  /** Leaf resolver used by every test below: undefined for empty values, a tagged predicate otherwise. */
  function leafCondition(f: FilterState): StubPredicate | undefined {
    return f.values.length === 0 ? undefined : { kind: f.columnId, values: f.values };
  }

  it('a bare leaf node resolves via the leaf callback directly (no combinator call)', () => {
    const node: FilterNode = leaf('a');
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result).toEqual({ kind: 'a', values: ['x'] });
  });

  it('a two-child AND group calls emitter.and with both leaf conditions', () => {
    const node: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [leaf('a'), leaf('b')],
    };
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result?.kind).toBe('and');
    expect(result?.children).toHaveLength(2);
    expect(result?.children).toEqual([
      { kind: 'a', values: ['x'] },
      { kind: 'b', values: ['x'] },
    ]);
  });

  it('a two-child OR group calls emitter.or with both leaf conditions', () => {
    const node: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [leaf('a'), leaf('b')],
    };
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result?.kind).toBe('or');
    expect(result?.children).toHaveLength(2);
  });

  it('nested groups recurse: OR(a, AND(b, c))', () => {
    const node: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [leaf('a'), { kind: 'group', logic: 'and', children: [leaf('b'), leaf('c')] }],
    };
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result?.kind).toBe('or');
    expect(result?.children).toHaveLength(2);
    expect(result?.children?.[0]).toEqual({ kind: 'a', values: ['x'] });
    expect(result?.children?.[1]?.kind).toBe('and');
    expect(result?.children?.[1]?.children).toHaveLength(2);
  });

  it('an empty group (every child resolves to undefined) collapses to undefined', () => {
    const node: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [leaf('a', []), leaf('b', [])],
    };
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result).toBeUndefined();
    // No and()/or() combinator call recorded (StubPredicate has no calls log
    // for combinators, but we can assert indirectly: an actual combinator
    // call would have produced a { kind: 'and' | 'or' } wrapper).
  });

  it('a single-survivor group collapses to the survivor, no and()/or() wrapper', () => {
    const node: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [leaf('a', []), leaf('b')],
    };
    const result = router.buildNodeCondition(node, leafCondition);
    expect(result).toEqual({ kind: 'b', values: ['x'] });
  });
});

describe('computeDatePeriodRange', () => {
  it('today spans a full day, start <= now <= end', () => {
    const { start, end } = computeDatePeriodRange('today');
    const now = Date.now();
    expect(start.getTime()).toBeLessThanOrEqual(now);
    expect(end.getTime()).toBeGreaterThanOrEqual(now);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('yesterday ends immediately before today starts', () => {
    const today = computeDatePeriodRange('today');
    const yesterday = computeDatePeriodRange('yesterday');
    expect(yesterday.end.getTime()).toBe(today.start.getTime() - 1);
  });

  it('thisMonth starts on the first of the month', () => {
    const { start } = computeDatePeriodRange('thisMonth');
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it('thisYear spans from Jan 1 to Dec 31', () => {
    const { start, end } = computeDatePeriodRange('thisYear');
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});
