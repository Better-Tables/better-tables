import React, { useState, useEffect, useCallback } from 'react';
import type { TextFilterInputProps } from './types';
import { useDebounce } from '../../hooks';

/**
 * Basic text filter input component
 */
export const TextFilterInput: React.FC<TextFilterInputProps> = ({
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
  debounce = 300,
  showCaseSensitive = false,
  caseSensitive = false,
  onCaseSensitiveChange,
  ...props
}) => {
  const [inputValue, setInputValue] = useState(values[0] || '');
  const [isCaseSensitive, setIsCaseSensitive] = useState(caseSensitive);

  // Debounce the input value
  const debouncedValue = useDebounce(inputValue, debounce);

  // Update parent when debounced value changes
  useEffect(() => {
    if (debouncedValue !== values[0]) {
      onValuesChange(debouncedValue ? [debouncedValue] : []);
    }
  }, [debouncedValue, values, onValuesChange]);

  // Update local state when values prop changes externally
  useEffect(() => {
    if (values[0] !== inputValue) {
      setInputValue(values[0] || '');
    }
  }, [values]);

  // Update case sensitivity
  useEffect(() => {
    setIsCaseSensitive(caseSensitive);
  }, [caseSensitive]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  }, []);

  const handleOperatorChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onOperatorChange(event.target.value as any);
    },
    [onOperatorChange],
  );

  const handleCaseSensitiveChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.checked;
      setIsCaseSensitive(newValue);
      onCaseSensitiveChange?.(newValue);
    },
    [onCaseSensitiveChange],
  );

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;

  // Base classes with theme overrides
  const containerClass =
    `filter-input filter-input--text ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
  const valueInputClass = `filter-input__value ${theme?.valueInput || ''}`.trim();
  const removeButtonClass = `filter-input__remove ${theme?.removeButton || ''}`.trim();
  const labelClass = `filter-input__label ${theme?.label || ''}`.trim();

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

      {/* Value Input */}
      {needsValue && (
        <input
          type="text"
          className={valueInputClass}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder || `Enter ${column.displayName.toLowerCase()}...`}
          disabled={disabled}
          aria-label={`Value for ${column.displayName}`}
        />
      )}

      {/* Case Sensitivity Toggle */}
      {showCaseSensitive && needsValue && (
        <label className="filter-input__case-sensitive">
          <input
            type="checkbox"
            checked={isCaseSensitive}
            onChange={handleCaseSensitiveChange}
            disabled={disabled}
          />
          <span>Case sensitive</span>
        </label>
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

export default TextFilterInput;
