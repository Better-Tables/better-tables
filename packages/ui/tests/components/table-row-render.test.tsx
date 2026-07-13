import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { destroyTableStore, getTableStore } from '@better-tables/core';
import { act, cleanup, render } from '@testing-library/react';
import { BetterTable, type BetterTableProps } from '../../src/components/table/table';

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

  it('AFTER FIX: selecting one row re-renders only that row, not its siblings', () => {
    const tableId = 'row-render-select-fixed';
    const counts = new Map<string, number>();
    const columns = makeCountingColumns(counts);
    const rows = makeRows(10);

    render(
      <BetterTable
        id={tableId}
        name="Row render select fixed"
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

    // `MemoizedTableRow` bails out for every row whose own props
    // (`isSelected`, plus the referentially-stable `row`/`visibleColumns`/
    // callbacks) didn't change. Only r3's `isSelected` flips, so only r3
    // re-renders — every other row's count stays at the pre-toggle value.
    expect(counts.get('r3')).toBeGreaterThan(1);
    for (const row of rows) {
      if (row.id === 'r3') continue;
      expect(counts.get(row.id)).toBe(1);
    }

    destroyTableStore(tableId);
  });

  it(
    'AFTER FIX: reordering data (as a real consumer does in response to a sort) ' +
      're-renders every row exactly once, not zero times and not repeatedly',
    () => {
      const tableId = 'row-render-sort-fixed';
      const counts = new Map<string, number>();
      const columns = makeCountingColumns(counts);
      const rows = makeRows(10);

      function Harness({ data }: { data: BetterTableProps<(typeof rows)[number]>['data'] }) {
        return (
          <BetterTable
            id={tableId}
            name="Row render sort fixed"
            columns={columns}
            data={data}
            features={{ rowSelection: true }}
          />
        );
      }

      const { rerender } = render(<Harness data={rows} />);
      expect(Array.from(counts.values())).toEqual(rows.map(() => 1));

      // `BetterTable` doesn't sort `data` itself — a real consumer reacts to
      // `sortingState` (via `onSortingChange`) by re-fetching/reordering and
      // passing a new `data` array, which is what actually changes each
      // row's `index` prop. Simulate that directly: same row objects,
      // reversed order.
      const reordered = [...rows].reverse();
      rerender(<Harness data={reordered} />);

      for (const row of rows) {
        expect(counts.get(row.id)).toBe(2);
      }

      destroyTableStore(tableId);
    }
  );
});
