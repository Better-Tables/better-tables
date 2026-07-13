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

// Stable module-level no-ops, mirroring a caller (e.g. `table.tsx`'s
// `useCallback`'d `handleFiltersChange`) that already supplies stable
// `onUpdateFilter`/`onRemoveFilter` identities.
const noopUpdate = () => {};
const noopRemove = () => {};

const filterA: FilterState = { columnId: 'a', type: 'text', operator: 'contains', values: ['x'] };
const filterB: FilterState = { columnId: 'b', type: 'text', operator: 'contains', values: ['y'] };

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

function Harness({
  columns,
  filters,
}: {
  columns: ColumnDefinition<Row>[];
  filters: FilterState[];
}) {
  return (
    <ActiveFilters
      columns={columns}
      filters={filters}
      onUpdateFilter={noopUpdate}
      onRemoveFilter={noopRemove}
    />
  );
}

describe('ActiveFilters / MemoizedFilterBadge render counts (UI-08)', () => {
  afterEach(() => {
    cleanup();
  });

  it(
    'AFTER FIX: re-rendering ActiveFilters with identical filters/columns/callbacks ' +
      'does not re-render any badge',
    () => {
      const counts = new Map<string, number>();
      const trackedColumns = makeCountingColumns(counts);
      const filters = [filterA, filterB];

      const { rerender } = render(<Harness columns={trackedColumns} filters={filters} />);
      expect(counts.get('a')).toBe(1);
      expect(counts.get('b')).toBe(1);

      // Re-render ActiveFilters (as its parent, FilterBar, would on any
      // unrelated state change) with the SAME `filters`/`columns` references
      // and stable `onUpdateFilter`/`onRemoveFilter` identities — nothing
      // either badge actually depends on has changed. `FilterBadge` now
      // takes `filter.columnId` itself instead of `ActiveFiltersComponent`
      // building a fresh `onUpdate`/`onRemove` closure per filter per
      // render, so `MemoizedFilterBadge` bails out for both badges.
      rerender(<Harness columns={trackedColumns} filters={filters} />);

      expect(counts.get('a')).toBe(1);
      expect(counts.get('b')).toBe(1);
    }
  );

  it('AFTER FIX: updating one filter re-renders only that filter’s badge, not its sibling', () => {
    const counts = new Map<string, number>();
    const trackedColumns = makeCountingColumns(counts);

    const { rerender } = render(<Harness columns={trackedColumns} filters={[filterA, filterB]} />);
    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(1);

    // Simulate updating filter "a" only — a genuinely new FilterState object
    // for "a", but "b" keeps the exact same object reference, as a real
    // `setFilters` update would produce.
    const updatedFilterA: FilterState = { ...filterA, values: ['z'] };
    rerender(<Harness columns={trackedColumns} filters={[updatedFilterA, filterB]} />);

    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
  });
});
