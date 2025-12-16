'use client';

import { formatNumber, getFilterValueAsNumber, getFormattedPlaceholder, getNumberInputConfig, getNumberInputStep, parseFormattedNumber, validateNumberInput, type ColumnDefinition, type FilterState } from '@better-tables/core';
import * as React from 'react';
import { useFilterValidation } from '../../../hooks';

import { cn } from '../../../lib/utils';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export interface NumberFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Number filter input component
 *
 * Pattern: Controlled component with local UI state
 * - Data state comes from parent (filter.values)
 * - UI state (formatted input strings) managed locally
 * - Updates sent to parent only on blur or Enter key press
 * - Syncs from parent only when values actually change
 */
export function NumberFilterInput<TData = unknown>({
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

  // UI-only state: formatted strings for display
  const [values, setValues] = React.useState(() => {
    const val0 = getFilterValueAsNumber(filter, 0);
    const val1 = getFilterValueAsNumber(filter, 1);
    return {
      single: val0 !== null ? formatNumber(val0, numberConfig) : '',
      min: val0 !== null ? formatNumber(val0, numberConfig) : '',
      max: val1 !== null ? formatNumber(val1, numberConfig) : '',
    };
  });

  // Track if user is actively typing (prevents automatic sync to parent)
  const [isUserTyping, setIsUserTyping] = React.useState(false);

  const needsTwoValues = filter.operator === 'between' || filter.operator === 'notBetween';
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';

  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
    }
    const single = parseFormattedNumber(values.single, numberConfig);
    return single !== null ? [single] : [];
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

  // Commit the value to parent when user is done editing
  const commitValue = React.useCallback(() => {
    if (needsNoValues) {
      onChangeRef.current([]);
    } else if (needsTwoValues) {
      const min = parseFormattedNumber(values.min, numberConfig);
      const max = parseFormattedNumber(values.max, numberConfig);
      const newValues = [];
      if (min !== null) newValues.push(min);
      if (max !== null) newValues.push(max);
      onChangeRef.current(newValues);
    } else {
      const single = parseFormattedNumber(values.single, numberConfig);
      onChangeRef.current(single !== null ? [single] : []);
    }
    setIsUserTyping(false);
  }, [values, needsTwoValues, needsNoValues, numberConfig]);

  // Sync FROM parent when filter values change (only if not typing)
  // Only update if the values are actually different
  const externalVal0 = getFilterValueAsNumber(filter, 0);
  const externalVal1 = getFilterValueAsNumber(filter, 1);

  React.useEffect(() => {
    // Don't sync from parent while user is actively typing
    if (isUserTyping) return;

    const formattedSingle = externalVal0 !== null ? formatNumber(externalVal0, numberConfig) : '';
    const formattedMin = externalVal0 !== null ? formatNumber(externalVal0, numberConfig) : '';
    const formattedMax = externalVal1 !== null ? formatNumber(externalVal1, numberConfig) : '';

    // Only update if values changed to prevent loops
    setValues((prev) => {
      const needsUpdate =
        prev.single !== formattedSingle || prev.min !== formattedMin || prev.max !== formattedMax;

      return needsUpdate ? { single: formattedSingle, min: formattedMin, max: formattedMax } : prev;
    });
  }, [externalVal0, externalVal1, numberConfig, isUserTyping]);

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUserTyping(true);
    setValues((prev) => ({ ...prev, single: e.target.value }));
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUserTyping(true);
    setValues((prev) => ({ ...prev, min: e.target.value }));
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUserTyping(true);
    setValues((prev) => ({ ...prev, max: e.target.value }));
  };

  // Handle blur - commit the value
  const handleBlur = () => {
    commitValue();
  };

  // Handle Enter key - commit the value
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
    } else if (e.key === 'Escape') {
      // Clear current input on escape
      setValues((prev) => ({ ...prev, single: '', min: '', max: '' }));
      setIsUserTyping(false);
    }
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
            <Label htmlFor={`min-${filter.columnId}`} className="text-xs text-muted-foreground">
              Minimum {column.displayName}
            </Label>
            <Input
              id={`min-${filter.columnId}`}
              type="number"
              value={values.min}
              onChange={handleMinChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
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
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`max-${filter.columnId}`} className="text-xs text-muted-foreground">
              Maximum {column.displayName}
            </Label>
            <Input
              id={`max-${filter.columnId}`}
              type="number"
              value={values.max}
              onChange={handleMaxChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
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
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
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
      />
      {!finalValidation.isValid && finalValidation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{finalValidation.error}</p>
      )}
    </div>
  );
}
