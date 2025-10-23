import type { FilterConfig, FilterOption } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Option column builder for single-select dropdown columns
 */
export class OptionColumnBuilder<TData = unknown> extends ColumnBuilder<TData, string> {
  constructor() {
    super('option');
  }

  /**
   * Set available options for the column
   */
  options(
    options: FilterOption[],
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for option values */
      validation?: (value: string) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
    } = {}
  ): this {
    const { includeNull = false, validation, searchable = true, placeholder } = config;

    const filterConfig: FilterConfig<string> = {
      operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf'],
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
      },
    };
    return this;
  }

  /**
   * Set specific option operators
   */
  optionOperators(operators: Array<'is' | 'isNot' | 'isAnyOf' | 'isNoneOf'>): this {
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
      validation?: (value: string) => boolean | string;
      /** Whether to allow searching through options (default: true) */
      searchable?: boolean;
      /** Placeholder text for the option selector */
      placeholder?: string;
      /** Loading placeholder text */
      loadingPlaceholder?: string;
    } = {}
  ): this {
    const {
      includeNull = false,
      validation,
      searchable = true,
      placeholder,
      loadingPlaceholder = 'Loading options...',
    } = config;

    const filterConfig: FilterConfig<string> = {
      operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf'],
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
      },
    };
    return this;
  }

  /**
   * Configure as status column with predefined status options
   */
  status(
    statuses: Array<{
      value: string;
      label: string;
      color: string;
    }>,
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Default status value */
      defaultValue?: string;
    } = {}
  ): this {
    const { includeNull = false, defaultValue } = config;

    const statusOptions: FilterOption[] = statuses.map((status) => ({
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
    return this;
  }

  /**
   * Configure as priority column with predefined priority options
   */
  priority(
    priorities: Array<{
      value: string;
      label: string;
      color: string;
      order: number;
    }> = [
      { value: 'low', label: 'Low', color: 'gray', order: 1 },
      { value: 'medium', label: 'Medium', color: 'yellow', order: 2 },
      { value: 'high', label: 'High', color: 'red', order: 3 },
    ],
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Default priority value */
      defaultValue?: string;
    } = {}
  ): this {
    const { includeNull = false, defaultValue } = config;

    const priorityOptions: FilterOption[] = priorities
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
    return this;
  }

  /**
   * Configure as category column
   */
  category(
    categories: FilterOption[],
    config: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Whether to allow searching through categories (default: true) */
      searchable?: boolean;
      /** Whether to show category icons (default: true) */
      showIcons?: boolean;
    } = {}
  ): this {
    const { includeNull = false, searchable = true, showIcons = true } = config;

    this.options(categories, { includeNull, searchable });

    this.config.meta = {
      ...this.config.meta,
      category: {
        showIcons,
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
