import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { cleanup, render } from '@testing-library/react';
import { FilterBar } from '../../src/components/filters/filter-bar';
interface Row { id: string; a: string; b: string; }
const baseColumns: ColumnDefinition<Row>[] = [
  { id: 'a', displayName: 'A', type: 'text', accessor: (r) => r.a, filterable: true },
  { id: 'b', displayName: 'B', type: 'text', accessor: (r) => r.b, filterable: true },
];
const filterA: FilterState = { columnId: 'a', type: 'text', operator: 'contains', values: ['x'] };
const filterB: FilterState = { columnId: 'b', type: 'text', operator: 'contains', values: ['y'] };
function makeCountingColumns(counts: Map<string, number>): ColumnDefinition<Row>[] {
  return baseColumns.map((col) => ({ ...col, icon: (() => { counts.set(col.id, (counts.get(col.id) ?? 0) + 1); return null; }) as NonNullable<ColumnDefinition<Row>['icon']> }));
}
describe('FilterBar stable handlers (UI-09)', () => {
  afterEach(() => cleanup());
  it('updating one filter re-renders only that filter badge, not its sibling', () => {
    const counts = new Map<string, number>();
    const cols = makeCountingColumns(counts);
    const { rerender } = render(<FilterBar columns={cols} filters={[filterA, filterB]} onFiltersChange={() => {}} showAddFilter={false} />);
    expect(counts.get('a')).toBe(1); expect(counts.get('b')).toBe(1);
    rerender(<FilterBar columns={cols} filters={[{ ...filterA, values: ['z'] }, filterB]} onFiltersChange={() => {}} showAddFilter={false} />);
    expect(counts.get('a')).toBe(2); expect(counts.get('b')).toBe(1);
  });
});
