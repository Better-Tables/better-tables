/**
 * @fileoverview Option column builder for single-select dropdown columns.
 *
 * This module provides a specialized column builder for single-select option columns,
 * including predefined status/priority configurations and async option loading.
 *
 * @module builders/option-column-builder
 */

import type { FilterConfig, FilterOption } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/** Default priority levels used by `.priority()` when called with no arguments. */
const DEFAULT_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'gray', order: 1 },
  { value: 'medium', label: 'Medium', color: 'yellow', order: 2 },
  { value: 'high', label: 'High', color: 'red', order: 3 },
] as const;

/**
 * Option column builder for single-select dropdown columns.
 *
 * Extends the base column builder with specialized methods for single-select
 * option columns, including status, priority, and category configurations.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value (defaults to `string`; narrowed by `.accessor()`)
 *
 * @example
 * ```typescript
 * const statusColumn = new OptionColumnBuilder<User>()
 *   .id('status')
 *   .displayName('Status')
 *   .accessor(user => user.status)
 *   .status([
 *     { value: 'active', label: 'Active', color: 'green' },
 *     { value: 'inactive', label: 'Inactive', color: 'red' }
 *   ])
 *   .showBadges({ variant: 'default' })
 *   .build();
 * ```
 */
export class OptionColumnBuilder<
  TData = unknown,
  TValue extends string = string,
  TId extends string = string,
> extends ColumnBuilder<TData, TValue, TId> {
  constructor() {
    super('option');
  }

  /**
   * Set the column identifier.
   *
   * Rebinds the builder's id type to the literal passed in, so subsequent
   * chained methods (and `build()`) see the narrowed id type.
   *
   * @param id - Unique column identifier
   * @returns An `OptionColumnBuilder` rebound to the id literal
   */
  override id<const K extends string>(id: K): OptionColumnBuilder<TData, TValue, K> {
    this.config.id = id as unknown as TId;
    return this as unknown as OptionColumnBuilder<TData, TValue, K>;
  }

  /**
   * Set the data accessor function.
   *
   * Rebinds the builder's value type to the accessor's return type, so
   * subsequent chained methods see the narrowed string type. Constraining
   * `V` to the current `TValue` (rather than plain `string`) means that if
   * `.options()` was already called, an accessor whose return type isn't
   * assignable to the option values' literal union is a compile error —
   * mismatches surface regardless of call order.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns An `OptionColumnBuilder` rebound to the accessor's return type
   */
  override accessor<V extends TValue>(
    accessor: (data: TData) => V
  ): OptionColumnBuilder<TData, V, TId> {
    this.config.accessor = accessor as unknown as (data: TData) => TValue;
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Set available options for the column.
   *
   * Configures the available options for single-select filtering
   * with validation, search capabilities, and placeholder text.
   *
   * @param options - Array of available filter options. Passed as a `const`-inferred
   * array (TS >= 5.0), so literal option values narrow the returned builder's value
   * type without needing an `as const` at the call site.
   * @param config - Option configuration settings
   * @returns An `OptionColumnBuilder` rebound to the union of the option values
   *
   * @example
   * ```typescript
   * const departmentColumn = new OptionColumnBuilder<Employee>()
   *   .id('department')
   *   .displayName('Department')
   *   .accessor(employee => employee.department)
   *   .options([
   *     { value: 'engineering', label: 'Engineering', color: 'blue' },
   *     { value: 'marketing', label: 'Marketing', color: 'purple' },
   *     { value: 'sales', label: 'Sales', color: 'green' }
   *   ], {
   *     includeNull: false,
   *     searchable: true,
   *     placeholder: 'Select department...'
   *   })
   *   .build();
   * ```
   */
  options<const V extends TValue>(
    options: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: V) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
    } = {}
  ): OptionColumnBuilder<TData, V, TId> {
    const { includeNull = false, validation, searchable = true, placeholder } = config;

    const filterConfig: FilterConfig<V> = {
      operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf'],
      options: [...options],
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig } as FilterConfig<TValue>;
    this.config.meta = {
      ...this.config.meta,
      options: {
        searchable,
        placeholder,
        values: options,
      },
    };
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Set specific option operators for filtering.
   *
   * Configures which option-based filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of option filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const categoryColumn = new OptionColumnBuilder<Product>()
   *   .id('category')
   *   .displayName('Category')
   *   .accessor(product => product.category)
   *   .optionOperators(['is', 'isNot', 'isAnyOf'])
   *   .build();
   * ```
   */
  optionOperators(operators: Array<'is' | 'isNot' | 'isAnyOf' | 'isNoneOf'>): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Load options from an async source.
   *
   * Configures the column to load options dynamically from an async source,
   * useful for large datasets or when options change frequently.
   *
   * @param optionsLoader - Function that returns a promise of options
   * @param config - Async option configuration settings
   * @returns An `OptionColumnBuilder` rebound to the union of the option values
   *
   * @example
   * ```typescript
   * const countryColumn = new OptionColumnBuilder<User>()
   *   .id('country')
   *   .displayName('Country')
   *   .accessor(user => user.country)
   *   .asyncOptions(
   *     () => fetch('/api/countries').then(res => res.json()),
   *     {
   *       searchable: true,
   *       placeholder: 'Select country...',
   *       loadingPlaceholder: 'Loading countries...'
   *     }
   *   )
   *   .build();
   * ```
   */
  asyncOptions<V extends TValue>(
    optionsLoader: () => Promise<FilterOption<V>[]>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: V) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
      /** Loading placeholder text */
      loadingPlaceholder?: string;
    } = {}
  ): OptionColumnBuilder<TData, V, TId> {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      loadingPlaceholder = 'Loading options...',
    } = config;

    const filterConfig: FilterConfig<V> = {
      operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf'],
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig } as FilterConfig<TValue>;
    this.config.meta = {
      ...this.config.meta,
      options: {
        searchable,
        placeholder,
        loadingPlaceholder,
        async: true,
        optionsLoader,
      },
    };
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Configure as status column with predefined status options
   *
   * @returns An `OptionColumnBuilder` rebound to the union of the status values
   */
  status<const V extends TValue>(
    statuses: ReadonlyArray<{
      value: V;
      label: string;
      color: string;
    }>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Default status value */
      defaultValue?: V;
    } = {}
  ): OptionColumnBuilder<TData, V, TId> {
    const { includeNull = false, defaultValue } = config;

    const statusOptions: FilterOption<V>[] = statuses.map((status) => ({
      value: status.value,
      label: status.label,
      color: status.color,
    }));

    this.options(statusOptions, { includeNull });

    this.config.meta = {
      ...this.config.meta,
      status: {
        defaultValue,
        showBadge: true,
      },
    };
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Configure as priority column with predefined priority options
   *
   * @returns An `OptionColumnBuilder` rebound to the union of the priority values
   * (or unchanged `TValue` when called with no arguments, since no new literal
   * information is provided in that case)
   */
  priority<const V extends TValue = TValue>(
    priorities: ReadonlyArray<{
      value: V;
      label: string;
      color: string;
      order: number;
    }> = DEFAULT_PRIORITIES as unknown as ReadonlyArray<{
      value: V;
      label: string;
      color: string;
      order: number;
    }>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Default priority value */
      defaultValue?: V;
    } = {}
  ): OptionColumnBuilder<TData, V, TId> {
    const { includeNull = false, defaultValue } = config;

    const priorityOptions: FilterOption<V>[] = [...priorities]
      .sort((a, b) => a.order - b.order)
      .map((priority) => ({
        value: priority.value,
        label: priority.label,
        color: priority.color,
        meta: { order: priority.order },
      }));

    this.options(priorityOptions, { includeNull });

    this.config.meta = {
      ...this.config.meta,
      priority: {
        defaultValue,
        showBadge: true,
        sortByOrder: true,
      },
    };
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Configure as category column
   *
   * @returns An `OptionColumnBuilder` rebound to the union of the category values
   */
  category<const V extends TValue>(
    categories: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Whether to allow searching through categories (default: true) */
      searchable?: boolean;
      /** Whether to show category icons (default: true) */
      showIcons?: boolean;
    } = {}
  ): OptionColumnBuilder<TData, V, TId> {
    const { includeNull = false, searchable = true, showIcons = true } = config;

    this.options(categories, { includeNull, searchable });

    this.config.meta = {
      ...this.config.meta,
      category: {
        showIcons,
      },
    };
    return this as unknown as OptionColumnBuilder<TData, V, TId>;
  }

  /**
   * Enable option badges/chips display
   */
  showBadges(
    config: {
      /** Badge variant (default: 'default') */
      variant?: 'default' | 'secondary' | 'destructive' | 'outline';
      /** Whether to show option colors (default: true) */
      showColors?: boolean;
      /** Whether to show option icons (default: true) */
      showIcons?: boolean;
    } = {}
  ): this {
    const { variant = 'default', showColors = true, showIcons = true } = config;

    this.config.meta = {
      ...this.config.meta,
      display: {
        type: 'badge',
        variant,
        showColors,
        showIcons,
      },
    };
    return this;
  }
}
