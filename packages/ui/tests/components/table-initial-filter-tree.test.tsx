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

  it('warns when "Clear all" discards a seeded tree (it bypasses the flat edit path)', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const id = `${TABLE_ID}-reset`;
      render(
        <BetterTable
          id={id}
          columns={columns}
          data={rows}
          virtualized={false}
          initialFilters={{ kind: 'group', logic: 'or', children: [nameLeaf, statusLeaf] }}
        />
      );

      const store = getTableStore(id);
      if (!store) throw new Error('Expected table store');

      // Clear all routes through `onReset` -> manager.reset(), NOT through
      // handleFiltersChange — the path that used to drop the tree silently.
      fireEvent.click(screen.getByRole('button', { name: /clear all/i }));

      expect(isFilterGroupNode(store.getState().manager.getFilterNode())).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain('Clear all');
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain(id);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('re-arms the one-time warning when the table id changes', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const tree: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [nameLeaf, statusLeaf],
      };
      const first = `${TABLE_ID}-rearm-a`;
      const second = `${TABLE_ID}-rearm-b`;

      const { rerender } = render(
        <BetterTable
          id={first}
          columns={columns}
          data={rows}
          virtualized={false}
          initialFilters={tree}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /remove name filter/i }));
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Same component instance, new table id => new store and new seeded
      // tree. A bare boolean latch would swallow this second warning.
      rerender(
        <BetterTable
          id={second}
          columns={columns}
          data={rows}
          virtualized={false}
          initialFilters={tree}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /remove name filter/i }));

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(String(warnSpy.mock.calls[1]?.[0])).toContain(second);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
