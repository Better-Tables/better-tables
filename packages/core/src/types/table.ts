/**
 * @fileoverview Table configuration and feature types for better-tables setup.
 *
 * This module defines the main table configuration interface along with
 * feature flags, bulk actions, export options, and UI state configurations.
 *
 * @module types/table
 */

import type { ComponentType } from 'react';
import type { TableAdapter } from './adapter';
import type { ColumnDefinition } from './column';
import type { EventHandler, IconComponent, TableTheme } from './common';
import type { FilterGroup, FilterState } from './filter';
import type { PaginationConfig } from './pagination';
import type { SortingConfig } from './sorting';

/**
 * Main table configuration interface.
 *
 * Defines the complete configuration for a table instance, including
 * columns, features, adapters, and UI customization options.
 *
 * @template TData - The type of data managed by the table
 *
 * @example
 * ```typescript
 * const tableConfig: TableConfig<User> = {
 *   id: 'users-table',
 *   name: 'User Management',
 *   columns: userColumns,
 *   groups: filterGroups,
 *   defaultFilters: [{ columnId: 'status', operator: 'equals', values: ['active'] }],
 *   pagination: { defaultPageSize: 20 },
 *   sorting: { enabled: true, multiSort: true },
 *   bulkActions: [deleteAction, exportAction],
 *   exportOptions: { formats: ['csv', 'excel'] },
 *   adapter: userAdapter,
 *   theme: darkTheme,
 *   features: { filtering: true, sorting: true, pagination: true }
 * };
 * ```
 */
export interface TableConfig<TData = unknown> {
  /** Unique identifier for the table instance */
  id: string;

  /** Human-readable display name for the table */
  name: string;

  /** Column definitions for the table */
  columns: ColumnDefinition<TData>[];

  /** Filter group definitions for organized filtering */
  groups?: FilterGroup[];

  /** Default filters to apply on initialization */
  defaultFilters?: FilterState[];

  /** Pagination configuration and options */
  pagination?: PaginationConfig;

  /** Sorting configuration and options */
  sorting?: SortingConfig;

  /** Bulk actions available for selected rows */
  bulkActions?: BulkActionDefinition<TData>[];

  /** Export configuration and options */
  exportOptions?: ExportConfig<TData>;

  /** Data adapter for table operations */
  adapter: TableAdapter<TData>;

  /** UI theme and styling configuration */
  theme?: TableTheme;

  /** Feature flags to enable/disable table capabilities */
  features?: TableFeatures;

  /** Row-specific configuration and behavior */
  rowConfig?: RowConfig<TData>;

  /** Empty state configuration and customization */
  emptyState?: EmptyStateConfig;

  /** Loading state configuration and customization */
  loadingState?: LoadingStateConfig;

  /** Error state configuration and customization */
  errorState?: ErrorStateConfig;
}

/**
 * Table feature flags interface.
 *
 * Controls which features are enabled or disabled for the table,
 * allowing fine-grained control over table capabilities.
 *
 * @example
 * ```typescript
 * const features: TableFeatures = {
 *   filtering: true,
 *   sorting: true,
 *   pagination: true,
 *   bulkActions: true,
 *   export: true,
 *   columnResizing: true,
 *   columnReordering: false,
 *   rowSelection: true,
 *   virtualScrolling: false,
 *   realTimeUpdates: true,
 *   columnVisibility: true,
 *   rowExpansion: false
 * };
 * ```
 */
export interface TableFeatures {
  /** Enable column filtering functionality */
  filtering?: boolean;

  /** Enable column sorting functionality */
  sorting?: boolean;

  /** Enable pagination functionality */
  pagination?: boolean;

  /** Enable bulk actions for selected rows */
  bulkActions?: boolean;

  /** Enable data export functionality */
  export?: boolean;

  /** Enable column resizing */
  columnResizing?: boolean;

  /** Enable column reordering */
  columnReordering?: boolean;

  /** Enable row selection */
  rowSelection?: boolean;

  /** Enable virtual scrolling for large datasets */
  virtualScrolling?: boolean;

  /** Enable real-time data updates */
  realTimeUpdates?: boolean;

  /** Enable column visibility toggle */
  columnVisibility?: boolean;

  /** Enable row expansion functionality */
  rowExpansion?: boolean;

  /** Configuration for header context menu */
  headerContextMenu?: HeaderContextMenuConfig;
}

/**
 * Bulk action definition interface.
 *
 * Defines actions that can be performed on multiple selected rows,
 * including custom components and confirmation dialogs.
 *
 * @template TData - The type of data being acted upon
 *
 * @example
 * ```typescript
 * const deleteAction: BulkActionDefinition<User> = {
 *   id: 'delete',
 *   label: 'Delete Selected',
 *   icon: TrashIcon,
 *   variant: 'destructive',
 *   handler: async (selectedIds, data) => {
 *     await deleteUsers(selectedIds);
 *   },
 *   requiresConfirmation: true,
 *   confirmationMessage: 'Are you sure you want to delete these users?'
 * };
 * ```
 */
export interface BulkActionDefinition<TData = unknown> {
  /** Unique identifier for the action */
  id: string;

  /** Display label for the action */
  label: string;

  /** Icon component for the action */
  icon?: IconComponent;

  /** Visual variant/style for the action */
  variant?: 'default' | 'primary' | 'secondary' | 'destructive';

  /** Custom component for complex actions */
  component?: ComponentType<BulkActionProps>;

  /** Action handler function */
  handler?: (selectedIds: string[], data?: TData[]) => void | Promise<void>;

  /** Whether the action requires user confirmation */
  requiresConfirmation?: boolean;

  /** Confirmation message to display */
  confirmationMessage?: string;
}

/**
 * Props interface for bulk action components.
 *
 * Provides necessary props for custom bulk action components,
 * including selected data and event handlers.
 *
 * @example
 * ```typescript
 * const BulkDeleteComponent: React.FC<BulkActionProps> = ({
 *   selectedIds,
 *   onClose,
 *   onSuccess,
 *   onError
 * }) => {
 *   const handleDelete = async () => {
 *     try {
 *       await deleteUsers(selectedIds);
 *       onSuccess();
 *     } catch (error) {
 *       onError(error);
 *     }
 *   };
 *
 *   return <button onClick={handleDelete}>Delete {selectedIds.length} users</button>;
 * };
 * ```
 */
export interface BulkActionProps {
  /** Array of selected row identifiers */
  selectedIds: string[];

  /** Function to close the bulk action interface */
  onClose: () => void;

  /** Function to call on successful action completion */
  onSuccess: () => void;

  /** Function to call when an error occurs */
  onError: (error: Error) => void;
}

/**
 * Export configuration interface.
 *
 * Configures data export options including available formats,
 * custom handlers, and export behavior.
 *
 * @template TData - The type of data being exported
 *
 * @example
 * ```typescript
 * const exportConfig: ExportConfig<User> = {
 *   formats: ['csv', 'excel', 'json'],
 *   defaultFormat: 'csv',
 *   customHandler: async (format, data) => {
 *     if (format === 'custom') {
 *       await customExport(data);
 *     }
 *   },
 *   includeHiddenColumns: false
 * };
 * ```
 */
export interface ExportConfig<TData = unknown> {
  /** Available export formats */
  formats?: ('csv' | 'json' | 'excel')[];

  /** Default export format to use */
  defaultFormat?: 'csv' | 'json' | 'excel';

  /** Custom export handler for special cases */
  customHandler?: (format: string, data: TData[]) => void | Promise<void>;

  /** Whether to include hidden columns in exports */
  includeHiddenColumns?: boolean;
}

/**
 * Row configuration interface.
 *
 * Configures row-specific behavior including selection, expansion,
 * styling, and event handling.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const rowConfig: RowConfig<User> = {
 *   getId: (user) => user.id,
 *   isSelectable: (user) => user.status !== 'deleted',
 *   isExpandable: (user) => user.hasDetails,
 *   expandedContent: (user) => <UserDetails user={user} />,
 *   onClick: (user) => navigateToUser(user.id),
 *   className: (user) => user.status === 'active' ? 'active-row' : '',
 *   style: (user) => ({ backgroundColor: user.isHighlighted ? '#fff3cd' : undefined })
 * };
 * ```
 */
export interface RowConfig<TData = unknown> {
  /** Function to extract unique row identifier */
  getId?: (row: TData) => string;

  /** Function to determine if a row is selectable */
  isSelectable?: (row: TData) => boolean;

  /** Function to determine if a row is expandable */
  isExpandable?: (row: TData) => boolean;

  /** Function to render expanded row content */
  expandedContent?: (row: TData) => React.ReactNode;

  /** Click handler for row interactions */
  onClick?: EventHandler<TData>;

  /** CSS class name or function to generate class name */
  className?: string | ((row: TData) => string);

  /** CSS styles or function to generate styles */
  style?: React.CSSProperties | ((row: TData) => React.CSSProperties);
}

/**
 * Empty state configuration interface.
 *
 * Configures the appearance and behavior of the empty state
 * when no data is available to display.
 *
 * @example
 * ```typescript
 * const emptyState: EmptyStateConfig = {
 *   title: 'No users found',
 *   description: 'Try adjusting your filters or add some users to get started.',
 *   icon: UsersIcon,
 *   component: CustomEmptyState
 * };
 * ```
 */
export interface EmptyStateConfig {
  /** Title text for the empty state */
  title?: string;

  /** Description text for the empty state */
  description?: string;

  /** Icon component to display */
  icon?: IconComponent;

  /** Custom empty state component */
  component?: ComponentType<EmptyStateProps>;
}

/**
 * Props interface for empty state components.
 *
 * Provides necessary props for custom empty state components,
 * including filter state and clear actions.
 *
 * @example
 * ```typescript
 * const CustomEmptyState: React.FC<EmptyStateProps> = ({
 *   hasFilters,
 *   onClearFilters
 * }) => (
 *   <div className="empty-state">
 *     <h3>No data found</h3>
 *     {hasFilters && (
 *       <button onClick={onClearFilters}>Clear filters</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export interface EmptyStateProps {
  /** Whether filters are currently applied */
  hasFilters: boolean;

  /** Function to clear all applied filters */
  onClearFilters: () => void;
}

/**
 * Loading state configuration interface.
 *
 * Configures the appearance and behavior of the loading state
 * while data is being fetched or processed.
 *
 * @example
 * ```typescript
 * const loadingState: LoadingStateConfig = {
 *   message: 'Loading users...',
 *   component: CustomLoadingSpinner
 * };
 * ```
 */
export interface LoadingStateConfig {
  /** Loading message to display */
  message?: string;

  /** Custom loading component */
  component?: ComponentType;
}

/**
 * Error state configuration interface.
 *
 * Configures the appearance and behavior of error states
 * when data loading or operations fail.
 *
 * @example
 * ```typescript
 * const errorState: ErrorStateConfig = {
 *   title: 'Failed to load data',
 *   component: CustomErrorComponent,
 *   onRetry: () => refetchData()
 * };
 * ```
 */
export interface ErrorStateConfig {
  /** Error title text */
  title?: string;

  /** Custom error component */
  component?: ComponentType<ErrorStateProps>;

  /** Retry handler function */
  onRetry?: () => void;
}

/**
 * Header context menu configuration interface.
 *
 * Configures the behavior and options available in the table header
 * right-click context menu.
 *
 * @example
 * ```typescript
 * const contextMenuConfig: HeaderContextMenuConfig = {
 *   enabled: true,
 *   showSortToggle: true,
 *   allowSortReorder: true,
 *   showColumnVisibility: true
 * };
 * ```
 */
export interface HeaderContextMenuConfig {
  /** Whether the header context menu is enabled */
  enabled: boolean;

  /** Whether to show sort toggle options in the menu */
  showSortToggle?: boolean;

  /** Whether to allow reordering sorts via drag-and-drop */
  allowSortReorder?: boolean;

  /** Whether to show column visibility toggle */
  showColumnVisibility?: boolean;
}

/**
 * Props interface for error state components.
 *
 * Provides necessary props for custom error state components,
 * including error information and retry functionality.
 *
 * @example
 * ```typescript
 * const CustomErrorState: React.FC<ErrorStateProps> = ({
 *   error,
 *   onRetry
 * }) => (
 *   <div className="error-state">
 *     <h3>Something went wrong</h3>
 *     <p>{error.message}</p>
 *     {onRetry && (
 *       <button onClick={onRetry}>Try again</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export interface ErrorStateProps {
  /** Error object containing details about the failure */
  error: Error;

  /** Optional retry handler function */
  onRetry?: () => void;
}
