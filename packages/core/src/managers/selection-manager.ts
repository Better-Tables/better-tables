/**
 * @fileoverview Selection manager for handling table row selection state and operations.
 *
 * This module provides comprehensive row selection management including single/multiple
 * selection modes, validation, event-based subscriptions, and bulk operations.
 *
 * @module managers/selection-manager
 */

import type {
  SelectionConfig,
  SelectionMode,
  SelectionState,
  SelectionStats,
  SelectionValidationResult,
} from '../types/selection';

/**
 * Event types for selection manager.
 *
 * Defines the different types of events that can be emitted by the selection manager,
 * enabling reactive updates and state synchronization for selection operations.
 *
 * @example
 * ```typescript
 * const unsubscribe = selectionManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'row_selected':
 *       console.log(`Row ${event.rowId} ${event.selected ? 'selected' : 'deselected'}`);
 *       break;
 *     case 'all_selected':
 *       console.log(`All rows ${event.selected ? 'selected' : 'deselected'}`);
 *       break;
 *     case 'selection_cleared':
 *       console.log('Selection was cleared');
 *       break;
 *     case 'selection_replaced':
 *       console.log(`Selection replaced with ${event.selectedIds.size} rows`);
 *       break;
 *   }
 * });
 * ```
 */
export type SelectionManagerEvent =
  | { type: 'row_selected'; rowId: string; selected: boolean }
  | { type: 'rows_selected'; rowIds: string[]; selected: boolean }
  | { type: 'all_selected'; selected: boolean }
  | { type: 'selection_cleared' }
  | { type: 'selection_replaced'; selectedIds: Set<string> }
  | { type: 'selection_toggled'; rowId: string; selected: boolean };

/**
 * Selection manager subscriber function type.
 *
 * Defines the callback function signature for selection event subscribers.
 *
 * @param event - The selection event that occurred
 *
 * @example
 * ```typescript
 * const handleSelectionChange: SelectionManagerSubscriber = (event) => {
 *   if (event.type === 'row_selected') {
 *     // Update UI to reflect selection change
 *     updateRowVisualState(event.rowId, event.selected);
 *   }
 * };
 * ```
 */
export type SelectionManagerSubscriber = (event: SelectionManagerEvent) => void;

/**
 * Core selection manager class for managing row selection state and operations.
 *
 * Provides comprehensive row selection management including single/multiple selection modes,
 * validation against row availability and configuration constraints, event-based subscriptions,
 * and bulk operations. Supports configurable selection limits, row ID extraction, and
 * selection preservation across data updates.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const selectionManager = new SelectionManager<User>({
 *   mode: 'multiple',
 *   maxSelections: 100,
 *   preserveSelection: true,
 *   showSelectAll: true,
 *   getRowId: (user) => user.id,
 *   isSelectable: (user) => user.status !== 'deleted'
 * }, users);
 *
 * // Subscribe to changes
 * const unsubscribe = selectionManager.subscribe((event) => {
 *   console.log('Selection changed:', event);
 * });
 *
 * // Select rows
 * selectionManager.selectRow('user-1');
 * selectionManager.selectRows(['user-2', 'user-3']);
 * selectionManager.selectAll();
 *
 * // Check state
 * console.log('Selected count:', selectionManager.getSelectionCount());
 * console.log('Is all selected:', selectionManager.isAllSelected());
 *
 * // Get selected data
 * const selectedUsers = selectionManager.getSelectedRows();
 * ```
 */
export class SelectionManager<TData = unknown> {
  private selectionState: SelectionState = {
    selectedIds: new Set<string>(),
    allSelected: false,
    someSelected: false,
    mode: 'multiple',
  };
  private availableRows: TData[] = [];
  private subscribers: SelectionManagerSubscriber[] = [];
  private config: SelectionConfig = {};

  /**
   * Create a new selection manager instance.
   *
   * Initializes the selection manager with configuration options and available rows.
   * The manager will validate all selection operations against the provided configuration
   * and emit events for state changes.
   *
   * @param config - Selection configuration options
   * @param availableRows - Initial array of available rows
   *
   * @example
   * ```typescript
   * const selectionManager = new SelectionManager<User>({
   *   mode: 'multiple',
   *   maxSelections: 50,
   *   preserveSelection: true,
   *   showSelectAll: true,
   *   getRowId: (user) => user.id,
   *   isSelectable: (user) => user.status === 'active'
   * }, users);
   * ```
   */
  constructor(config: SelectionConfig = {}, availableRows: TData[] = []) {
    this.config = {
      mode: 'multiple',
      maxSelections: undefined,
      preserveSelection: false,
      showSelectAll: true,
      getRowId: (row: unknown) => {
        if (typeof row === 'object' && row !== null) {
          const obj = row as Record<string, unknown>;
          return String(obj.id || obj._id || row);
        }
        return String(row);
      },
      isSelectable: () => true,
      ...config,
    };

    this.selectionState.mode = this.config.mode || 'multiple';
    this.setAvailableRows(availableRows);
  }

  /**
   * Get current selection state.
   *
   * Returns a copy of the current selection state including selected IDs,
   * selection mode, and computed metadata (allSelected, someSelected).
   *
   * @returns Current selection state
   *
   * @example
   * ```typescript
   * const selection = selectionManager.getSelection();
   * console.log(`Selected: ${selection.selectedIds.size} rows`);
   * console.log(`All selected: ${selection.allSelected}`);
   * console.log(`Some selected: ${selection.someSelected}`);
   * console.log(`Mode: ${selection.mode}`);
   * ```
   */
  getSelection(): SelectionState {
    return {
      ...this.selectionState,
      selectedIds: new Set(this.selectionState.selectedIds),
    };
  }

  /**
   * Get selected row IDs as array
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectionState.selectedIds);
  }

  /**
   * Get selected rows
   */
  getSelectedRows(): TData[] {
    return this.availableRows.filter((row) =>
      this.selectionState.selectedIds.has(this.getRowId(row))
    );
  }

  /**
   * Set available rows (updates selection state)
   */
  setAvailableRows(rows: TData[]): void {
    this.availableRows = rows;

    if (!this.config.preserveSelection) {
      // Clear selection when rows change
      this.clearSelection();
    } else {
      // Filter out selected IDs that are no longer available
      const availableIds = new Set(rows.map((row) => this.getRowId(row)));
      const filteredIds = new Set(
        Array.from(this.selectionState.selectedIds).filter((id) => availableIds.has(id))
      );

      if (filteredIds.size !== this.selectionState.selectedIds.size) {
        this.selectionState.selectedIds = filteredIds;
        this.updateSelectionState();
        this.notifySubscribers({ type: 'selection_replaced', selectedIds: filteredIds });
      }
    }

    this.updateSelectionState();
  }

  /**
   * Select a row.
   *
   * Selects the specified row if it's available and selectable. In single selection mode,
   * this will clear any existing selection first. Validates the selection against
   * configuration constraints and emits appropriate events.
   *
   * @param rowId - Row identifier to select
   * @throws {Error} If the selection is invalid
   *
   * @example
   * ```typescript
   * try {
   *   selectionManager.selectRow('user-123');
   *   console.log('Row selected successfully');
   * } catch (error) {
   *   console.error('Invalid selection:', error.message);
   * }
   * ```
   */
  selectRow(rowId: string): void {
    if (this.config.mode === 'none') {
      return;
    }

    const validation = this.validateSelection(rowId, true);
    if (!validation.valid) {
      throw new Error(`Invalid selection: ${validation.error}`);
    }

    const wasSelected = this.selectionState.selectedIds.has(rowId);

    if (this.config.mode === 'single') {
      // Single selection - clear others first
      this.selectionState.selectedIds.clear();
    }

    this.selectionState.selectedIds.add(rowId);
    this.updateSelectionState();

    if (!wasSelected) {
      this.notifySubscribers({ type: 'row_selected', rowId, selected: true });
    }
  }

  /**
   * Deselect a row
   */
  deselectRow(rowId: string): void {
    if (this.selectionState.selectedIds.has(rowId)) {
      this.selectionState.selectedIds.delete(rowId);
      this.updateSelectionState();
      this.notifySubscribers({ type: 'row_selected', rowId, selected: false });
    }
  }

  /**
   * Toggle row selection.
   *
   * Toggles the selection state of the specified row. If the row is currently
   * selected, it will be deselected. If not selected, it will be selected.
   * Emits both individual row events and a toggle event.
   *
   * @param rowId - Row identifier to toggle
   *
   * @example
   * ```typescript
   * // Toggle selection state
   * selectionManager.toggleRow('user-123');
   *
   * // Check current state
   * const isSelected = selectionManager.isRowSelected('user-123');
   * console.log('Row is now', isSelected ? 'selected' : 'deselected');
   * ```
   */
  toggleRow(rowId: string): void {
    const isSelected = this.selectionState.selectedIds.has(rowId);

    if (isSelected) {
      this.deselectRow(rowId);
    } else {
      this.selectRow(rowId);
    }

    this.notifySubscribers({ type: 'selection_toggled', rowId, selected: !isSelected });
  }

  /**
   * Select multiple rows
   */
  selectRows(rowIds: string[]): void {
    if (this.config.mode === 'none') {
      return;
    }

    const validIds = rowIds.filter((id) => {
      const validation = this.validateSelection(id, true);
      if (!validation.valid) {
        console.warn(`Invalid selection for row ${id}: ${validation.error}`);
        return false;
      }
      return true;
    });

    if (this.config.mode === 'single' && validIds.length > 0) {
      // Single selection - only select the first valid ID
      this.selectionState.selectedIds.clear();
      this.selectionState.selectedIds.add(validIds[0]);
    } else {
      // Multiple selection - respect maxSelections limit
      if (this.config.maxSelections) {
        const currentCount = this.selectionState.selectedIds.size;
        const remainingSlots = this.config.maxSelections - currentCount;

        if (remainingSlots <= 0) {
          console.warn(`Maximum selections reached (${this.config.maxSelections})`);
          return;
        }

        // Only select up to the remaining slots
        const idsToSelect = validIds.slice(0, remainingSlots);
        for (const id of idsToSelect) {
          this.selectionState.selectedIds.add(id);
        }

        this.updateSelectionState();
        this.notifySubscribers({ type: 'rows_selected', rowIds: idsToSelect, selected: true });
        return;
      }

      // No maxSelections limit - select all valid IDs
      for (const id of validIds) {
        this.selectionState.selectedIds.add(id);
      }
    }

    this.updateSelectionState();
    this.notifySubscribers({ type: 'rows_selected', rowIds: validIds, selected: true });
  }

  /**
   * Deselect multiple rows
   */
  deselectRows(rowIds: string[]): void {
    const deselectedIds = rowIds.filter((id) => this.selectionState.selectedIds.has(id));

    for (const id of deselectedIds) {
      this.selectionState.selectedIds.delete(id);
    }
    this.updateSelectionState();

    if (deselectedIds.length > 0) {
      this.notifySubscribers({ type: 'rows_selected', rowIds: deselectedIds, selected: false });
    }
  }

  /**
   * Select all available rows.
   *
   * Selects all available and selectable rows. Only works in multiple selection mode.
   * Respects the isSelectable configuration and selection limits. Emits an 'all_selected' event.
   *
   * @example
   * ```typescript
   * if (selectionManager.getSelectionMode() === 'multiple') {
   *   selectionManager.selectAll();
   *   console.log('All rows selected');
   * }
   * ```
   */
  selectAll(): void {
    if (this.config.mode === 'none' || this.config.mode === 'single') {
      return;
    }

    const selectableRows = this.availableRows.filter((row) => this.config.isSelectable?.(row));

    // Check if there's a maxSelections limit
    if (this.config.maxSelections) {
      const currentCount = this.selectionState.selectedIds.size;

      // If already at or over limit, don't select any new rows
      if (currentCount >= this.config.maxSelections) {
        console.warn(`Maximum selections reached (${this.config.maxSelections})`);
        return;
      }

      const remainingSlots = this.config.maxSelections - currentCount;

      // Only select up to the remaining slots
      const idsToSelect = selectableRows
        .filter((row) => !this.selectionState.selectedIds.has(this.getRowId(row)))
        .slice(0, remainingSlots);

      for (const row of idsToSelect) {
        this.selectionState.selectedIds.add(this.getRowId(row));
      }
    } else {
      // No maxSelections limit - select all selectable rows
      for (const row of selectableRows) {
        this.selectionState.selectedIds.add(this.getRowId(row));
      }
    }

    this.updateSelectionState();
    this.notifySubscribers({ type: 'all_selected', selected: true });
  }

  /**
   * Deselect all rows
   */
  deselectAll(): void {
    this.selectionState.selectedIds.clear();
    this.updateSelectionState();
    this.notifySubscribers({ type: 'all_selected', selected: false });
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this.selectionState.selectedIds.clear();
    this.updateSelectionState();
    this.notifySubscribers({ type: 'selection_cleared' });
  }

  /**
   * Toggle select all
   */
  toggleAll(): void {
    if (this.selectionState.allSelected) {
      this.deselectAll();
    } else {
      this.selectAll();
    }
  }

  /**
   * Check if a row is selected
   */
  isRowSelected(rowId: string): boolean {
    return this.selectionState.selectedIds.has(rowId);
  }

  /**
   * Check if all rows are selected
   */
  isAllSelected(): boolean {
    return this.selectionState.allSelected;
  }

  /**
   * Check if some rows are selected
   */
  isSomeSelected(): boolean {
    return this.selectionState.someSelected;
  }

  /**
   * Get selection count
   */
  getSelectionCount(): number {
    return this.selectionState.selectedIds.size;
  }

  /**
   * Get selection mode
   */
  getSelectionMode(): SelectionMode {
    return this.selectionState.mode;
  }

  /**
   * Get selection statistics.
   *
   * Returns comprehensive statistics about the current selection including counts,
   * percentages, and selection state flags. Useful for displaying selection
   * summaries and managing UI state.
   *
   * @returns Detailed selection statistics
   *
   * @example
   * ```typescript
   * const stats = selectionManager.getSelectionStats();
   * console.log(`Selected: ${stats.selectedCount}/${stats.totalCount} (${stats.selectionPercentage.toFixed(1)}%)`);
   * console.log(`All selected: ${stats.allSelected}`);
   * console.log(`Some selected: ${stats.someSelected}`);
   *
   * // Update UI elements
   * updateSelectionSummary(stats);
   * updateBulkActionButtons(stats);
   * ```
   */
  getSelectionStats(): SelectionStats {
    const selectableRows = this.availableRows.filter((row) => this.config.isSelectable?.(row));

    const selectedCount = this.selectionState.selectedIds.size;
    const totalCount = selectableRows.length;
    const allSelected = totalCount > 0 && selectedCount === totalCount;
    const someSelected = selectedCount > 0 && selectedCount < totalCount;
    const selectionPercentage = totalCount > 0 ? (selectedCount / totalCount) * 100 : 0;

    return {
      selectedCount,
      totalCount,
      allSelected,
      someSelected,
      selectionPercentage,
    };
  }

  /**
   * Get row ID using the configured getRowId function
   */
  private getRowId(row: TData): string {
    return this.config.getRowId?.(row) || String(row);
  }

  /**
   * Validate selection operation
   */
  private validateSelection(rowId: string, selecting: boolean): SelectionValidationResult {
    if (this.config.mode === 'none') {
      return { valid: false, error: 'Selection is disabled' };
    }

    const row = this.availableRows.find((r) => this.getRowId(r) === rowId);
    if (!row) {
      return { valid: false, error: `Row with ID ${rowId} not found` };
    }

    if (!this.config.isSelectable?.(row)) {
      return { valid: false, error: `Row with ID ${rowId} is not selectable` };
    }

    if (selecting && this.config.mode === 'single' && this.selectionState.selectedIds.size > 0) {
      // Single mode allows replacing selection
      return { valid: true };
    }

    if (selecting && this.config.maxSelections) {
      const currentCount = this.selectionState.selectedIds.size;
      if (
        currentCount >= this.config.maxSelections &&
        !this.selectionState.selectedIds.has(rowId)
      ) {
        return {
          valid: false,
          error: `Maximum selections reached (${this.config.maxSelections})`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Update selection state metadata
   */
  private updateSelectionState(): void {
    const selectableRows = this.availableRows.filter((row) => this.config.isSelectable?.(row));

    const selectedCount = this.selectionState.selectedIds.size;
    const totalCount = selectableRows.length;

    this.selectionState.allSelected = totalCount > 0 && selectedCount === totalCount;
    this.selectionState.someSelected = selectedCount > 0 && selectedCount < totalCount;
  }

  /**
   * Get configuration
   */
  getConfig(): SelectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.selectionState.mode = this.config.mode || 'multiple';

    // Validate current selection against new config
    if (this.config.mode === 'none') {
      this.clearSelection();
    } else if (this.config.mode === 'single' && this.selectionState.selectedIds.size > 1) {
      // Keep only the first selected item
      const firstId = Array.from(this.selectionState.selectedIds)[0];
      this.selectionState.selectedIds.clear();
      this.selectionState.selectedIds.add(firstId);
      this.updateSelectionState();
    } else if (
      this.config.maxSelections &&
      this.selectionState.selectedIds.size > this.config.maxSelections
    ) {
      // Trim to max selections
      const ids = Array.from(this.selectionState.selectedIds);
      this.selectionState.selectedIds = new Set(ids.slice(0, this.config.maxSelections));
      this.updateSelectionState();
    }
  }

  /**
   * Subscribe to selection changes.
   *
   * Registers a callback function to be called whenever selection state changes.
   * Returns an unsubscribe function to remove the subscription.
   *
   * @param callback - Function to call when selection changes
   * @returns Unsubscribe function to remove the subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = selectionManager.subscribe((event) => {
   *   switch (event.type) {
   *     case 'row_selected':
   *       console.log(`Row ${event.rowId} ${event.selected ? 'selected' : 'deselected'}`);
   *       updateRowVisualState(event.rowId, event.selected);
   *       break;
   *     case 'all_selected':
   *       console.log(`All rows ${event.selected ? 'selected' : 'deselected'}`);
   *       updateSelectAllButton(event.selected);
   *       break;
   *     case 'selection_cleared':
   *       console.log('Selection was cleared');
   *       updateSelectionSummary();
   *       break;
   *     case 'selection_replaced':
   *       console.log(`Selection replaced with ${event.selectedIds.size} rows`);
   *       updateBulkActions();
   *       break;
   *   }
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  subscribe(callback: SelectionManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of selection changes
   */
  private notifySubscribers(event: SelectionManagerEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in selection manager subscriber:', error);
      }
    });
  }

  /**
   * Clone the selection manager with the same configuration.
   *
   * Creates a new selection manager instance with the same configuration
   * and current state. Useful for creating backup instances or managing
   * multiple selection contexts.
   *
   * @returns New selection manager instance with copied state
   *
   * @example
   * ```typescript
   * const originalManager = new SelectionManager(config, data);
   * originalManager.selectRows(['user-1', 'user-2']);
   *
   * // Create a backup
   * const backupManager = originalManager.clone();
   * console.log('Backup created with same selection state');
   *
   * // Modify backup without affecting original
   * backupManager.clearSelection();
   * console.log('Original still has', originalManager.getSelectionCount(), 'selections');
   * ```
   */
  clone(): SelectionManager<TData> {
    const cloned = new SelectionManager(this.config, this.availableRows);
    cloned.selectionState = {
      ...this.selectionState,
      selectedIds: new Set(this.selectionState.selectedIds),
    };
    return cloned;
  }
}
