import type { FilterState } from '@/types';
import { isDateFilterState, isNumberFilterState, isTextFilterState, isValidDate } from '@/utils';

/**
 * Safely get filter value as string
 */
export function getFilterValueAsString(filter: FilterState, index: number): string | null {
  if (!isTextFilterState(filter)) return null;
  const value = filter.values[index];
  return typeof value === 'string' ? value : null;
}

/**
 * Safely get filter value as number
 */
export function getFilterValueAsNumber(filter: FilterState, index: number): number | null {
  if (!isNumberFilterState(filter)) return null;
  const value = filter.values[index];
  return typeof value === 'number' ? value : null;
}

/**
 * Safely get filter value as date
 */
export function getFilterValueAsDate(filter: FilterState, index: number): Date | null {
  if (!isDateFilterState(filter)) return null;
  const value = filter.values[index];

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  return null;
}
