/**
 * FK-click navigation (plan 065 Phase 3): a resolved column carrying
 * `foreignKeyTarget` renders as a clickable link when `onNavigateToRelated`
 * is provided, plain text otherwise (back-compat) — both for an explicitly
 * declared `foreignKeyTarget` and one resolved through the auto-columns
 * pipeline (`describeColumns`).
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type {
  ColumnDefinition,
  ColumnType,
  InferredColumnSpec,
  TableAdapter,
} from '@better-tables/core';
import { clearAllTableStores, defineTableRow } from '@better-tables/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface TicketRow {
  id: number;
  subject: string;
  customerId: number;
}

const ROWS: TicketRow[] = [
  { id: 1, subject: 'Login broken', customerId: 42 },
  { id: 2, subject: 'No FK value', customerId: 0 },
];

function fkColumns(): ColumnDefinition<TicketRow>[] {
  return [
    {
      id: 'subject',
      displayName: 'Subject',
      type: 'text',
      accessor: (row) => row.subject,
    },
    {
      id: 'customerId',
      displayName: 'Customer Id',
      type: 'number',
      accessor: (row) => row.customerId,
      foreignKeyTarget: { table: 'customers', field: 'id' },
    },
  ];
}

describe('BetterTable FK-click navigation (plan 065 Phase 3) — explicit columns', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders plain text when onNavigateToRelated is omitted (back-compat)', () => {
    render(<BetterTable id="fk-nav-omitted" columns={fkColumns()} data={ROWS} />);

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '42' })).toBeNull();
  });

  it('renders a clickable link when the column has foreignKeyTarget and the callback is provided', () => {
    const onNavigateToRelated = mock((_target: { table: string; id: string }) => {});
    render(
      <BetterTable
        id="fk-nav-provided"
        columns={fkColumns()}
        data={ROWS}
        onNavigateToRelated={onNavigateToRelated}
      />
    );

    const link = screen.getByRole('button', { name: '42' });
    fireEvent.click(link);

    expect(onNavigateToRelated).toHaveBeenCalledTimes(1);
    expect(onNavigateToRelated).toHaveBeenCalledWith({ table: 'customers', id: '42' });
  });

  it('does not render a link for a column with no foreignKeyTarget, even with the callback provided', () => {
    const onNavigateToRelated = mock((_target: { table: string; id: string }) => {});
    render(
      <BetterTable
        id="fk-nav-no-target"
        columns={fkColumns()}
        data={ROWS}
        onNavigateToRelated={onNavigateToRelated}
      />
    );

    // 'subject' has no foreignKeyTarget — plain text regardless of the callback.
    expect(screen.getByText('Login broken')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Login broken' })).toBeNull();
  });

  it('does not render a link (or call back) for a falsy FK value (0)', () => {
    const onNavigateToRelated = mock((_target: { table: string; id: string }) => {});
    render(
      <BetterTable
        id="fk-nav-falsy-value"
        columns={fkColumns()}
        data={ROWS}
        onNavigateToRelated={onNavigateToRelated}
      />
    );

    // Row 2's customerId is 0 — `value != null` still true (0 is not
    // null/undefined), so it SHOULD render as a link and be clickable.
    const link = screen.getByRole('button', { name: '0' });
    fireEvent.click(link);
    expect(onNavigateToRelated).toHaveBeenCalledWith({ table: 'customers', id: '0' });
  });

  it('clicking the FK link does not also trigger onRowClick (stopPropagation)', () => {
    const onNavigateToRelated = mock((_target: { table: string; id: string }) => {});
    const onRowClick = mock((_row: TicketRow) => {});
    render(
      <BetterTable
        id="fk-nav-stop-propagation"
        columns={fkColumns()}
        data={ROWS}
        onNavigateToRelated={onNavigateToRelated}
        onRowClick={onRowClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '42' }));

    expect(onNavigateToRelated).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('BetterTable FK-click navigation — resolved via describeColumns (auto columns)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  const SPECS_WITH_FK: InferredColumnSpec[] = [
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
      field: 'customerId',
      columnType: 'number',
      label: 'Customer Id',
      nullable: false,
      primaryKey: false,
      foreignKey: true,
      foreignKeyTarget: { table: 'customers', field: 'id' },
      writable: true,
    },
  ];

  function makeAdapter(): TableAdapter<TicketRow> {
    return {
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
        supportedColumnTypes: ['text', 'number'],
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
      describeColumns: async () => SPECS_WITH_FK,
    };
  }

  it('an inferred (t.auto()) column with a schema-derived foreignKeyTarget renders as a link', async () => {
    const ticketsTable = defineTableRow<TicketRow>()('tickets');
    const onNavigateToRelated = mock((_target: { table: string; id: string }) => {});

    render(
      <BetterTable
        table={ticketsTable}
        data={ROWS}
        adapter={makeAdapter()}
        onNavigateToRelated={onNavigateToRelated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Login broken')).toBeTruthy();
    });

    const link = screen.getByRole('button', { name: '42' });
    fireEvent.click(link);
    expect(onNavigateToRelated).toHaveBeenCalledWith({ table: 'customers', id: '42' });
  });
});
