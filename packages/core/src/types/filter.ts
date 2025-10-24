import type { ComponentType } from 'react';
import type { ColumnDefinition } from './column';
import type { IconComponent } from './common';

/**
 * Filter operators available for different column types
 * NOTE: This must stay in sync with centralized filter operator definitions
 * in filter-operators.ts. Tests ensure consistency.
 */
export type FilterOperator =
  // Text operators
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'

  // Number operators
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'notBetween'

  // Date operators
  | 'is'
  | 'isNot'
  | 'before'
  | 'after'
  | 'isToday'
  | 'isYesterday'
  | 'isThisWeek'
  | 'isThisMonth'
  | 'isThisYear'

  // Option operators
  | 'isAnyOf'
  | 'isNoneOf'

  // Multi-option operators
  | 'includes'
  | 'excludes'
  | 'includesAny'
  | 'includesAll'
  | 'excludesAny'
  | 'excludesAll'

  // Boolean operators
  | 'isTrue'
  | 'isFalse'

  // Universal operators (available for most types)
  | 'isNull'
  | 'isNotNull';

/**
 * Filter configuration for a column
 */
export interface FilterConfig<TValue = unknown> {
  /** Filter operators allowed for this column */
  operators?: FilterOperator[];

  /** Options for option/multiOption filters */
  options?: FilterOption[];

  /** Minimum value for number filters */
  min?: number;

  /** Maximum value for number filters */
  max?: number;

  /** Custom filter component */
  customComponent?: ComponentType<FilterComponentProps<TValue>>;

  /** Whether to include null/undefined values */
  includeNull?: boolean;

  /** Debounce delay for text filters */
  debounce?: number;

  /** Validation for filter values */
  validation?: (value: TValue) => boolean | string;

  /** Whether to include time component for date filters */
  includeTime?: boolean;

  /** Date format for date filters */
  format?: string;
}

/**
 * Filter option for select-based filters
 */
export interface FilterOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional color indicator */
  color?: string;
  /** Optional icon */
  icon?: IconComponent;
  /** Optional count */
  count?: number;
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Metadata for filter state
 */
export interface FilterMetadata {
  /** UI-specific metadata */
  ui?: {
    expanded?: boolean;
    pinned?: boolean;
    color?: string;
  };

  /** Validation metadata */
  validation?: {
    lastValidated?: number;
    isValid?: boolean;
  };

  /** Source of filter (user, preset, url, etc) */
  source?: 'user' | 'preset' | 'url' | 'api' | 'default';

  /** Allow extensions */
  [key: string]: unknown;
}

/**
 * Base filter state with common properties
 */
export interface BaseFilterState {
  /** Column ID being filtered */
  columnId: string;

  /** Filter operator */
  operator: FilterOperator;

  /** Whether to include null values */
  includeNull?: boolean;

  /** Filter metadata */
  meta?: FilterMetadata;
}

/**
 * Text filter state (text, email, url, phone)
 */
export interface TextFilterState extends BaseFilterState {
  type: 'text' | 'email' | 'url' | 'phone';
  values: string[];
}

/**
 * Number filter state (number, currency, percentage)
 */
export interface NumberFilterState extends BaseFilterState {
  type: 'number' | 'currency' | 'percentage';
  values: number[];
}

/**
 * Date filter state
 */
export interface DateFilterState extends BaseFilterState {
  type: 'date';
  values: (Date | string | number)[];
}

/**
 * Boolean filter state
 */
export interface BooleanFilterState extends BaseFilterState {
  type: 'boolean';
  values: boolean[];
}

/**
 * Option filter state (single select)
 */
export interface OptionFilterState extends BaseFilterState {
  type: 'option';
  values: string[];
}

/**
 * Multi-option filter state (multi-select)
 */
export interface MultiOptionFilterState extends BaseFilterState {
  type: 'multiOption';
  values: string[];
}

/**
 * JSON filter state
 */
export interface JsonFilterState extends BaseFilterState {
  type: 'json';
  values: (object | string)[];
}

/**
 * Custom filter state (fallback for custom types)
 */
export interface CustomFilterState extends BaseFilterState {
  type: 'custom';
  values: unknown[];
}

/**
 * Current filter state - discriminated union by type
 *
 * This discriminated union enables automatic type narrowing based on the `type` field.
 * When you check `filter.type`, TypeScript will automatically narrow the `values` type.
 *
 * @example
 * ```typescript
 * if (filter.type === 'number') {
 *   // TypeScript knows filter.values is number[]
 *   const value: number = filter.values[0];
 * }
 * ```
 */
export type FilterState =
  | TextFilterState
  | NumberFilterState
  | DateFilterState
  | BooleanFilterState
  | OptionFilterState
  | MultiOptionFilterState
  | JsonFilterState
  | CustomFilterState;

/**
 * Filter group for organizing filters
 */
export interface FilterGroup {
  /** Group identifier */
  id: string;

  /** Group display name */
  label: string;

  /** Group icon */
  icon?: IconComponent;

  /** Columns in this group */
  columns: string[];

  /** Whether group is collapsed by default */
  defaultCollapsed?: boolean;

  /** Group description */
  description?: string;
}

/**
 * Props for custom filter components
 */
export interface FilterComponentProps<TValue = unknown> {
  /** Current filter value */
  value: TValue[];
  /** Value change handler */
  onChange: (value: TValue[]) => void;
  /** Filter operator */
  operator: FilterOperator;
  /** Column definition */
  column: ColumnDefinition<unknown, TValue>;
  /** Theme configuration */
  theme?: Record<string, unknown>; // Will be TableTheme
}

/**
 * Filter operator definition
 */
export interface FilterOperatorDefinition<TOperator extends string = FilterOperator> {
  /** Operator key */
  key: TOperator;

  /** Display label */
  label: string;

  /** Description */
  description?: string;

  /** Number of values required */
  valueCount: number | 'variable';

  /** Whether operator supports null values */
  supportsNull?: boolean;

  /** Validation function */
  validate?: (values: unknown[]) => boolean | string;

  /** Custom input component */
  inputComponent?: ComponentType<FilterInputProps>;
}

/**
 * Props for filter input components
 */
export interface FilterInputProps<TValue = unknown> {
  /** Current value */
  value: TValue[];
  /** Change handler */
  onChange: (value: TValue[]) => void;
  /** Operator */
  operator: FilterOperator;
  /** Column definition */
  column: ColumnDefinition<unknown, TValue>;
  /** Theme */
  theme?: Record<string, unknown>; // Will be TableTheme
}
