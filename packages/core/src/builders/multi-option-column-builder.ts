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
export class MultiOptionColumnBuilder<TData = unknown> extends ColumnBuilder<TData, string[]> {
  constructor() {
    super('multiOption');
  }

  /**
   * Set available options for the multi-select column.
   *
   * Configures the available options for multi-select filtering
   * with validation, search capabilities, and selection limits.
   *
   * @param options - Array of available filter options
   * @param config - Multi-option configuration settings
   * @returns This builder instance for method chaining
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
  options(
    options: FilterOption[],
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: string[]) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
      /** Maximum number of selections allowed */
      maxSelections?: number;
      /** Minimum number of selections required */
      minSelections?: number;
    } = {}
  ): this {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      maxSelections,
      minSelections,
    } = config;

    const filterConfig: FilterConfig<string[]> = {
      operators: [
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ],
      options,
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };
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
    return this;
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
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Load options from an async source for multi-select.
   *
   * Configures the column to load options dynamically from an async source,
   * useful for large datasets or when options change frequently.
   *
   * @param optionsLoader - Function that returns a promise of options
   * @param config - Async multi-option configuration settings
   * @returns This builder instance for method chaining
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
  asyncOptions(
    optionsLoader: () => Promise<FilterOption[]>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: string[]) => boolean | string;
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
  ): this {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      loadingPlaceholder = 'Loading options...',
      maxSelections,
      minSelections,
    } = config;

    const filterConfig: FilterConfig<string[]> = {
      operators: [
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ],
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };
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
    return this;
  }

  /**
   * Configure as tags column.
   *
   * Sets up the column for tag-based multi-selection with optional
   * tag creation and count display capabilities.
   *
   * @param tags - Array of available tag options
   * @param config - Tags configuration settings
   * @returns This builder instance for method chaining
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
  tags(
    tags: FilterOption[],
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
  ): this {
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
      maxSelections: maxTags,
      minSelections: minTags,
    });

    this.config.meta = {
      ...this.config.meta,
      tags: {
        allowCreate,
        showCount: true,
      },
    };
    return this;
  }

  /**
   * Configure as categories column (hierarchical)
   */
  categories(
    categories: FilterOption[],
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
  ): this {
    const { includeNull = false, searchable = true, showHierarchy = true, maxCategories } = config;

    this.options(categories, {
      includeNull,
      searchable,
      maxSelections: maxCategories,
    });

    this.config.meta = {
      ...this.config.meta,
      categories: {
        showHierarchy,
        showIcons: true,
      },
    };
    return this;
  }

  /**
   * Configure as roles/permissions column
   */
  roles(
    roles: FilterOption[],
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
  ): this {
    const { includeNull = false, searchable = true, showDescriptions = true, maxRoles } = config;

    this.options(roles, { includeNull, searchable, maxSelections: maxRoles });

    this.config.meta = {
      ...this.config.meta,
      roles: {
        showDescriptions,
        showBadges: true,
      },
    };
    return this;
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
