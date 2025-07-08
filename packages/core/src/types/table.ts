import type { ComponentType } from 'react';
import type { ColumnDefinition } from './column';
import type { FilterState, FilterGroup } from './filter';
import type { PaginationConfig } from './pagination';
import type { SortingConfig } from './sorting';
import type { TableAdapter } from './adapter';
import type { TableTheme, IconComponent, EventHandler } from './common';

/**
 * Table configuration
 */
export interface TableConfig<TData = any> {
  /** Unique identifier for the table */
  id: string;
  
  /** Display name for the table */
  name: string;
  
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  
  /** Filter group definitions */
  groups?: FilterGroup[];
  
  /** Default filters */
  defaultFilters?: FilterState[];
  
  /** Pagination configuration */
  pagination?: PaginationConfig;
  
  /** Sorting configuration */
  sorting?: SortingConfig;
  
  /** Bulk actions */
  bulkActions?: BulkActionDefinition[];
  
  /** Export options */
  exportOptions?: ExportConfig;
  
  /** Adapter for data access */
  adapter: TableAdapter<TData>;
  
  /** UI theme */
  theme?: TableTheme;
  
  /** Feature flags */
  features?: TableFeatures;
  
  /** Row configuration */
  rowConfig?: RowConfig<TData>;
  
  /** Empty state configuration */
  emptyState?: EmptyStateConfig;
  
  /** Loading state configuration */
  loadingState?: LoadingStateConfig;
  
  /** Error state configuration */
  errorState?: ErrorStateConfig;
}

/**
 * Table features that can be enabled/disabled
 */
export interface TableFeatures {
  /** Enable filtering */
  filtering?: boolean;
  
  /** Enable sorting */
  sorting?: boolean;
  
  /** Enable pagination */
  pagination?: boolean;
  
  /** Enable bulk actions */
  bulkActions?: boolean;
  
  /** Enable export */
  export?: boolean;
  
  /** Enable column resizing */
  columnResizing?: boolean;
  
  /** Enable column reordering */
  columnReordering?: boolean;
  
  /** Enable row selection */
  rowSelection?: boolean;
  
  /** Enable virtual scrolling */
  virtualScrolling?: boolean;
  
  /** Enable real-time updates */
  realTimeUpdates?: boolean;
  
  /** Enable column visibility toggle */
  columnVisibility?: boolean;
  
  /** Enable row expansion */
  rowExpansion?: boolean;
}

/**
 * Bulk action definition
 */
export interface BulkActionDefinition {
  /** Action identifier */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Action icon */
  icon?: IconComponent;
  
  /** Action variant */
  variant?: 'default' | 'primary' | 'secondary' | 'destructive';
  
  /** Custom component for action */
  component?: ComponentType<BulkActionProps>;
  
  /** Action handler */
  handler?: (selectedIds: string[], data?: any) => void | Promise<void>;
  
  /** Whether action requires confirmation */
  requiresConfirmation?: boolean;
  
  /** Confirmation message */
  confirmationMessage?: string;
}

/**
 * Props for bulk action components
 */
export interface BulkActionProps {
  /** Selected row IDs */
  selectedIds: string[];
  
  /** Close action handler */
  onClose: () => void;
  
  /** Success handler */
  onSuccess: () => void;
  
  /** Error handler */
  onError: (error: Error) => void;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Available export formats */
  formats?: ('csv' | 'json' | 'excel')[];
  
  /** Default export format */
  defaultFormat?: 'csv' | 'json' | 'excel';
  
  /** Custom export handler */
  customHandler?: (format: string, data: any[]) => void | Promise<void>;
  
  /** Whether to include hidden columns */
  includeHiddenColumns?: boolean;
}

/**
 * Row configuration
 */
export interface RowConfig<TData = any> {
  /** Row ID accessor */
  getId?: (row: TData) => string;
  
  /** Whether row is selectable */
  isSelectable?: (row: TData) => boolean;
  
  /** Whether row is expandable */
  isExpandable?: (row: TData) => boolean;
  
  /** Expanded row content */
  expandedContent?: (row: TData) => React.ReactNode;
  
  /** Row click handler */
  onClick?: EventHandler<TData>;
  
  /** Row class name */
  className?: string | ((row: TData) => string);
  
  /** Row styles */
  style?: React.CSSProperties | ((row: TData) => React.CSSProperties);
}

/**
 * Empty state configuration
 */
export interface EmptyStateConfig {
  /** Empty state title */
  title?: string;
  
  /** Empty state description */
  description?: string;
  
  /** Empty state icon */
  icon?: IconComponent;
  
  /** Custom empty state component */
  component?: ComponentType<EmptyStateProps>;
}

/**
 * Props for empty state component
 */
export interface EmptyStateProps {
  /** Whether filters are applied */
  hasFilters: boolean;
  
  /** Clear filters handler */
  onClearFilters: () => void;
}

/**
 * Loading state configuration
 */
export interface LoadingStateConfig {
  /** Loading message */
  message?: string;
  
  /** Custom loading component */
  component?: ComponentType;
}

/**
 * Error state configuration
 */
export interface ErrorStateConfig {
  /** Error title */
  title?: string;
  
  /** Custom error component */
  component?: ComponentType<ErrorStateProps>;
  
  /** Retry handler */
  onRetry?: () => void;
}

/**
 * Props for error state component
 */
export interface ErrorStateProps {
  /** Error object */
  error: Error;
  
  /** Retry handler */
  onRetry?: () => void;
} 