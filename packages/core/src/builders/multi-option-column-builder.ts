import type { FilterConfig, FilterOption } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Multi-option column builder for multi-select columns
 */
export class MultiOptionColumnBuilder<TData = unknown> extends ColumnBuilder<TData, string[]> {
  constructor() {
    super('multiOption');
  }

  /**
   * Set available options for the multi-select column
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
   * Set specific multi-option operators
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
   * Load options from an async source
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
   * Configure as tags column
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
   * Set display format for multiple values
   */
  displayFormat(format: {
    /** How to display multiple values (default: 'chips') */
    type: 'chips' | 'comma' | 'count' | 'first';
    /** Maximum number of items to show before truncating (default: 3) */
    maxVisible?: number;
    /** Text to show when truncated (default: '+{count} more') */
    truncateText?: string;
    /** Whether to show tooltip with all values (default: true) */
    showTooltip?: boolean;
    /** Separator for comma format (default: ', ') */
    separator?: string;
  }): this {
    const {
      type = 'chips',
      maxVisible = 3,
      truncateText = '+{count} more',
      showTooltip = true,
      separator = ', ',
    } = format;

    this.config.meta = {
      ...this.config.meta,
      display: {
        type,
        maxVisible,
        truncateText,
        showTooltip,
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
        ...(this.config.meta?.display || {}),
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
