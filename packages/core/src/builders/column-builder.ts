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
  EditableConfig,
  HeaderRendererProps,
  ValidationRule,
} from '../types/column';
import type { IconComponent } from '../types/common';
import type { DerivedColumnSpec } from '../types/derived';
import type { FilterConfig, FilterOperator } from '../types/filter';

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
export class ColumnBuilder<TData = unknown, TValue = unknown, TId extends string = string> {
  protected config: Partial<ColumnDefinition<TData, TValue, TId>>;

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
    // Client-only custom/computed columns have no DB backing — honest
    // defaults suppress filter/sort until the caller opts in (plan 060).
    const isCustom = type === 'custom';
    this.config = {
      type,
      sortable: !isCustom,
      filterable: !isCustom,
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
  id<const K extends string>(id: K): ColumnBuilder<TData, TValue, K> {
    this.config.id = id as unknown as TId;
    return this as unknown as ColumnBuilder<TData, TValue, K>;
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
   * is called for each row to get the value to display, sort, and filter. The
   * builder's value type is inferred from (and rebound to) the accessor's return
   * type, so subsequent chained methods (e.g. `cellRenderer`, `filterable`) see
   * the narrowed type rather than the original `TValue`.
   *
   * **Accessor constraint policy:** the base uses `V extends TValue` — the
   * accessor's return type must be assignable to the builder's current value
   * type. Value-family builders (text/number/date/boolean) override with a
   * primitive-family bound (`V extends string`, etc.) when `TValue` is still the
   * column default. Option and multi-option builders keep `V extends TValue`
   * because `.options()` narrows `TValue` to a literal union and the accessor
   * must stay consistent with declared option values.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns A builder rebound to the accessor's return type, for method chaining
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
  accessor<V extends TValue>(accessor: (data: TData) => V): ColumnBuilder<TData, V, TId> {
    this.config.accessor = accessor as unknown as (data: TData) => TValue;
    return this as unknown as ColumnBuilder<TData, V, TId>;
  }

  /**
   * Set a nullable accessor that handles null/undefined values gracefully
   * @deprecated Use `.accessorWithDefault()` instead
   */
  nullableAccessor(
    accessor: (data: TData) => TValue | null | undefined,
    defaultValue?: TValue
  ): this {
    return this.accessorWithDefault(accessor, defaultValue);
  }

  /**
   * Set an accessor with a default value for null/undefined results.
   *
   * Automatically sets the column as nullable and provides a default value
   * that will be used when the accessor returns null or undefined.
   *
   * @param accessor - Function that extracts the column value (may return null/undefined)
   * @param defaultValue - Value to use when accessor returns null/undefined
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const column = new ColumnBuilder<User, number>('number')
   *   .id('age')
   *   .displayName('Age')
   *   .accessorWithDefault((user) => user.age, 0)  // Use 0 if age is null/undefined
   *   .build();
   * ```
   */
  accessorWithDefault(
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
   * Set whether column can be hidden via context menu
   */
  hideable(hideable = true): this {
    this.config.hideable = hideable;
    return this;
  }

  /**
   * Set whether column is visible by default
   */
  defaultVisible(visible: boolean): this {
    this.config.defaultVisible = visible;
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
   * Enable inline editing for this column. `editable()` uses defaults;
   * pass a config for per-row gating, field mapping, or a custom editor.
   */
  editable(config: boolean | EditableConfig<TData, TValue> = true): this {
    this.config.editable = config;
    return this;
  }

  /**
   * Set whether column supports null/undefined values
   * @deprecated Use `.normalizeEmptyToNull()` instead for clearer intent
   */
  nullable(nullable = true): this {
    return this.normalizeEmptyToNull(nullable);
  }

  /**
   * Configure column to normalize empty values to null.
   *
   * When enabled, the accessor will convert empty strings ('') and undefined
   * values to null during the build process. This is useful for columns where
   * you want to treat "no value" consistently as null rather than empty string.
   *
   * @param normalize - Whether to normalize empty values to null (default: true)
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const column = new ColumnBuilder<User, string>('text')
   *   .id('bio')
   *   .displayName('Bio')
   *   .accessor(user => user.bio || '')
   *   .normalizeEmptyToNull(true)  // Converts '' and undefined to null
   *   .build();
   * ```
   */
  normalizeEmptyToNull(normalize = true): this {
    this.config.nullable = normalize;
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
   * Attach a server-derived column spec (plan 060 aggregates).
   */
  derived(spec: DerivedColumnSpec): this {
    this.config.derived = spec;
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
  build(): ColumnDefinition<TData, TValue, TId> {
    this.validateConfig();

    // If nullable is true, wrap the accessor to convert empty strings to null
    if (this.config.nullable && this.config.accessor) {
      const originalAccessor = this.config.accessor;
      this.config.accessor = (data: TData) => {
        const value = originalAccessor(data);
        // Convert empty strings to null for nullable columns
        if (value === '' || value === undefined) {
          return null as TValue;
        }
        return value;
      };
    }

    return this.config as ColumnDefinition<TData, TValue, TId>;
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
  protected getConfig(): Partial<ColumnDefinition<TData, TValue, TId>> {
    return { ...this.config };
  }

  /**
   * Apply a typed operator list to the column's filter config.
   *
   * Shared implementation for per-type `*Operators()` setters on specialized
   * builders; public methods keep their own operator-union parameter types.
   */
  protected applyOperators(operators: readonly string[]): this {
    this.config.filter = { ...this.config.filter, operators: [...operators] as FilterOperator[] };
    return this;
  }
}
