import type { ColumnType } from '../types/column';
import type {
  BooleanFilterState,
  CustomFilterState,
  DateFilterState,
  FilterState,
  JsonFilterState,
  MultiOptionFilterState,
  NumberFilterState,
  OptionFilterState,
  TextFilterState,
} from '../types/filter';

/**
 * Type guard for text filter states (text, email, url, phone)
 */
export function isTextFilterState(filter: FilterState): filter is TextFilterState {
  return ['text', 'email', 'url', 'phone'].includes(filter.type);
}

/**
 * Type guard for number filter states (number, currency, percentage)
 */
export function isNumberFilterState(filter: FilterState): filter is NumberFilterState {
  return ['number', 'currency', 'percentage'].includes(filter.type);
}

/**
 * Type guard for date filter states
 */
export function isDateFilterState(filter: FilterState): filter is DateFilterState {
  return filter.type === 'date';
}

/**
 * Type guard for boolean filter states
 */
export function isBooleanFilterState(filter: FilterState): filter is BooleanFilterState {
  return filter.type === 'boolean';
}

/**
 * Type guard for option filter states
 */
export function isOptionFilterState(filter: FilterState): filter is OptionFilterState {
  return filter.type === 'option';
}

/**
 * Type guard for multi-option filter states
 */
export function isMultiOptionFilterState(filter: FilterState): filter is MultiOptionFilterState {
  return filter.type === 'multiOption';
}

/**
 * Type guard for JSON filter states
 */
export function isJsonFilterState(filter: FilterState): filter is JsonFilterState {
  return filter.type === 'json';
}

/**
 * Type guard for custom filter states
 */
export function isCustomFilterState(filter: FilterState): filter is CustomFilterState {
  return filter.type === 'custom';
}

/**
 * Assert filter values match expected type
 * @throws {Error} If filter type doesn't match expected type
 */
export function assertFilterValueType<T>(
  filter: FilterState,
  expectedType: ColumnType
): filter is FilterState & { values: T[] } {
  if (filter.type !== expectedType) {
    throw new Error(`Expected filter type ${expectedType}, got ${filter.type}`);
  }
  return true;
}

/**
 * Check if a value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if a value can be converted to a Date
 */
export function isDateLike(value: unknown): value is Date | string | number {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}
