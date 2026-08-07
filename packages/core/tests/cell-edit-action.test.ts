/**
 * tables.cellEditAction(def) (plan 055 Step 2): the generated plain-async
 * save function — policy-gated, type-coerced, explicit-table writes.
 */

import { describe, expect, it, spyOn } from 'bun:test';
import { betterTables, defineTableRow } from '../src/factory';
import type { CellEditActionInput } from '../src/lib/cell-edit-core';
import type { CellWriteTarget, MutationOptions } from '../src/types/adapter';

interface TicketRow {
  id: number;
  subject: string;
  createdAt: Date;
  customer: { id: number; company: string } | null;
}

type UpdateCall = { id: string; data: Record<string, unknown>; options?: MutationOptions };

function makeWriteAdapter(overrides?: { failUpdate?: boolean; noUpdate?: boolean }) {
  const updates: UpdateCall[] = [];
  const adapter: Record<string, unknown> = {
    fetchData: async () => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    resolveCellWriteTarget: async (columnId: string): Promise<CellWriteTarget | null> => {
      if (columnId === 'customer.company') {
        return {
          table: 'customers',
          field: 'company',
          relatedIdPath: 'customer.id',
          single: true,
          writable: true,
        };
      }
      return null;
    },
    meta: { name: 'stub', version: 'test', features: { update: true } },
  };
  if (!overrides?.noUpdate) {
    adapter.updateRecord = async (
      id: string,
      data: Record<string, unknown>,
      options?: MutationOptions
    ) => {
      if (overrides?.failUpdate) throw new Error('unique constraint violated: secret_sql');
      updates.push({ id, data, ...(options ? { options } : {}) });
      return { id, ...data };
    };
  }
  return { adapter, updates };
}

function makeTicketsDef() {
  return defineTableRow<TicketRow>()('tickets', (t) => ({
    columns: [
      t.text('subject').editable(),
      t.date('createdAt').editable(),
      t.text('customer.company').editable(),
    ],
  }));
}

describe('tables.cellEditAction', () => {
  it('saves an own-table field with the def tableName and coerces ISO → Date', async () => {
    const { adapter, updates } = makeWriteAdapter();
    const tables = betterTables({ database: adapter });
    const def = makeTicketsDef();
    const action = tables.cellEditAction(def);

    const textResult = await action({ id: '5', field: 'subject', value: 'New subject' });
    expect(textResult).toEqual({ ok: true, data: { id: '5', subject: 'New subject' } });
    expect(updates[0]).toEqual({
      id: '5',
      data: { subject: 'New subject' },
      options: { table: 'tickets' },
    });

    const dateResult = await action({
      id: '5',
      field: 'createdAt',
      value: '2026-04-01T12:00:00.000Z',
    });
    expect(dateResult.ok).toBe(true);
    const written = updates[1]?.data.createdAt;
    expect(written).toBeInstanceOf(Date);
    expect((written as Date).toISOString()).toBe('2026-04-01T12:00:00.000Z');
  });

  it('a dot-column save writes the RELATED table and field', async () => {
    const { adapter, updates } = makeWriteAdapter();
    const tables = betterTables({ database: adapter });
    const action = tables.cellEditAction(makeTicketsDef());

    const result = await action({ id: '42', field: 'customer.company', value: 'Globex' });
    expect(result.ok).toBe(true);
    expect(updates).toEqual([
      { id: '42', data: { company: 'Globex' }, options: { table: 'customers' } },
    ]);
  });

  it('unknown / non-editable columns are rejected and updateRecord is NEVER called', async () => {
    const { adapter, updates } = makeWriteAdapter();
    const tables = betterTables({ database: adapter });
    const action = tables.cellEditAction(makeTicketsDef());

    const unknown = await action({ id: '1', field: 'priority', value: 'high' });
    expect(unknown).toEqual({ ok: false, error: 'Column "priority" is not editable.' });

    const badValue = await action({ id: '1', field: 'subject', value: 42 });
    expect(badValue.ok).toBe(false);

    expect(updates).toHaveLength(0);
  });

  it('an adapter without updateRecord rejects cleanly', async () => {
    const { adapter } = makeWriteAdapter({ noUpdate: true });
    const tables = betterTables({ database: adapter });
    const action = tables.cellEditAction(makeTicketsDef());

    expect(await action({ id: '1', field: 'subject', value: 'x' })).toEqual({
      ok: false,
      error: 'Adapter does not support updates.',
    });
  });

  it('is memoized per table definition (same function back)', async () => {
    const { adapter } = makeWriteAdapter();
    const tables = betterTables({ database: adapter });
    const def = makeTicketsDef();
    expect(tables.cellEditAction(def)).toBe(tables.cellEditAction(def));
    // A different def gets its own action.
    expect(tables.cellEditAction(makeTicketsDef())).not.toBe(tables.cellEditAction(def));
  });

  it('input and result are serializable (plain data, no functions/classes)', async () => {
    const { adapter } = makeWriteAdapter();
    const tables = betterTables({ database: adapter });
    const action = tables.cellEditAction(makeTicketsDef());

    const input: CellEditActionInput = { id: '5', field: 'subject', value: 'Plain' };
    // The input round-trips through JSON unchanged (what crosses the wire).
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);

    const result = await action(input);
    expect(result.ok).toBe(true);
    // No functions/classes anywhere in the result tree (Dates are fine —
    // React server actions serialize them natively).
    const walk = (value: unknown): void => {
      expect(typeof value).not.toBe('function');
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        expect(Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value)).toBe(
          true
        );
        for (const child of Object.values(value)) walk(child);
      }
    };
    walk(result);
  });
});
