import React, { useState, useEffect, useCallback } from 'react';
import type { NumberFilterInputProps } from './types';
import { useDebounce } from '../../hooks/use-debounce';

/**
 * Basic number filter input component
 */
export const NumberFilterInput: React.FC<NumberFilterInputProps> = ({
  filter,
  column,
  operators,
  operator,
  values,
  onOperatorChange,
  onValuesChange,
  onRemove,
  disabled = false,
  className = '',
  theme,
  placeholder,
  showRemove = true,
  min,
  max,
  step = 1,
  format = 'number',
  currency = '$',
  decimals = 2,
  ...props
}) => {
  const [inputValues, setInputValues] = useState<string[]>(
    values.map(v => formatDisplayValue(v, format, currency, decimals)),
  );

  // Debounce the input values
  const debouncedValues = useDebounce(inputValues, 300);

  // Update parent when debounced values change
  useEffect(() => {
    const numericValues = debouncedValues
      .map(v => parseDisplayValue(v, format))
      .filter(v => !isNaN(v));

    if (JSON.stringify(numericValues) !== JSON.stringify(values)) {
      onValuesChange(numericValues);
    }
  }, [debouncedValues, values, onValuesChange, format]);

  // Update local state when values prop changes externally
  useEffect(() => {
    const displayValues = values.map(v => formatDisplayValue(v, format, currency, decimals));
    if (JSON.stringify(displayValues) !== JSON.stringify(inputValues)) {
      setInputValues(displayValues);
    }
  }, [values, format, currency, decimals]);

  const handleInputChange = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValues = [...inputValues];
      newValues[index] = event.target.value;
      setInputValues(newValues);
    },
    [inputValues],
  );

  const handleOperatorChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onOperatorChange(event.target.value as any);
    },
    [onOperatorChange],
  );

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;
  const valueCount =
    currentOperator?.valueCount === 'variable' ? 1 : currentOperator?.valueCount || 0;
  const needsRange = operator === 'between' || operator === 'notBetween';

  // Ensure we have the right number of input values
  const requiredInputs = needsRange ? 2 : valueCount;
  const currentInputs = Array.from({ length: requiredInputs }, (_, i) => inputValues[i] || '');

  // Base classes with theme overrides
  const containerClass =
    `filter-input filter-input--number ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
  const valueInputClass = `filter-input__value ${theme?.valueInput || ''}`.trim();
  const removeButtonClass = `filter-input__remove ${theme?.removeButton || ''}`.trim();
  const labelClass = `filter-input__label ${theme?.label || ''}`.trim();

  // Get input properties
  const inputType = format === 'number' ? 'number' : 'text';
  const inputMin = min;
  const inputMax = max;
  const inputStep = step;

  return (
    <div className={containerClass} {...props}>
      {/* Column Label */}
      <span className={labelClass}>{column.displayName}</span>

      {/* Operator Selector */}
      <select
        className={operatorSelectClass}
        value={operator}
        onChange={handleOperatorChange}
        disabled={disabled}
        aria-label={`Operator for ${column.displayName}`}
      >
        {operators.map(op => (
          <option key={op.key} value={op.key}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value Inputs */}
      {needsValue &&
        currentInputs.map((value, index) => (
          <React.Fragment key={index}>
            {index > 0 && needsRange && <span className="filter-input__range-separator">and</span>}
            <input
              type={inputType}
              className={valueInputClass}
              value={value}
              onChange={handleInputChange(index)}
              placeholder={
                placeholder ||
                (needsRange && index === 0
                  ? 'Min value'
                  : needsRange && index === 1
                    ? 'Max value'
                    : `Enter ${column.displayName.toLowerCase()}...`)
              }
              disabled={disabled}
              min={inputMin}
              max={inputMax}
              step={inputStep}
              aria-label={
                needsRange && index === 0
                  ? `Minimum ${column.displayName}`
                  : needsRange && index === 1
                    ? `Maximum ${column.displayName}`
                    : `Value for ${column.displayName}`
              }
            />
          </React.Fragment>
        ))}

      {/* Format Indicator */}
      {format !== 'number' && (
        <span className="filter-input__format">{format === 'currency' ? currency : '%'}</span>
      )}

      {/* Remove Button */}
      {showRemove && (
        <button
          type="button"
          className={removeButtonClass}
          onClick={handleRemove}
          disabled={disabled}
          aria-label={`Remove ${column.displayName} filter`}
          title="Remove filter"
        >
          ×
        </button>
      )}
    </div>
  );
};

/**
 * Format a numeric value for display
 */
function formatDisplayValue(
  value: number,
  format: 'number' | 'currency' | 'percentage',
  currency?: string,
  decimals?: number,
): string {
  if (isNaN(value)) return '';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percentage':
      return (value * 100).toFixed(decimals);
    default:
      return value.toString();
  }
}

/**
 * Parse a display value back to a number
 */
function parseDisplayValue(value: string, format: string): number {
  if (!value) return NaN;

  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));

  switch (format) {
    case 'percentage':
      return numericValue / 100;
    default:
      return numericValue;
  }
}

export default NumberFilterInput;
