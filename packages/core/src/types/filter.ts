import type { ComponentType } from 'react';
import type { ColumnDefinition } from './column';
import type { IconComponent } from './common';
import type {
  BooleanFilterOperator,
  DateFilterOperator,
  JsonFilterOperator,
  MultiOptionFilterOperator,
  NumberFilterOperator,
  OptionFilterOperator,
  TextFilterOperator,
} from './filter-operators';

/**
 * Filter operators available across all column types (the flat union).
 * NOTE: This must stay in sync with centralized filter operator definitions
 * in filter-operators.ts -- `filter-operators.test.ts`'s "Type Safety" suite
 * asserts `FilterOperator` equals the union of every `*_OPERATORS` array's
 * derived keys (`FilterOperatorKey`). Per-type `FilterState` members
 * (`TextFilterState`, `NumberFilterState`, ...) do NOT use this flat union
 * for their `operator` field -- they use the narrower, DERIVED
 * `TextFilterOperator`/`NumberFilterOperator`/etc. from `filter-operators.ts`
 * (plan 031 Step 1), so a wrong operator for a column type is a compile
 * error. This flat union remains useful as the "any legal operator, don't
 * care which type" type (e.g. `CustomFilterState.operator`, adapter
 * `supportedOperators: Record<ColumnType, FilterOperator[]>`).
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
 *
 * @template V - The literal type of the option's `value` (defaults to `string`,
 * which keeps every existing non-generic usage compiling unchanged). Passing a
 * `const`-inferred array of options to `OptionColumnBuilder.options()` /
 * `MultiOptionColumnBuilder.options()` narrows `V` to the literal union of the
 * option values, so it flows through to the column's value type.
 */
export interface FilterOption<V extends string = string> {
  /** Option value */
  value: V;
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
 *
 * `operator` is narrowed to {@link TextFilterOperator} (plan 031 Step 1,
 * finding 8) -- derived from `TEXT_OPERATORS` in `filter-operators.ts`, the
 * single source of truth. `{ type: 'text', operator: 'isAnyOf' }` (an
 * option-only operator) is now a COMPILE error instead of a runtime-only
 * validation failure.
 */
export interface TextFilterState extends BaseFilterState {
  type: 'text' | 'email' | 'url' | 'phone';
  operator: TextFilterOperator;
  values: string[];
}

/**
 * Number filter state (number, currency, percentage)
 */
export interface NumberFilterState extends BaseFilterState {
  type: 'number' | 'currency' | 'percentage';
  operator: NumberFilterOperator;
  values: number[];
}

/**
 * Date filter state
 */
export interface DateFilterState extends BaseFilterState {
  type: 'date';
  operator: DateFilterOperator;
  values: (Date | string | number)[];
}

/**
 * Boolean filter state
 */
export interface BooleanFilterState extends BaseFilterState {
  type: 'boolean';
  operator: BooleanFilterOperator;
  values: boolean[];
}

/**
 * Option filter state (single select)
 */
export interface OptionFilterState extends BaseFilterState {
  type: 'option';
  operator: OptionFilterOperator;
  values: string[];
}

/**
 * Multi-option filter state (multi-select)
 */
export interface MultiOptionFilterState extends BaseFilterState {
  type: 'multiOption';
  operator: MultiOptionFilterOperator;
  values: string[];
}

/**
 * JSON filter state
 */
export interface JsonFilterState extends BaseFilterState {
  type: 'json';
  operator: JsonFilterOperator;
  values: (object | string)[];
}

/**
 * Custom filter state (fallback for custom types)
 *
 * `operator` stays the flat {@link FilterOperator} union -- `custom` has no
 * fixed operator set in `filter-operators.ts` (`FILTER_OPERATORS.custom` is
 * `[]`; operators are user-defined per column via `FilterConfig.operators`),
 * so there is nothing narrower to derive.
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
 * Boolean combinator for a {@link FilterGroupNode}. Deliberately just
 * `'and' | 'or'` -- anything else (e.g. `'xor'`) is a compile error, and
 * unknown logic is a runtime drop (see `isFilterNodeShape` /
 * `normalizeFilterNode` in `utils/type-guards.ts`).
 */
export type FilterGroupLogic = 'and' | 'or';

/**
 * A boolean AND/OR node over other {@link FilterNode}s -- the recursive
 * filter-group tree ("contract v2", `plans/design/core-contract-v2.md` §1.1).
 *
 * Named `FilterGroupNode`, **not** `FilterGroup` -- to avoid colliding with
 * {@link FilterGroup} below, which is UI control grouping (grouping filter
 * *controls* by column for display), not boolean logic. Do not conflate the
 * two.
 *
 * `kind: 'group'` is the discriminant: no `FilterState` member has a
 * top-level `kind` field, so a node is a group iff `kind === 'group'`.
 */
export interface FilterGroupNode {
  /** Discriminant. No `FilterState` leaf has a top-level `kind`. */
  kind: 'group';
  /** How this group combines its children. */
  logic: FilterGroupLogic;
  /** Non-empty after validation; an empty/singleton group is normalized away. */
  children: FilterNode[];
}

/**
 * The recursive filter tree: a leaf {@link FilterState} or a boolean
 * {@link FilterGroupNode}. A bare `FilterState[]` (implicit AND) and a
 * single `FilterGroupNode` are the two shapes `FetchDataParams.filters`
 * accepts (design §1.1); `FilterNode` is the shared per-node type both
 * eventually canonicalize to.
 */
export type FilterNode = FilterState | FilterGroupNode;

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
