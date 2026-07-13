import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { destroyTableStore, getTableStore } from '@better-tables/core';
import { act, cleanup, render } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  a: string;
  b: string;
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'id', displayName: 'Id', type: 'text', accessor: (row) => row.id },
  { id: 'a', displayName: 'A', type: 'text', accessor: (row) => row.a, filterable: true },
  { id: 'b', displayName: 'B', type: 'text', accessor: (row) => row.b, filterable: true },
];

const rows: Row[] = [{ id: '1', a: 'x', b: 'y' }];

function Wrapper({ bumpKey }: { bumpKey: number }) {
  return (
    <BetterTable
      id="effect-churn-table"
      name="Effect churn table"
      columns={columns}
      data={rows}
      // A fresh inline function every render, on purpose: this is the
      // exact shape of prop instability the ref-latch fix must tolerate.
      onFiltersChange={(filters) => onFiltersChangeSpy(filters, bumpKey)}
    />
  );
}

let onFiltersChangeSpy: (filters: FilterState[], bumpKey: number) => void = () => {};

describe('BetterTable bridge-effect churn (UI-08)', () => {
  afterEach(() => {
    cleanup();
    destroyTableStore('effect-churn-table');
    destroyTableStore('auto-show-baseline');
  });

  it(
    'BEFORE FIX baseline: an unrelated parent re-render with a fresh inline ' +
      'onFiltersChange identity refires the bridge effect even though filters did not change',
    () => {
      const calls: number[] = [];
      onFiltersChangeSpy = (_filters, bumpKey) => calls.push(bumpKey);

      const { rerender } = render(<Wrapper bumpKey={0} />);
      expect(calls).toEqual([0]); // fires once on mount with initial filters

      // Parent re-renders with a NEW inline onFiltersChange (closure captures
      // a different bumpKey), but the table's `filters` state hasn't changed.
      rerender(<Wrapper bumpKey={1} />);

      // Pre-fix: the bridge effect's deps include the callback itself, so a
      // fresh identity alone refires it with the (unchanged) filters.
      expect(calls).toEqual([0, 1]);
    }
  );

  it(
    'BEFORE FIX baseline: swapping the filtered column in one update clobbers ' +
      'the auto-show visibility change for the other column',
    () => {
      const tableId = 'auto-show-baseline';
      render(
        <BetterTable
          id={tableId}
          name="Auto-show baseline table"
          columns={columns}
          data={rows}
          defaultVisibleColumns={['id']}
          autoShowFilteredColumns
          initialFilters={[{ columnId: 'b', type: 'text', operator: 'contains', values: ['y'] }]}
        />
      );

      const store = getTableStore(tableId);
      if (!store) throw new Error('store missing');

      // Column b starts filtered => auto-shown (visible !== false).
      expect(store.getState().columnVisibility.b).not.toBe(false);

      // Swap the filter from column b to column a in ONE setFilters call, so
      // the auto-show effect sees a newly-filtered column (a) AND an
      // unfiltered column (b) in the same run.
      act(() => {
        store
          .getState()
          .setFilters([{ columnId: 'a', type: 'text', operator: 'contains', values: ['x'] }]);
      });

      // The correct end state is BOTH: column a explicitly shown (it's newly
      // filtered) AND column b explicitly hidden (its filter was removed, and
      // it's not in defaultVisibleColumns).
      //
      // Pre-fix: the auto-show effect makes two separate `setColumnVisibility`
      // calls in the same run, each spreading from the SAME stale
      // `columnVisibility` closure — the second call (for hiding column b)
      // clobbers the first call's `a: true`, since `setColumnVisibility`
      // replaces the whole object. Column a's visibility change is lost.
      expect(store.getState().columnVisibility.b).toBe(false);
      expect(store.getState().columnVisibility.a).not.toBe(true);
    }
  );
});
