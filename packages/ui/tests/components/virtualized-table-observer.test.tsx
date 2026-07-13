import { describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { render } from '@testing-library/react';
import { VirtualizedTable } from '../../src/components/table/virtualized-table';
import { installResizeObserverMock } from '../helpers/render-count';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (row) => row.name },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));
}

// With a 400px default container and 52px rows, happy-dom's zeroed layout
// still yields a deterministic visible window from the virtualization
// manager's defaults. Assert against that count rather than hardcoding it,
// so this test isn't coupled to virtualization internals (plan 024).
describe('VirtualizedTable ResizeObserver construction (UI-06)', () => {
  it(
    'BEFORE FIX baseline: constructs one row observer per visible row on mount, ' +
      'plus one container observer',
    () => {
      const ro = installResizeObserverMock();
      const rows = makeRows(50);
      const { container } = render(<VirtualizedTable data={rows} columns={columns} />);
      const visibleRows = container.querySelectorAll('tbody tr').length;

      // Pre-fix baseline: mount alone triggers more than
      // `visibleRows + 1` constructions, because the unstable per-row
      // `onMeasure` closure factory (`handleRowMeasure`) is rebuilt whenever
      // `VirtualizedTable` re-renders for ANY reason (including the
      // dimension-measurement effect firing once after mount), tearing down
      // and reconstructing every row's ResizeObserver.
      expect(visibleRows).toBeGreaterThan(0);
      expect(ro.constructionCount()).toBeGreaterThan(visibleRows + 1);

      ro.restore();
    }
  );

  it(
    'BEFORE FIX baseline: observer constructions grow with each parent re-render, ' +
      'even when re-rendered with equivalent (but referentially fresh) props',
    () => {
      const ro = installResizeObserverMock();
      const rows = makeRows(50);
      const { container, rerender } = render(
        <VirtualizedTable
          data={rows}
          columns={columns}
          onScroll={() => {}}
          onViewportChange={() => {}}
        />
      );
      const visibleRows = container.querySelectorAll('tbody tr').length;
      const afterMount = ro.constructionCount();

      rerender(
        <VirtualizedTable
          data={rows}
          columns={columns}
          onScroll={() => {}}
          onViewportChange={() => {}}
        />
      );
      const afterRerender1 = ro.constructionCount();

      rerender(
        <VirtualizedTable
          data={rows}
          columns={columns}
          onScroll={() => {}}
          onViewportChange={() => {}}
        />
      );
      const afterRerender2 = ro.constructionCount();

      // Pre-fix: every re-render reconstructs every visible row's observer
      // because `handleRowMeasure(virtualRow.index)` returns a new function
      // identity each render, and that identity is the row effect's only dep.
      expect(afterRerender1).toBeGreaterThanOrEqual(afterMount + visibleRows);
      expect(afterRerender2).toBeGreaterThanOrEqual(afterRerender1 + visibleRows);

      ro.restore();
    }
  );
});
