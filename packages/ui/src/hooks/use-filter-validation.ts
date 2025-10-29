import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { validateOperatorValues } from '@better-tables/core';
import { useMemo } from 'react';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export interface UseFilterValidationOptions<TData = unknown> {
  /** Current filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData, unknown>;
  /** Values to validate */
  values: unknown[];
  /** Whether to validate immediately */
  immediate?: boolean;
}

/**
 * Hook for validating filter values against operator and column requirements
 */
export function useFilterValidation<TData = unknown>({
  filter,
  column,
  values,
  immediate = true,
}: UseFilterValidationOptions<TData>): ValidationResult {
  // Memoize expensive calculations
  const isNumericType = useMemo(
    () => column.type === 'number' || column.type === 'currency' || column.type === 'percentage',
    [column.type]
  );

  const isOptionType = useMemo(
    () => column.type === 'option' || column.type === 'multiOption',
    [column.type]
  );

  const validOptions = useMemo(
    () => column.filter?.options?.map((opt) => opt.value) || [],
    [column.filter?.options]
  );

  return useMemo(() => {
    // Skip validation if not immediate
    if (!immediate) {
      return { isValid: true };
    }

    // Validate against operator requirements
    const operatorValidation = validateOperatorValues(filter.operator, values, column.type);
    if (operatorValidation !== true) {
      return {
        isValid: false,
        error:
          typeof operatorValidation === 'string'
            ? operatorValidation
            : 'Invalid values for this operator',
      };
    }

    // Validate against column-specific validation
    if (column.filter?.validation) {
      for (const value of values) {
        const result = column.filter.validation(value);
        if (result !== true) {
          return {
            isValid: false,
            error: typeof result === 'string' ? result : 'Invalid value',
          };
        }
      }
    }

    // Validate against column constraints (e.g., min/max for numbers)
    if (isNumericType) {
      const numericValues = values.filter((v) => typeof v === 'number');

      if (column.filter?.min !== undefined) {
        const belowMin = numericValues.filter((v) => v < (column.filter?.min ?? 0));
        if (belowMin.length > 0) {
          return {
            isValid: false,
            error: `Value must be at least ${column.filter.min}`,
          };
        }
      }

      if (column.filter?.max !== undefined) {
        const aboveMax = numericValues.filter((v) => v > (column.filter?.max ?? 0));
        if (aboveMax.length > 0) {
          return {
            isValid: false,
            error: `Value must be at most ${column.filter.max}`,
          };
        }
      }
    }

    // Validate options for option/multiOption filters
    if (isOptionType && validOptions.length > 0) {
      const invalidValues = values.filter((v) => !validOptions.includes(v as string));

      if (invalidValues.length > 0) {
        return {
          isValid: false,
          error: `Invalid option: ${invalidValues[0]}`,
        };
      }
    }

    return { isValid: true };
  }, [filter.operator, values, column, immediate, isNumericType, isOptionType, validOptions]);
}
