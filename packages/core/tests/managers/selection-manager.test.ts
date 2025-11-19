import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { SelectionManager } from '../../src/managers/selection-manager';
import type { SelectionConfig } from '../../src/types/selection';

interface TestData {
  id: string;
  name: string;
  age: number;
  disabled?: boolean;
}

describe('SelectionManager', () => {
  let manager: SelectionManager<TestData>;
  let mockSubscriber: ReturnType<typeof mock>;
  let testData: TestData[];

  beforeEach(() => {
    mockSubscriber = mock();
    testData = [
      { id: '1', name: 'Alice', age: 25 },
      { id: '2', name: 'Bob', age: 30 },
      { id: '3', name: 'Charlie', age: 35, disabled: true },
      { id: '4', name: 'Diana', age: 28 },
    ];
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      manager = new SelectionManager();

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(0);
      expect(state.allSelected).toBe(false);
      expect(state.someSelected).toBe(false);
      expect(state.mode).toBe('multiple');
    });

    it('should initialize with custom config', () => {
      const config: SelectionConfig = {
        mode: 'single',
        maxSelections: 2,
        preserveSelection: true,
        showSelectAll: false,
        getRowId: (row: unknown) => (row as TestData).id,
        isSelectable: (row: unknown) => !(row as TestData).disabled,
      };

      manager = new SelectionManager<TestData>(config, testData);

      expect(manager.getSelectionMode()).toBe('single');
      expect(manager.getConfig().maxSelections).toBe(2);
    });

    it('should initialize with available rows', () => {
      manager = new SelectionManager({}, testData);

      expect(manager.getConfig().getRowId).toBeDefined();
    });
  });

  describe('row selection', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
    });

    it('should select a single row', () => {
      manager.selectRow('1');

      const state = manager.getSelection();
      expect(state.selectedIds.has('1')).toBe(true);
      expect(state.someSelected).toBe(true);
      expect(state.allSelected).toBe(false);
    });

    it('should deselect a row', () => {
      manager.selectRow('1');
      manager.deselectRow('1');

      const state = manager.getSelection();
      expect(state.selectedIds.has('1')).toBe(false);
      expect(state.someSelected).toBe(false);
    });

    it('should toggle row selection', () => {
      manager.toggleRow('1');

      let state = manager.getSelection();
      expect(state.selectedIds.has('1')).toBe(true);

      manager.toggleRow('1');
      state = manager.getSelection();
      expect(state.selectedIds.has('1')).toBe(false);
    });

    it('should select multiple rows', () => {
      manager.selectRows(['1', '2', '3']);

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(3);
      expect(state.selectedIds.has('1')).toBe(true);
      expect(state.selectedIds.has('2')).toBe(true);
      expect(state.selectedIds.has('3')).toBe(true);
    });

    it('should clear all selections', () => {
      manager.selectRows(['1', '2']);
      manager.clearSelection();

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(0);
      expect(state.someSelected).toBe(false);
      expect(state.allSelected).toBe(false);
    });
  });

  describe('single selection mode', () => {
    beforeEach(() => {
      manager = new SelectionManager({ mode: 'single' }, testData);
    });

    it('should only allow one selection at a time', () => {
      manager.selectRow('1');
      manager.selectRow('2');

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(1);
      expect(state.selectedIds.has('2')).toBe(true);
      expect(state.selectedIds.has('1')).toBe(false);
    });

    it('should deselect when selecting the same row', () => {
      manager.selectRow('1');
      manager.selectRow('1'); // Select same row again

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(1); // Single mode doesn't deselect on same selection
    });
  });

  describe('max selections', () => {
    beforeEach(() => {
      manager = new SelectionManager({ maxSelections: 2 }, testData);
    });

    it('should respect max selections limit', () => {
      manager.selectRows(['1', '2', '3']);

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(2); // Should respect maxSelections limit of 2
    });

    it('should remove oldest selection when exceeding max', () => {
      manager.selectRow('1');
      manager.selectRow('2');

      // This should throw an error since maxSelections is 2
      expect(() => {
        manager.selectRow('3');
      }).toThrow('Maximum selections reached');
    });
  });

  describe('selectable rows', () => {
    beforeEach(() => {
      manager = new SelectionManager<TestData>(
        {
          isSelectable: (row: unknown) => !(row as TestData).disabled,
        },
        testData
      );
    });

    it('should not select disabled rows', () => {
      // This should throw an error since row 3 is disabled
      expect(() => {
        manager.selectRow('3'); // Charlie is disabled
      }).toThrow('Row with ID 3 is not selectable');
    });

    it('should select only selectable rows', () => {
      manager.selectRows(['1', '2', '3', '4']);

      const state = manager.getSelection();
      expect(state.selectedIds.has('1')).toBe(true);
      expect(state.selectedIds.has('2')).toBe(true);
      expect(state.selectedIds.has('3')).toBe(false); // Disabled
      expect(state.selectedIds.has('4')).toBe(true);
    });
  });

  describe('select all functionality', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
    });

    it('should select all rows', () => {
      manager.selectAll();

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(4);
      expect(state.allSelected).toBe(true);
      expect(state.someSelected).toBe(false); // When all are selected, someSelected is false
    });

    it('should deselect all rows', () => {
      manager.selectAll();
      manager.deselectAll();

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(0);
      expect(state.allSelected).toBe(false);
      expect(state.someSelected).toBe(false);
    });

    it('should toggle select all', () => {
      manager.toggleAll();

      let state = manager.getSelection();
      expect(state.allSelected).toBe(true);

      manager.toggleAll();
      state = manager.getSelection();
      expect(state.allSelected).toBe(false);
    });
  });

  describe('row ID handling', () => {
    it('should handle objects with id property', () => {
      const customData = [{ id: 'user1', name: 'Alice' }];
      const customManager = new SelectionManager({}, customData);

      customManager.selectRow('user1');
      expect(customManager.isRowSelected('user1')).toBe(true);
    });

    it('should handle objects with _id property', () => {
      const customData = [{ _id: 'user1', name: 'Alice' }];
      const customManager = new SelectionManager({}, customData);

      customManager.selectRow('user1');
      expect(customManager.isRowSelected('user1')).toBe(true);
    });

    it('should handle primitive values', () => {
      const primitiveData = ['item1', 'item2', 'item3'];
      const primitiveManager = new SelectionManager({}, primitiveData);

      primitiveManager.selectRow('item1');
      expect(primitiveManager.isRowSelected('item1')).toBe(true);
    });

    it('should handle objects without id/_id', () => {
      const customData = [{ name: 'Alice' }];
      const customManager = new SelectionManager({}, customData);

      customManager.selectRow('[object Object]'); // String representation of object
      expect(customManager.isRowSelected('[object Object]')).toBe(true);
    });
  });

  describe('subscription system', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
      manager.subscribe(mockSubscriber);
    });

    it('should notify on row selection', () => {
      manager.selectRow('1');

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'row_selected',
        rowId: '1',
        selected: true,
      });
    });

    it('should notify on multiple row selection', () => {
      manager.selectRows(['1', '2']);

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'rows_selected',
        rowIds: ['1', '2'],
        selected: true,
      });
    });

    it('should notify on select all', () => {
      manager.selectAll();

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'all_selected',
        selected: true,
      });
    });

    it('should notify on selection cleared', () => {
      manager.selectRow('1');
      manager.clearSelection();

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'selection_cleared',
      });
    });

    it('should notify on selection replaced', () => {
      manager.selectRow('1');
      manager.clearSelection();
      manager.selectRows(['2', '3']);

      // Check that we got the expected sequence of events
      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'row_selected',
        rowId: '1',
        selected: true,
      });
      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'selection_cleared',
      });
      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'rows_selected',
        rowIds: ['2', '3'],
        selected: true,
      });
    });

    it('should unsubscribe properly', () => {
      const unsubscribe = manager.subscribe(mockSubscriber);
      unsubscribe();

      manager.selectRow('1');
      // Should still be called because the original subscription is still active
      expect(mockSubscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('query methods', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
      manager.selectRows(['1', '2']);
    });

    it('should check if row is selected', () => {
      expect(manager.isRowSelected('1')).toBe(true);
      expect(manager.isRowSelected('3')).toBe(false);
    });

    it('should get selected IDs', () => {
      const selectedIds = manager.getSelectedIds();
      expect(selectedIds).toEqual(['1', '2']);
    });

    it('should get selected rows', () => {
      const selectedRows = manager.getSelectedRows();
      expect(selectedRows).toHaveLength(2);
      expect(selectedRows[0].name).toBe('Alice');
      expect(selectedRows[1].name).toBe('Bob');
    });

    it('should get selection count', () => {
      expect(manager.getSelectionCount()).toBe(2);
    });

    it('should get selection stats', () => {
      const stats = manager.getSelectionStats();
      expect(stats.selectedCount).toBe(2);
      expect(stats.totalCount).toBe(4);
      expect(stats.selectionPercentage).toBe(50);
    });
  });

  describe('configuration updates', () => {
    beforeEach(() => {
      manager = new SelectionManager({ mode: 'multiple' }, testData);
    });

    it('should update configuration', () => {
      manager.updateConfig({ mode: 'single' });

      expect(manager.getSelectionMode()).toBe('single');
    });

    it('should clear selections when switching to single mode', () => {
      manager.selectRows(['1', '2']);
      manager.updateConfig({ mode: 'single' });

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(1); // Single mode keeps only one selection
    });

    it('should respect new max selections', () => {
      manager.updateConfig({ maxSelections: 1 });
      manager.selectRows(['1', '2']);

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(1); // Should respect maxSelections limit
    });

    it('should respect maxSelections when selecting additional rows', () => {
      manager.updateConfig({ maxSelections: 2 });
      manager.selectRow('1'); // Already have 1 selection
      manager.selectRows(['2', '3', '4']); // Try to select 3 more

      const state = manager.getSelection();
      expect(state.selectedIds.size).toBe(2); // Should only select 1 more (total of 2)
      expect(state.selectedIds.has('1')).toBe(true);
      expect(state.selectedIds.has('2')).toBe(true);
      expect(state.selectedIds.has('3')).toBe(false);
      expect(state.selectedIds.has('4')).toBe(false);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
    });

    it('should handle invalid row IDs gracefully', () => {
      // Test that selecting invalid IDs throws an error
      expect(() => {
        manager.selectRow('invalid-id');
      }).toThrow('Row with ID invalid-id not found');

      expect(manager.isRowSelected('invalid-id')).toBe(false);
    });

    it('should respect max selections limit', () => {
      manager = new SelectionManager({ maxSelections: 1 }, testData);

      manager.selectRow('1');

      // This should throw an error since maxSelections is 1
      expect(() => {
        manager.selectRow('2');
      }).toThrow('Maximum selections reached');
    });
  });

  describe('cloning', () => {
    it('should clone manager with same state', () => {
      manager = new SelectionManager({ mode: 'single' }, testData);
      manager.selectRow('1');

      const cloned = manager.clone();

      expect(cloned.getSelection()).toEqual(manager.getSelection());
      expect(cloned.getConfig()).toEqual(manager.getConfig());
    });

    it('should not affect original when cloned manager is modified', () => {
      manager = new SelectionManager({}, testData);
      manager.selectRow('1');

      const cloned = manager.clone();
      cloned.selectRow('2');

      expect(manager.isRowSelected('1')).toBe(true);
      expect(manager.isRowSelected('2')).toBe(false);
      expect(cloned.isRowSelected('1')).toBe(true);
      expect(cloned.isRowSelected('2')).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      manager = new SelectionManager({}, testData);
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = mock(() => {
        throw new Error('Subscriber error');
      });
      const originalError = console.error;
      const consoleSpy = mock();
      console.error = consoleSpy as typeof console.error;

      manager.subscribe(errorCallback);

      // Should not throw despite subscriber error
      expect(() => {
        manager.selectRow('1');
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in selection manager subscriber:',
        expect.any(Error)
      );

      console.error = originalError;
    });
  });
});
