/**
 * Shared cell-edit policy (plan 055 Step 1): admission (own-table + dot
 * columns via resolveCellWriteTarget; one-to-many/unwritable rejected at
 * build), per-type coercion, ValidationRules, and typed rejections.
 */

import { describe, expect, it, spyOn } from 'bun:test';
import { defineTableRow } from '../../src/factory';
import {
  buildCellEditPolicy,
  coerceCellValue,
  resolveEditableField,
} from '../../src/lib/cell-edit-core';
import type { CellWriteTarget } from '../../src/types/adapter';

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  reopenCount: number;
  slaBreached: boolean;
  createdAt: Date;
  customer: { id: number; company: string } | null;
  notes: Array<{ id: number; body: string }>;
}

const CUSTOMER_COMPANY_TARGET: CellWriteTarget = {
  table: 'customers',
  field: 'company',
  relatedIdPath: 'customer.id',
  single: true,
  writable: true,
};

function makeTargetStub(targets: Record<string, CellWriteTarget | null>) {
  const calls: Array<[string, string | undefined]> = [];
  return {
    calls,
    adapter: {
      resolveCellWriteTarget: async (columnId: string, table?: string) => {
        calls.push([columnId, table]);
        return targets[columnId] ?? null;
      },
    },
  };
}

const silenced = async <T>(fn: () => Promise<T>): Promise<T> => {
  const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return await fn();
  } finally {
    warnSpy.mockRestore();
  }
};

describe('buildCellEditPolicy — admission', () => {
  it('admits own-table editable columns locally and dot columns via the adapter', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [
        t.text('subject').editable(),
        t.number('reopenCount'), // NOT editable — must not be admitted
        t.text('customer.company').editable(),
      ],
    }));
    const { adapter, calls } = makeTargetStub({
      'customer.company': CUSTOMER_COMPANY_TARGET,
    });

    const policy = await buildCellEditPolicy(def, adapter);

    expect([...policy.entries.keys()].sort()).toEqual(['customer.company', 'subject']);
    // Own-table columns resolved locally — the adapter saw only the dot column.
    expect(calls).toEqual([['customer.company', 'tickets']]);
    expect(policy.entries.get('subject')?.target).toEqual({
      table: 'tickets',
      field: 'subject',
      relatedIdPath: null,
      single: true,
      writable: true,
    });
    expect(policy.entries.get('customer.company')?.target).toEqual(CUSTOMER_COMPANY_TARGET);
  });

  it('a dotted id with an editable.field override is an OWN-table write (053 semantic)', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('customer.company').editable({ field: 'subject' })],
    }));
    // No adapter at all — the override resolves locally.
    const policy = await buildCellEditPolicy(def, null);
    expect(policy.entries.get('customer.company')?.target).toEqual({
      table: 'tickets',
      field: 'subject',
      relatedIdPath: null,
      single: true,
      writable: true,
    });
  });

  it('rejects one-to-many and unwritable targets at build time (dev warn names why)', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('notes.body').editable(), t.text('customer.company').editable()],
    }));
    const { adapter } = makeTargetStub({
      'notes.body': {
        table: 'notes',
        field: 'body',
        relatedIdPath: 'notes.id',
        single: false,
        writable: true,
      },
      'customer.company': { ...CUSTOMER_COMPANY_TARGET, writable: false },
    });

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const policy = await buildCellEditPolicy(def, adapter);
      expect(policy.entries.size).toBe(0);
      const messages = warnSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes('one-to-many'))).toBe(true);
      expect(messages.some((m) => m.includes('schema-unwritable'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('a dot column without the capability is not admitted (callback-only, dev warn)', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('customer.company').editable(), t.text('subject').editable()],
    }));
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const policy = await buildCellEditPolicy(def, {});
      expect([...policy.entries.keys()]).toEqual(['subject']);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain('resolveCellWriteTarget');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('editable columns without a v1 editor type are not admitted', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (_t) => ({
      columns: [
        // multiOption has no v1 editor — force via a raw definition.
        {
          id: 'tags',
          displayName: 'Tags',
          type: 'multiOption' as const,
          accessor: () => [],
          editable: true,
        },
      ],
    }));
    const policy = await silenced(() => buildCellEditPolicy(def, null));
    expect(policy.entries.size).toBe(0);
  });
});

describe('policy.check — coercion, validation, rejection', () => {
  async function makeTicketsPolicy() {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [
        t
          .text('subject')
          .editable()
          .validation([
            {
              id: 'non-empty',
              validate: (value) => (value ?? '').length > 0 || 'Subject required',
            },
          ]),
        t
          .option('status')
          .options([
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ])
          .editable(),
        t.number('reopenCount').editable(),
        t.boolean('slaBreached').editable(),
        t.date('createdAt').editable(),
        t.text('customer.company').editable(),
      ],
    }));
    const { adapter } = makeTargetStub({ 'customer.company': CUSTOMER_COMPANY_TARGET });
    return buildCellEditPolicy(def, adapter);
  }

  it('date: ISO string and epoch coerce to Date; garbage rejected', async () => {
    const policy = await makeTicketsPolicy();
    const iso = policy.check({ id: '1', field: 'createdAt', value: '2026-03-01T00:00:00.000Z' });
    expect(iso.ok).toBe(true);
    if (iso.ok) {
      expect(iso.value).toBeInstanceOf(Date);
      expect((iso.value as Date).toISOString()).toBe('2026-03-01T00:00:00.000Z');
    }
    const epoch = policy.check({ id: '1', field: 'createdAt', value: 1_700_000_000_000 });
    expect(epoch.ok).toBe(true);
    if (epoch.ok) expect(epoch.value).toBeInstanceOf(Date);
    expect(policy.check({ id: '1', field: 'createdAt', value: 'not-a-date' }).ok).toBe(false);
    expect(policy.check({ id: '1', field: 'createdAt', value: true }).ok).toBe(false);
  });

  it('number: finite ok, non-finite/NaN/string rejected', async () => {
    const policy = await makeTicketsPolicy();
    expect(policy.check({ id: '1', field: 'reopenCount', value: 3 }).ok).toBe(true);
    expect(policy.check({ id: '1', field: 'reopenCount', value: null }).ok).toBe(true);
    expect(policy.check({ id: '1', field: 'reopenCount', value: Number.NaN }).ok).toBe(false);
    expect(
      policy.check({ id: '1', field: 'reopenCount', value: Number.POSITIVE_INFINITY }).ok
    ).toBe(false);
    expect(policy.check({ id: '1', field: 'reopenCount', value: '3' }).ok).toBe(false);
  });

  it('boolean: requires a boolean', async () => {
    const policy = await makeTicketsPolicy();
    expect(policy.check({ id: '1', field: 'slaBreached', value: true }).ok).toBe(true);
    expect(policy.check({ id: '1', field: 'slaBreached', value: 'true' }).ok).toBe(false);
    expect(policy.check({ id: '1', field: 'slaBreached', value: 1 }).ok).toBe(false);
  });

  it('option: value must be one of the declared options', async () => {
    const policy = await makeTicketsPolicy();
    expect(policy.check({ id: '1', field: 'status', value: 'closed' }).ok).toBe(true);
    const bad = policy.check({ id: '1', field: 'status', value: 'escalated' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('not one of the column options');
  });

  it('text: string/null ok, non-string rejected; ValidationRules run after coercion', async () => {
    const policy = await makeTicketsPolicy();
    expect(policy.check({ id: '1', field: 'subject', value: 'Hello' }).ok).toBe(true);
    expect(policy.check({ id: '1', field: 'subject', value: 42 }).ok).toBe(false);
    const invalid = policy.check({ id: '1', field: 'subject', value: '' });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBe('Subject required');
  });

  it('unknown / non-admitted columns and malformed inputs are rejected', async () => {
    const policy = await makeTicketsPolicy();
    const unknown = policy.check({ id: '1', field: 'nope', value: 'x' });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('Column "nope" is not editable.');
    expect(policy.check({ id: '', field: 'subject', value: 'x' }).ok).toBe(false);
    expect(policy.check({ id: '1', field: '', value: 'x' } as never).ok).toBe(false);
  });

  it('a dot column check returns the RELATED table target', async () => {
    const policy = await makeTicketsPolicy();
    const check = policy.check({ id: '7', field: 'customer.company', value: 'Acme Corp' });
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.target.table).toBe('customers');
      expect(check.target.field).toBe('company');
      expect(check.target.relatedIdPath).toBe('customer.id');
      expect(check.value).toBe('Acme Corp');
    }
  });
});

describe('coerceCellValue (field-agnostic export) + resolveEditableField', () => {
  it('rejects types without a v1 editor', () => {
    expect(coerceCellValue('multiOption', ['a']).ok).toBe(false);
    expect(coerceCellValue('json', {}).ok).toBe(false);
  });

  it('accepts an in-process Date for date columns', () => {
    const when = new Date('2026-01-01T00:00:00.000Z');
    const result = coerceCellValue('date', when);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(when);
  });

  it('resolveEditableField: override > flat id > null for dotted ids', () => {
    expect(resolveEditableField('subject', null)).toBe('subject');
    expect(resolveEditableField('customer.company', null)).toBeNull();
    expect(resolveEditableField('customer.company', { field: 'companyCache' })).toBe(
      'companyCache'
    );
  });
});
