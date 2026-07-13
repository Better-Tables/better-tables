import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { cleanup, render } from '@testing-library/react';
import { ActiveFilters } from '../../src/components/filters/active-filters';

interface Row {
  id: string;
  a: string;
  b: string;
}

const baseColumns: ColumnDefinition<Row>[] = [
  { id: 'a', displayName: 'A', type: 'text', accessor: (row) => row.a },
  { id: 'b', displayName: 'B', type: 'text', accessor: (row) => row.b },
];

const filters: FilterState[] = [
  { columnId: 'a', type: 'text', operator: 'contains', values: ['x'] },
  { columnId: 'b', type: 'text', operator: 'contains', values: ['y'] },
];

/** Counts renders of a badge via its column's `icon` render function, which
 * `FilterBadge` calls directly in its render body — an indirect "did this
 * badge actually re-render" probe that doesn't require exporting
 * `FilterBadge`/`MemoizedFilterBadge` from the module. */
function makeCountingColumns(counts: Map<string, number>): ColumnDefinition<Row>[] {
  return baseColumns.map((col) => ({
    ...col,
    icon: (() => {
      counts.set(col.id, (counts.get(col.id) ?? 0) + 1);
      return null;
    }) as unknown as ColumnDefinition<Row>['icon'],
  }));
}

function Harness({ columns }: { columns: ColumnDefinition<Row>[] }) {
  return (
    <ActiveFilters
      columns={columns}
      filters={filters}
      onUpdateFilter={() => {}}
      onRemoveFilter={() => {}}
    />
  );
}

describe('ActiveFilters / MemoizedFilterBadge render counts (UI-08)', () => {
  afterEach(() => {
    cleanup();
  });

  it(
    'BEFORE FIX baseline: re-rendering ActiveFilters (e.g. from an unrelated ' +
      'parent state change) still re-renders every badge, defeating MemoizedFilterBadge',
    () => {
      const counts = new Map<string, number>();
      const trackedColumns = makeCountingColumns(counts);

      const { rerender } = render(<Harness columns={trackedColumns} />);
      expect(counts.get('a')).toBe(1);
      expect(counts.get('b')).toBe(1);

      // Re-render ActiveFilters (as its parent, FilterBar, would on any
      // unrelated state change) with the SAME `filters`/`columns` references —
      // nothing either badge actually depends on has changed.
      rerender(<Harness columns={trackedColumns} />);

      // Pre-fix: ActiveFiltersComponent builds brand-new `onUpdate`/`onRemove`
      // closures per filter on every render, so `MemoizedFilterBadge` never
      // bails out — any re-render of ActiveFilters re-renders every badge.
      expect(counts.get('a')).toBe(2);
      expect(counts.get('b')).toBe(2);
    }
  );
});
