import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { cleanup, render } from '@testing-library/react';
import { VirtualizedTable } from '../../src/components/table/virtualized-table';

interface Row {
  id: string;
  name: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (row) => row.name },
];

describe('VirtualizedTable row render counts (UI-05)', () => {
  afterEach(() => {
    cleanup();
  });

  it(
    'AFTER FIX: re-rendering the parent with identical data/columns/renderCell ' +
      'does not re-render any visible row',
    () => {
      let renderCellCalls = 0;
      const rows = makeRows(20);
      const renderCell = (value: unknown) => {
        renderCellCalls += 1;
        return String(value);
      };

      const { container, rerender } = render(
        <VirtualizedTable data={rows} columns={columns} renderCell={renderCell} />
      );
      const visibleRows = container.querySelectorAll('tbody tr').length;
      expect(visibleRows).toBeGreaterThan(0);
      const afterMount = renderCellCalls;
      expect(afterMount).toBeGreaterThanOrEqual(visibleRows);

      // Re-render with the SAME `rows`/`columns` references and the SAME
      // `renderCell` identity, simulating an unrelated parent re-render.
      // `MemoizedVirtualizedRow`'s custom comparator treats this as a
      // complete no-op for every row: `style` is compared by its `top`/
      // `height` values (not object identity, since `getRowStyle` always
      // allocates a fresh object) and every other prop is referentially
      // identical, so no row's `renderCell` should fire again.
      rerender(<VirtualizedTable data={rows} columns={columns} renderCell={renderCell} />);

      expect(renderCellCalls).toBe(afterMount);
    }
  );

  it('AFTER FIX: changing one row object only re-renders that row', () => {
    const rowCallCounts = new Map<string, number>();
    const rows = makeRows(20);
    const renderCell = (value: unknown, _column: unknown, item: unknown) => {
      const row = item as Row;
      rowCallCounts.set(row.id, (rowCallCounts.get(row.id) ?? 0) + 1);
      return String(value);
    };

    const { rerender } = render(
      <VirtualizedTable data={rows} columns={columns} renderCell={renderCell} />
    );
    const countsAfterMount = new Map(rowCallCounts);

    // Replace only row r2 with a new object (same id, different name) —
    // every other row keeps its exact same object reference.
    const updatedRows = rows.map((row) => (row.id === 'r2' ? { ...row, name: 'Changed' } : row));
    rerender(<VirtualizedTable data={updatedRows} columns={columns} renderCell={renderCell} />);

    for (const row of rows) {
      const before = countsAfterMount.get(row.id) ?? 0;
      const after = rowCallCounts.get(row.id) ?? 0;
      if (row.id === 'r2') {
        expect(after).toBeGreaterThan(before);
      } else {
        expect(after).toBe(before);
      }
    }
  });
});
