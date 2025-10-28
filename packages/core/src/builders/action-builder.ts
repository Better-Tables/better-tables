/**
 * @fileoverview Action builder class with fluent API for creating action definitions.
 *
 * This module provides the foundational action builder class that implements the fluent API
 * pattern for creating action definitions. It enables type-safe, declarative action configuration
 * with built-in support for confirmations, visibility control, and handler registration.
 *
 * @module builders/action-builder
 */

import type {
  ActionConfirmationConfig,
  ActionEnabled,
  ActionHandler,
  ActionVariant,
  ActionVisibility,
  TableAction,
} from '../types/action';
import type { IconComponent } from '../types/common';

/**
 * Action builder class with fluent API.
 *
 * Provides the builder pattern implementation for creating action definitions
 * with a fluent, chainable API. Supports validation, conditional visibility,
 * confirmation dialogs, and handler registration.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * // Create a basic delete action
 * const deleteAction = new ActionBuilder<User>()
 *   .id('delete')
 *   .label('Delete Selected')
 *   .icon(TrashIcon)
 *   .variant('destructive')
 *   .confirmationDialog({
 *     title: 'Delete Users',
 *     description: 'Are you sure you want to delete the selected users?',
 *     confirmLabel: 'Delete',
 *     destructive: true
 *   })
 *   .handler(async (selectedIds, selectedData) => {
 *     await Promise.all(selectedIds.map(id => deleteUser(id)));
 *   })
 *   .build();
 *
 * // Create an action with conditional visibility
 * const archiveAction = new ActionBuilder<User>()
 *   .id('archive')
 *   .label('Archive')
 *   .isVisible((selectedIds) => selectedIds.length > 0)
 *   .isEnabled((selectedIds, selectedData) => {
 *     return selectedData?.every(user => user.status !== 'archived') ?? false;
 *   })
 *   .handler(async (selectedIds) => {
 *     await archiveUsers(selectedIds);
 *   })
 *   .build();
 * ```
 */
export class ActionBuilder<TData = unknown> {
  protected config: Partial<TableAction<TData>>;

  /**
   * Create a new action builder instance.
   *
   * Initializes the action builder with sensible defaults while allowing
   * customization through the fluent API methods.
   *
   * @example
   * ```typescript
   * const builder = new ActionBuilder<User>();
   * ```
   */
  constructor() {
    this.config = {
      variant: 'default',
    };
  }

  /**
   * Set the action identifier.
   *
   * Sets the unique identifier for the action. Must be unique within the table.
   *
   * @param id - Unique action identifier
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete-users')
   *   .label('Delete')
   *   .build();
   * ```
   */
  id(id: string): this {
    this.config.id = id;
    return this;
  }

  /**
   * Set the action display label.
   *
   * Sets the human-readable label that will be displayed on the action button.
   *
   * @param label - Display label for the action
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .label('Delete Selected Users')
   *   .build();
   * ```
   */
  label(label: string): this {
    this.config.label = label;
    return this;
  }

  /**
   * Set the action icon.
   *
   * Sets the icon component to display alongside the action label.
   *
   * @param icon - Icon component
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .label('Delete')
   *   .icon(TrashIcon)
   *   .build();
   * ```
   */
  icon(icon: IconComponent): this {
    this.config.icon = icon;
    return this;
  }

  /**
   * Set the action variant.
   *
   * Sets the visual variant for the action button to indicate its importance
   * and potential consequences (e.g., destructive actions).
   *
   * @param variant - Visual variant for the action
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .variant('destructive')
   *   .build();
   * ```
   */
  variant(variant: ActionVariant): this {
    this.config.variant = variant;
    return this;
  }

  /**
   * Set the action handler function.
   *
   * Sets the function that will be executed when the action is triggered.
   * The handler receives the selected row IDs and optionally the selected row data.
   *
   * @param handler - Action handler function
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .handler(async (selectedIds, selectedData) => {
   *     // Delete the selected users
   *     await Promise.all(
   *       selectedIds.map(id => deleteUser(id))
   *     );
   *   })
   *   .build();
   * ```
   */
  handler(handler: ActionHandler<TData>): this {
    this.config.handler = handler;
    return this;
  }

  /**
   * Set the confirmation dialog configuration.
   *
   * Configures a confirmation dialog that will be shown before executing the action.
   * This is particularly useful for destructive actions.
   *
   * @param config - Confirmation dialog configuration
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .confirmationDialog({
   *     title: 'Delete Users',
   *     description: 'Are you sure you want to delete {count} user(s)? This action cannot be undone.',
   *     confirmLabel: 'Delete',
   *     cancelLabel: 'Cancel',
   *     destructive: true
   *   })
   *   .build();
   * ```
   */
  confirmationDialog(config: ActionConfirmationConfig): this {
    this.config.confirmationDialog = config;
    return this;
  }

  /**
   * Set the visibility check function.
   *
   * Sets a function that determines whether the action should be visible
   * based on the current selection. By default, actions are always visible.
   *
   * @param isVisible - Function to determine visibility
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .isVisible((selectedIds) => selectedIds.length > 0)
   *   .build();
   *
   * // Or with more complex logic
   * const action = new ActionBuilder<User>()
   *   .id('archive')
   *   .isVisible((selectedIds, selectedData) => {
   *     return selectedData?.some(user => user.status !== 'archived') ?? false;
   *   })
   *   .build();
   * ```
   */
  isVisible(isVisible: ActionVisibility): this {
    this.config.isVisible = isVisible;
    return this;
  }

  /**
   * Set the enabled check function.
   *
   * Sets a function that determines whether the action button should be enabled
   * based on the current selection. By default, actions are always enabled.
   *
   * @param isEnabled - Function to determine if action is enabled
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('activate')
   *   .isEnabled((selectedIds, selectedData) => {
   *     return selectedData?.every(user => user.status === 'inactive') ?? false;
   *   })
   *   .build();
   * ```
   */
  isEnabled(isEnabled: ActionEnabled): this {
    this.config.isEnabled = isEnabled;
    return this;
  }

  /**
   * Set action metadata.
   *
   * Sets additional metadata for the action. This can be used to store
   * custom information that may be useful for action handling logic.
   *
   * @param meta - Metadata object
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('export')
   *   .meta({ requiresPermission: 'export', logLevel: 'info' })
   *   .build();
   * ```
   */
  meta(meta: Record<string, unknown>): this {
    this.config.meta = meta;
    return this;
  }

  /**
   * Build the final action definition.
   *
   * Creates and returns the complete action definition object with all configured
   * properties. This method should be called last in the builder chain.
   *
   * @returns Complete action definition
   * @throws {Error} If required properties are missing
   *
   * @example
   * ```typescript
   * const action = new ActionBuilder<User>()
   *   .id('delete')
   *   .label('Delete Selected')
   *   .handler(async (ids) => { await deleteUsers(ids); })
   *   .build();
   *
   * // Use the action definition
   * const tableConfig: TableConfig<User> = {
   *   id: 'users-table',
   *   columns: userColumns,
   *   actions: [action],
   *   adapter: userAdapter
   * };
   * ```
   */
  build(): TableAction<TData> {
    this.validateConfig();
    return this.config as TableAction<TData>;
  }

  /**
   * Validate the action configuration.
   *
   * Ensures all required properties are present before building.
   */
  protected validateConfig(): void {
    if (!this.config.id) {
      throw new Error('Action ID is required. Use .id() to set the action identifier.');
    }
    if (!this.config.label) {
      throw new Error('Action label is required. Use .label() to set the action display name.');
    }
    if (!this.config.handler) {
      throw new Error(
        'Action handler is required. Use .handler() to set the action handler function.'
      );
    }
  }

  /**
   * Get the current configuration (for debugging).
   */
  protected getConfig(): Partial<TableAction<TData>> {
    return { ...this.config };
  }
}
