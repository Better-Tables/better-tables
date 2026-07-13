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
    'BEFORE FIX baseline: re-rendering the parent with identical data/columns ' +
      'still re-renders every visible row (VirtualizedRow is not memoized)',
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
      // Mount alone already renders each row more than once (a
      // self-triggered re-render from the dimension-measurement effect
      // rebuilding the unstable per-row `onMeasure` closure) — capture
      // whatever that baseline is rather than assuming exactly `visibleRows`.
      const afterMount = renderCellCalls;
      expect(afterMount).toBeGreaterThanOrEqual(visibleRows);

      // Re-render with the SAME `rows`/`columns` references and an
      // equal-but-fresh `renderCell` identity, simulating an unrelated parent
      // re-render.
      rerender(<VirtualizedTable data={rows} columns={columns} renderCell={renderCell} />);

      // Pre-fix: every visible row re-renders (calls renderCell again) even
      // though nothing it actually depends on changed, because VirtualizedRow
      // has no React.memo.
      expect(renderCellCalls).toBeGreaterThanOrEqual(afterMount + visibleRows);
    }
  );
});
