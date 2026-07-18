/**
 * Auto columns at the BetterTable mount seam (plan 054): a no-factory
 * definition renders fully inferred columns, `[...t.auto(), override]`
 * merges with explicit-wins semantics, enrichment fills enum options without
 * `t.auto()`, and fully-declared tables never pay the resolution round-trip.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnType, InferredColumnSpec, TableAdapter } from '@better-tables/core';
import { clearAllTableStores, defineTableRow, getTableStore } from '@better-tables/core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface TicketRow {
  id: number;
  subject: string;
  status: string;
}

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
];

const ROWS: TicketRow[] = [
  { id: 1, subject: 'Login broken', status: 'open' },
  { id: 2, subject: 'Slow dashboard', status: 'closed' },
];

function makeAdapter(specs: InferredColumnSpec[] = TICKET_SPECS) {
  const describeCalls: Array<string | undefined> = [];
  const adapter: TableAdapter<TicketRow> = {
    meta: {
      name: 'stub',
      version: 'test',
      features: {
        create: false,
        read: true,
        update: false,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text', 'number', 'option'],
      supportedOperators: {} as Record<ColumnType, never[]>,
    },
    fetchData: async () => ({
      data: ROWS,
      total: ROWS.length,
      pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    describeColumns: async (table?: string) => {
      describeCalls.push(table);
      return specs;
    },
  };
  return { adapter, describeCalls };
}

describe('BetterTable auto columns (plan 054)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders inferred headers and cells for a no-factory definition', async () => {
    // Each test needs a FRESH definition: resolveTableColumns memoizes per
    // (def, adapter) pair, so module-level defs would cross-contaminate.
    const ticketsTable = defineTableRow<TicketRow>()('tickets');
    const { adapter, describeCalls } = makeAdapter();

    render(<BetterTable table={ticketsTable} data={ROWS} adapter={adapter} />);

    // While resolving: the columns-loading skeleton, not the table.
    expect(screen.queryByLabelText('Loading table columns')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeTruthy();
    });

    expect(describeCalls).toEqual(['tickets']);
    expect(screen.getByText('Id')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Login broken')).toBeTruthy();
    expect(screen.getByText('Slow dashboard')).toBeTruthy();
  });

  it('lets an explicit override replace its inferred twin ([...t.auto(), override])', async () => {
    const ticketsTable = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [...t.auto(), t.text('subject').displayName('Custom Subject')],
    }));
    const { adapter } = makeAdapter();

    render(<BetterTable table={ticketsTable} data={ROWS} adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText('Custom Subject')).toBeTruthy();
    });

    // The inferred 'Subject' header must NOT appear alongside the override.
    expect(screen.queryByText('Subject')).toBeNull();
    // The rest of the schema still fills in.
    expect(screen.getByText('Id')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();

    const store = getTableStore('tickets');
    expect(store?.getState().columns.map((c) => c.id)).toEqual(['subject', 'id', 'status']);
  });

  it('enriches an explicit option column with enum choices — zero t.auto() in the def', async () => {
    const ticketsTable = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('subject'), t.option('status')],
    }));
    const { adapter, describeCalls } = makeAdapter();

    render(<BetterTable table={ticketsTable} data={ROWS} adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeTruthy();
    });

    expect(describeCalls).toEqual(['tickets']);
    const store = getTableStore('tickets');
    const columns = store?.getState().columns ?? [];
    // Enrichment fills only the gap — no columns added.
    expect(columns.map((c) => c.id)).toEqual(['subject', 'status']);
    const status = columns.find((c) => c.id === 'status');
    expect(status?.filter?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
  });

  it('never calls describeColumns for a fully-declared definition (no async hop)', () => {
    const ticketsTable = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('subject'), t.option('status').options([{ value: 'open', label: 'Open' }])],
    }));
    const { adapter, describeCalls } = makeAdapter();

    render(<BetterTable table={ticketsTable} data={ROWS} adapter={adapter} />);

    // Renders synchronously — no columns-loading skeleton, headers present.
    expect(screen.queryByLabelText('Loading table columns')).toBeNull();
    expect(screen.getByText('Subject')).toBeTruthy();
    expect(describeCalls).toEqual([]);
  });

  it('an explicit columns prop wins over the table definition — no resolution', () => {
    const ticketsTable = defineTableRow<TicketRow>()('tickets');
    const { adapter, describeCalls } = makeAdapter();

    render(
      <BetterTable
        table={ticketsTable}
        columns={[
          {
            id: 'subject',
            displayName: 'Prop Subject',
            type: 'text',
            accessor: (row: TicketRow) => row.subject,
          },
        ]}
        data={ROWS}
        adapter={adapter}
      />
    );

    expect(screen.getByText('Prop Subject')).toBeTruthy();
    expect(describeCalls).toEqual([]);
  });
});
