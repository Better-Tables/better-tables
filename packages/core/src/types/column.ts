import type { ReactNode } from 'react';
import type { ColumnMeta } from './column-meta';
import type { IconComponent, RenderProps } from './common';
import type { DerivedColumnSpec } from './derived';
import type { FilterConfig } from './filter';

/**
 * Runtime list of every {@link ColumnType}. Single source of truth — the type
 * below is derived from this array so the two can't drift.
 */
export const COLUMN_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'option',
  'multiOption',
  'currency',
  'percentage',
  'url',
  'email',
  'phone',
  'json',
  'custom',
] as const;

/**
 * Column types supported by the table
 */
export type ColumnType = (typeof COLUMN_TYPES)[number];

/**
 * Column definition for table columns
 */
export interface ColumnDefinition<TData = unknown, TValue = unknown, TId extends string = string> {
  /** Unique column identifier */
  id: TId;

  /** Column display name */
  displayName: string;

  /** Icon for the column */
  icon?: IconComponent;

  /** Data accessor function */
  accessor: (data: TData) => TValue;

  /** Column type */
  type: ColumnType;

  /** Whether column is sortable */
  sortable?: boolean;

  /** Whether column is filterable */
  filterable?: boolean;

  /** Whether column is resizable */
  resizable?: boolean;

  /** Whether column can be hidden via context menu */
  hideable?: boolean;

  /** Whether column is visible by default */
  defaultVisible?: boolean;

  /**
   * Inline editing for this column. `true` enables defaults; pass
   * {@link EditableConfig} for per-row gating, field mapping, or a custom editor.
   */
  editable?: boolean | EditableConfig<TData, TValue>;

  /** Default column width */
  width?: number;

  /** Minimum column width */
  minWidth?: number;

  /** Maximum column width */
  maxWidth?: number;

  /** Column alignment */
  align?: 'left' | 'center' | 'right';

  /** Custom cell renderer */
  cellRenderer?: (props: CellRendererProps<TData, TValue>) => ReactNode;

  /** Custom header renderer */
  headerRenderer?: (props: HeaderRendererProps<TData>) => ReactNode;

  /** Filter configuration */
  filter?: FilterConfig<TValue>;

  /** Validation rules */
  validation?: ValidationRule<TValue>[];

  /** Whether column supports null/undefined values */
  nullable?: boolean;

  /**
   * Server-derived column spec (plan 060). When set, adapters evaluate the
   * value (e.g. relation `count`) instead of reading a physical column.
   * Serializable — never functions or SQL strings.
   */
  derived?: DerivedColumnSpec;

  /** Column metadata - strongly typed */
  meta?: ColumnMeta;
}

/**
 * Props for custom cell renderers
 */
export interface CellRendererProps<TData = unknown, TValue = unknown>
  extends RenderProps<TData, TValue, ColumnDefinition<TData, TValue>> {
  /** Whether the row is selected */
  isSelected?: boolean;
  /** Whether the row is expanded */
  isExpanded?: boolean;
}

/**
 * Props for custom header renderers
 */
export interface HeaderRendererProps<TData = unknown> {
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Sorting state */
  isSorted?: boolean;
  /** Sorting direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort handler */
  onSort?: () => void;
  /** Whether column is being resized */
  isResizing?: boolean;
}

/**
 * Validation rule for column values
 */
export interface ValidationRule<TValue = unknown> {
  /** Rule identifier */
  id: string;
  /** Validation function */
  validate: (value: TValue) => boolean | string;
  /** Error message */
  message?: string;
}

/**
 * Per-column inline-edit configuration (see plan 053).
 */
export interface EditableConfig<TData = unknown, TValue = unknown> {
  /** Per-row gate — return false to render this row's cell read-only. */
  when?: (row: TData) => boolean;
  /**
   * Data field written by the adapter save path. Defaults to the column id
   * when it contains no dot; REQUIRED for adapter-saves on columns whose id
   * is not the storage field (set on a dot-path id, it forces an own-table
   * write). Relationship (dot-path) ids resolve through the adapter's
   * `resolveCellWriteTarget` for both `saveAction` and adapter saves
   * (`onCellEdit` needs no resolution); unresolvable paths fall back to
   * callback-only or read-only.
   */
  field?: string;
  /** Text editor renders a textarea instead of a single-line input. */
  multiline?: boolean;
  /** Placeholder for empty text/number editors. */
  placeholder?: string;
  /**
   * Custom editor (escape hatch, and the ONLY editor for `custom` columns).
   * Receives current value + commit/cancel; the table still owns save/
   * validation/rollback around it.
   */
  editRenderer?: (props: EditRendererProps<TData, TValue>) => ReactNode;
}

/**
 * Props for custom inline cell editors.
 */
export interface EditRendererProps<TData = unknown, TValue = unknown> {
  value: TValue;
  row: TData;
  column: ColumnDefinition<TData, TValue>;
  /** Commit the new value (runs validation + save pipeline). */
  commit: (value: TValue) => void;
  /** Cancel editing, restore display. */
  cancel: () => void;
}

/**
 * Column visibility state
 */
export interface ColumnVisibility {
  [columnId: string]: boolean;
}

/**
 * Column ordering state
 */
export type ColumnOrder = string[];
