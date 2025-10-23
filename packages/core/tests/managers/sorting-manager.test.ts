import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SortingManager } from '../../src/managers/sorting-manager';
import type { ColumnDefinition } from '../../src/types/column';
import type { SortingConfig } from '../../src/types/sorting';

describe('SortingManager', () => {
  let manager: SortingManager;
  let mockColumns: ColumnDefinition[];
  let mockSubscriber: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockColumns = [
      {
        id: 'name',
        displayName: 'Name',
        type: 'text',
        accessor: (row: any) => row.name,
        sortable: true,
      },
      {
        id: 'age',
        displayName: 'Age',
        type: 'number',
        accessor: (row: any) => row.age,
        sortable: true,
      },
      {
        id: 'email',
        displayName: 'Email',
        type: 'text',
        accessor: (row: any) => row.email,
        sortable: false,
      },
    ];
    mockSubscriber = vi.fn();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      manager = new SortingManager(mockColumns);

      expect(manager.getSorting()).toEqual([]);
      expect(manager.isMultiSortEnabled()).toBe(false);
      expect(manager.getMaxSortColumns()).toBe(1);
    });

    it('should initialize with custom config', () => {
      const config: SortingConfig = {
        multiSort: true,
        maxSortColumns: 3,
        resetOnClick: true,
      };

      manager = new SortingManager(mockColumns, config);

      expect(manager.isMultiSortEnabled()).toBe(true);
      expect(manager.getMaxSortColumns()).toBe(3);
    });

    it('should initialize with initial sorting', () => {
      manager = new SortingManager(mockColumns, {}, [{ columnId: 'name', direction: 'asc' }]);

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });
  });

  describe('basic sorting operations', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns);
    });

    it('should add sorting', () => {
      manager.addSort('name', 'asc');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });

    it('should update existing sorting', () => {
      manager.addSort('name', 'asc');
      manager.addSort('name', 'desc');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);
    });

    it('should remove sorting', () => {
      manager.addSort('name', 'asc');
      manager.removeSort('name');

      expect(manager.getSorting()).toEqual([]);
    });

    it('should clear all sorting', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');
      manager.clearSorting();

      expect(manager.getSorting()).toEqual([]);
    });
  });

  describe('toggle sorting', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns);
    });

    it('should toggle from none to asc', () => {
      manager.toggleSort('name');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });

    it('should toggle from asc to desc', () => {
      manager.addSort('name', 'asc');
      manager.toggleSort('name');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);
    });

    it('should toggle from desc to asc by default', () => {
      manager.addSort('name', 'desc');
      manager.toggleSort('name');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });

    it('should remove sort when resetOnClick is enabled', () => {
      manager = new SortingManager(mockColumns, { resetOnClick: true });
      manager.addSort('name', 'desc');
      manager.toggleSort('name');

      expect(manager.getSorting()).toEqual([]);
    });
  });

  describe('multi-sort', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns, { multiSort: true, maxSortColumns: 3 });
    });

    it('should allow multiple sorts', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      expect(manager.getSorting()).toEqual([
        { columnId: 'name', direction: 'asc' },
        { columnId: 'age', direction: 'desc' },
      ]);
    });

    it('should respect max sort columns', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      // In multi-sort mode, both sorts should exist
      expect(manager.getSorting()).toEqual([
        { columnId: 'name', direction: 'asc' },
        { columnId: 'age', direction: 'desc' },
      ]);

      // Adding a non-sortable column should throw
      expect(() => manager.addSort('email', 'asc')).toThrow('Column email is not sortable');
    });

    it('should remove oldest sort when exceeding max columns', () => {
      manager = new SortingManager(mockColumns, { multiSort: true, maxSortColumns: 2 });

      // Add sortable column for testing
      mockColumns.push({
        id: 'status',
        displayName: 'Status',
        type: 'text',
        accessor: (row: any) => row.status,
        sortable: true,
      });

      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');
      manager.addSort('status', 'asc'); // Should remove 'name' sort

      expect(manager.getSorting()).toEqual([
        { columnId: 'age', direction: 'desc' },
        { columnId: 'status', direction: 'asc' },
      ]);
    });
  });

  describe('query methods', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns, { multiSort: true });
      manager.addSort('name', 'asc');
    });

    it('should check if column is sorted', () => {
      expect(manager.isSorted('name')).toBe(true);
      expect(manager.isSorted('age')).toBe(false);
    });

    it('should get sort direction', () => {
      expect(manager.getSortDirection('name')).toBe('asc');
      expect(manager.getSortDirection('age')).toBeUndefined();
    });

    it('should get sort priority', () => {
      manager.addSort('age', 'desc');

      expect(manager.getSortPriority('name')).toBe(0);
      expect(manager.getSortPriority('age')).toBe(1);
      expect(manager.getSortPriority('email')).toBeUndefined();
    });

    it('should get sorted column IDs', () => {
      manager.addSort('age', 'desc');

      expect(manager.getSortedColumnIds()).toEqual(['name', 'age']);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns);
    });

    it('should validate sortable columns', () => {
      expect(() => manager.addSort('name', 'asc')).not.toThrow();
      expect(() => manager.addSort('email', 'asc')).toThrow('Column email is not sortable');
    });

    it('should validate column existence', () => {
      expect(() => manager.addSort('invalid', 'asc')).toThrow('Column invalid not found');
    });

    it('should validate sort direction', () => {
      expect(() => manager.addSort('name', 'invalid' as any)).toThrow(
        'Invalid sort direction: invalid'
      );
    });

    it('should filter invalid sorts when setting', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.setSorting([
        { columnId: 'name', direction: 'asc' },
        { columnId: 'invalid', direction: 'desc' },
        { columnId: 'email', direction: 'asc' }, // Not sortable
      ]);

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

      expect(consoleWarn).toHaveBeenCalledWith(
        'Invalid sort for column invalid: Column invalid not found'
      );
      expect(consoleWarn).toHaveBeenCalledWith(
        'Invalid sort for column email: Column email is not sortable'
      );

      consoleWarn.mockRestore();
    });
  });

  describe('subscription system', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns);
      manager.subscribe(mockSubscriber);
    });

    it('should notify on sort added', () => {
      manager.addSort('name', 'asc');

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'sorts_replaced',
        sorts: [{ columnId: 'name', direction: 'asc' }],
      });
    });

    it('should notify on sort updated', () => {
      manager.addSort('name', 'asc');
      mockSubscriber.mockClear();

      manager.updateSort('name', 'desc');

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'sort_updated',
        columnId: 'name',
        sort: { columnId: 'name', direction: 'desc' },
      });
    });

    it('should notify on sort removed', () => {
      manager.addSort('name', 'asc');
      mockSubscriber.mockClear();

      manager.removeSort('name');

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'sort_removed',
        columnId: 'name',
      });
    });

    it('should notify on all sorts cleared', () => {
      manager.addSort('name', 'asc');
      mockSubscriber.mockClear();

      manager.clearSorting();

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'sorts_cleared',
      });
    });

    it('should unsubscribe properly', () => {
      const newSubscriber = vi.fn();
      const unsubscribe = manager.subscribe(newSubscriber);
      unsubscribe();

      manager.addSort('age', 'desc');
      expect(newSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('config updates', () => {
    beforeEach(() => {
      manager = new SortingManager(mockColumns, { multiSort: true, maxSortColumns: 3 });
    });

    it('should clear sorts when disabled', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      manager.updateConfig({ enabled: false });

      expect(manager.getSorting()).toEqual([]);
    });

    it('should limit sorts when multi-sort is disabled', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      manager.updateConfig({ multiSort: false });

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });

    it('should trim sorts when max columns is reduced', () => {
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      manager.updateConfig({ maxSortColumns: 1 });

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });
  });

  describe('cloning', () => {
    it('should clone manager with same state', () => {
      manager = new SortingManager(mockColumns, { multiSort: true });
      manager.addSort('name', 'asc');
      manager.addSort('age', 'desc');

      const cloned = manager.clone();

      expect(cloned.getSorting()).toEqual(manager.getSorting());
      expect(cloned.isMultiSortEnabled()).toBe(manager.isMultiSortEnabled());
      expect(cloned.getMaxSortColumns()).toBe(manager.getMaxSortColumns());
    });

    it('should not affect original when cloned manager is modified', () => {
      manager = new SortingManager(mockColumns);
      manager.addSort('name', 'asc');

      const cloned = manager.clone();
      cloned.addSort('age', 'desc');

      expect(manager.getSorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
      expect(cloned.getSorting()).toEqual([{ columnId: 'age', direction: 'desc' }]);
    });
  });
});
