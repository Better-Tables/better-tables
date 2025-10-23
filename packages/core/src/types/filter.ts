import type { ComponentType } from 'react';
import type { ColumnDefinition, ColumnType } from './column';
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
export interface FilterConfig<TValue = any> {
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
  meta?: Record<string, any>;
}

/**
 * Current filter state
 */
export interface FilterState {
  /** Column ID being filtered */
  columnId: string;

  /** Filter type */
  type: ColumnType;

  /** Filter operator */
  operator: FilterOperator;

  /** Filter values */
  values: unknown[];

  /** Whether to include null values */
  includeNull?: boolean;

  /** Filter metadata */
  meta?: Record<string, unknown>;
}

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
export interface FilterComponentProps<TValue = any> {
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
