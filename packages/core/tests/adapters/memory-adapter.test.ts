import { describe, expect, it } from 'bun:test';
import { memoryAdapter } from '../../src/adapters/memory-adapter';
import type { FilterGroupNode, FilterState } from '../../src/types/filter';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'resolved' | 'closed';
  reopenCount: number;
  slaBreached: boolean;
  createdAt: Date;
  tags: string[];
  customer: { company: string | null };
  notes: string | null;
}

function makeRows(): Ticket[] {
  return [
    {
      id: '1',
      subject: 'Login broken',
      status: 'open',
      reopenCount: 2,
      slaBreached: true,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      tags: ['auth', 'urgent'],
      customer: { company: 'Acme' },
      notes: null,
    },
    {
      id: '2',
      subject: 'Billing question',
      status: 'resolved',
      reopenCount: 0,
      slaBreached: false,
      createdAt: new Date('2026-02-01T10:00:00Z'),
      tags: ['billing'],
      customer: { company: 'Globex' },
      notes: 'answered',
    },
    {
      id: '3',
      subject: 'Feature request: dark mode',
      status: 'open',
      reopenCount: 5,
      slaBreached: false,
      createdAt: new Date('2026-03-05T10:00:00Z'),
      tags: ['feature'],
      customer: { company: null },
      notes: 'planned',
    },
    {
      id: '4',
      subject: 'Crash on save',
      status: 'closed',
      reopenCount: 1,
      slaBreached: true,
      createdAt: new Date('2025-12-25T10:00:00Z'),
      tags: ['bug', 'urgent'],
      customer: { company: 'Acme' },
      notes: null,
    },
  ];
}

const leaf = (partial: Partial<FilterState> & Pick<FilterState, 'columnId' | 'operator'>) =>
  ({ type: 'text', values: [], ...partial }) as FilterState;

describe('memoryAdapter', () => {
  describe('fetchData', () => {
    it('returns all rows with total when unfiltered', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({});
      expect(result.data).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it('applies implicit-AND flat filter arrays', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({
        filters: [
          leaf({ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }),
          leaf({ columnId: 'reopenCount', type: 'number', operator: 'greaterThan', values: [3] }),
        ],
      });
      expect(result.data.map((r) => r.id)).toEqual(['3']);
    });

    it('applies nested OR/AND group trees', async () => {
      const adapter = memoryAdapter(makeRows());
      const tree: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [
          leaf({ columnId: 'status', type: 'option', operator: 'is', values: ['closed'] }),
          {
            kind: 'group',
            logic: 'and',
            children: [
              leaf({ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }),
              leaf({ columnId: 'slaBreached', type: 'boolean', operator: 'isTrue' }),
            ],
          },
        ],
      };
      const result = await adapter.fetchData({ filters: tree });
      expect(result.data.map((r) => r.id).sort()).toEqual(['1', '4']);
    });

    it('filters text operators case-insensitively', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({
        filters: [leaf({ columnId: 'subject', operator: 'contains', values: ['LOGIN'] })],
      });
      expect(result.data.map((r) => r.id)).toEqual(['1']);
    });

    it('filters relationship-style dot-paths on nested objects', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({
        filters: [leaf({ columnId: 'customer.company', operator: 'equals', values: ['Acme'] })],
      });
      expect(result.data.map((r) => r.id).sort()).toEqual(['1', '4']);
    });

    it('honors includeNull to let null values pass', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({
        filters: [
          leaf({
            columnId: 'customer.company',
            operator: 'equals',
            values: ['Acme'],
            includeNull: true,
          }),
        ],
      });
      expect(result.data.map((r) => r.id).sort()).toEqual(['1', '3', '4']);
    });

    it('supports multiOption set operators', async () => {
      const adapter = memoryAdapter(makeRows());
      const anyOf = await adapter.fetchData({
        filters: [
          leaf({
            columnId: 'tags',
            type: 'multiOption',
            operator: 'includesAny',
            values: ['urgent', 'billing'],
          }),
        ],
      });
      expect(anyOf.data.map((r) => r.id).sort()).toEqual(['1', '2', '4']);

      const all = await adapter.fetchData({
        filters: [
          leaf({
            columnId: 'tags',
            type: 'multiOption',
            operator: 'includesAll',
            values: ['auth', 'urgent'],
          }),
        ],
      });
      expect(all.data.map((r) => r.id)).toEqual(['1']);
    });

    it('supports date range and universal null operators', async () => {
      const adapter = memoryAdapter(makeRows());
      const between = await adapter.fetchData({
        filters: [
          leaf({
            columnId: 'createdAt',
            type: 'date',
            operator: 'between',
            values: [new Date('2026-01-01'), new Date('2026-02-15')],
          }),
        ],
      });
      expect(between.data.map((r) => r.id).sort()).toEqual(['1', '2']);

      const nulls = await adapter.fetchData({
        filters: [leaf({ columnId: 'notes', operator: 'isNull' })],
      });
      expect(nulls.data.map((r) => r.id).sort()).toEqual(['1', '4']);
    });

    it('sorts multi-column with nulls last', async () => {
      const adapter = memoryAdapter(makeRows());
      const result = await adapter.fetchData({
        sorting: [
          { columnId: 'customer.company', direction: 'asc' },
          { columnId: 'reopenCount', direction: 'desc' },
        ],
      });
      // Acme(reopen 2), Acme(reopen 1), Globex, null-company last
      expect(result.data.map((r) => r.id)).toEqual(['1', '4', '2', '3']);
    });

    it('paginates 1-based with correct metadata', async () => {
      const adapter = memoryAdapter(makeRows());
      const page2 = await adapter.fetchData({ pagination: { page: 2, limit: 3 } });
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(4);
      expect(page2.pagination).toEqual({
        page: 2,
        limit: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('honors an aborted signal', async () => {
      const adapter = memoryAdapter(makeRows());
      const controller = new AbortController();
      controller.abort();
      await expect(adapter.fetchData({ signal: controller.signal })).rejects.toThrow();
    });
  });

  describe('facets', () => {
    it('counts values with self-exclusion for the facet column', async () => {
      const adapter = memoryAdapter(makeRows());
      const counts = await adapter.getFacetedValues('status', {
        filters: [
          leaf({ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }),
          leaf({ columnId: 'slaBreached', type: 'boolean', operator: 'isTrue' }),
        ],
      });
      // Own status filter excluded; slaBreached=true keeps rows 1 and 4.
      expect(counts.get('open')).toBe(1);
      expect(counts.get('closed')).toBe(1);
      expect(counts.get('resolved')).toBeUndefined();
    });

    it('flattens array values and caps by limit ordered by count', async () => {
      const adapter = memoryAdapter(makeRows());
      const counts = await adapter.getFacetedValues('tags', { limit: 1 });
      expect([...counts.entries()]).toEqual([['urgent', 2]]);
      const all = await adapter.getFacetedValues('tags', { limit: null });
      expect(all.size).toBe(5);
    });

    it('treats invalid limits as the default', async () => {
      const adapter = memoryAdapter(makeRows());
      const counts = await adapter.getFacetedValues('tags', { limit: -3 });
      expect(counts.size).toBe(5); // default 100 cap, all 5 distinct tags
    });

    it('getMinMaxValues respects filters minus the facet column', async () => {
      const adapter = memoryAdapter(makeRows());
      const [min, max] = await adapter.getMinMaxValues('reopenCount', {
        filters: [
          leaf({ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }),
          leaf({ columnId: 'reopenCount', type: 'number', operator: 'greaterThan', values: [4] }),
        ],
      });
      expect([min, max]).toEqual([2, 5]);
    });

    it('getFilterOptions returns counted options', async () => {
      const adapter = memoryAdapter(makeRows());
      const options = await adapter.getFilterOptions('status');
      expect(options).toContainEqual({ value: 'open', label: 'open', count: 2 });
    });
  });

  describe('describeColumns', () => {
    it('infers types, nullability, enums, and pk from data', async () => {
      const adapter = memoryAdapter(makeRows());
      const specs = await adapter.describeColumns?.();
      const byField = Object.fromEntries((specs ?? []).map((s) => [s.field, s]));

      expect(byField.id).toMatchObject({ primaryKey: true, writable: false });
      expect(byField.subject?.columnType).toBe('text');
      expect(byField.reopenCount?.columnType).toBe('number');
      expect(byField.slaBreached?.columnType).toBe('boolean');
      expect(byField.createdAt?.columnType).toBe('date');
      expect(byField.tags?.columnType).toBe('multiOption');
      expect(byField.customer?.columnType).toBe('json');
      expect(byField.notes?.nullable).toBe(true);
      expect(byField.status?.columnType).toBe('option');
      expect(byField.status?.options?.map((o) => o.value).sort()).toEqual([
        'closed',
        'open',
        'resolved',
      ]);
    });

    it('disables enum inference when enumInferenceLimit is 0', async () => {
      const adapter = memoryAdapter(makeRows(), { enumInferenceLimit: 0 });
      const specs = await adapter.describeColumns?.();
      expect(specs?.find((s) => s.field === 'status')?.columnType).toBe('text');
    });
  });

  describe('updateRecord', () => {
    it('mutates the matching row in place and returns it', async () => {
      const rows = makeRows();
      const adapter = memoryAdapter(rows);
      const updated = await adapter.updateRecord?.('2', { status: 'closed' });
      expect(updated?.status).toBe('closed');
      expect(rows[1]?.status).toBe('closed');
    });

    it('throws for an unknown id', async () => {
      const adapter = memoryAdapter(makeRows());
      await expect(adapter.updateRecord?.('999', {})).rejects.toThrow("no row with id '999'");
    });

    it('uses a custom getRowId', async () => {
      const adapter = memoryAdapter(makeRows(), { getRowId: (r) => r.subject });
      const updated = await adapter.updateRecord?.('Crash on save', { reopenCount: 9 });
      expect(updated?.reopenCount).toBe(9);
    });
  });

  it('declares honest meta features', () => {
    const adapter = memoryAdapter(makeRows());
    expect(adapter.meta.features).toMatchObject({
      read: true,
      update: true,
      create: false,
      delete: false,
    });
    expect(adapter.meta.supportsFilterGroups).toBe(true);
  });
});
