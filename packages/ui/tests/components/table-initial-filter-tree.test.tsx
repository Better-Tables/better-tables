import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  type ColumnDefinition,
  clearAllTableStores,
  type FilterGroupNode,
  type FilterState,
  getTableStore,
  isFilterGroupNode,
} from '@better-tables/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
  status: string;
}

const columns: ColumnDefinition<Row>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (row) => row.name, filterable: true },
  {
    id: 'status',
    displayName: 'Status',
    type: 'text',
    accessor: (row) => row.status,
    filterable: true,
  },
];

const rows: Row[] = [
  { id: '1', name: 'Alice', status: 'open' },
  { id: '2', name: 'Bob', status: 'closed' },
];

const nameLeaf: FilterState = {
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['ali'],
};
const statusLeaf: FilterState = {
  columnId: 'status',
  type: 'text',
  operator: 'contains',
  values: ['open'],
};

const TABLE_ID = 'table-initial-filter-tree-test';

/**
 * Documented `initialFilters` limitation (see the prop's JSDoc): a
 * `FilterGroupNode` tree seeds the manager's real filter state, but the
 * built-in filter bar edits the FLAT leaf view — the first chip edit calls
 * the store's flat `setFilters`, which replaces the tree with an
 * implicit-AND array of its leaves. These tests pin that behavior and the
 * one-time dev-only warning that makes it non-silent.
 */
describe('BetterTable initialFilters tree collapse', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('seeds a FilterGroupNode tree; a chip removal collapses it to a flat implicit-AND list and warns once', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const tree: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [nameLeaf, statusLeaf],
      };

      render(
        <BetterTable
          id={TABLE_ID}
          columns={columns}
          data={rows}
          virtualized={false}
          initialFilters={tree}
        />
      );

      const store = getTableStore(TABLE_ID);
      if (!store) throw new Error('Expected table store');
      const manager = store.getState().manager;

      // The tree seeds the real stored value; the store's `filters` field is
      // its flat leaf view (what the filter bar chips render).
      const seeded = manager.getFilterNode();
      if (!isFilterGroupNode(seeded)) throw new Error('Expected seeded filter tree');
      expect(seeded.logic).toBe('or');
      expect(seeded.children).toHaveLength(2);
      expect(store.getState().filters).toHaveLength(2);
      expect(warnSpy).not.toHaveBeenCalled();

      // First flat-bar edit: removing one chip replaces the OR tree with a
      // flat implicit-AND array of the remaining leaves...
      fireEvent.click(screen.getByRole('button', { name: /remove name filter/i }));

      const collapsed = manager.getFilterNode();
      expect(Array.isArray(collapsed)).toBe(true);
      expect(collapsed).toEqual([statusLeaf]);

      // ...and warns once in dev so the semantics change isn't silent.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain('FilterGroupNode');
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain(TABLE_ID);

      // Subsequent flat edits (state is already flat) do not warn again.
      fireEvent.click(screen.getByRole('button', { name: /remove status filter/i }));
      expect(manager.getFilterNode()).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn when initialFilters is a flat array', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <BetterTable
          id={`${TABLE_ID}-flat`}
          columns={columns}
          data={rows}
          virtualized={false}
          initialFilters={[nameLeaf]}
        />
      );

      const store = getTableStore(`${TABLE_ID}-flat`);
      if (!store) throw new Error('Expected table store');

      fireEvent.click(screen.getByRole('button', { name: /remove name filter/i }));
      expect(store.getState().manager.getFilterNode()).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
