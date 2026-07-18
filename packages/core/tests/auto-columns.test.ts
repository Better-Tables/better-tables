/**
 * Auto columns (plan 054): the `t.auto()` sentinel, the no-factory `define`
 * form, and the ONE lazy resolver (`resolveTableColumns`) behind both
 * enrichment and column-set inference.
 */

import { describe, expect, it, spyOn } from 'bun:test';
import {
  betterTables,
  defineTable,
  defineTableRow,
  resolveTableColumns,
  tableNeedsColumnResolution,
} from '../src/factory';
import type { InferredColumnSpec, TableAdapter } from '../src/types/adapter';
import type { SchemaAwareAdapter } from '../src/types/paths';

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
}

type TicketSchema = { tickets: { row: TicketRow } };

const TICKET_SPECS: InferredColumnSpec[] = [
  {
    field: 'id',
    columnType: 'number',
    label: 'Id',
    nullable: false,
    primaryKey: true,
    foreignKey: false,
    writable: false,
  },
  {
    field: 'subject',
    columnType: 'text',
    label: 'Subject',
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
  {
    field: 'status',
    columnType: 'option',
    label: 'Status',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
  {
    field: 'createdAt',
    columnType: 'date',
    label: 'Created At',
    nullable: true,
    primaryKey: false,
    foreignKey: false,
    writable: true,
  },
];

/** Minimal describeColumns-capable adapter stub with a call counter. */
function makeDescribeStub(specs: InferredColumnSpec[] = TICKET_SPECS) {
  const calls: Array<string | undefined> = [];
  const adapter: Pick<TableAdapter<unknown>, 'describeColumns'> = {
    describeColumns: async (table?: string) => {
      calls.push(table);
      return specs;
    },
  };
  return { adapter, calls };
}

describe('no-factory define / t.auto() markers', () => {
  it('defineTableRow with no factory produces columns: [] + autoColumns: true', () => {
    const def = defineTableRow<TicketRow>()('tickets');
    expect(def.tableName).toBe('tickets');
    expect(def.columns).toEqual([]);
    expect(def.autoColumns).toBe(true);
  });

  it('defineTable (curried, schema-aware) with no factory sets the marker', () => {
    const tables = betterTables({
      database: { $types: undefined } as unknown as SchemaAwareAdapter<{ tables: TicketSchema }> &
        object,
    });
    const def = defineTable<typeof tables>()('tickets');
    expect(def.columns).toEqual([]);
    expect(def.autoColumns).toBe(true);
  });

  it('tables.define (method form) with no factory sets the marker', () => {
    const tables = betterTables({
      database: { $types: undefined } as unknown as SchemaAwareAdapter<{ tables: TicketSchema }> &
        object,
    });
    const def = tables.define('tickets');
    expect(def.columns).toEqual([]);
    expect(def.autoColumns).toBe(true);
  });

  it('a spread t.auto() is stripped from columns and sets the marker', () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [...t.auto(), t.text('subject').editable()],
    }));
    expect(def.autoColumns).toBe(true);
    expect(def.columns.map((c) => c.id)).toEqual(['subject']);
    expect(def.columns[0]?.editable).toBeTruthy();
  });

  it('a factory without t.auto() does NOT set the marker (auto-inclusion is never the default)', () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('subject')],
    }));
    expect(def.autoColumns).toBeUndefined();
  });
});

describe('tableNeedsColumnResolution', () => {
  it('is true for autoColumns definitions and enrichable gaps, false when fully declared', () => {
    const auto = defineTableRow<TicketRow>()('tickets');
    expect(tableNeedsColumnResolution(auto)).toBe(true);

    const gap = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.option('status')],
    }));
    expect(tableNeedsColumnResolution(gap)).toBe(true);

    const declared = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [
        t.text('subject'),
        t.option('status').options([{ value: 'open', label: 'Open' }]),
      ],
    }));
    expect(tableNeedsColumnResolution(declared)).toBe(false);
  });
});

describe('resolveTableColumns — column-set inference', () => {
  it('resolves a no-factory definition to the full inferred column list', async () => {
    const def = defineTableRow<TicketRow>()('tickets');
    const { adapter, calls } = makeDescribeStub();

    const columns = await resolveTableColumns(def, adapter);

    expect(calls).toEqual(['tickets']);
    expect(columns.map((c) => c.id)).toEqual(['id', 'subject', 'status', 'createdAt']);
    expect(columns.map((c) => c.type)).toEqual(['number', 'text', 'option', 'date']);
    expect(columns.map((c) => c.displayName)).toEqual(['Id', 'Subject', 'Status', 'Created At']);
    expect(columns[2]?.filter?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
    // Inferred columns are usable defaults…
    expect(columns[0]?.sortable).toBe(true);
    expect(columns[0]?.filterable).toBe(true);
    expect(columns[0]?.hideable).toBe(true);
    // …but NEVER editable without an explicit override.
    for (const column of columns) {
      expect(column.editable).toBeUndefined();
    }
    // The accessor reads the raw field.
    expect(columns[1]?.accessor({ subject: 'Hello' } as TicketRow)).toBe('Hello');
  });

  it('merges [...t.auto(), override]: explicit wins by id, explicit first, then schema order', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [...t.auto(), t.text('subject').displayName('Custom Subject').editable()],
    }));
    const { adapter } = makeDescribeStub();

    const columns = await resolveTableColumns(def, adapter);

    // Explicit first, inferred fill the rest in stable schema order — no
    // duplicate 'subject'.
    expect(columns.map((c) => c.id)).toEqual(['subject', 'id', 'status', 'createdAt']);
    expect(columns[0]?.displayName).toBe('Custom Subject');
    expect(columns[0]?.editable).toBeTruthy();
    expect(columns.filter((c) => c.id === 'subject')).toHaveLength(1);
  });

  it('memoizes per (def, adapter) pair — describeColumns called once', async () => {
    const def = defineTableRow<TicketRow>()('tickets');
    const { adapter, calls } = makeDescribeStub();

    const first = await resolveTableColumns(def, adapter);
    const second = await resolveTableColumns(def, adapter);

    expect(calls).toHaveLength(1);
    expect(second).toBe(first);

    // A different adapter is a different pair.
    const { adapter: other, calls: otherCalls } = makeDescribeStub();
    await resolveTableColumns(def, other);
    expect(otherCalls).toHaveLength(1);
  });

  it('degrades to the declared list (with a dev warn) when the adapter lacks describeColumns', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [...t.auto(), t.text('subject')],
    }));
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const columns = await resolveTableColumns(def, {});
      expect(columns.map((c) => c.id)).toEqual(['subject']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain('describeColumns');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('falls back to the declared columns when describeColumns throws', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [...t.auto(), t.text('subject')],
    }));
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const columns = await resolveTableColumns(def, {
        describeColumns: async () => {
          throw new Error('no introspection today');
        },
      });
      expect(columns.map((c) => c.id)).toEqual(['subject']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('resolveTableColumns — enrichment (independent of t.auto())', () => {
  it('fills enum options on a declared option column with no .options() — no t.auto() involved', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.option('status')],
    }));
    expect(def.autoColumns).toBeUndefined();
    const { adapter } = makeDescribeStub();

    const columns = await resolveTableColumns(def, adapter);

    // Only the declared column — enrichment never adds columns.
    expect(columns.map((c) => c.id)).toEqual(['status']);
    expect(columns[0]?.filter?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
  });

  it('declared options always win — enrichment only fills gaps', async () => {
    const declaredOptions = [{ value: 'open', label: 'OPEN (declared)' }];
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.option('status').options(declaredOptions)],
    }));
    const { adapter, calls } = makeDescribeStub();

    const columns = await resolveTableColumns(def, adapter);
    expect(columns[0]?.filter?.options).toEqual(declaredOptions);
    // The resolver may have been called (caller's choice) but must not
    // overwrite; the declared column object is passed through untouched.
    expect(columns[0]).toBe(def.columns[0]);
    expect(calls.length).toBeLessThanOrEqual(1);
  });

  it('warns (dev mode) when a declared type contradicts the schema type', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      // 'subject' is text in the schema — declare it as a number column.
      columns: [t.computed('subject', (row) => row.subject as unknown as number)],
    }));
    // computed() is type 'custom' (always compatible) — force the mismatch.
    const columns = def.columns.map((c) => ({ ...c, type: 'number' as const }));
    const mismatchDef = { ...def, columns };

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { adapter } = makeDescribeStub();
      await resolveTableColumns(mismatchDef, adapter);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain("declared 'number'");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for compatible refinements (email over a text schema column)', async () => {
    const def = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.option('status'), t.text('subject')],
    }));
    const emailish = {
      ...def,
      columns: def.columns.map((c) => (c.id === 'subject' ? { ...c, type: 'email' as const } : c)),
    };
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { adapter } = makeDescribeStub();
      await resolveTableColumns(emailish, adapter);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
