/**
 * @fileoverview Selection types and interfaces for table row selection.
 *
 * This module defines types for row selection modes, state, and configuration
 * used throughout the table system for managing user selections.
 *
 * @module types/selection
 */

/**
 * Selection mode enumeration.
 *
 * Defines the different modes of row selection available.
 *
 * @example
 * ```typescript
 * const mode: SelectionMode = 'multiple'; // 'single', 'multiple', or 'none'
 * ```
 */
export type SelectionMode = 'single' | 'multiple' | 'none';

/**
 * Row selection state interface.
 *
 * Contains the current selection state including selected IDs,
 * selection flags, and the current selection mode.
 *
 * @example
 * ```typescript
 * const selectionState: SelectionState = {
 *   selectedIds: new Set(['1', '2', '3']),
 *   allSelected: false,
 *   someSelected: true,
 *   mode: 'multiple'
 * };
 * ```
 */
export interface SelectionState {
  /** Set of selected row identifiers */
  selectedIds: Set<string>;
  /** Whether all available rows are selected */
  allSelected: boolean;
  /** Whether some (but not all) rows are selected (for indeterminate state) */
  someSelected: boolean;
  /** Current selection mode */
  mode: SelectionMode;
}

/**
 * Selection configuration options.
 *
 * Configures selection behavior and capabilities for
 * the table selection system.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const selectionConfig: SelectionConfig<User> = {
 *   mode: 'multiple',
 *   maxSelections: 100,
 *   preserveSelection: true,
 *   showSelectAll: true,
 *   getRowId: (user) => user.id,
 *   isSelectable: (user) => user.status !== 'deleted'
 * };
 * ```
 */
export interface SelectionConfig<TData = unknown> {
  /** Selection mode for the table */
  mode?: SelectionMode;
  /** Maximum number of rows that can be selected (for multiple mode) */
  maxSelections?: number;
  /** Whether to preserve selection when changing pages */
  preserveSelection?: boolean;
  /** Whether to show select all checkbox in header */
  showSelectAll?: boolean;
  /** Custom function to extract row ID from data */
  getRowId?: (row: TData) => string;
  /** Function to determine if a row is selectable */
  isSelectable?: (row: TData) => boolean;
}

/**
 * Selection validation result interface.
 *
 * Contains the result of validating a selection operation,
 * including success status and error information.
 *
 * @example
 * ```typescript
 * const validation: SelectionValidationResult = {
 *   valid: false,
 *   error: 'Maximum selection limit exceeded'
 * };
 * ```
 */
export interface SelectionValidationResult {
  /** Whether the selection operation is valid */
  valid: boolean;
  /** Error message if the selection is invalid */
  error?: string;
}

/**
 * Selection statistics interface.
 *
 * Provides statistical information about the current selection
 * state for display in UI components.
 *
 * @example
 * ```typescript
 * const stats: SelectionStats = {
 *   selectedCount: 25,
 *   totalCount: 100,
 *   allSelected: false,
 *   someSelected: true,
 *   selectionPercentage: 25
 * };
 * ```
 */
export interface SelectionStats {
  /** Total number of currently selected rows */
  selectedCount: number;
  /** Total number of available rows */
  totalCount: number;
  /** Whether all available rows are selected */
  allSelected: boolean;
  /** Whether some rows are selected */
  someSelected: boolean;
  /** Percentage of rows selected (0-100) */
  selectionPercentage: number;
}
