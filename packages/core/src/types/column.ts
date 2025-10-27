import type { ReactNode } from 'react';
import type { ColumnMeta } from './column-meta';
import type { IconComponent, RenderProps } from './common';
import type { FilterConfig } from './filter';

/**
 * Column types supported by the table
 */
export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'option'
  | 'multiOption'
  | 'currency'
  | 'percentage'
  | 'url'
  | 'email'
  | 'phone'
  | 'json'
  | 'custom';

/**
 * Column definition for table columns
 */
export interface ColumnDefinition<TData = unknown, TValue = unknown> {
  /** Unique column identifier */
  id: string;

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
 * Column visibility state
 */
export interface ColumnVisibility {
  [columnId: string]: boolean;
}

/**
 * Column ordering state
 */
export type ColumnOrder = string[];
