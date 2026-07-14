/**
 * @fileoverview Tests for `buildFilter` (plan 031 Step 4, finding 1).
 *
 * Every negative case is pinned with `@ts-expect-error` so a regression that
 * ACCEPTS the bad shape fails the build (the directive becomes unused) --
 * same convention as `tests/types/contract-v2.test.ts`.
 */

import { describe, expect, it } from 'bun:test';
import { buildFilter } from '../../src/builders/build-filter';
import { betterTables, defineTable } from '../../src/factory';
import type { SchemaAwareAdapter } from '../../src/types/paths';

interface Customer {
  id: string;
  plan: string;
}

interface Ticket {
  id: string;
  subject: string;
  priority: number;
  isOpen: boolean;
  createdAt: Date;
  customer: Customer;
}

type Schema = { tickets: { row: Ticket } };
const fakeAdapter = {} as SchemaAwareAdapter<{ tables: Schema }>;
const tables = betterTables({ database: fakeAdapter });

const ticketsTable = defineTable<typeof tables>()('tickets', (t) => ({
  columns: [
    t.text('subject'),
    t.number('priority'),
    t.boolean('isOpen'),
    t.date('createdAt'),
    t.option('customer.plan').options([
      { value: 'starter', label: 'Starter' },
      { value: 'pro', label: 'Pro' },
      { value: 'enterprise', label: 'Enterprise' },
    ]),
  ],
}));

describe('buildFilter -- inferred overload (reachable from $infer.Row)', () => {
  it('builds a number filter without restating type', () => {
    const filter = buildFilter(ticketsTable, 'priority', 'greaterThan', [5]);
    expect(filter).toEqual({
      columnId: 'priority',
      type: 'number',
      operator: 'greaterThan',
      values: [5],
    });
  });

  it('builds a boolean filter without restating type', () => {
    const filter = buildFilter(ticketsTable, 'isOpen', 'isTrue', []);
    expect(filter).toEqual({ columnId: 'isOpen', type: 'boolean', operator: 'isTrue', values: [] });
  });

  it('builds a date filter without restating type', () => {
    const date = new Date('2024-01-01');
    const filter = buildFilter(ticketsTable, 'createdAt', 'before', [date]);
    expect(filter).toEqual({
      columnId: 'createdAt',
      type: 'date',
      operator: 'before',
      values: [date],
    });
  });

  it('builds a text filter and resolves the REAL declared column type at runtime', () => {
    const filter = buildFilter(ticketsTable, 'subject', 'contains', ['refund']);
    // 'subject' really is a 'text' column -- matches the inferred default.
    expect(filter).toEqual({
      columnId: 'subject',
      type: 'text',
      operator: 'contains',
      values: ['refund'],
    });
  });

  it('passes through options (id, includeNull, meta)', () => {
    const filter = buildFilter(ticketsTable, 'priority', 'greaterThan', [5], {
      id: 'f-1',
      includeNull: true,
      meta: { source: 'user' },
    });
    expect(filter).toEqual({
      columnId: 'priority',
      type: 'number',
      operator: 'greaterThan',
      values: [5],
      id: 'f-1',
      includeNull: true,
      meta: { source: 'user' },
    });
  });

  it('rejects a columnId that is not a real path on the row (compile error)', () => {
    // @ts-expect-error - 'bogus' is not a Paths<Ticket>
    buildFilter(ticketsTable, 'bogus', 'contains', ['x']);
    expect(true).toBe(true);
  });

  it('rejects a wrong operator for the inferred number family (compile error)', () => {
    // @ts-expect-error - 'contains' is a text/json operator, not legal for 'number'
    buildFilter(ticketsTable, 'priority', 'contains', [5]);
    expect(true).toBe(true);
  });

  it('rejects a wrong value shape for the inferred number family (compile error)', () => {
    // @ts-expect-error - number[] expected, not string[]
    buildFilter(ticketsTable, 'priority', 'greaterThan', ['5']);
    expect(true).toBe(true);
  });

  it('rejects a wrong operator for the inferred boolean family (compile error)', () => {
    // @ts-expect-error - 'startsWith' is a text-only operator, not legal for 'boolean'
    buildFilter(ticketsTable, 'isOpen', 'startsWith', []);
    expect(true).toBe(true);
  });
});

describe('buildFilter -- explicit-type overload (the reachable-gap escape hatch)', () => {
  it("builds an 'option' filter for customer.plan (not inferable from its raw string shape)", () => {
    const filter = buildFilter(ticketsTable, 'customer.plan', 'option', 'isAnyOf', ['enterprise']);
    expect(filter).toEqual({
      columnId: 'customer.plan',
      type: 'option',
      operator: 'isAnyOf',
      values: ['enterprise'],
    });
  });

  it('rejects a text-only operator on the explicit option type (compile error)', () => {
    // @ts-expect-error - 'contains' is a text operator, not legal for 'option'
    buildFilter(ticketsTable, 'customer.plan', 'option', 'contains', ['enterprise']);
    expect(true).toBe(true);
  });

  it('rejects a value shape that does not match the explicit type (compile error)', () => {
    // @ts-expect-error - 'option' values are string[], not number[]
    buildFilter(ticketsTable, 'customer.plan', 'option', 'is', [1]);
    expect(true).toBe(true);
  });
});

describe('buildFilter -- runtime type resolution edge case', () => {
  it('falls back to a values-based guess for a valid row path that is not a registered column', () => {
    // 'customer.id' is a real Paths<Ticket> (compiles), but ticketsTable
    // never turned it into a column via t.text(...) -- there is no runtime
    // ColumnDefinition to look up, so buildFilter falls back to inspecting
    // values[0]. This is the documented last-resort case (module doc).
    const filter = buildFilter(ticketsTable, 'customer.id', 'contains', ['cust_1']);
    expect(filter).toEqual({
      columnId: 'customer.id',
      type: 'text',
      operator: 'contains',
      values: ['cust_1'],
    });
  });
});
