import type { ReactNode } from 'react';
import type { 
  FilterOperator, 
  FilterState, 
  FilterOption,
  FilterOperatorDefinition 
} from '../../types/filter';
import type { ColumnDefinition } from '../../types/column';

/**
 * Base props for all filter input components
 */
export interface BaseFilterInputProps<TValue = any> {
  /** Current filter state */
  filter: FilterState;
  
  /** Column definition */
  column: ColumnDefinition<any, TValue>;
  
  /** Available operators for this column */
  operators: FilterOperatorDefinition[];
  
  /** Current selected operator */
  operator: FilterOperator;
  
  /** Current filter values */
  values: TValue[];
  
  /** Callback when operator changes */
  onOperatorChange: (operator: FilterOperator) => void;
  
  /** Callback when values change */
  onValuesChange: (values: TValue[]) => void;
  
  /** Callback when filter is removed */
  onRemove: () => void;
  
  /** Whether the filter is disabled */
  disabled?: boolean;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Custom theme/styling */
  theme?: FilterInputTheme;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Whether to show the remove button */
  showRemove?: boolean;
  
  /** Additional props for custom implementations */
  [key: string]: any;
}

/**
 * Theme configuration for filter inputs
 */
export interface FilterInputTheme {
  /** Container styling */
  container?: string;
  
  /** Operator selector styling */
  operatorSelect?: string;
  
  /** Value input styling */
  valueInput?: string;
  
  /** Remove button styling */
  removeButton?: string;
  
  /** Label styling */
  label?: string;
  
  /** Error styling */
  error?: string;
  
  /** Focus styling */
  focus?: string;
  
  /** Disabled styling */
  disabled?: string;
}

/**
 * Text filter input props
 */
export interface TextFilterInputProps extends BaseFilterInputProps<string> {
  /** Debounce delay for text input */
  debounce?: number;
  
  /** Whether to show case sensitivity toggle */
  showCaseSensitive?: boolean;
  
  /** Case sensitivity setting */
  caseSensitive?: boolean;
  
  /** Callback when case sensitivity changes */
  onCaseSensitiveChange?: (caseSensitive: boolean) => void;
}

/**
 * Number filter input props
 */
export interface NumberFilterInputProps extends BaseFilterInputProps<number> {
  /** Minimum value */
  min?: number;
  
  /** Maximum value */
  max?: number;
  
  /** Step value */
  step?: number;
  
  /** Number format (currency, percentage, etc.) */
  format?: 'number' | 'currency' | 'percentage';
  
  /** Currency symbol */
  currency?: string;
  
  /** Number of decimal places */
  decimals?: number;
}

/**
 * Date filter input props
 */
export interface DateFilterInputProps extends BaseFilterInputProps<Date> {
  /** Date format for display */
  format?: string;
  
  /** Minimum date */
  minDate?: Date;
  
  /** Maximum date */
  maxDate?: Date;
  
  /** Whether to show time picker */
  showTime?: boolean;
  
  /** Time format */
  timeFormat?: string;
  
  /** Date picker locale */
  locale?: string;
  
  /** Predefined date ranges */
  presets?: DatePreset[];
}

/**
 * Date preset configuration
 */
export interface DatePreset {
  /** Preset key */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Date range */
  range: {
    start: Date;
    end: Date;
  };
  
  /** Whether this is a relative preset */
  relative?: boolean;
}

/**
 * Option filter input props
 */
export interface OptionFilterInputProps extends BaseFilterInputProps<string> {
  /** Available options */
  options: FilterOption[];
  
  /** Whether to allow searching options */
  searchable?: boolean;
  
  /** Whether to show option counts */
  showCounts?: boolean;
  
  /** Whether to allow creating new options */
  creatable?: boolean;
  
  /** Maximum number of visible options */
  maxVisibleOptions?: number;
  
  /** Option loading state */
  loading?: boolean;
  
  /** Callback to load more options */
  onLoadMore?: () => void;
  
  /** Custom option renderer */
  optionRenderer?: (option: FilterOption) => ReactNode;
}

/**
 * Multi-option filter input props
 */
export interface MultiOptionFilterInputProps extends BaseFilterInputProps<string> {
  /** Available options */
  options: FilterOption[];
  
  /** Whether to allow searching options */
  searchable?: boolean;
  
  /** Whether to show option counts */
  showCounts?: boolean;
  
  /** Whether to allow creating new options */
  creatable?: boolean;
  
  /** Maximum number of visible options */
  maxVisibleOptions?: number;
  
  /** Maximum number of selected options */
  maxSelectedOptions?: number;
  
  /** Option loading state */
  loading?: boolean;
  
  /** Callback to load more options */
  onLoadMore?: () => void;
  
  /** Custom option renderer */
  optionRenderer?: (option: FilterOption) => ReactNode;
  
  /** Custom selected option renderer */
  selectedOptionRenderer?: (option: FilterOption) => ReactNode;
}

/**
 * Boolean filter input props
 */
export interface BooleanFilterInputProps extends BaseFilterInputProps<boolean> {
  /** Label for true value */
  trueLabel?: string;
  
  /** Label for false value */
  falseLabel?: string;
  
  /** Label for null value */
  nullLabel?: string;
  
  /** Whether to show indeterminate state */
  showIndeterminate?: boolean;
}

/**
 * Filter input component type definitions
 */
export type FilterInputComponent<TProps = BaseFilterInputProps> = React.ComponentType<TProps>;

/**
 * Filter input component registry
 */
export interface FilterInputComponents {
  /** Text filter input component */
  text: FilterInputComponent<TextFilterInputProps>;
  
  /** Number filter input component */
  number: FilterInputComponent<NumberFilterInputProps>;
  
  /** Date filter input component */
  date: FilterInputComponent<DateFilterInputProps>;
  
  /** Option filter input component */
  option: FilterInputComponent<OptionFilterInputProps>;
  
  /** Multi-option filter input component */
  multiOption: FilterInputComponent<MultiOptionFilterInputProps>;
  
  /** Boolean filter input component */
  boolean: FilterInputComponent<BooleanFilterInputProps>;
}

/**
 * Filter input configuration
 */
export interface FilterInputConfig {
  /** Custom filter input components */
  components?: Partial<FilterInputComponents>;
  
  /** Default theme */
  theme?: FilterInputTheme;
  
  /** Default debounce delay */
  debounce?: number;
  
  /** Default date format */
  dateFormat?: string;
  
  /** Default locale */
  locale?: string;
  
  /** Whether to show remove buttons by default */
  showRemove?: boolean;
  
  /** Custom validation messages */
  validationMessages?: Record<string, string>;
}

/**
 * Filter input validation result
 */
export interface FilterInputValidationResult {
  /** Whether the input is valid */
  valid: boolean;
  
  /** Error message if invalid */
  error?: string;
  
  /** Warning message if applicable */
  warning?: string;
}

/**
 * Filter input event handlers
 */
export interface FilterInputEventHandlers {
  /** Called when input value changes */
  onChange?: (values: any[]) => void;
  
  /** Called when operator changes */
  onOperatorChange?: (operator: FilterOperator) => void;
  
  /** Called when input gains focus */
  onFocus?: () => void;
  
  /** Called when input loses focus */
  onBlur?: () => void;
  
  /** Called when filter is removed */
  onRemove?: () => void;
  
  /** Called when validation fails */
  onValidationError?: (error: string) => void;
}

/**
 * Filter input state
 */
export interface FilterInputState {
  /** Current values */
  values: any[];
  
  /** Current operator */
  operator: FilterOperator;
  
  /** Whether input is focused */
  focused: boolean;
  
  /** Whether input is disabled */
  disabled: boolean;
  
  /** Current validation state */
  validation: FilterInputValidationResult;
  
  /** Whether input is loading */
  loading: boolean;
} 