'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFilterValidation, useKeyboardNavigation } from '@/hooks';
import {
  formatNumber,
  getFormattedPlaceholder,
  getNumberInputConfig,
  getNumberInputStep,
  parseFormattedNumber,
  validateNumberInput,
} from '@/lib/number-format-utils';
import { cn } from '@/lib/utils';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import * as React from 'react';

export interface NumberFilterInputProps<TData = any> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: any[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function NumberFilterInput<TData = any>({
  filter,
  column,
  onChange,
  disabled = false,
}: NumberFilterInputProps<TData>) {
  // Get number input configuration from column
  const numberConfig = React.useMemo(
    () => getNumberInputConfig(column.type, column.meta),
    [column.type, column.meta]
  );

  const [values, setValues] = React.useState(() => {
    const filterValues = filter.values || [];
    return {
      single: filterValues[0] ? formatNumber(filterValues[0], numberConfig) : '',
      min: filterValues[0] ? formatNumber(filterValues[0], numberConfig) : '',
      max: filterValues[1] ? formatNumber(filterValues[1], numberConfig) : '',
    };
  });

  const needsTwoValues = filter.operator === 'between' || filter.operator === 'notBetween';
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';

  // Prepare values for validation
  const validationValues = React.useMemo(() => {
    if (needsNoValues) return [];
    if (needsTwoValues) {
      const min = parseFormattedNumber(values.min, numberConfig);
      const max = parseFormattedNumber(values.max, numberConfig);
      const validValues = [];
      if (min !== null) validValues.push(min);
      if (max !== null) validValues.push(max);
      return validValues;
    } else {
      const single = parseFormattedNumber(values.single, numberConfig);
      return single !== null ? [single] : [];
    }
  }, [values, needsTwoValues, needsNoValues, numberConfig]);

  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: validationValues,
    immediate: validationValues.length > 0 || needsNoValues,
  });

  // Additional number-specific validation
  const numberValidation = React.useMemo(() => {
    if (needsNoValues) return { isValid: true };

    if (needsTwoValues) {
      const minValidation = validateNumberInput(values.min, numberConfig);
      const maxValidation = validateNumberInput(values.max, numberConfig);

      if (!minValidation.isValid) return minValidation;
      if (!maxValidation.isValid) return maxValidation;

      // Check if min <= max
      const minNum = parseFormattedNumber(values.min, numberConfig);
      const maxNum = parseFormattedNumber(values.max, numberConfig);
      if (minNum !== null && maxNum !== null && minNum > maxNum) {
        return {
          isValid: false,
          error: 'Minimum value must be less than or equal to maximum value',
        };
      }
    } else {
      return validateNumberInput(values.single, numberConfig);
    }

    return { isValid: true };
  }, [values, needsNoValues, needsTwoValues, numberConfig]);

  // Combined validation
  const finalValidation = React.useMemo(() => {
    if (!validation.isValid) return validation;
    if (!numberValidation.isValid) return numberValidation;
    return { isValid: true };
  }, [validation, numberValidation]);

  // Update parent when values change
  React.useEffect(() => {
    if (needsNoValues) {
      onChange([]);
    } else if (needsTwoValues) {
      const min = parseFormattedNumber(values.min, numberConfig);
      const max = parseFormattedNumber(values.max, numberConfig);
      const newValues = [];
      if (min !== null) newValues.push(min);
      if (max !== null) newValues.push(max);
      onChange(newValues);
    } else {
      const single = parseFormattedNumber(values.single, numberConfig);
      onChange(single !== null ? [single] : []);
    }
  }, [values, onChange, needsTwoValues, needsNoValues, numberConfig]);

  // Sync local values when filter values change externally
  React.useEffect(() => {
    const filterValues = filter.values || [];
    setValues({
      single: filterValues[0] ? formatNumber(filterValues[0], numberConfig) : '',
      min: filterValues[0] ? formatNumber(filterValues[0], numberConfig) : '',
      max: filterValues[1] ? formatNumber(filterValues[1], numberConfig) : '',
    });
  }, [filter.values, numberConfig]);

  // Keyboard navigation
  const keyboardNavigation = useKeyboardNavigation({
    onEscape: () => {
      // Clear current input on escape
      setValues((prev) => ({ ...prev, single: '', min: '', max: '' }));
    },
  });

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, single: e.target.value }));
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, min: e.target.value }));
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, max: e.target.value }));
  };

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">This filter doesn't require a value.</div>
    );
  }

  if (needsTwoValues) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Min</Label>
            <Input
              type="number"
              value={values.min}
              onChange={handleMinChange}
              onKeyDown={keyboardNavigation.onKeyDown}
              placeholder={getFormattedPlaceholder({ ...numberConfig, placeholder: 'Min value' })}
              min={numberConfig.min}
              max={numberConfig.max}
              step={getNumberInputStep(numberConfig)}
              disabled={disabled}
              className={cn(
                !finalValidation.isValid &&
                  values.min &&
                  'border-destructive focus-visible:ring-destructive'
              )}
              {...keyboardNavigation.ariaAttributes}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Max</Label>
            <Input
              type="number"
              value={values.max}
              onChange={handleMaxChange}
              onKeyDown={keyboardNavigation.onKeyDown}
              placeholder={getFormattedPlaceholder({ ...numberConfig, placeholder: 'Max value' })}
              min={numberConfig.min}
              max={numberConfig.max}
              step={getNumberInputStep(numberConfig)}
              disabled={disabled}
              className={cn(
                !finalValidation.isValid &&
                  values.max &&
                  'border-destructive focus-visible:ring-destructive'
              )}
              {...keyboardNavigation.ariaAttributes}
            />
          </div>
        </div>
        {!finalValidation.isValid && finalValidation.error && validationValues.length > 0 && (
          <p className="text-sm text-destructive">{finalValidation.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Value</Label>
      <Input
        type="number"
        value={values.single}
        onChange={handleSingleChange}
        onKeyDown={keyboardNavigation.onKeyDown}
        placeholder={getFormattedPlaceholder(numberConfig)}
        min={numberConfig.min}
        max={numberConfig.max}
        step={getNumberInputStep(numberConfig)}
        disabled={disabled}
        className={cn(
          !finalValidation.isValid &&
            values.single &&
            'border-destructive focus-visible:ring-destructive'
        )}
        {...keyboardNavigation.ariaAttributes}
      />
      {!finalValidation.isValid && finalValidation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{finalValidation.error}</p>
      )}
    </div>
  );
}
