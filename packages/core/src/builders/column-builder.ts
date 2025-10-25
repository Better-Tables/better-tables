/**
 * @fileoverview Base column builder class with fluent API for creating column definitions.
 *
 * This module provides the foundational column builder class that implements the fluent API
 * pattern for creating column definitions. All specialized column builders extend this base
 * class to inherit common functionality while adding type-specific features.
 *
 * @module builders/column-builder
 */

import type { ReactNode } from 'react';
import type {
  CellRendererProps,
  ColumnDefinition,
  ColumnType,
  HeaderRendererProps,
  ValidationRule,
} from '../types/column';
import type { IconComponent } from '../types/common';
import type { FilterConfig } from '../types/filter';

/**
 * Base column builder class with fluent API.
 *
 * Provides the foundational builder pattern implementation for creating column definitions
 * with a fluent, chainable API. All specialized column builders extend this class to inherit
 * common functionality while adding type-specific features and validation.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value
 *
 * @example
 * ```typescript
 * // Create a basic text column
 * const nameColumn = new ColumnBuilder<User, string>('text')
 *   .id('name')
 *   .displayName('Full Name')
 *   .accessor(user => `${user.firstName} ${user.lastName}`)
 *   .sortable()
 *   .filterable()
 *   .width(200)
 *   .build();
 *
 * // Create a custom column with renderers
 * const statusColumn = new ColumnBuilder<User, string>('custom')
 *   .id('status')
 *   .displayName('Status')
 *   .accessor(user => user.status)
 *   .cellRenderer(({ value }) => (
 *     <span className={`status-${value}`}>{value}</span>
 *   ))
 *   .headerRenderer(({ column }) => (
 *     <div className="status-header">
 *       <Icon name="status" />
 *       {column.displayName}
 *     </div>
 *   ))
 *   .build();
 * ```
 */
export class ColumnBuilder<TData = unknown, TValue = unknown> {
  protected config: Partial<ColumnDefinition<TData, TValue>>;

  /**
   * Create a new column builder instance.
   *
   * Initializes the column builder with the specified column type and default configuration.
   * The builder will use sensible defaults for common properties while allowing customization
   * through the fluent API methods.
   *
   * @param type - The column type (text, number, date, boolean, option, multiOption, custom, json)
   *
   * @example
   * ```typescript
   * const builder = new ColumnBuilder<User, string>('text');
   * ```
   */
  constructor(type: ColumnType) {
    this.config = {
      type,
      sortable: true,
      filterable: true,
      resizable: true,
      align: 'left',
      nullable: false,
    };
  }

  /**
   * Set the column identifier.
   *
   * Sets the unique identifier for the column. This ID is used for sorting, filtering,
   * and other operations. Must be unique within the table.
   *
   * @param id - Unique column identifier
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const column = new ColumnBuilder<User, string>('text')
   *   .id('userName')
   *   .displayName('User Name')
   *   .build();
   * ```
   */
  id(id: string): this {
    this.config.id = id;
    return this;
  }

  /**
   * Set the column display name
   */
  displayName(displayName: string): this {
    this.config.displayName = displayName;
    return this;
  }

  /**
   * Set the data accessor function.
   *
   * Sets the function that extracts the column value from row data. This function
   * is called for each row to get the value to display, sort, and filter.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const column = new ColumnBuilder<User, string>('text')
   *   .id('fullName')
   *   .displayName('Full Name')
   *   .accessor(user => `${user.firstName} ${user.lastName}`)
   *   .build();
   * ```
   */
  accessor(accessor: (data: TData) => TValue): this {
    this.config.accessor = accessor;
    return this;
  }

  /**
   * Set a nullable accessor that handles null/undefined values gracefully
   */
  nullableAccessor(
    accessor: (data: TData) => TValue | null | undefined,
    defaultValue?: TValue
  ): this {
    this.config.nullable = true;
    this.config.accessor = (data: TData) => {
      const value = accessor(data);
      return value ?? defaultValue ?? (null as TValue);
    };
    return this;
  }

  /**
   * Set the column icon
   */
  icon(icon: IconComponent): this {
    this.config.icon = icon;
    return this;
  }

  /**
   * Configure column sorting
   */
  sortable(sortable = true): this {
    this.config.sortable = sortable;
    return this;
  }

  /**
   * Configure column filtering
   */
  filterable(filterable = true, filterConfig?: FilterConfig<TValue>): this {
    this.config.filterable = filterable;
    if (filterConfig) {
      this.config.filter = filterConfig;
    }
    return this;
  }

  /**
   * Configure column resizing
   */
  resizable(resizable = true): this {
    this.config.resizable = resizable;
    return this;
  }

  /**
   * Set column width properties
   */
  width(width: number, minWidth?: number, maxWidth?: number): this {
    this.config.width = width;
    if (minWidth !== undefined) {
      this.config.minWidth = minWidth;
    }
    if (maxWidth !== undefined) {
      this.config.maxWidth = maxWidth;
    }
    return this;
  }

  /**
   * Set minimum column width
   */
  minWidth(minWidth: number): this {
    this.config.minWidth = minWidth;
    return this;
  }

  /**
   * Set maximum column width
   */
  maxWidth(maxWidth: number): this {
    this.config.maxWidth = maxWidth;
    return this;
  }

  /**
   * Set column alignment
   */
  align(align: 'left' | 'center' | 'right'): this {
    this.config.align = align;
    return this;
  }

  /**
   * Set custom cell renderer
   */
  cellRenderer(renderer: (props: CellRendererProps<TData, TValue>) => ReactNode): this {
    this.config.cellRenderer = renderer;
    return this;
  }

  /**
   * Set custom header renderer
   */
  headerRenderer(renderer: (props: HeaderRendererProps<TData>) => ReactNode): this {
    this.config.headerRenderer = renderer;
    return this;
  }

  /**
   * Add validation rules
   */
  validation(rules: ValidationRule<TValue>[]): this {
    this.config.validation = rules;
    return this;
  }

  /**
   * Set whether column supports null/undefined values
   */
  nullable(nullable = true): this {
    this.config.nullable = nullable;
    return this;
  }

  /**
   * Set column metadata
   */
  meta(meta: Record<string, unknown>): this {
    this.config.meta = { ...this.config.meta, ...meta };
    return this;
  }

  /**
   * Build the final column definition.
   *
   * Creates and returns the complete column definition object with all configured
   * properties. This method should be called last in the builder chain to finalize
   * the column configuration.
   *
   * @returns Complete column definition
   * @throws {Error} If required properties are missing
   *
   * @example
   * ```typescript
   * const column = new ColumnBuilder<User, string>('text')
   *   .id('name')
   *   .displayName('Full Name')
   *   .accessor(user => `${user.firstName} ${user.lastName}`)
   *   .sortable()
   *   .filterable()
   *   .width(200)
   *   .build();
   *
   * // Use the column definition
   * const columns = [column];
   * ```
   */
  build(): ColumnDefinition<TData, TValue> {
    this.validateConfig();
    return this.config as ColumnDefinition<TData, TValue>;
  }

  /**
   * Validate the column configuration
   */
  protected validateConfig(): void {
    if (!this.config.id) {
      throw new Error('Column ID is required. Use .id() to set the column identifier.');
    }
    if (!this.config.displayName) {
      throw new Error(
        'Column display name is required. Use .displayName() to set the column display name.'
      );
    }
    if (!this.config.accessor) {
      throw new Error(
        'Column accessor is required. Use .accessor() to set the data accessor function.'
      );
    }
    if (!this.config.type) {
      throw new Error(
        'Column type is required. This should be set by the specific column builder.'
      );
    }
  }

  /**
   * Get the current configuration (for debugging)
   */
  protected getConfig(): Partial<ColumnDefinition<TData, TValue>> {
    return { ...this.config };
  }
}
