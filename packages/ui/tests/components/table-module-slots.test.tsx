import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { type ColumnDefinition, clearAllTableStores, type TableAction } from '@better-tables/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  type ActionsToolbarSlotProps,
  BetterTable,
  type ToolbarExtraSlotProps,
} from '../../src/components/table/table';

/**
 * Plan 059 Step 2: the `slots` seam. `actions` (a core prop) no longer imports
 * a toolbar directly — the `actions` module injects one through
 * `slots.actionsToolbar`. These tests pin: the slot renders and receives live
 * selection; an absent slot with `actions` present renders nothing and warns
 * once in dev; no `actions` never warns; and `toolbarExtra` receives the
 * current view (columns/filters/sorting) for a module like export.
 */

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (row) => row.name, filterable: true },
];

const rows: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const actions: TableAction<Row>[] = [{ id: 'archive', label: 'Archive', handler: () => {} }];

/** A stub `actions` module component: renders the live selection count. */
function StubActionsToolbar({ selectedIds }: ActionsToolbarSlotProps<Row>) {
  return <div data-testid="actions-slot">selected:{selectedIds.length}</div>;
}

/** A stub `toolbarExtra` module component: echoes the injected view. */
function StubToolbarExtra({ columns: cols, filters, sorting }: ToolbarExtraSlotProps<Row>) {
  return (
    <div data-testid="toolbar-extra">
      cols:{cols.length} filters:{Array.isArray(filters) ? filters.length : 'tree'} sorts:
      {sorting.length}
    </div>
  );
}

describe('BetterTable module slots', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders the actionsToolbar slot and feeds it live selection', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <BetterTable
          id="slots-wired"
          columns={columns}
          data={rows}
          totalCount={2}
          virtualized={false}
          actions={actions}
          slots={{ actionsToolbar: StubActionsToolbar }}
        />
      );

      // Slot is mounted (actions present + slot wired); nothing selected yet.
      expect(screen.getByTestId('actions-slot').textContent).toBe('selected:0');

      // Selecting rows flows through to the slot's props.
      fireEvent.click(screen.getByRole('checkbox', { name: /select all rows/i }));
      expect(screen.getByTestId('actions-slot').textContent).toBe('selected:2');

      // Wiring the slot means no missing-slot warning.
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('renders nothing and warns exactly once when actions are set but the slot is absent', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(
        <BetterTable
          id="slots-absent"
          columns={columns}
          data={rows}
          totalCount={2}
          virtualized={false}
          actions={actions}
        />
      );

      // No toolbar rendered...
      expect(screen.queryByTestId('actions-slot')).toBeNull();
      // ...but row selection still turns on (actions imply selection).
      expect(screen.getByRole('checkbox', { name: /select all rows/i })).toBeTruthy();

      // Exactly one dev warn, naming the fix.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = String(warnSpy.mock.calls[0]?.[0]);
      expect(message).toContain('slots-absent');
      expect(message).toContain('slots.actionsToolbar');
      expect(message).toContain('better-tables add actions');

      // A re-render of the same table does not warn again.
      rerender(
        <BetterTable
          id="slots-absent"
          columns={columns}
          data={rows}
          totalCount={2}
          virtualized={false}
          actions={actions}
        />
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn when no actions are provided', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <BetterTable
          id="slots-no-actions"
          columns={columns}
          data={rows}
          totalCount={2}
          virtualized={false}
        />
      );

      expect(screen.queryByTestId('actions-slot')).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('renders the toolbarExtra slot with the current columns/filters/sorting', () => {
    render(
      <BetterTable
        id="slots-extra"
        columns={columns}
        data={rows}
        totalCount={2}
        virtualized={false}
        slots={{ toolbarExtra: StubToolbarExtra }}
      />
    );

    const extra = screen.getByTestId('toolbar-extra').textContent ?? '';
    expect(extra).toContain('cols:1');
    expect(extra).toContain('filters:0');
    expect(extra).toContain('sorts:0');
  });
});
