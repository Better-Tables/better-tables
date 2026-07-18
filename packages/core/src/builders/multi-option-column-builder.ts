/**
 * @fileoverview Multi-option column builder for multi-select columns.
 *
 * This module provides a specialized column builder for multi-select option columns,
 * including tags, categories, roles, and validation configurations.
 *
 * @module builders/multi-option-column-builder
 */

import type { FilterConfig, FilterOption } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Multi-option column builder for multi-select columns.
 *
 * Extends the base column builder with specialized methods for multi-select
 * option columns, including tags, categories, roles, and validation configurations.
 *
 * @template TData - The type of row data
 * @template TValue - The type of column value (defaults to `string[]`; narrowed by `.accessor()`)
 *
 * @example
 * ```typescript
 * const tagsColumn = new MultiOptionColumnBuilder<Article>()
 *   .id('tags')
 *   .displayName('Tags')
 *   .accessor(article => article.tags)
 *   .tags([
 *     { value: 'javascript', label: 'JavaScript', color: 'yellow' },
 *     { value: 'react', label: 'React', color: 'blue' }
 *   ], { allowCreate: true, maxTags: 5 })
 *   .showBadges({ removable: true })
 *   .build();
 * ```
 */
export class MultiOptionColumnBuilder<
  TData = unknown,
  TValue extends string[] = string[],
  TId extends string = string,
> extends ColumnBuilder<TData, TValue, TId> {
  constructor() {
    super('multiOption');
  }

  /**
   * Set the column identifier.
   *
   * Rebinds the builder's id type to the literal passed in, so subsequent
   * chained methods (and `build()`) see the narrowed id type.
   *
   * @param id - Unique column identifier
   * @returns A `MultiOptionColumnBuilder` rebound to the id literal
   */
  override id<const K extends string>(id: K): MultiOptionColumnBuilder<TData, TValue, K> {
    return super.id(id) as unknown as MultiOptionColumnBuilder<TData, TValue, K>;;
  }

  /**
   * Set the data accessor function.
   *
   * Rebinds the builder's value type to the accessor's return type, so
   * subsequent chained methods see the narrowed string array type.
   * Constraining `V` to the current `TValue` (rather than plain `string[]`)
   * means that if `.options()` was already called, an accessor whose return
   * type isn't assignable to the option elements' literal union array is a
   * compile error — mismatches surface regardless of call order.
   *
   * @param accessor - Function that extracts the column value from row data
   * @returns A `MultiOptionColumnBuilder` rebound to the accessor's return type
   */
  override accessor<V extends TValue>(
    accessor: (data: TData) => V
  ): MultiOptionColumnBuilder<TData, V, TId> {
    return super.accessor(accessor) as unknown as MultiOptionColumnBuilder<TData, V, TId>;;
  }

  /**
   * Set available options for the multi-select column.
   *
   * Configures the available options for multi-select filtering
   * with validation, search capabilities, and selection limits.
   *
   * @param options - Array of available filter options. `V` is the *element* type
   * (each option's `value`), inferred as a `const` literal union (TS >= 5.0) so it
   * doesn't widen to `string`. The returned builder's value type is rebound to `V[]`.
   * @param config - Multi-option configuration settings
   * @returns A `MultiOptionColumnBuilder` rebound to `V[]`, the array of the option values
   *
   * @example
   * ```typescript
   * const skillsColumn = new MultiOptionColumnBuilder<Developer>()
   *   .id('skills')
   *   .displayName('Skills')
   *   .accessor(developer => developer.skills)
   *   .options([
   *     { value: 'javascript', label: 'JavaScript', color: 'yellow' },
   *     { value: 'python', label: 'Python', color: 'green' },
   *     { value: 'react', label: 'React', color: 'blue' }
   *   ], {
   *     includeNull: false,
   *     searchable: true,
   *     maxSelections: 10,
   *     minSelections: 1,
   *     placeholder: 'Select skills...'
   *   })
   *   .build();
   * ```
   */
  options<const V extends TValue[number]>(
    options: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: V[]) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
      /** Maximum number of selections allowed */
      maxSelections?: number;
      /** Minimum number of selections required */
      minSelections?: number;
    } = {}
  ): MultiOptionColumnBuilder<TData, V[], TId> {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      maxSelections,
      minSelections,
    } = config;

    const filterConfig: FilterConfig<V[]> = {
      operators: [
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ],
      options: [...options],
      includeNull,
      ...(validation !== undefined && { validation }),
    };

    this.config.filter = { ...this.config.filter, ...filterConfig } as FilterConfig<TValue>;
    this.config.meta = {
      ...this.config.meta,
      options: {
        searchable,
        placeholder,
        values: options,
        maxSelections,
        minSelections,
      },
    };
    return this as unknown as MultiOptionColumnBuilder<TData, V[], TId>;
  }

  /**
   * Set specific multi-option operators for filtering.
   *
   * Configures which multi-option filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of multi-option filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const categoriesColumn = new MultiOptionColumnBuilder<Product>()
   *   .id('categories')
   *   .displayName('Categories')
   *   .accessor(product => product.categories)
   *   .multiOptionOperators(['includes', 'excludes', 'includesAny'])
   *   .build();
   * ```
   */
  multiOptionOperators(
    operators: Array<
      'includes' | 'excludes' | 'includesAny' | 'includesAll' | 'excludesAny' | 'excludesAll'
    >
  ): this {
    return this.applyOperators(operators);
  }

  /**
   * Load options from an async source for multi-select.
   *
   * Configures the column to load options dynamically from an async source,
   * useful for large datasets or when options change frequently.
   *
   * @param optionsLoader - Function that returns a promise of options
   * @param config - Async multi-option configuration settings
   * @returns A `MultiOptionColumnBuilder` rebound to `V[]`, the array of the option values
   *
   * @example
   * ```typescript
   * const permissionsColumn = new MultiOptionColumnBuilder<User>()
   *   .id('permissions')
   *   .displayName('Permissions')
   *   .accessor(user => user.permissions)
   *   .asyncOptions(
   *     () => fetch('/api/permissions').then(res => res.json()),
   *     {
   *       searchable: true,
   *       maxSelections: 20,
   *       placeholder: 'Select permissions...',
   *       loadingPlaceholder: 'Loading permissions...'
   *     }
   *   )
   *   .build();
   * ```
   */
  asyncOptions<V extends TValue[number]>(
    optionsLoader: () => Promise<FilterOption<V>[]>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: V[]) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
      /** Loading placeholder text */
      loadingPlaceholder?: string;
      /** Maximum number of selections allowed */
      maxSelections?: number;
      /** Minimum number of selections required */
      minSelections?: number;
    } = {}
  ): MultiOptionColumnBuilder<TData, V[], TId> {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      loadingPlaceholder = 'Loading options...',
      maxSelections,
      minSelections,
    } = config;

    const filterConfig: FilterConfig<V[]> = {
      operators: [
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ],
      includeNull,
      ...(validation !== undefined && { validation }),
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
        maxSelections,
        minSelections,
      },
    };
    return this as unknown as MultiOptionColumnBuilder<TData, V[], TId>;
  }

  /**
   * Configure as tags column.
   *
   * Sets up the column for tag-based multi-selection with optional
   * tag creation and count display capabilities.
   *
   * @param tags - Array of available tag options
   * @param config - Tags configuration settings
   * @returns A `MultiOptionColumnBuilder` rebound to the array of the tag values
   *
   * @example
   * ```typescript
   * const tagsColumn = new MultiOptionColumnBuilder<Article>()
   *   .id('tags')
   *   .displayName('Tags')
   *   .accessor(article => article.tags)
   *   .tags([
   *     { value: 'javascript', label: 'JavaScript', color: 'yellow' },
   *     { value: 'react', label: 'React', color: 'blue' },
   *     { value: 'typescript', label: 'TypeScript', color: 'blue' }
   *   ], {
   *     allowCreate: true,
   *     maxTags: 5,
   *     minTags: 1,
   *     searchable: true
   *   })
   *   .build();
   * ```
   */
  tags<const V extends TValue[number]>(
    tags: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Whether to allow searching through tags (default: true) */
      searchable?: boolean;
      /** Whether to allow creating new tags (default: false) */
      allowCreate?: boolean;
      /** Maximum number of tags allowed */
      maxTags?: number;
      /** Minimum number of tags required */
      minTags?: number;
    } = {}
  ): MultiOptionColumnBuilder<TData, V[], TId> {
    const {
      includeNull = false,
      searchable = true,
      allowCreate = false,
      maxTags,
      minTags,
    } = config;

    this.options(tags, {
      includeNull,
      searchable,
      ...(maxTags !== undefined && { maxSelections: maxTags }),
      ...(minTags !== undefined && { minSelections: minTags }),
    });

    this.config.meta = {
      ...this.config.meta,
      tags: {
        allowCreate,
        showCount: true,
      },
    };
    return this as unknown as MultiOptionColumnBuilder<TData, V[], TId>;
  }

  /**
   * Configure as categories column (hierarchical)
   *
   * @returns A `MultiOptionColumnBuilder` rebound to the array of the category values
   */
  categories<const V extends TValue[number]>(
    categories: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Whether to allow searching through categories (default: true) */
      searchable?: boolean;
      /** Whether to show category hierarchy (default: true) */
      showHierarchy?: boolean;
      /** Maximum number of categories allowed */
      maxCategories?: number;
    } = {}
  ): MultiOptionColumnBuilder<TData, V[], TId> {
    const { includeNull = false, searchable = true, showHierarchy = true, maxCategories } = config;

    this.options(categories, {
      includeNull,
      searchable,
      ...(maxCategories !== undefined && { maxSelections: maxCategories }),
    });

    this.config.meta = {
      ...this.config.meta,
      categories: {
        showHierarchy,
        showIcons: true,
      },
    };
    return this as unknown as MultiOptionColumnBuilder<TData, V[], TId>;
  }

  /**
   * Configure as roles/permissions column
   *
   * @returns A `MultiOptionColumnBuilder` rebound to the array of the role values
   */
  roles<const V extends TValue[number]>(
    roles: ReadonlyArray<FilterOption<V>>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Whether to allow searching through roles (default: true) */
      searchable?: boolean;
      /** Whether to show role descriptions (default: true) */
      showDescriptions?: boolean;
      /** Maximum number of roles allowed */
      maxRoles?: number;
    } = {}
  ): MultiOptionColumnBuilder<TData, V[], TId> {
    const { includeNull = false, searchable = true, showDescriptions = true, maxRoles } = config;

    this.options(roles, {
      includeNull,
      searchable,
      ...(maxRoles !== undefined && { maxSelections: maxRoles }),
    });

    this.config.meta = {
      ...this.config.meta,
      roles: {
        showDescriptions,
        showBadges: true,
      },
    };
    return this as unknown as MultiOptionColumnBuilder<TData, V[], TId>;
  }

  /**
   * Set display format for multiple values.
   *
   * Configures how multiple selected values are displayed in the column,
   * including chips, comma-separated, count, or first-item formats.
   *
   * @param format - Display format configuration
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const skillsColumn = new MultiOptionColumnBuilder<Developer>()
   *   .id('skills')
   *   .displayName('Skills')
   *   .accessor(developer => developer.skills)
   *   .displayFormat({
   *     type: 'chips',
   *     maxVisible: 3,
   *     truncateText: '+{count} more'
   *   })
   *   .build();
   * ```
   */
  displayFormat(format: {
    /** How to display multiple values (default: 'chips') */
    type: 'chips' | 'comma' | 'count' | 'first';
    /** Maximum number of items to show before truncating (default: 3) */
    maxVisible?: number;
    /** Text to show when truncated (default: '+{count} more') */
    truncateText?: string;
    /** Separator for comma format (default: ', ') */
    separator?: string;
  }): this {
    const {
      type = 'chips',
      maxVisible = 3,
      truncateText = '+{count} more',
      separator = ', ',
    } = format;

    this.config.meta = {
      ...this.config.meta,
      display: {
        type,
        maxVisible,
        truncateText,
        separator,
      },
    };
    return this;
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
      /** Whether to show remove button on badges (default: true) */
      removable?: boolean;
    } = {}
  ): this {
    const { variant = 'default', showColors = true, showIcons = true, removable = true } = config;

    this.config.meta = {
      ...this.config.meta,
      display: {
        ...((this.config.meta?.display as Record<string, unknown>) || {}),
        type: 'chips',
        variant,
        showColors,
        showIcons,
        removable,
      },
    };
    return this;
  }

  /**
   * Set validation rules for multi-select
   */
  validate(config: {
    /** Maximum number of selections allowed */
    maxSelections?: number;
    /** Minimum number of selections required */
    minSelections?: number;
    /** Custom validation function */
    custom?: (values: string[]) => boolean | string;
  }): this {
    const { maxSelections, minSelections, custom } = config;

    this.config.meta = {
      ...this.config.meta,
      validation: {
        maxSelections,
        minSelections,
        custom,
      },
    };
    return this;
  }
}
