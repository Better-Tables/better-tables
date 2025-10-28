/**
 * @fileoverview Factory utilities for creating action builders and built-in actions.
 *
 * This module provides factory functions for creating action builders and
 * pre-configured common actions like delete.
 *
 * @module builders/action-factory
 */

import type { ActionHandler, TableAction } from '../types/action';
import type { IconComponent } from '../types/common';
import { ActionBuilder } from './action-builder';

/**
 * Factory function for creating a new action builder instance.
 *
 * Provides a convenient way to create action builders without directly
 * instantiating the class. Enables type inference and better ergonomics.
 *
 * @template TData - The type of row data
 * @returns New action builder instance
 *
 * @example
 * ```typescript
 * const builder = createActionBuilder<User>();
 *
 * const deleteAction = builder
 *   .id('delete')
 *   .label('Delete Selected')
 *   .handler(async (ids) => { await deleteUsers(ids); })
 *   .build();
 * ```
 */
export function createActionBuilder<TData = unknown>(): ActionBuilder<TData> {
  return new ActionBuilder<TData>();
}

/**
 * Create a pre-configured delete action.
 *
 * Provides a common pattern for delete actions with destructive variant,
 * confirmation dialog, and standard delete semantics.
 *
 * @template TData - The type of row data
 * @param config - Delete action configuration
 * @returns Configured delete action
 *
 * @example
 * ```typescript
 * const deleteAction = deleteActionBuilder<User>({
 *   label: 'Delete Users',
 *   icon: TrashIcon,
 *   handler: async (selectedIds) => {
 *     await Promise.all(selectedIds.map(id => deleteUser(id)));
 *   }
 * });
 * ```
 */
export function deleteAction<TData = unknown>(config: {
  /** Display label for the delete action */
  label?: string;
  /** Icon component for the delete action */
  icon?: IconComponent;
  /** Delete handler function */
  handler: ActionHandler<TData>;
  /** Custom confirmation dialog configuration */
  confirmation?: {
    title?: string;
    description?: string;
    confirmLabel?: string;
  };
}): TableAction<TData> {
  const builder = new ActionBuilder<TData>()
    .id('delete')
    .label(config.label || 'Delete Selected')
    .variant('destructive');

  if (config.icon) {
    builder.icon(config.icon);
  }

  if (config.confirmation) {
    builder.confirmationDialog({
      title: config.confirmation.title || 'Delete Selected',
      description:
        config.confirmation.description ||
        'Are you sure you want to delete the selected items? This action cannot be undone.',
      confirmLabel: config.confirmation.confirmLabel || 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
  } else {
    // Default confirmation
    builder.confirmationDialog({
      title: 'Delete Selected',
      description:
        'Are you sure you want to delete the selected items? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
  }

  builder.handler(config.handler);

  return builder.build();
}

/**
 * Helper to create multiple action builders at once.
 *
 * Useful for defining multiple actions in a single expression.
 *
 * @template TData - The type of row data
 * @returns Array of action builders
 *
 * @example
 * ```typescript
 * const [deleteBuilder, exportBuilder] = createActionBuilders<User>(2);
 *
 * const deleteAction = deleteBuilder
 *   .id('delete')
 *   .label('Delete')
 *   .build();
 *
 * const exportAction = exportBuilder
 *   .id('export')
 *   .label('Export')
 *   .build();
 * ```
 */
export function createActionBuilders<TData = unknown>(count: number): ActionBuilder<TData>[] {
  return Array.from({ length: count }, () => new ActionBuilder<TData>());
}
