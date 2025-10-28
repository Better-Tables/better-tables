/**
 * @fileoverview Action types for table bulk operations.
 *
 * This module defines the types and interfaces for table actions that can be
 * performed on selected rows, including handlers, visibility control, and
 * confirmation dialogs.
 *
 * @module types/action
 */

import type { IconComponent } from './common';

/**
 * Action variant type for visual styling.
 *
 * Different variants provide different visual treatments for action buttons
 * to indicate their importance and potential consequences.
 */
export type ActionVariant = 'default' | 'destructive' | 'secondary';

/**
 * Function type for checking action visibility.
 *
 * Determines whether an action should be visible based on the currently
 * selected rows and their data.
 *
 * @template TData - The type of row data
 * @param selectedIds - Array of selected row IDs
 * @param selectedData - Array of selected row data (optional)
 * @returns Whether the action should be visible
 */
export type ActionVisibility<TData = unknown> = (
  selectedIds: string[],
  selectedData?: TData[]
) => boolean;

/**
 * Function type for checking if action is enabled.
 *
 * Determines whether an action button should be enabled or disabled
 * based on the current selection.
 *
 * @template TData - The type of row data
 * @param selectedIds - Array of selected row IDs
 * @param selectedData - Array of selected row data (optional)
 * @returns Whether the action should be enabled
 */
export type ActionEnabled<TData = unknown> = (
  selectedIds: string[],
  selectedData?: TData[]
) => boolean;

/**
 * Action handler function type.
 *
 * Defines the signature for action execution handlers. Handlers can be
 * synchronous or asynchronous and should return the appropriate type.
 *
 * @template TData - The type of row data
 * @param selectedIds - Array of selected row IDs
 * @param selectedData - Array of selected row data (optional)
 * @returns Promise or void indicating completion
 */
export type ActionHandler<TData = unknown> = (
  selectedIds: string[],
  selectedData?: TData[]
) => void | Promise<void>;

/**
 * Configuration for action confirmation dialogs.
 *
 * Provides options for customizing the confirmation dialog that appears
 * before executing potentially destructive actions.
 */
export interface ActionConfirmationConfig {
  /** Title of the confirmation dialog */
  title: string;

  /** Description or message explaining the action */
  description: string;

  /** Label for the confirm/execute button */
  confirmLabel?: string;

  /** Label for the cancel button */
  cancelLabel?: string;

  /** Whether this is a destructive action (affects button styling) */
  destructive?: boolean;
}

/**
 * Complete table action definition.
 *
 * Defines an action that can be performed on selected rows, including
 * its appearance, behavior, and execution logic.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const deleteAction: TableAction<User> = {
 *   id: 'delete',
 *   label: 'Delete Selected',
 *   icon: TrashIcon,
 *   variant: 'destructive',
 *   handler: async (selectedIds, selectedData) => {
 *     await Promise.all(
 *       selectedIds.map(id => deleteUser(id))
 *     );
 *   },
 *   confirmationDialog: {
 *     title: 'Delete Users',
 *     description: 'Are you sure you want to delete the selected users? This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     cancelLabel: 'Cancel',
 *     destructive: true
 *   },
 *   isVisible: (selectedIds, selectedData) => selectedIds.length > 0,
 *   isEnabled: (selectedIds, selectedData) => selectedIds.length > 0 && selectedData?.every(u => !u.isAdmin)
 * };
 * ```
 */
export interface TableAction<TData = unknown> {
  /** Unique identifier for the action */
  id: string;

  /** Display label for the action */
  label: string;

  /** Icon component to display (optional) */
  icon?: IconComponent;

  /** Visual variant for the action button */
  variant?: ActionVariant;

  /** Action handler function */
  handler: ActionHandler<TData>;

  /** Confirmation dialog configuration (optional) */
  confirmationDialog?: ActionConfirmationConfig;

  /** Function to determine if action is visible */
  isVisible?: ActionVisibility<TData>;

  /** Function to determine if action is enabled */
  isEnabled?: ActionEnabled<TData>;

  /** Additional metadata for the action */
  meta?: Record<string, unknown>;
}

/**
 * Configuration for table actions system.
 *
 * Provides global settings for the actions feature.
 */
export interface ActionsConfig {
  /** Whether to show selected count in the toolbar */
  showSelectedCount?: boolean;

  /** Custom text for selected count (supports {count} placeholder) */
  selectedCountText?: string;

  /** Whether to show toast notifications on action completion */
  showToastNotifications?: boolean;

  /** Custom toast duration in milliseconds */
  toastDuration?: number;
}
