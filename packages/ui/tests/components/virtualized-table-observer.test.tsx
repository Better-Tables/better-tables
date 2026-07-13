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
  it('AFTER FIX: constructs exactly one row observer per visible row on mount, plus one container observer', () => {
    const ro = installResizeObserverMock();
    const rows = makeRows(50);
    const { container } = render(<VirtualizedTable data={rows} columns={columns} />);
    const visibleRows = container.querySelectorAll('tbody tr').length;

    // The stable single `onMeasure` callback (ref-latched inside
    // `useVirtualization`) means the dimension-measurement effect firing
    // after mount no longer tears down and reconstructs every row's
    // ResizeObserver — mount produces exactly one construction per visible
    // row, plus one for the container itself.
    expect(visibleRows).toBeGreaterThan(0);
    expect(ro.constructionCount()).toBe(visibleRows + 1);

    ro.restore();
  });

  it(
    'AFTER FIX: observer construction count does not grow across parent re-renders, ' +
      'even with fresh inline callback props',
    () => {
      const ro = installResizeObserverMock();
      const rows = makeRows(50);
      const { rerender } = render(
        <VirtualizedTable
          data={rows}
          columns={columns}
          onScroll={() => {}}
          onViewportChange={() => {}}
        />
      );
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

      // Neither the row-level `onMeasure` nor the manager subscription in
      // `useVirtualization` depend on caller-supplied callback identity
      // anymore, so re-rendering the parent — even with brand-new inline
      // `onScroll`/`onViewportChange` — must not construct any new observers.
      expect(afterRerender1).toBe(afterMount);
      expect(afterRerender2).toBe(afterMount);

      ro.restore();
    }
  );
});
