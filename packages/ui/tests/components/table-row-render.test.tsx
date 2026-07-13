import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { destroyTableStore, getTableStore } from '@better-tables/core';
import { act, cleanup, render } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));
}

/** Column whose `cellRenderer` increments a per-row counter every time React
 * actually calls it. Since `cellRenderer` is invoked directly in the row's
 * render body, its call count is a direct proxy for "did this row's
 * component function actually re-run" — it stays flat across a re-render
 * exactly when (and only when) the row bailed out via memoization. */
function makeCountingColumns(counts: Map<string, number>): ColumnDefinition<Row>[] {
  return [
    {
      id: 'name',
      displayName: 'Name',
      type: 'text',
      sortable: true,
      accessor: (row) => row.name,
      cellRenderer: ({ row }) => {
        const r = row as Row;
        counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
        return r.name;
      },
    },
  ];
}

describe('BetterTable row render counts (UI-05)', () => {
  afterEach(() => {
    cleanup();
  });

  it('BEFORE FIX baseline: selecting one row re-renders every row (no memoization yet)', () => {
    const tableId = 'row-render-select-baseline';
    const counts = new Map<string, number>();
    const columns = makeCountingColumns(counts);
    const rows = makeRows(10);

    render(
      <BetterTable
        id={tableId}
        name="Row render select baseline"
        columns={columns}
        data={rows}
        features={{ rowSelection: true }}
      />
    );

    const store = getTableStore(tableId);
    if (!store) throw new Error('store missing');
    expect(Array.from(counts.values())).toEqual(rows.map(() => 1));

    act(() => {
      store.getState().toggleRow('r3');
    });

    // Pre-fix: selecting row 3 bumps EVERY row's render count by the same
    // amount as r3's — not just r3's — because rows are unmemoized inline
    // JSX recreated by the parent's render. (The exact increment can be >1
    // if the store notifies subscribers more than once per toggle; what
    // matters here is that it's identical and >1 across every row.)
    const r3Count = counts.get('r3');
    expect(r3Count).toBeGreaterThan(1);
    for (const row of rows) {
      expect(counts.get(row.id)).toBe(r3Count);
    }

    destroyTableStore(tableId);
  });

  it(
    'BEFORE FIX baseline: a sort re-renders every row (also true after the fix, ' +
      'documented so the "sort still re-renders everything" behavior does not regress ' +
      'into "sort renders nothing")',
    () => {
      const tableId = 'row-render-sort-baseline';
      const counts = new Map<string, number>();
      const columns = makeCountingColumns(counts);
      const rows = makeRows(10);

      render(
        <BetterTable
          id={tableId}
          name="Row render sort baseline"
          columns={columns}
          data={rows}
          features={{ rowSelection: true }}
        />
      );

      const store = getTableStore(tableId);
      if (!store) throw new Error('store missing');

      act(() => {
        store.getState().toggleSort('name');
      });

      const afterSortCount = counts.get('r0');
      expect(afterSortCount).toBeGreaterThan(1);
      for (const row of rows) {
        expect(counts.get(row.id)).toBe(afterSortCount);
      }

      destroyTableStore(tableId);
    }
  );
});
