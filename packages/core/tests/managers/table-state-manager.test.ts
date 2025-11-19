import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableStateManager } from '../../src/managers/table-state-manager';
import type { ColumnDefinition } from '../../src/types/column';
import type { FilterState } from '../../src/types/filter';
import type { SortingState } from '../../src/types/sorting';

interface TestData {
  id: string;
  name: string;
  age: number;
  status: string;
  email: string;
  birthDate: Date;
}

// Mock column definitions for testing
const mockColumns: ColumnDefinition<TestData>[] = [
  {
    id: 'id',
    displayName: 'ID',
    type: 'text',
    accessor: (row: TestData) => row.id,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row: TestData) => row.name,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'age',
    displayName: 'Age',
    type: 'number',
    accessor: (row: TestData) => row.age,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'status',
    displayName: 'Status',
    type: 'option',
    accessor: (row: TestData) => row.status,
    filterable: true,
    sortable: true,
    resizable: true,
  },
  {
    id: 'email',
    displayName: 'Email',
    type: 'text',
    accessor: (row: TestData) => row.email,
    filterable: true,
    sortable: true,
    resizable: true,
  },
];

describe('TableStateManager', () => {
  let manager: TableStateManager<TestData>;
  let mockSubscriber: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscriber = vi.fn();
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      manager = new TableStateManager(mockColumns);

      const state = manager.getState();
      expect(state.filters).toEqual([]);
      expect(state.pagination.page).toBe(1);
      expect(state.pagination.limit).toBe(10);
      expect(state.sorting).toEqual([]);
      expect(state.selectedRows.size).toBe(0);
      // Column visibility merges with defaults (all visible)
      expect(Object.keys(state.columnVisibility)).toHaveLength(5);
      expect(state.columnVisibility.id).toBe(true);
      // Column order merges with defaults (all columns)
      expect(state.columnOrder).toHaveLength(5);
    });

    it('should initialize with initial state', () => {
      const initialState = {
        filters: [
          {
            columnId: 'name',
            type: 'text' as const,
            operator: 'contains' as const,
            values: ['John'],
          },
        ],
        pagination: { page: 2, limit: 20, totalPages: 5, hasNext: true, hasPrev: true },
        sorting: [{ columnId: 'age', direction: 'desc' as const }],
        selectedRows: new Set(['1', '2']),
        columnVisibility: { id: false, email: false },
        columnOrder: ['name', 'age', 'status'],
      };

      manager = new TableStateManager(mockColumns, initialState);

      const state = manager.getState();
      expect(state.filters).toHaveLength(1);
      expect(state.pagination.page).toBe(2);
      expect(state.sorting).toHaveLength(1);
      expect(state.selectedRows.has('1')).toBe(true);
      expect(state.columnVisibility.id).toBe(false);
      expect(state.columnOrder).toContain('name');
      expect(state.columnOrder).toContain('age');
      expect(state.columnOrder).toContain('status');
    });

    it('should initialize with custom config', () => {
      const config = {
        pagination: {
          defaultPageSize: 50,
          pageSizeOptions: [25, 50, 100],
          maxPageSize: 200,
        },
      };

      manager = new TableStateManager(mockColumns, {}, config);

      const state = manager.getState();
      expect(state.pagination.limit).toBe(50);
    });
  });

  describe('filter operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get filters', () => {
      expect(manager.getFilters()).toEqual([]);
    });

    it('should set filters', () => {
      const filters: FilterState[] = [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
      ];

      manager.setFilters(filters);

      expect(manager.getFilters()).toHaveLength(2);
      expect(manager.getFilters()[0].columnId).toBe('name');
    });

    it('should add filter', () => {
      const filter: FilterState = {
        columnId: 'status',
        type: 'option',
        operator: 'is',
        values: ['active'],
      };

      manager.addFilter(filter);

      expect(manager.getFilters()).toHaveLength(1);
      expect(manager.getFilters()[0].columnId).toBe('status');
    });

    it('should remove filter', () => {
      manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });
      manager.addFilter({
        columnId: 'age',
        type: 'number',
        operator: 'greaterThan',
        values: [25],
      });

      manager.removeFilter('name');

      expect(manager.getFilters()).toHaveLength(1);
      expect(manager.getFilters()[0].columnId).toBe('age');
    });

    it('should clear filters', () => {
      manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });

      manager.clearFilters();

      expect(manager.getFilters()).toHaveLength(0);
    });
  });

  describe('pagination operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get pagination', () => {
      const pagination = manager.getPagination();
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(10);
    });

    it('should set page', () => {
      manager.setPage(3);

      const pagination = manager.getPagination();
      expect(pagination.page).toBe(3);
    });

    it('should set page size', () => {
      manager.setPageSize(50);

      const pagination = manager.getPagination();
      expect(pagination.limit).toBe(50);
    });

    it('should set total', () => {
      manager.setTotal(100);

      const pagination = manager.getPagination();
      expect(pagination.totalPages).toBe(10);
    });

    it('should navigate to next page', () => {
      manager.setTotal(100);
      manager.setPage(1);

      manager.nextPage();

      const pagination = manager.getPagination();
      expect(pagination.page).toBe(2);
    });

    it('should navigate to previous page', () => {
      manager.setTotal(100);
      manager.setPage(3);

      manager.prevPage();

      const pagination = manager.getPagination();
      expect(pagination.page).toBe(2);
    });
  });

  describe('sorting operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get sorting', () => {
      expect(manager.getSorting()).toEqual([]);
    });

    it('should set sorting', () => {
      const sorting: SortingState = [
        { columnId: 'age', direction: 'desc' },
        { columnId: 'name', direction: 'asc' },
      ];

      manager.setSorting(sorting);

      expect(manager.getSorting()).toHaveLength(2);
      expect(manager.getSorting()[0].columnId).toBe('age');
    });

    it('should toggle sort - add new sort', () => {
      manager.toggleSort('name');

      expect(manager.getSorting()).toHaveLength(1);
      expect(manager.getSorting()[0]).toEqual({ columnId: 'name', direction: 'asc' });
    });

    it('should toggle sort - asc to desc', () => {
      manager.setSorting([{ columnId: 'name', direction: 'asc' }]);
      manager.toggleSort('name');

      expect(manager.getSorting()).toHaveLength(1);
      expect(manager.getSorting()[0]).toEqual({ columnId: 'name', direction: 'desc' });
    });

    it('should toggle sort - desc to remove', () => {
      manager.setSorting([{ columnId: 'name', direction: 'desc' }]);
      manager.toggleSort('name');

      expect(manager.getSorting()).toHaveLength(0);
    });

    it('should clear sorting', () => {
      manager.setSorting([{ columnId: 'age', direction: 'desc' }]);
      manager.clearSorting();

      expect(manager.getSorting()).toEqual([]);
    });
  });

  describe('selection operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get selected rows', () => {
      expect(manager.getSelectedRows().size).toBe(0);
    });

    it('should set selected rows', () => {
      manager.setSelectedRows(new Set(['1', '2', '3']));

      expect(manager.getSelectedRows().size).toBe(3);
      expect(manager.getSelectedRows().has('1')).toBe(true);
    });

    it('should toggle row selection', () => {
      manager.toggleRow('1');
      expect(manager.getSelectedRows().has('1')).toBe(true);

      manager.toggleRow('1');
      expect(manager.getSelectedRows().has('1')).toBe(false);
    });

    it('should select all rows', () => {
      manager.selectAll(['1', '2', '3', '4', '5']);

      expect(manager.getSelectedRows().size).toBe(5);
    });

    it('should clear selection', () => {
      manager.setSelectedRows(new Set(['1', '2']));
      manager.clearSelection();

      expect(manager.getSelectedRows().size).toBe(0);
    });
  });

  describe('column visibility operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get column visibility', () => {
      const visibility = manager.getColumnVisibility();
      // Returns all columns as visible by default
      expect(Object.keys(visibility)).toHaveLength(5);
      expect(visibility.id).toBe(true);
    });

    it('should set column visibility', () => {
      manager.setColumnVisibility({ id: false, email: false, name: true });

      const visibility = manager.getColumnVisibility();
      expect(visibility.id).toBe(false);
      expect(visibility.email).toBe(false);
      expect(visibility.name).toBe(true);
    });

    it('should toggle column visibility', () => {
      // Initially visible
      manager.toggleColumnVisibility('id');
      expect(manager.getColumnVisibility().id).toBe(false);

      // Toggle to visible
      manager.toggleColumnVisibility('id');
      expect(manager.getColumnVisibility().id).toBe(true);
    });

    it('should reset column visibility', () => {
      manager.setColumnVisibility({ id: false, email: false });
      manager.resetColumnVisibility();

      const visibility = manager.getColumnVisibility();
      expect(visibility.id).toBe(true);
      expect(visibility.email).toBe(true);
    });
  });

  describe('column order operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get column order', () => {
      const order = manager.getColumnOrder();
      // Returns all columns in default order
      expect(order.length).toBeGreaterThan(0);
      expect(order).toContain('id');
      expect(order).toContain('name');
    });

    it('should set column order', () => {
      manager.setColumnOrder(['name', 'age', 'status']);

      const order = manager.getColumnOrder();
      expect(order).toContain('name');
      expect(order).toContain('age');
      expect(order).toContain('status');
    });

    it('should reset column order', () => {
      manager.setColumnOrder(['name', 'age', 'status']);
      manager.resetColumnOrder();

      const order = manager.getColumnOrder();
      // Reset returns to default order (all columns)
      expect(order.length).toBeGreaterThan(0);
    });
  });

  describe('structural sharing and caching', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should return same filter array reference if unchanged', () => {
      const filters1 = manager.getFilters();
      const filters2 = manager.getFilters();

      expect(filters1).toBe(filters2);
    });

    it('should return new filter array reference when changed', () => {
      const filters1 = manager.getFilters();
      manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });
      const filters2 = manager.getFilters();

      expect(filters1).not.toBe(filters2);
      expect(filters1).toHaveLength(0);
      expect(filters2).toHaveLength(1);
    });

    it('should return same pagination object reference if unchanged', () => {
      const pagination1 = manager.getPagination();
      const pagination2 = manager.getPagination();

      expect(pagination1).toBe(pagination2);
    });

    it('should return new pagination object reference when changed', () => {
      const pagination1 = manager.getPagination();
      manager.setPage(2);
      const pagination2 = manager.getPagination();

      expect(pagination1).not.toBe(pagination2);
    });

    it('should return same sorting array reference if unchanged', () => {
      manager.setSorting([{ columnId: 'age', direction: 'desc' }]);
      const sorting1 = manager.getSorting();
      const sorting2 = manager.getSorting();

      expect(sorting1).toBe(sorting2);
    });

    it('should return same selected rows set reference if unchanged', () => {
      manager.setSelectedRows(new Set(['1', '2']));
      const selected1 = manager.getSelectedRows();
      const selected2 = manager.getSelectedRows();

      expect(selected1).toBe(selected2);
    });

    it('should return same column visibility object reference if unchanged', () => {
      manager.setColumnVisibility({ id: false });
      const visibility1 = manager.getColumnVisibility();
      const visibility2 = manager.getColumnVisibility();

      expect(visibility1).toBe(visibility2);
    });

    it('should return same column order array reference if unchanged', () => {
      manager.setColumnOrder(['name', 'age']);
      const order1 = manager.getColumnOrder();
      const order2 = manager.getColumnOrder();

      expect(order1).toBe(order2);
    });
  });

  describe('subscription management', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should subscribe to state changes', () => {
      manager.subscribe(mockSubscriber);
      manager.setPage(2);

      expect(mockSubscriber).toHaveBeenCalled();
    });

    it('should emit state_changed event on any change', () => {
      manager.subscribe(mockSubscriber);
      manager.setPage(2);

      const calls = mockSubscriber.mock.calls;
      expect(calls[calls.length - 1][0]).toMatchObject({ type: 'state_changed' });
    });

    it('should emit filters_changed event on filter change', () => {
      manager.subscribe(mockSubscriber);
      manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });

      const calls = mockSubscriber.mock.calls;
      const filterEvent = calls.find((call) => call[0].type === 'filters_changed');
      expect(filterEvent).toBeDefined();
      expect(filterEvent).toBeTruthy();
      if (filterEvent)
        expect(filterEvent[0]).toMatchObject({
          type: 'filters_changed',
          filters: expect.any(Array),
        });
    });

    it('should emit pagination_changed event on pagination change', () => {
      manager.subscribe(mockSubscriber);
      manager.setPage(3);

      const calls = mockSubscriber.mock.calls;
      const paginationEvent = calls.find((call) => call[0].type === 'pagination_changed');
      expect(paginationEvent).toBeDefined();
      expect(paginationEvent).toBeTruthy();
      if (paginationEvent)
        expect(paginationEvent[0]).toMatchObject({
          type: 'pagination_changed',
          pagination: expect.any(Object),
        });
    });

    it('should emit sorting_changed event on sorting change', () => {
      manager.subscribe(mockSubscriber);
      manager.setSorting([{ columnId: 'age', direction: 'desc' }]);

      const calls = mockSubscriber.mock.calls;
      const sortingEvent = calls.find((call) => call[0].type === 'sorting_changed');
      expect(sortingEvent).toBeDefined();
      expect(sortingEvent).toBeTruthy();
      if (sortingEvent)
        expect(sortingEvent[0]).toMatchObject({
          type: 'sorting_changed',
          sorting: [{ columnId: 'age', direction: 'desc' }],
        });
    });

    it('should emit selection_changed event on selection change', () => {
      manager.subscribe(mockSubscriber);
      manager.toggleRow('1');

      const calls = mockSubscriber.mock.calls;
      const selectionEvent = calls.find((call) => call[0].type === 'selection_changed');
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent).toBeTruthy();
      if (selectionEvent)
        expect(selectionEvent[0]).toMatchObject({
          type: 'selection_changed',
          selectedRows: expect.any(Set),
        });
    });

    it('should emit visibility_changed event on visibility change', () => {
      manager.subscribe(mockSubscriber);
      manager.toggleColumnVisibility('id');

      const calls = mockSubscriber.mock.calls;
      const visibilityEvent = calls.find((call) => call[0].type === 'visibility_changed');
      expect(visibilityEvent).toBeDefined();
      expect(visibilityEvent).toBeTruthy();
      if (visibilityEvent)
        expect(visibilityEvent[0]).toMatchObject({
          type: 'visibility_changed',
          columnVisibility: expect.any(Object),
        });
    });

    it('should emit order_changed event on order change', () => {
      manager.subscribe(mockSubscriber);
      manager.setColumnOrder(['name', 'age']);

      const calls = mockSubscriber.mock.calls;
      const orderEvent = calls.find((call) => call[0].type === 'order_changed');
      expect(orderEvent).toBeDefined();
      expect(orderEvent).toBeTruthy();
      if (orderEvent) {
        expect(orderEvent[0]).toMatchObject({
          type: 'order_changed',
          columnOrder: expect.arrayContaining(['name', 'age']),
        });
      }
    });

    it('should unsubscribe from state changes', () => {
      const unsubscribe = manager.subscribe(mockSubscriber);
      unsubscribe();
      manager.setPage(3);

      // Should only have the initial subscribe call, not the setPage call
      expect(mockSubscriber).toHaveBeenCalledTimes(0);
    });

    it('should handle multiple subscribers', () => {
      const subscriber2 = vi.fn();
      manager.subscribe(mockSubscriber);
      manager.subscribe(subscriber2);

      manager.setPage(2);

      expect(mockSubscriber).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
    });

    it('should not emit state_changed if state unchanged', () => {
      manager.subscribe(mockSubscriber);
      manager.setPage(1); // Already on page 1
      // The pagination manager emits events even when staying on the same page
      const calls = mockSubscriber.mock.calls;
      const stateChangedEvents = calls.filter((call) => call[0].type === 'state_changed');
      // Pagination manager might emit events even without state change
      expect(stateChangedEvents.length).toBe(0);
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should update state with partial updates', () => {
      const updates = {
        filters: [
          {
            columnId: 'name',
            type: 'text' as const,
            operator: 'equals' as const,
            values: ['John'],
          },
        ],
        pagination: { page: 3, limit: 50, totalPages: 10, hasNext: true, hasPrev: true },
        sorting: [{ columnId: 'age', direction: 'asc' as const }],
        selectedRows: new Set(['1', '2']),
        columnVisibility: { id: false },
        columnOrder: ['name', 'age'],
      };

      manager.updateState(updates);

      const state = manager.getState();
      expect(state.filters).toHaveLength(1);
      // updateState might not update page if already on that page
      expect(state.pagination.page).toBe(3);
      expect(state.sorting).toHaveLength(1);
      expect(state.selectedRows.size).toBe(2);
      expect(state.columnVisibility.id).toBe(false);
      // columnOrder is merged with defaults
      expect(state.columnOrder).toContain('name');
      expect(state.columnOrder).toContain('age');
    });

    it('should reset all state to defaults', () => {
      manager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });
      manager.setPage(5);
      manager.setSorting([{ columnId: 'age', direction: 'desc' }]);
      manager.toggleRow('1');
      manager.setColumnVisibility({ id: false });
      manager.setColumnOrder(['name', 'age']);

      manager.reset();

      const state = manager.getState();
      expect(state.filters).toEqual([]);
      expect(state.pagination.page).toBe(1);
      expect(state.sorting).toEqual([]);
      expect(state.selectedRows.size).toBe(0);
      expect(state.columnVisibility.id).toBe(true); // Reset to visible
      // Reset returns column order to default (all columns)
      expect(state.columnOrder.length).toBeGreaterThan(0);
    });
  });

  describe('column management', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get columns', () => {
      const columns = manager.getColumns();
      expect(columns.length).toBe(5);
      expect(columns[0].id).toBe('id');
    });

    it('should update columns', () => {
      const newColumns: ColumnDefinition<TestData>[] = [
        ...mockColumns,
        {
          id: 'phone',
          displayName: 'Phone',
          type: 'text',
          accessor: (row: TestData) => row.email,
          filterable: true,
          sortable: true,
          resizable: true,
        },
      ];

      manager.updateColumns(newColumns);

      const columns = manager.getColumns();
      expect(columns.length).toBe(6);
      expect(columns[5].id).toBe('phone');
    });

    it('should emit columns_changed event on column update', () => {
      manager.subscribe(mockSubscriber);

      const newColumns: ColumnDefinition<TestData>[] = [...mockColumns];
      manager.updateColumns(newColumns);

      const calls = mockSubscriber.mock.calls;
      const columnsEvent = calls.find((call) => call[0].type === 'columns_changed');
      expect(columnsEvent).toBeDefined();
      expect(columnsEvent).toBeTruthy();
      if (columnsEvent)
        expect(columnsEvent[0]).toMatchObject({
          type: 'columns_changed',
          columns: expect.any(Array),
        });
    });
  });

  describe('integration with sub-managers', () => {
    beforeEach(() => {
      manager = new TableStateManager(mockColumns);
    });

    it('should get filter manager', () => {
      const filterManager = manager.getFilterManager();
      expect(filterManager).toBeDefined();
      expect(filterManager.getFilters()).toEqual([]);
    });

    it('should get pagination manager', () => {
      const paginationManager = manager.getPaginationManager();
      expect(paginationManager).toBeDefined();
      expect(paginationManager.getCurrentPage()).toBe(1);
    });

    it('should sync filter manager changes to state', () => {
      const filterManager = manager.getFilterManager();
      filterManager.addFilter({
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['John'],
      });

      expect(manager.getFilters()).toHaveLength(1);
    });

    it('should sync pagination manager changes to state', () => {
      const paginationManager = manager.getPaginationManager();
      paginationManager.goToPage(5);

      expect(manager.getPagination().page).toBe(5);
    });
  });
});
