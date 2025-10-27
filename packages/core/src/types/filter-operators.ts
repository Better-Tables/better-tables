import type { ColumnType } from './column';
import type { FilterOperator, FilterOperatorDefinition } from './filter';

/**
 * Text filter operators with validation
 */
const TEXT_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'contains',
    label: 'Contains',
    description: 'Includes this text',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'string',
  },
  {
    key: 'equals',
    label: 'Equals',
    description: 'Exact match',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null,
  },
  {
    key: 'startsWith',
    label: 'Starts with',
    description: 'Begins with this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'string',
  },
  {
    key: 'endsWith',
    label: 'Ends with',
    description: 'Finishes with this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'string',
  },
  {
    key: 'isEmpty',
    label: 'Is empty',
    description: 'Blank or null',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotEmpty',
    label: 'Is not empty',
    description: 'Has content',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Number filter operators with validation
 */
const NUMBER_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'equals',
    label: 'Equals',
    description: 'Exact match',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null,
  },
  {
    key: 'notEquals',
    label: 'Not equals',
    description: "Doesn't match",
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'number',
  },
  {
    key: 'greaterThan',
    label: 'Greater than',
    description: 'More than this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'number',
  },
  {
    key: 'greaterThanOrEqual',
    label: 'Greater than or equal',
    description: 'At least this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'number',
  },
  {
    key: 'lessThan',
    label: 'Less than',
    description: 'Under this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'number',
  },
  {
    key: 'lessThanOrEqual',
    label: 'Less than or equal',
    description: 'At most this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'number',
  },
  {
    key: 'between',
    label: 'Between',
    description: 'Between two values',
    valueCount: 2,
    supportsNull: false,
    validate: (values) => {
      if (values.length !== 2) return false;
      if (!values.every((v) => typeof v === 'number')) return false;
      return values[0] <= values[1]; // Allow equal values for between
    },
  },
  {
    key: 'notBetween',
    label: 'Not between',
    description: 'Outside this range',
    valueCount: 2,
    supportsNull: false,
    validate: (values) => {
      if (values.length !== 2) return false;
      if (!values.every((v) => typeof v === 'number')) return false;
      return values[0] <= values[1]; // Allow equal values for not between
    },
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No value set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Has a value',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Date filter operators with validation
 */
const DATE_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'is',
    label: 'Is',
    description: 'Exact date match',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] instanceof Date,
  },
  {
    key: 'isNot',
    label: 'Is not',
    description: 'Any except this',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] instanceof Date,
  },
  {
    key: 'before',
    label: 'Before',
    description: 'Earlier than',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] instanceof Date,
  },
  {
    key: 'after',
    label: 'After',
    description: 'Later than',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] instanceof Date,
  },
  {
    key: 'between',
    label: 'Between',
    description: 'Between two dates',
    valueCount: 2,
    supportsNull: false,
    validate: (values) => {
      if (values.length !== 2) return false;
      if (!values.every((v) => v instanceof Date)) return false;
      return values[0] <= values[1]; // Allow same date for between
    },
  },
  {
    key: 'notBetween',
    label: 'Not between',
    description: 'Outside date range',
    valueCount: 2,
    supportsNull: false,
    validate: (values) => {
      if (values.length !== 2) return false;
      if (!values.every((v) => v instanceof Date)) return false;
      return values[0] <= values[1]; // Allow same date for not between
    },
  },
  {
    key: 'isToday',
    label: 'Is today',
    description: 'Current day',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isYesterday',
    label: 'Is yesterday',
    description: 'Previous day',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isThisWeek',
    label: 'Is this week',
    description: 'Current week',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isThisMonth',
    label: 'Is this month',
    description: 'Current month',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isThisYear',
    label: 'Is this year',
    description: 'Current year',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No date set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Date exists',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Option filter operators with validation
 */
const OPTION_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'is',
    label: 'Is',
    description: 'Matches option',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null && values[0] !== '',
  },
  {
    key: 'isNot',
    label: 'Is not',
    description: 'Excludes option',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null && values[0] !== '',
  },
  {
    key: 'isAnyOf',
    label: 'Is any of',
    description: 'Matches any selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'isNoneOf',
    label: 'Is none of',
    description: 'Excludes all selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No option set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Option selected',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Multi-option filter operators with validation
 */
const MULTI_OPTION_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'includes',
    label: 'Includes',
    description: 'Contains value',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null,
  },
  {
    key: 'excludes',
    label: 'Excludes',
    description: 'Missing value',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null,
  },
  {
    key: 'includesAny',
    label: 'Includes any',
    description: 'Contains any selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'includesAll',
    label: 'Includes all',
    description: 'Contains all selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'excludesAny',
    label: 'Excludes any',
    description: 'Missing any selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'excludesAll',
    label: 'Excludes all',
    description: 'Missing all selected',
    valueCount: 'variable',
    supportsNull: false,
    validate: (values) => values.length >= 1 && values.every((v) => v != null),
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No values set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Has values',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Boolean filter operators with validation
 */
const BOOLEAN_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'isTrue',
    label: 'Is true',
    description: 'Checked/enabled',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isFalse',
    label: 'Is false',
    description: 'Unchecked/disabled',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No value set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Has value',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * JSON filter operators with validation
 */
const JSON_OPERATORS: FilterOperatorDefinition[] = [
  {
    key: 'contains',
    label: 'Contains',
    description: 'Includes text',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'string',
  },
  {
    key: 'equals',
    label: 'Equals',
    description: 'Exact match',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && values[0] != null,
  },
  {
    key: 'isEmpty',
    label: 'Is empty',
    description: 'Empty object/array',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotEmpty',
    label: 'Is not empty',
    description: 'Has data',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'No value set',
    valueCount: 0,
    supportsNull: true,
    validate: (values) => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Has value',
    valueCount: 0,
    supportsNull: false,
    validate: (values) => values.length === 0,
  },
];

/**
 * Centralized filter operators registry by column type
 */
export const FILTER_OPERATORS: Record<ColumnType, FilterOperatorDefinition[]> = {
  // Text-based columns
  text: TEXT_OPERATORS,
  url: TEXT_OPERATORS,
  email: TEXT_OPERATORS,
  phone: TEXT_OPERATORS,

  // Number-based columns
  number: NUMBER_OPERATORS,
  currency: NUMBER_OPERATORS,
  percentage: NUMBER_OPERATORS,

  // Date columns
  date: DATE_OPERATORS,

  // Option columns
  option: OPTION_OPERATORS,
  multiOption: MULTI_OPTION_OPERATORS,

  // Boolean columns
  boolean: BOOLEAN_OPERATORS,

  // Complex data types
  json: JSON_OPERATORS,
  custom: [], // User-defined operators
};

/**
 * Get all available operators for a column type
 */
export function getOperatorsForType(type: ColumnType): FilterOperatorDefinition[] {
  return FILTER_OPERATORS[type] || [];
}

/**
 * Get a specific operator definition by key
 */
export function getOperatorDefinition(
  operator: FilterOperator
): FilterOperatorDefinition | undefined {
  for (const operators of Object.values(FILTER_OPERATORS)) {
    const found = operators.find((op) => op.key === operator);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get default operators for a column type (most commonly used)
 */
export function getDefaultOperatorsForType(type: ColumnType): FilterOperator[] {
  switch (type) {
    case 'text':
    case 'url':
    case 'email':
    case 'phone':
      return ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];

    case 'number':
    case 'currency':
    case 'percentage':
      return [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
      ];

    case 'date':
      return [
        'is',
        'isNot',
        'before',
        'after',
        'isToday',
        'isYesterday',
        'isThisWeek',
        'isThisMonth',
        'isThisYear',
      ];

    case 'boolean':
      return ['isTrue', 'isFalse', 'isNull', 'isNotNull'];

    case 'option':
      return ['is', 'isNot', 'isAnyOf', 'isNoneOf'];

    case 'multiOption':
      return ['includes', 'excludes', 'includesAny', 'includesAll', 'excludesAny', 'excludesAll'];

    case 'json':
      return ['contains', 'equals', 'isEmpty', 'isNotEmpty'];

    case 'custom':
      return ['equals', 'notEquals', 'isNull', 'isNotNull'];

    default:
      return ['equals', 'notEquals', 'isNull', 'isNotNull'];
  }
}

/**
 * Validate operator values according to operator definition
 */
export function validateOperatorValues(
  operator: FilterOperator,
  values: unknown[]
): boolean | string {
  const definition = getOperatorDefinition(operator);
  if (!definition) {
    return 'Unknown operator';
  }

  // First check basic value count validation
  if (definition.valueCount === 0) {
    if (values.length !== 0) {
      return 'This operator requires no values';
    }
  } else if (typeof definition.valueCount === 'number') {
    if (values.length !== definition.valueCount) {
      return `This operator requires exactly ${definition.valueCount} value(s)`;
    }
  } else if (definition.valueCount === 'variable') {
    if (values.length < 1) {
      return 'This operator requires at least one value';
    }
  }

  // Then run custom validation if available
  if (definition.validate) {
    const result = definition.validate(values);
    if (result === false) {
      return 'Invalid values for this operator';
    }
    return result;
  }

  return true;
}

/**
 * Create a new operator definition registry
 */
export function createOperatorRegistry(
  operators: FilterOperatorDefinition[]
): Map<FilterOperator, FilterOperatorDefinition> {
  const registry = new Map<FilterOperator, FilterOperatorDefinition>();
  for (const op of operators) {
    registry.set(op.key, op);
  }
  return registry;
}

/**
 * Get all operators as a flat array (deduplicated)
 */
export function getAllOperators(): FilterOperatorDefinition[] {
  const allOperators = Object.values(FILTER_OPERATORS).flat();
  const operatorMap = new Map<FilterOperator, FilterOperatorDefinition>();

  // Deduplicate by operator key
  for (const op of allOperators) {
    operatorMap.set(op.key, op);
  }

  return Array.from(operatorMap.values());
}

/**
 * Extract all filter operator keys as a union type
 * This ensures FilterOperator type stays in sync with our definitions
 */
type ExtractOperatorKeys<T> = T extends readonly { key: infer K }[] ? K : never;

type AllOperatorKeys =
  | ExtractOperatorKeys<typeof TEXT_OPERATORS>
  | ExtractOperatorKeys<typeof NUMBER_OPERATORS>
  | ExtractOperatorKeys<typeof DATE_OPERATORS>
  | ExtractOperatorKeys<typeof OPTION_OPERATORS>
  | ExtractOperatorKeys<typeof MULTI_OPTION_OPERATORS>
  | ExtractOperatorKeys<typeof BOOLEAN_OPERATORS>
  | ExtractOperatorKeys<typeof JSON_OPERATORS>;

/**
 * All available filter operators (auto-generated from centralized definitions)
 */
export type FilterOperatorKey = AllOperatorKeys;

export {
  TEXT_OPERATORS,
  NUMBER_OPERATORS,
  DATE_OPERATORS,
  OPTION_OPERATORS,
  MULTI_OPTION_OPERATORS,
  BOOLEAN_OPERATORS,
  JSON_OPERATORS,
};
