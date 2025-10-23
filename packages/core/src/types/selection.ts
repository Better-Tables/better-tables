/**
 * Selection mode types
 */
export type SelectionMode = 'single' | 'multiple' | 'none';

/**
 * Row selection state
 */
export interface SelectionState {
  /** Selected row IDs */
  selectedIds: Set<string>;
  /** Whether all rows are selected */
  allSelected: boolean;
  /** Whether some rows are selected (for indeterminate state) */
  someSelected: boolean;
  /** Selection mode */
  mode: SelectionMode;
}

/**
 * Selection configuration
 */
export interface SelectionConfig<TData = any> {
  /** Selection mode */
  mode?: SelectionMode;
  /** Maximum number of selections (for multiple mode) */
  maxSelections?: number;
  /** Whether to preserve selection across page changes */
  preserveSelection?: boolean;
  /** Whether to show select all checkbox */
  showSelectAll?: boolean;
  /** Custom key function for row IDs */
  getRowId?: (row: TData) => string;
  /** Whether to disable selection for specific rows */
  isSelectable?: (row: TData) => boolean;
}

/**
 * Selection validation result
 */
export interface SelectionValidationResult {
  /** Whether the selection is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Selection stats
 */
export interface SelectionStats {
  /** Total number of selected rows */
  selectedCount: number;
  /** Total number of available rows */
  totalCount: number;
  /** Whether all available rows are selected */
  allSelected: boolean;
  /** Whether some rows are selected */
  someSelected: boolean;
  /** Selection percentage */
  selectionPercentage: number;
}
